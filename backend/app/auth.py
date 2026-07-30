from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from . import config

router = APIRouter(prefix="/auth", tags=["auth"])

oauth = OAuth()
oauth.register(
    name="google",
    client_id=config.GOOGLE_CLIENT_ID,
    client_secret=config.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile " + " ".join(config.CALENDAR_SCOPES)},
)


@router.get("/login")
async def login(request: Request):
    return await oauth.google.authorize_redirect(
        request, config.GOOGLE_REDIRECT_URI, access_type="offline", prompt="consent"
    )


@router.get("/callback")
async def callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo", {})
    request.session["token"] = {
        "access_token": token.get("access_token"),
        "refresh_token": token.get("refresh_token"),
    }
    request.session["user"] = {
        "email": userinfo.get("email"),
        "name": userinfo.get("name"),
    }
    return RedirectResponse(url=config.FRONTEND_ORIGIN)


@router.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/me")
async def me(request: Request):
    user = request.session.get("user")
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, **user}
