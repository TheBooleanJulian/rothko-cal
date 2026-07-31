from datetime import date

from app.normalize import (
    bucket_events_into_weeks,
    build_week_events,
    day_index,
    decimal_hour,
    real_category_config,
)
from datetime import datetime

CALENDAR_LIST = [
    {"id": "cal-market", "summary": "Event/Market", "colorId": "7", "backgroundColor": "#2f6f6b"},
    {"id": "cal-tut", "summary": "Tutoring", "colorId": "6"},
]

COLORS = {
    "calendar": {
        "7": {"background": "#0b8043", "foreground": "#ffffff"},
        "6": {"background": "#f4511e", "foreground": "#ffffff"},
    },
    "event": {
        "11": {"background": "#dc2127", "foreground": "#ffffff"},
    },
}

CATEGORY_CONFIG = real_category_config({
    "cal-market": {"label": "market", "order": 0},
    "cal-tut": {"label": "tut", "order": 1},
    "_comment": "ignored",
})

WEEK_START = date(2026, 7, 19)  # Sunday


def test_real_category_config_strips_underscore_keys():
    assert "_comment" not in CATEGORY_CONFIG
    assert set(CATEGORY_CONFIG) == {"cal-market", "cal-tut"}


def test_decimal_hour():
    dt = datetime(2026, 7, 20, 14, 30)
    assert decimal_hour(dt) == 14.5


def test_day_index():
    assert day_index(date(2026, 7, 19), WEEK_START) == 0
    assert day_index(date(2026, 7, 25), WEEK_START) == 6


def test_build_week_events_maps_category_and_status_color():
    events_by_calendar = {
        "cal-market": [
            {
                "summary": "Farmers market",
                "start": {"dateTime": "2026-07-19T11:00:00+08:00"},
                "end": {"dateTime": "2026-07-19T19:00:00+08:00"},
                "colorId": "11",
            }
        ],
        "cal-tut": [
            {
                "summary": "Tuition session",
                "start": {"dateTime": "2026-07-20T14:30:00+08:00"},
                "end": {"dateTime": "2026-07-20T16:00:00+08:00"},
            }
        ],
    }

    events = build_week_events(events_by_calendar, CALENDAR_LIST, CATEGORY_CONFIG, COLORS, WEEK_START)

    assert len(events) == 2
    market = next(e for e in events if e["category"] == "market")
    assert market["day"] == 0
    assert market["start"] == 11.0
    assert market["end"] == 19.0
    assert market["categoryColor"] == "#2f6f6b"  # calendar's own backgroundColor wins over the colorId lookup
    assert market["statusColor"] == "#dc2127"

    tut = next(e for e in events if e["category"] == "tut")
    assert tut["day"] == 1
    assert tut["start"] == 14.5
    assert tut["statusColor"] is None


def test_build_week_events_skips_all_day_and_falls_back_unconfigured_calendars():
    events_by_calendar = {
        "cal-market": [
            {"summary": "All day thing", "start": {"date": "2026-07-19"}, "end": {"date": "2026-07-20"}},
        ],
        "cal-unknown": [
            {"summary": "Should default to calendar name", "start": {"dateTime": "2026-07-19T10:00:00+08:00"},
             "end": {"dateTime": "2026-07-19T11:00:00+08:00"}},
        ],
    }
    events = build_week_events(events_by_calendar, CALENDAR_LIST, CATEGORY_CONFIG, COLORS, WEEK_START)
    assert len(events) == 1
    assert events[0]["category"] == "Calendar"  # no summary in CALENDAR_LIST entry for cal-unknown, falls back to default


def test_bucket_events_into_weeks_groups_by_week_offset():
    events_by_calendar = {
        "cal-market": [
            {"start": {"dateTime": "2026-07-19T11:00:00+08:00"}, "end": {"dateTime": "2026-07-19T19:00:00+08:00"}},
            {"start": {"dateTime": "2026-07-27T09:00:00+08:00"}, "end": {"dateTime": "2026-07-27T10:00:00+08:00"}},
        ],
    }
    weeks = bucket_events_into_weeks(events_by_calendar, CALENDAR_LIST, CATEGORY_CONFIG, COLORS, WEEK_START, 3)

    assert len(weeks) == 3
    assert weeks[0]["weekStart"] == "2026-07-19"
    assert len(weeks[0]["blocks"]) == 1
    assert weeks[1]["weekStart"] == "2026-07-26"
    assert len(weeks[1]["blocks"]) == 1
    assert weeks[2]["blocks"] == []
