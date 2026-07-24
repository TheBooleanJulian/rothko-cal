#!/usr/bin/env python3
"""
backfill_calendar_categories.py

Reassigns past Google Calendar events to their correct category calendar
(per CALENDAR_COLORS.md) using keyword matching, with mandatory human
confirmation before any event is moved. Review happens in batches;
approved moves within a batch are then executed as a single Google
Calendar API batch request for efficiency.

Nothing is written to Google Calendar until you type 'a' (approve) or
edit+confirm a batch. Dry-run mode (default) never touches the API's
write endpoints regardless of what you approve — pass --apply to
actually move events.

Setup
-----
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib

1. In Google Cloud Console, enable the Calendar API and create OAuth
   client credentials (Desktop app). Save as credentials.json next to
   this script.
2. Create the destination calendars in Google Calendar first (BNI & 121,
   Accurova (paid), Accurova (free), Educare4u, UpTeach, etc.) and fill
   in their calendar IDs in CATEGORY_TO_CALENDAR_ID below. Find a
   calendar's ID under Settings > [calendar name] > Integrate calendar.
3. Tune CATEGORY_RULES to your actual event titles/locations — the
   defaults below are a starting guess based on your existing patterns.

Usage
-----
python backfill_calendar_categories.py                 # dry run, review only
python backfill_calendar_categories.py --apply          # review + actually move approved events
python backfill_calendar_categories.py --since 2026-01-01 --until 2026-07-01
python backfill_calendar_categories.py --batch-size 20
"""

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import BatchHttpRequest

SCOPES = ["https://www.googleapis.com/auth/calendar"]
CREDS_FILE = Path("credentials.json")
TOKEN_FILE = Path("token.json")
STATE_FILE = Path("backfill_state.json")
UNMATCHED_CSV = Path("unmatched_events.csv")

# ---------------------------------------------------------------------------
# Fill these in with real calendar IDs after creating the calendars.
# ---------------------------------------------------------------------------
CATEGORY_TO_CALENDAR_ID = {
    "BNI & 121": "TODO_calendar_id",
    "Accurova (paid)": "TODO_calendar_id",
    "Accurova (free)": "TODO_calendar_id",
    "Educare4u": "TODO_calendar_id",
    "UpTeach": "TODO_calendar_id",
    "Other paid gigs": "TODO_calendar_id",
    "Other networking / meetups": "TODO_calendar_id",
    "External events / Luma": "TODO_calendar_id",
    "Courses / lessons / webinars": "TODO_calendar_id",
    "Travel / public transport": "TODO_calendar_id",
    "F1": "TODO_calendar_id",
    "Moon phase": "TODO_calendar_id",
    "Shared family calendar": "TODO_calendar_id",
}

# ---------------------------------------------------------------------------
# Keyword rules — matched case-insensitively against summary + location.
# Order matters only for tie-breaking (first highest-score match wins).
# Tune freely; this is a starting guess, not ground truth.
# ---------------------------------------------------------------------------
CATEGORY_RULES = {
    "BNI & 121": ["bni", "crescendo", "121", "1-2-1", "8 in 6", "chapter meeting"],
    "Accurova (paid)": ["photog", "shoot", "accurova", "wedding", "cosplay shoot"],
    "Educare4u": ["educare4u", "educare", "sec 1", "sec 2", "sec 3", "sec 4", "p6", "wis@changi"],
    "UpTeach": ["tut ", "tuition", "upteach"],
    "Other networking / meetups": ["meetup", "networking", "connect society", "coffee chat"],
    "External events / Luma": ["luma"],
    "Courses / lessons / webinars": ["webinar", "course", "workshop", "masterclass"],
    "Travel / public transport": ["mrt", "flight", "airport", "grab", "train"],
    "F1": ["f1", "grand prix", "formula 1"],
    "Moon phase": ["full moon", "new moon", "moon phase", "supermoon"],
    "Shared family calendar": ["family", "mum", "dad", "parents"],
}
# Note: "Accurova (free)", "Other paid gigs", and "Tentative schedules"
# are intentionally left out of keyword rules — paid/free and gig-source
# aren't reliably inferable from title text alone. These stay in the
# unmatched pile for manual assignment during review.


def get_service():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDS_FILE.exists():
                sys.exit("Missing credentials.json — see setup instructions at top of script.")
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json())
    return build("calendar", "v3", credentials=creds)


