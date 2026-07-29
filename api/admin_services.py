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


def _invalidate_cache():
    try:
        from api import main
        main.invalidate_cache()
    except Exception:
        pass


async def record_status(
    db, service_id: ObjectId, status: str, note: str | None, by: str | None
) -> dict:
    """Append a history event with previous_status and refresh the cached current_status."""
    if status not in STATUSES:
        raise HTTPException(status_code=422, detail=f"Unknown status: {status}")

    service = await db.services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    previous_status = service.get("current_status")
    now = datetime.now(timezone.utc)

    event = {
        "service_id": service_id,
        "previous_status": previous_status,
        "status": status,
        "note": note,
        "changed_by": by,
        "created_at": now,
    }
    await db.status_history.insert_one(dict(event))
    await db.services.update_one(
        {"_id": service_id},
        {"$set": {"current_status": status, "updated_at": now}},
    )
    _invalidate_cache()
    return event


# --- request bodies ---------------------------------------------------------


class ServiceIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    group_id: str | None = None
    position: int | None = None
    initial_status: str | None = "operational"


class ServicePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    group_id: str | None = None
    position: int | None = None
    current_status: str | None = None


class BulkStatusIn(BaseModel):
    service_ids: list[str] = Field(min_items=1)
    new_status: str
    optional_note: str | None = Field(default=None, max_length=500)


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
    groups = {g["_id"]: g["name"] async for g in db.service_groups.find({}, {"name": 1})}

    out = []
    async for doc in db.services.find().sort("position", 1):
        gid = doc.get("group_id")
        created_at = doc.get("created_at")
        updated_at = doc.get("updated_at")
        out.append(
            {
                "id": str(doc["_id"]),
                "name": doc["name"],
                "description": doc.get("description"),
                "group_id": str(gid) if gid else None,
                "group_name": groups.get(gid) if gid else None,
                "current_status": doc["current_status"],
                "position": doc["position"],
                "created_at": created_at.isoformat() if created_at else None,
                "updated_at": updated_at.isoformat() if updated_at else None,
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
    gid = oid(body.group_id) if body.group_id else None

    # Prevent duplicate service name within the same group
    duplicate = await db.services.find_one({
        "group_id": gid,
        "name": {"$regex": f"^{body.name.strip()}$", "$options": "i"}
    })
    if duplicate:
        raise HTTPException(
            status_code=400,
            detail="A service with this name already exists in this group"
        )

    now = datetime.now(timezone.utc)
    if body.position is not None:
        pos = body.position
    else:
        last = await db.services.find_one(sort=[("position", -1)])
        pos = int(last["position"] + 1) if last else 0

    status = body.initial_status if body.initial_status in STATUSES else "operational"

    doc = {
        "name": body.name.strip(),
        "description": body.description.strip() if body.description else None,
        "group_id": gid,
        "current_status": status,
        "position": pos,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.services.insert_one(doc)

    # Initial opening event
    await db.status_history.insert_one({
        "service_id": result.inserted_id,
        "previous_status": None,
        "status": status,
        "note": "Initial service creation",
        "changed_by": session["email"],
        "created_at": now,
    })

    _invalidate_cache()
    return {"id": str(result.inserted_id)}


@router.patch("/services/{service_id}")
async def update_service(
    service_id: str,
    body: ServicePatch,
    request: Request,
    session: dict = Depends(require_admin),
):
    db = request.app.state.db
    sid = oid(service_id)
    existing = await db.services.find_one({"_id": sid})
    if not existing:
        raise HTTPException(status_code=404, detail="Service not found")

    changes = body.model_dump(exclude_unset=True)

    if "name" in changes and changes["name"]:
        changes["name"] = changes["name"].strip()
        target_gid = oid(changes.get("group_id", existing.get("group_id"))) if changes.get("group_id") is not None else existing.get("group_id")
        dup = await db.services.find_one({
            "_id": {"$ne": sid},
            "group_id": target_gid,
            "name": {"$regex": f"^{changes['name']}$", "$options": "i"}
        })
        if dup:
            raise HTTPException(
                status_code=400,
                detail="A service with this name already exists in this group"
            )

    if "group_id" in changes:
        changes["group_id"] = oid(changes["group_id"]) if changes["group_id"] else None

    if "description" in changes and isinstance(changes["description"], str):
        changes["description"] = changes["description"].strip() or None

    new_status = changes.pop("current_status", None)
    now = datetime.now(timezone.utc)
    changes["updated_at"] = now

    if changes:
        await db.services.update_one({"_id": sid}, {"$set": changes})

    if new_status and new_status != existing["current_status"]:
        await record_status(
            db, sid, new_status, "Status updated via edit", session["email"]
        )

    _invalidate_cache()
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
    # Clean up related records
    await db.status_history.delete_many({"service_id": sid})
    await db.incident_services.delete_many({"service_id": sid})
    _invalidate_cache()
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
    _invalidate_cache()
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


@router.post("/services/bulk-status")
async def bulk_status(
    body: BulkStatusIn,
    request: Request,
    session: dict = Depends(require_admin),
):
    """Bulk update the status of multiple services simultaneously."""
    if body.new_status not in STATUSES:
        raise HTTPException(status_code=422, detail=f"Unknown status: {body.new_status}")

    db = request.app.state.db
    count = 0
    for sid_str in body.service_ids:
        try:
            sid = oid(sid_str)
            await record_status(
                db,
                sid,
                body.new_status,
                body.optional_note or "Bulk status update",
                session["email"],
            )
            count += 1
        except HTTPException:
            continue

    return {"updated": count, "status": body.new_status}


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
