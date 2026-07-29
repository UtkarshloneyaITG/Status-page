"""User-submitted reports and suggestions.

Anyone can submit without an account. An admin triages what arrives, and
anything marked fixed becomes visible on the public status page as a log of
what was reported and resolved.
"""

import random
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from api.admin_services import oid
from api.auth import require_admin
from api.constants import (
    FB_FIXED,
    FB_NEW,
    FEEDBACK_STATUSES,
    FEEDBACK_TYPES,
)

public_router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])
admin_router = APIRouter(prefix="/api/v1/admin/feedback", tags=["feedback"])

RATE_LIMIT = 3
RATE_WINDOW = 3600

# ponytail: in-process rate limiting. One worker only. If this ever runs
# multi-process, move the counter to Mongo with a TTL index — still no Redis.
_submissions: dict[str, list[float]] = {}


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    recent = [t for t in _submissions.get(ip, []) if now - t < RATE_WINDOW]
    _submissions[ip] = recent
    if len(recent) >= RATE_LIMIT:
        return True
    recent.append(now)
    return False


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _next_ref(db) -> str:
    """RPT-#### with a unique index behind it; retry on the rare collision.

    ponytail: four digits is plenty for a status page's report volume. Widen
    the range here if collisions ever start showing up in the logs.
    """
    for _ in range(10):
        ref = f"RPT-{random.randint(1000, 9999)}"
        if await db.feedback.find_one({"ref_code": ref}) is None:
            return ref
    raise HTTPException(503, "Could not allocate a reference code")


class FeedbackIn(BaseModel):
    type: str
    service_id: str | None = None
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=2000)
    reporter_email: EmailStr | None = None
    browser_meta: dict | None = None
    # Honeypot: a real person never fills this in, it is hidden from them.
    website: str | None = None


class Triage(BaseModel):
    status: str | None = None
    admin_reply: str | None = Field(default=None, max_length=2000)
    internal_note: str | None = Field(default=None, max_length=2000)
    is_public: bool | None = None


def _public_view(doc: dict, service_names: dict) -> dict:
    return {
        "ref_code": doc["ref_code"],
        "type": doc["type"],
        "title": doc["title"],
        "description": doc["description"],
        "status": doc["status"],
        "service": service_names.get(doc.get("service_id")),
        "admin_reply": doc.get("admin_reply"),
        "created_at": doc["created_at"].isoformat(),
        "resolved_at": doc["resolved_at"].isoformat()
        if doc.get("resolved_at")
        else None,
    }


def _admin_view(doc: dict, service_names: dict) -> dict:
    view = _public_view(doc, service_names)
    view.update(
        {
            "id": str(doc["_id"]),
            "reporter_email": doc.get("reporter_email"),
            "internal_note": doc.get("internal_note"),
            "is_public": doc.get("is_public", False),
            "browser_meta": doc.get("browser_meta"),
        }
    )
    return view


async def _service_names(db) -> dict:
    return {s["_id"]: s["name"] async for s in db.services.find({}, {"name": 1})}


# --- public -----------------------------------------------------------------


@public_router.post("", status_code=201)
async def submit(body: FeedbackIn, request: Request):
    """Open to anyone. No account, no login."""
    if body.type not in FEEDBACK_TYPES:
        raise HTTPException(422, f"type must be one of {FEEDBACK_TYPES}")

    db = request.app.state.db

    # A bot that filled the honeypot gets a plausible-looking receipt and
    # nothing is stored, so it has no signal to adapt to.
    if body.website:
        return {"ref_code": f"RPT-{random.randint(1000, 9999)}"}

    if _rate_limited(_client_ip(request)):
        raise HTTPException(429, "Too many reports from this address. Try later.")

    service_id = oid(body.service_id) if body.service_id else None
    if service_id and await db.services.find_one({"_id": service_id}) is None:
        raise HTTPException(422, "Unknown service")

    ref = await _next_ref(db)
    await db.feedback.insert_one(
        {
            "ref_code": ref,
            "type": body.type,
            "service_id": service_id,
            "title": body.title,
            "description": body.description,
            "reporter_email": body.reporter_email,
            "screenshot_id": None,
            "browser_meta": body.browser_meta,
            "status": FB_NEW,
            "upvotes": 0,
            "admin_reply": None,
            "internal_note": None,
            # Nothing is publicly visible until an admin says so.
            "is_public": False,
            "duplicate_of": None,
            "incident_id": None,
            "created_at": datetime.now(timezone.utc),
            "resolved_at": None,
        }
    )
    return {"ref_code": ref}