def fetch_past_events(service, calendar_id, since, until):
    events, page_token = [], None
    while True:
        resp = service.events().list(
            calendarId=calendar_id,
            timeMin=since,
            timeMax=until,
            singleEvents=True,
            orderBy="startTime",
            pageToken=page_token,
            maxResults=250,
        ).execute()
        events.extend(resp.get("items", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return events


def match_category(event):
    text = " ".join([
        event.get("summary", ""),
        event.get("location", ""),
    ]).lower()
    best_cat, best_score, best_hits = None, 0, []
    for category, keywords in CATEGORY_RULES.items():
        hits = [kw for kw in keywords if kw in text]
        if len(hits) > best_score:
            best_cat, best_score, best_hits = category, len(hits), hits
    return best_cat, best_hits


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def event_summary_line(idx, ev, category, hits):
    start = ev.get("start", {}).get("dateTime", ev.get("start", {}).get("date", "?"))[:16]
    title = (ev.get("summary") or "(no title)")[:42]
    return f"  [{idx:>2}] {start}  {title:<42}  -> {category}  (matched: {', '.join(hits)})"


def review_batch(batch, batch_num, total_batches):
    print(f"\n=== Batch {batch_num}/{total_batches} — {len(batch)} events ===")
    for i, (ev, category, hits) in enumerate(batch, 1):
        print(event_summary_line(i, ev, category, hits))

    while True:
        choice = input(
            "\nApprove all [a] / Reject all [r] / Edit individually [e] / "
            "Skip batch, review later [s] / Quit [q]: "
        ).strip().lower()

        if choice == "a":
            return [{"event": ev, "category": cat, "decision": "approved"} for ev, cat, hits in batch]
        if choice == "r":
            return [{"event": ev, "category": cat, "decision": "rejected"} for ev, cat, hits in batch]
        if choice == "s":
            return [{"event": ev, "category": cat, "decision": "deferred"} for ev, cat, hits in batch]
        if choice == "q":
            print("Quitting — progress so far has been saved.")
            return "QUIT"
        if choice == "e":
            decisions = []
            for i, (ev, category, hits) in enumerate(batch, 1):
                print(event_summary_line(i, ev, category, hits))
                sub = input(
                    "    Approve [a] / Reject [r] / Change category [c] / Skip for now [s]: "
                ).strip().lower()
                if sub == "c":
                    print("    Categories:", ", ".join(CATEGORY_TO_CALENDAR_ID.keys()))
                    new_cat = input("    New category (exact name): ").strip()
                    decisions.append({"event": ev, "category": new_cat, "decision": "approved"})
                elif sub == "a":
                    decisions.append({"event": ev, "category": category, "decision": "approved"})
                elif sub == "r":
                    decisions.append({"event": ev, "category": category, "decision": "rejected"})
                else:
                    decisions.append({"event": ev, "category": category, "decision": "deferred"})
            return decisions
        print("Unrecognized option, try again.")


def execute_moves(service, source_calendar_id, approved, apply_changes):
    if not approved:
        return []

    results = []

    def callback(request_id, response, exception):
        if exception is not None:
            results.append({"event_id": request_id, "ok": False, "error": str(exception)})
        else:
            results.append({"event_id": request_id, "ok": True})

    if not apply_changes:
        for item in approved:
            print(f"  [DRY RUN] would move '{item['event'].get('summary')}' -> {item['category']}")
        return [{"event_id": item["event"]["id"], "ok": True, "dry_run": True} for item in approved]

    # Google Calendar batch requests cap at 50 per batch.
    for chunk_start in range(0, len(approved), 50):
        chunk = approved[chunk_start:chunk_start + 50]
        batch = service.new_batch_http_request(callback=callback)
        for item in chunk:
            dest_id = CATEGORY_TO_CALENDAR_ID.get(item["category"])
            if not dest_id or dest_id.startswith("TODO"):
                print(f"  SKIPPED (no calendar ID configured for '{item['category']}'): "
                      f"{item['event'].get('summary')}")
                continue
            batch.add(
                service.events().move(
                    calendarId=source_calendar_id,
                    eventId=item["event"]["id"],
                    destination=dest_id,
                ),
                request_id=item["event"]["id"],
            )
        batch.execute()

    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--calendar-id", default="primary", help="Source calendar to scan (default: primary)")
    parser.add_argument("--since", help="ISO date, e.g. 2026-01-01. Default: unbounded past.")
    parser.add_argument("--until", help="ISO date, e.g. 2026-07-01. Default: now.")
    parser.add_argument("--batch-size", type=int, default=15)
    parser.add_argument("--apply", action="store_true", help="Actually move approved events. Omit for dry run.")
    args = parser.parse_args()

    now = datetime.now(timezone.utc).isoformat()
    since = f"{args.since}T00:00:00Z" if args.since else "2000-01-01T00:00:00Z"
    until = f"{args.until}T00:00:00Z" if args.until else now

    service = get_service()
    state = load_state()

    print(f"Fetching events from '{args.calendar_id}' between {since} and {until} ...")
    events = fetch_past_events(service, args.calendar_id, since, until)
    print(f"Found {len(events)} events.")

    matched, unmatched = [], []
    for ev in events:
        if ev["id"] in state:
            continue  # already reviewed in a prior run
        category, hits = match_category(ev)
        if category:
            matched.append((ev, category, hits))
        else:
            unmatched.append(ev)

    print(f"{len(matched)} events matched a category, {len(unmatched)} need manual review.")

    if unmatched:
        with UNMATCHED_CSV.open("w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["event_id", "start", "summary", "location"])
            for ev in unmatched:
                writer.writerow([
                    ev["id"],
                    ev.get("start", {}).get("dateTime", ev.get("start", {}).get("date", "")),
                    ev.get("summary", ""),
                    ev.get("location", ""),
                ])
        print(f"Unmatched events written to {UNMATCHED_CSV} for manual assignment.")

    if not matched:
        print("Nothing left to review.")
        return

    batches = [matched[i:i + args.batch_size] for i in range(0, len(matched), args.batch_size)]
    all_decisions = []

    for i, batch in enumerate(batches, 1):
        result = review_batch(batch, i, len(batches))
        if result == "QUIT":
            break
        all_decisions.extend(result)
        for d in result:
            state[d["event"]["id"]] = {"decision": d["decision"], "category": d["category"]}
        save_state(state)

    approved = [d for d in all_decisions if d["decision"] == "approved"]
    rejected = [d for d in all_decisions if d["decision"] == "rejected"]
    deferred = [d for d in all_decisions if d["decision"] == "deferred"]

    print(f"\n{len(approved)} approved, {len(rejected)} rejected, {len(deferred)} deferred.")

    if approved:
        mode = "Applying" if args.apply else "Dry run — simulating"
        print(f"\n{mode} {len(approved)} moves...")
        execute_moves(service, args.calendar_id, approved, args.apply)
        if not args.apply:
            print("\nNo changes were made. Re-run with --apply to actually move these events.")

    print(f"\nState saved to {STATE_FILE} — re-running the script will skip already-reviewed events.")


if __name__ == "__main__":
    main()
