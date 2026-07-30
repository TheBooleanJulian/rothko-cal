<div align="center">

# Rothko Cal

**A visual planning toolkit for turning Google Calendar into an intentional, legible system.**

![Version](https://img.shields.io/badge/version-0.3.0-00D4C8)
![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/-React-61DAFB?logo=react&logoColor=black)
![License](https://img.shields.io/badge/license-AGPLv3%20%2F%20Commercial-00D4C8.svg)

</div>

---

## What it does

Rothko Cal is a small personal planning toolkit for making Google Calendar more intentional and visual. It's a login-gated web app with a dark, editorial-style weekly canvas that renders your real Google Calendar events at a glance, backed by a Python API that talks to the Calendar API directly (no local database, no stale sync). It also includes a Python script for migrating historical events into cleaner category calendars, and a color-mapping reference for separating category and status visually. It's built for individuals who want their calendar to feel more legible and structurally durable.

The original single-file HTML mockup (`calendar-canvas.html`) is kept in the repo as the design reference the real app was built from — it renders a hardcoded sample week and isn't wired to any data source.

## Features

- Weekly mood-board-style calendar canvas, now driven by live Google Calendar data instead of a mockup
- "The shelf" — a strip of the last 13 weeks rendered as tiny thumbnails, aggregated server-side from real events
- Google sign-in gate (per-session OAuth, read-only Calendar access)
- Google Calendar backfill script for reviewing and moving historical events into category-specific calendars
- Color-mapping documentation separating calendar-level categories from event-level statuses, now sourced live from `colors().get()` rather than hardcoded hex values

## Tech Stack

| Layer | Choice |
|---|---|
| Backend API | Python (FastAPI), Google Calendar API via `google-api-python-client`, OAuth via Authlib |
| Frontend | React + Vite |
| Backfill script | Python |
| Deployment | Zeabur (two services: `backend/`, `frontend/`) |

## Project Structure

```
rothko-cal/
|-- backend/                       # FastAPI app — auth, Calendar API access, normalization
|   |-- app/
|   |-- category_config.json       # calendarId -> friendly category label
|   |-- requirements.txt
|   |-- Dockerfile
|   |-- .env.example
|   `-- tests/
|-- frontend/                      # React + Vite app — the real calendar canvas
|   |-- src/
|   `-- .env.example
|-- calendar-canvas.html           # original static mockup, kept as design reference
|-- backfill_calendar_categories.py
|-- CALENDAR_COLORS.md
|-- COMMERCIAL-LICENSE.md
|-- LICENSE
`-- README.md
```

## Running locally

**1. Create a Google OAuth client** (one-time, in [Google Cloud Console](https://console.cloud.google.com/)): enable the Calendar API, create an OAuth 2.0 Client ID (Web application), and add `http://localhost:8000/auth/callback` as an authorized redirect URI.

**2. Backend**

```
cd backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env   # fill in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SESSION_SECRET
uvicorn app.main:app --reload
```

Edit `backend/category_config.json` to map your real calendar IDs (from Google Calendar > Settings > [calendar] > Integrate calendar) to friendly category labels — calendars not listed there are ignored by the app.

Run the normalization tests any time with `pytest backend/tests` (pure-function tests, no network/credentials needed).

**3. Frontend**

```
cd frontend
npm install
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:8000
npm run dev
```

Open the printed `localhost:5173` URL, sign in with Google, and you should see your real week.

## Deploying (Zeabur)

Deploy `backend/` and `frontend/` as two separate Zeabur services from this repo:

- **backend** — Docker service using `backend/Dockerfile`. Set env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (`https://<backend-domain>/auth/callback`), `SESSION_SECRET`, `FRONTEND_ORIGIN` (`https://<frontend-domain>`).
- **frontend** — static/Vite service, root `frontend/`. Set `VITE_API_URL` to the backend's public URL.
- Add the real backend callback URL as an authorized redirect URI on the Google OAuth client once you know the deployed domain.

## Quick overview

This project is designed around two ideas:

1. Make time feel more legible through a visual weekly canvas.
2. Make calendar organization more durable by separating category and status into distinct layers.

## Versioning

This repository uses a simple major/minor version format:

- the first number increases for major milestones or structural changes
- the second number increases for minor feature updates, workflow improvements, or documentation refinements

## Status / Roadmap

**Done**

- [x] Standalone weekly calendar canvas mockup (`calendar-canvas.html`, kept as design reference)
- [x] Real login-gated web app (FastAPI + React) rendering live Google Calendar data
- [x] Prev/next week navigation and a real "shelf" of past weeks (was random mock data)
- [x] Calendar/event colors sourced live from `colors().get()` instead of hardcoded hex values
- [x] Category config moved to `backend/category_config.json` (JSON, no code changes needed)
- [x] Google Calendar backfill/migration script
- [x] Color-mapping reference for category vs status

**Planned / Suggestions**

- Add a simple visual review UI for approving or rejecting backfill actions
- Add automated tests for the backfill logic and category matching rules
- Add a `.env.example` / config scaffolding equivalent for the backfill script itself (the web app already has one)

### Near-term ideas
- Add an export/import workflow for saved category mappings and review decisions
- Add a simple review dashboard for approving or rejecting backfill actions visually
- Let the frontend filter/toggle which categories are visible in the week view

### Medium-term ideas
- Add support for recurring-event handling and smarter batch review in the backfill script
- Add richer calendar insights, such as workload summaries, travel patterns, and focus-block tracking
- Add automated testing for the backfill logic and category matching rules

### Longer-term ideas
- Turn the canvas into a more interactive planner with filters, toggles, and custom themes
- Add sync support for additional calendar providers or local export formats

## Suggested next steps

If you want to keep momentum, the best next move would be:

1. add category/status filtering to the week view
2. add a simple review UI for the backfill workflow
3. add automated tests for the backfill script's category matching rules

## Changelog

### v0.3.0 — Real backend and frontend
- Added a FastAPI backend (`backend/`) that authenticates with Google OAuth (login-gated, per-session) and serves normalized event/color data from the live Calendar API
- Added a React + Vite frontend (`frontend/`) that renders the weekly canvas and "the shelf" from real data, replacing the hardcoded mock week and random shelf blocks
- Added prev/next week navigation, sign-in/sign-out, and category config via `backend/category_config.json`
- Added unit tests for the event-normalization logic (`backend/tests`)
- `calendar-canvas.html` kept as the original static design mockup/reference

### v0.2.0 — Documentation and workflow refinement
- Clarified the category and status color model
- Improved the project structure around the backfill workflow
- Added a repository README with changelog and roadmap guidance

### v0.1.0 — Initial release
- Added the calendar canvas experience in `calendar-canvas.html`
- Added the Google Calendar backfill script for moving historical events into category calendars
- Added color-mapping documentation for category vs status distinctions

## License

Dual licensed:

- **Community Edition** — [GNU Affero General Public License v3 (AGPLv3)](LICENSE). Free to use, modify, and self-host. If you distribute a modified version or run it as a network service, you must make the corresponding source available.
- **Commercial License** — for organisations wanting to embed or distribute without AGPLv3 obligations. See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

---

<div align="center">
<sub>Built by <a href="https://github.com/TheBooleanJulian">@TheBooleanJulian</a></sub>
</div>
