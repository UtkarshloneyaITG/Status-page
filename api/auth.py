"""Admin authentication: bcrypt passwords, signed session cookie, roles.

No third-party auth service. The whole surface is three endpoints and one
dependency factory, because the only thing that logs in here is a handful of
operators.
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

# Ordered weakest to strongest; a route names the minimum it accepts.
ROLE_ORDER = ["responder", "admin", "owner"]

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


def role_at_least(role: str, minimum: str) -> bool:
    try:
        return ROLE_ORDER.index(role) >= ROLE_ORDER.index(minimum)
    except ValueError:
        return False


def issue_session(response: Response, user: dict, secure: bool = False) -> None:
    token = _serializer.dumps({"email": user["email"], "role": user["role"]})
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=secure,
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


def require_role(minimum: str):
    """Dependency factory: 401 when signed out, 403 when under-privileged."""

    def dependency(request: Request) -> dict:
        session = read_session(request)
        if session is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if not role_at_least(session.get("role", ""), minimum):
            raise HTTPException(status_code=403, detail="Insufficient role")
        return session

    return dependency


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class Identity(BaseModel):
    email: str
    role: str


@router.post("/login", response_model=Identity)
async def login(body: LoginBody, request: Request, response: Response):
    user = await request.app.state.db.admin_users.find_one(
        {"email": body.email.lower()}
    )
    stored = user["password_hash"] if user else _DUMMY_HASH.decode()
    if not verify_password(body.password, stored) or user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    issue_session(response, user, secure=request.url.scheme == "https")
    return Identity(email=user["email"], role=user["role"])


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=Identity)
async def me(session: dict = Depends(require_role("responder"))):
    return Identity(email=session["email"], role=session["role"])
