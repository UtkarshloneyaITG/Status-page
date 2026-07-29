"""Admin CRUD for services and groups, plus the status toggle.

The toggle is the only operation here with a real invariant: status_history is
the source of truth and services.current_status is a cache of it. Both are
written, history first, so a crash leaves a stale cache rather than a missing
history entry.
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.auth import require_admin
from api.constants import STATUSES

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail=f"Malformed id: {value}")


async def record_status(
    db, service_id: ObjectId, status: str, note: str | None, by: str | None
) -> dict:
    """Append a history event and refresh the cached current_status.

    Every path that changes a service's status goes through here — the admin
    toggle, incident resolution, anything later. One place to get the pairing
    right.
    """
    if status not in STATUSES:
        raise HTTPException(status_code=422, detail=f"Unknown status: {status}")

    now = datetime.now(timezone.utc)
    event = {
        "service_id": service_id,
        "status": status,
        "note": note,
        "changed_by": by,
        "created_at": now,
    }
    await db.status_history.insert_one(dict(event))
    result = await db.services.update_one(
        {"_id": service_id}, {"$set": {"current_status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return event


# --- request bodies ---------------------------------------------------------


class ServiceIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    group_id: str | None = None


class ServicePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    group_id: str | None = None


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class Reorder(BaseModel):
    ids: list[str]


class StatusIn(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=500)


# --- services ---------------------------------------------------------------


@router.get("/services")
async def list_services(
    request: Request, _: dict = Depends(require_admin)
):
    db = request.app.state.db
    out = []
    async for doc in db.services.find().sort("position", 1):
        out.append(
            {
                "id": str(doc["_id"]),
                "name": doc["name"],
                "description": doc.get("description"),
                "group_id": str(doc["group_id"]) if doc.get("group_id") else None,
                "current_status": doc["current_status"],
                "position": doc["position"],
            }
        )
    return out


@router.post("/services", status_code=201)
async def create_service(
    body: ServiceIn,
    request: Request,
    session: dict = Depends(require_admin),
):
    db = request.app.state.db
    now = datetime.now(timezone.utc)
    last = await db.services.find_one(sort=[("position", -1)])
    doc = {
        "name": body.name,
        "description": body.description,
        "group_id": oid(body.group_id) if body.group_id else None,
        "current_status": "operational",
        "position": int(last["position"] + 1) if last else 0,
        "created_at": now,
    }
    result = await db.services.insert_one(doc)
    # A service with no history has no uptime at all, so give it its opening
    # event immediately rather than leaving a gap before the first toggle.
    await record_status(
        db, result.inserted_id, "operational", None, session["email"]
    )
    return {"id": str(result.inserted_id)}


@router.patch("/services/{service_id}")
async def update_service(
    service_id: str,
    body: ServicePatch,
    request: Request,
    _: dict = Depends(require_admin),
):
    changes = body.model_dump(exclude_unset=True)
    if "group_id" in changes:
        changes["group_id"] = oid(changes["group_id"]) if changes["group_id"] else None
    if not changes:
        return {"ok": True}
    result = await request.app.state.db.services.update_one(
        {"_id": oid(service_id)}, {"$set": changes}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"ok": True}


@router.delete("/services/{service_id}")
async def delete_service(
    service_id: str, request: Request, _: dict = Depends(require_admin)
):
    db = request.app.state.db
    sid = oid(service_id)
    result = await db.services.delete_one({"_id": sid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    # Orphaned history would still be scanned by the uptime rollup.
    await db.status_history.delete_many({"service_id": sid})
    await db.incident_services.delete_many({"service_id": sid})
    return {"ok": True}


@router.post("/services/reorder")
async def reorder_services(
    body: Reorder, request: Request, _: dict = Depends(require_admin)
):
    db = request.app.state.db
    for position, service_id in enumerate(body.ids):
        await db.services.update_one(
            {"_id": oid(service_id)}, {"$set": {"position": position}}
        )
    return {"ok": True}


@router.post("/services/{service_id}/status")
async def set_status(
    service_id: str,
    body: StatusIn,
    request: Request,
    session: dict = Depends(require_admin),
):
    event = await record_status(
        request.app.state.db,
        oid(service_id),
        body.status,
        body.note,
        session["email"],
    )
    return {"status": event["status"], "changed_at": event["created_at"].isoformat()}


# --- groups -----------------------------------------------------------------


@router.get("/groups")
async def list_groups(request: Request, _: dict = Depends(require_admin)):
    return [
        {"id": str(g["_id"]), "name": g["name"], "position": g["position"]}
        async for g in request.app.state.db.service_groups.find().sort("position", 1)
    ]


@router.post("/groups", status_code=201)
async def create_group(
    body: GroupIn, request: Request, _: dict = Depends(require_admin)
):
    db = request.app.state.db
    last = await db.service_groups.find_one(sort=[("position", -1)])
    result = await db.service_groups.insert_one(
        {"name": body.name, "position": int(last["position"] + 1) if last else 0}
    )
    return {"id": str(result.inserted_id)}


@router.patch("/groups/{group_id}")
async def update_group(
    group_id: str,
    body: GroupIn,
    request: Request,
    _: dict = Depends(require_admin),
):
    result = await request.app.state.db.service_groups.update_one(
        {"_id": oid(group_id)}, {"$set": {"name": body.name}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"ok": True}


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: str, request: Request, _: dict = Depends(require_admin)
):
    db = request.app.state.db
    gid = oid(group_id)
    result = await db.service_groups.delete_one({"_id": gid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    # Its services survive, ungrouped, rather than disappearing with the group.
    await db.services.update_many({"group_id": gid}, {"$set": {"group_id": None}})
    return {"ok": True}


@router.post("/groups/reorder")
async def reorder_groups(
    body: Reorder, request: Request, _: dict = Depends(require_admin)
):
    db = request.app.state.db
    for position, group_id in enumerate(body.ids):
        await db.service_groups.update_one(
            {"_id": oid(group_id)}, {"$set": {"position": position}}
        )
    return {"ok": True}
