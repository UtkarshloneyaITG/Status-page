"""Admin authentication: bcrypt passwords, signed session cookie.

The public side of this app has no accounts and no login — anyone can submit a
report. Auth exists only to gate /admin, so there is one kind of user and no
role hierarchy.
"""

import logging
import os
import secrets

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel, EmailStr

log = logging.getLogger(__name__)

COOKIE_NAME = "statuspage_session"
SESSION_MAX_AGE = 7 * 24 * 3600

# In development the API and the site share localhost, so Lax works and keeps
# the CSRF protection Lax gives you. In production they are usually different
# hosts (Render + Vercel), and a Lax cookie is simply never sent — so set
# COOKIE_SAMESITE=none there. Browsers reject SameSite=None without Secure,
# so that combination forces Secure on regardless of what else is configured.
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()
_FORCE_SECURE = os.getenv("COOKIE_SECURE", "").lower() in {"1", "true", "yes"}
_SECURE = _FORCE_SECURE or COOKIE_SAMESITE == "none"

_secret = os.getenv("SESSION_SECRET")
if not _secret:
    _secret = secrets.token_urlsafe(32)
    log.warning(
        "SESSION_SECRET is unset; generated an ephemeral one. "
        "Sessions will not survive a restart."
    )

_serializer = URLSafeTimedSerializer(_secret, salt="statuspage-session")

# Verifying against this when the email is unknown keeps the failure path the
# same shape and roughly the same duration as a wrong password, so the response
# does not reveal whether an account exists.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def issue_session(response: Response, user: dict, secure: bool = False) -> None:
    token = _serializer.dumps({"email": user["email"]})
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=secure or _SECURE,
        path="/",
    )


def read_session(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        return _serializer.loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


def require_admin(request: Request) -> dict:
    """The only gate in the app. 401 when there is no valid session."""
    session = read_session(request)
    if session is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class Identity(BaseModel):
    email: str


@router.post("/login", response_model=Identity)
async def login(body: LoginBody, request: Request, response: Response):
    user = await request.app.state.db.admin_users.find_one(
        {"email": body.email.lower()}
    )
    stored = user["password_hash"] if user else _DUMMY_HASH.decode()
    if not verify_password(body.password, stored) or user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    issue_session(response, user, secure=request.url.scheme == "https")
    return Identity(email=user["email"])


@router.post("/logout")
async def logout(response: Response):
    # The attributes must match those the cookie was set with, or the browser
    # keeps it.
    response.delete_cookie(
        COOKIE_NAME, path="/", samesite=COOKIE_SAMESITE, secure=_SECURE
    )
    return {"ok": True}


@router.get("/me", response_model=Identity)
async def me(session: dict = Depends(require_admin)):
    return Identity(email=session["email"])
