"""Pure functions turning raw Google Calendar API payloads into the shapes
the frontend canvas renders. No network calls in this module — keeps it
unit-testable against fixture JSON.
"""
from datetime import datetime, timedelta, date


def real_category_config(raw_config):
    """Strip comment/meta keys (leading underscore) from category_config.json."""
    return {k: v for k, v in raw_config.items() if not k.startswith("_")}


def decimal_hour(dt: datetime) -> float:
    return dt.hour + dt.minute / 60 + dt.second / 3600


def parse_event_datetime(value: dict) -> datetime:
    """value is an event's start/end dict: {"dateTime": iso} or {"date": iso} (all-day)."""
    if "dateTime" in value:
        return datetime.fromisoformat(value["dateTime"])
    return datetime.fromisoformat(value["date"])


def day_index(d: date, week_start: date) -> int:
    return (d - week_start).days


def resolve_category_color(calendar_id: str, calendar_colors: dict, calendar_list_entry: dict) -> str:
    """calendar_colors is the 'calendar' section of colors().get() -> {colorId: {background, foreground}}."""
    color_id = calendar_list_entry.get("colorId")
    if color_id and color_id in calendar_colors:
        return calendar_colors[color_id]["background"]
    return calendar_list_entry.get("backgroundColor", "#5b6270")


def resolve_status_color(event: dict, event_colors: dict) -> str | None:
    """event_colors is the 'event' section of colors().get() -> {colorId: {background, foreground}}."""
    color_id = event.get("colorId")
    if color_id and color_id in event_colors:
        return event_colors[color_id]["background"]
    return None


def normalize_event(event: dict, calendar_id: str, category_label: str,
                     category_color: str, event_colors: dict, week_start: date) -> dict | None:
    start_val = event.get("start", {})
    end_val = event.get("end", {})
    if "dateTime" not in start_val:
        return None  # skip all-day events on the hourly canvas

    start_dt = parse_event_datetime(start_val)
    end_dt = parse_event_datetime(end_val)

    return {
        "day": day_index(start_dt.date(), week_start),
        "start": decimal_hour(start_dt),
        "end": decimal_hour(end_dt),
        "title": event.get("summary", "(no title)"),
        "category": category_label,
        "categoryColor": category_color,
        "statusColor": resolve_status_color(event, event_colors),
        "calendarId": calendar_id,
    }


def build_week_events(events_by_calendar: dict, calendar_list: list, category_config: dict,
                       colors: dict, week_start: date) -> list:
    """events_by_calendar: {calendarId: [raw event dicts]}
    calendar_list: raw calendarList().list() items (for colorId/backgroundColor fallback)
    category_config: already-stripped (see real_category_config)
    colors: raw colors().get() response -> {"calendar": {...}, "event": {...}}
    """
    calendar_entries = {c["id"]: c for c in calendar_list}
    calendar_colors = colors.get("calendar", {})
    event_colors = colors.get("event", {})

    normalized = []
    for calendar_id, events in events_by_calendar.items():
        if calendar_id not in category_config:
            continue
        cfg = category_config[calendar_id]
        entry = calendar_entries.get(calendar_id, {})
        category_color = resolve_category_color(calendar_id, calendar_colors, entry)
        for event in events:
            item = normalize_event(event, calendar_id, cfg["label"], category_color, event_colors, week_start)
            if item is not None and 0 <= item["day"] <= 6:
                normalized.append(item)
    return normalized


def bucket_events_into_weeks(events_by_calendar: dict, calendar_list: list, category_config: dict,
                              colors: dict, range_start: date, week_count: int) -> list:
    """Buckets a wide date-range query into `week_count` weeks starting at range_start.
    Returns a list of {weekStart, blocks: [{start, end, color}]} — lightweight, for the shelf view.
    """
    calendar_entries = {c["id"]: c for c in calendar_list}
    calendar_colors = colors.get("calendar", {})

    weeks = [
        {"weekStart": (range_start + timedelta(weeks=i)).isoformat(), "blocks": []}
        for i in range(week_count)
    ]

    for calendar_id, events in events_by_calendar.items():
        if calendar_id not in category_config:
            continue
        entry = calendar_entries.get(calendar_id, {})
        category_color = resolve_category_color(calendar_id, calendar_colors, entry)
        for event in events:
            start_val = event.get("start", {})
            if "dateTime" not in start_val:
                continue
            start_dt = parse_event_datetime(start_val)
            end_dt = parse_event_datetime(event.get("end", {}))
            week_offset = (start_dt.date() - range_start).days // 7
            if not (0 <= week_offset < week_count):
                continue
            weeks[week_offset]["blocks"].append({
                "start": decimal_hour(start_dt),
                "end": decimal_hour(end_dt),
                "color": category_color,
            })

    return weeks
