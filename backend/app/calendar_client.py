"""Thin wrapper around the Google Calendar API. Network calls live only here,
so normalize.py can be tested without hitting the network.
"""
from googleapiclient.discovery import build


def get_service(credentials):
    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


def list_calendars(credentials) -> list:
    service = get_service(credentials)
    items, page_token = [], None
    while True:
        resp = service.calendarList().list(pageToken=page_token).execute()
        items.extend(resp.get("items", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return items


def get_colors(credentials) -> dict:
    service = get_service(credentials)
    return service.colors().get().execute()


def list_events(credentials, calendar_id: str, time_min: str, time_max: str) -> list:
    service = get_service(credentials)
    items, page_token = [], None
    while True:
        resp = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
            pageToken=page_token,
            maxResults=250,
        ).execute()
        items.extend(resp.get("items", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return items


def fetch_events_for_calendars(credentials, calendar_ids: list, time_min: str, time_max: str) -> dict:
    return {cal_id: list_events(credentials, cal_id, time_min, time_max) for cal_id in calendar_ids}
