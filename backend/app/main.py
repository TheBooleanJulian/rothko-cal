from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2.credentials import Credentials
from starlette.middleware.sessions import SessionMiddleware

from . import calendar_client, config
from .auth import router as auth_router
from .deps import get_credentials
from .normalize import bucket_events_into_weeks, build_week_events, real_category_config

app = FastAPI(title="Rothko Cal API")

_IS_HTTPS = config.GOOGLE_REDIRECT_URI.startswith("https://")
app.add_middleware(
    SessionMiddleware,
    secret_key=config.SESSION_SECRET,
    same_site="none" if _IS_HTTPS else "lax",
    https_only=_IS_HTTPS,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(auth_router)


def week_bounds(week_start: date, tz: str) -> tuple[str, str]:
    zone = ZoneInfo(tz)
    start_dt = datetime.combine(week_start, datetime.min.time(), tzinfo=zone)
    end_dt = start_dt + timedelta(days=7)
    return start_dt.isoformat(), end_dt.isoformat()


@app.get("/api/calendars")
def get_calendars(credentials: Credentials = Depends(get_credentials)):
    return calendar_client.list_calendars(credentials)


@app.get("/api/colors")
def get_colors(credentials: Credentials = Depends(get_credentials)):
    return calendar_client.get_colors(credentials)


@app.get("/api/events")
def get_events(weekStart: str, tz: str = "UTC", credentials: Credentials = Depends(get_credentials)):
    week_start = date.fromisoformat(weekStart)
    category_config = real_category_config(config.load_category_config())
    calendar_list = calendar_client.list_calendars(credentials)
    colors = calendar_client.get_colors(credentials)

    time_min, time_max = week_bounds(week_start, tz)
    events_by_calendar = calendar_client.fetch_events_for_calendars(
        credentials, [c["id"] for c in calendar_list], time_min, time_max
    )

    events = build_week_events(events_by_calendar, calendar_list, category_config, colors, week_start)
    return {"weekStart": weekStart, "events": events}


@app.get("/api/weeks-summary")
def get_weeks_summary(end: str, count: int = 5, tz: str = "UTC", credentials: Credentials = Depends(get_credentials)):
    range_end = date.fromisoformat(end)
    range_start = range_end - timedelta(weeks=count - 1)
    category_config = real_category_config(config.load_category_config())
    calendar_list = calendar_client.list_calendars(credentials)
    colors = calendar_client.get_colors(credentials)

    zone = ZoneInfo(tz)
    time_min = datetime.combine(range_start, datetime.min.time(), tzinfo=zone).isoformat()
    time_max = (datetime.combine(range_end, datetime.min.time(), tzinfo=zone) + timedelta(days=7)).isoformat()
    events_by_calendar = calendar_client.fetch_events_for_calendars(
        credentials, [c["id"] for c in calendar_list], time_min, time_max
    )

    weeks = bucket_events_into_weeks(events_by_calendar, calendar_list, category_config, colors, range_start, count)
    return {"weeks": weeks}
