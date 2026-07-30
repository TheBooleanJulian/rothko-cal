import json
import os
from pathlib import Path

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-insecure-secret-change-me")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")

CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

CATEGORY_CONFIG_PATH = Path(__file__).resolve().parent.parent / "category_config.json"


def load_category_config():
    if not CATEGORY_CONFIG_PATH.exists():
        return {}
    return json.loads(CATEGORY_CONFIG_PATH.read_text())
