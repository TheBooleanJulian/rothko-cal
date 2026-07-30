from fastapi import Request, HTTPException
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials

from . import config


def get_credentials(request: Request) -> Credentials:
    token = request.session.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    credentials = Credentials(
        token=token.get("access_token"),
        refresh_token=token.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=config.GOOGLE_CLIENT_ID,
        client_secret=config.GOOGLE_CLIENT_SECRET,
        scopes=config.CALENDAR_SCOPES,
    )

    if credentials.expired and credentials.refresh_token:
        credentials.refresh(GoogleAuthRequest())
        token["access_token"] = credentials.token
        request.session["token"] = token

    return credentials