@public_router.get("")
async def public_log(request: Request, limit: int = 50):
    """The log shown on the status page: published reports, newest first."""
    db = request.app.state.db
    names = await _service_names(db)
    docs = [
        d
        async for d in db.feedback.find({"is_public": True})
        .sort("created_at", -1)
        .limit(max(1, min(limit, 200)))
    ]
    return {"items": [_public_view(d, names) for d in docs]}


@public_router.get("/{ref_code}")
async def public_item(ref_code: str, request: Request):
    db = request.app.state.db
    doc = await db.feedback.find_one({"ref_code": ref_code, "is_public": True})
    if doc is None:
        raise HTTPException(404, "Not found")
    return _public_view(doc, await _service_names(db))


# --- admin ------------------------------------------------------------------


@admin_router.get("")
async def inbox(
    request: Request,
    status: str | None = FB_NEW,
    type: str | None = None,
    _: dict = Depends(require_admin),
):
    """Defaults to the new reports — the queue an admin actually works."""
    db = request.app.state.db
    query: dict = {}
    if status and status != "all":
        query["status"] = status
    if type:
        query["type"] = type

    names = await _service_names(db)
    docs = [d async for d in db.feedback.find(query).sort("created_at", -1)]
    counts = {
        s: await db.feedback.count_documents({"status": s})
        for s in FEEDBACK_STATUSES
    }
    return {"counts": counts, "items": [_admin_view(d, names) for d in docs]}


@admin_router.patch("/{ref_code}")
async def triage(
    ref_code: str,
    body: Triage,
    request: Request,
    _: dict = Depends(require_admin),
):
    db = request.app.state.db
    changes = body.model_dump(exclude_unset=True)

    if "status" in changes:
        if changes["status"] not in FEEDBACK_STATUSES:
            raise HTTPException(422, f"status must be one of {FEEDBACK_STATUSES}")
        if changes["status"] == FB_FIXED:
            # Marking it fixed is what puts it on the status page.
            changes["resolved_at"] = datetime.now(timezone.utc)
            changes.setdefault("is_public", True)
        else:
            changes["resolved_at"] = None

    if not changes:
        return {"ok": True}

    result = await db.feedback.update_one(
        {"ref_code": ref_code}, {"$set": changes}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@admin_router.post("/bulk")
async def bulk(
    request: Request,
    body: dict,
    _: dict = Depends(require_admin),
):
    """Apply one status to several reports at once."""
    refs = body.get("ref_codes") or []
    status = body.get("status")
    if status not in FEEDBACK_STATUSES:
        raise HTTPException(422, f"status must be one of {FEEDBACK_STATUSES}")

    changes: dict = {"status": status}
    if status == FB_FIXED:
        changes["resolved_at"] = datetime.now(timezone.utc)
        changes["is_public"] = True
    else:
        changes["resolved_at"] = None

    result = await request.app.state.db.feedback.update_many(
        {"ref_code": {"$in": refs}}, {"$set": changes}
    )
    return {"updated": result.modified_count}


@admin_router.delete("/{ref_code}")
async def delete(
    ref_code: str, request: Request, _: dict = Depends(require_admin)
):
    result = await request.app.state.db.feedback.delete_one({"ref_code": ref_code})
    if result.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}
