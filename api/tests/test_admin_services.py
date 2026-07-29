import pytest

from api.constants import MAJOR, OPERATIONAL
from api.tests.conftest import login, needs_mongo

pytestmark = pytest.mark.asyncio


async def make_service(client, name="REST API"):
    res = await client.post("/api/v1/admin/services", json={"name": name})
    assert res.status_code == 201, res.text
    return res.json()["id"]


@needs_mongo
async def test_every_admin_route_rejects_anonymous(client, db):
    for method, path in [
        ("get", "/api/v1/admin/services"),
        ("post", "/api/v1/admin/services"),
        ("get", "/api/v1/admin/groups"),
        ("post", "/api/v1/admin/groups"),
        ("post", "/api/v1/admin/services/reorder"),
    ]:
        res = await client.request(method.upper(), path, json={"name": "x"})
        assert res.status_code == 401, f"{method} {path} -> {res.status_code}"


@needs_mongo
async def test_responder_is_forbidden_from_service_management(
    client, responder
):
    await login(client, responder)
    res = await client.get("/api/v1/admin/services")
    assert res.status_code == 403


@needs_mongo
async def test_create_service_opens_its_history(client, db, owner):
    await login(client, owner)
    service_id = await make_service(client)

    events = await db.status_history.count_documents({})
    assert events == 1, "a new service must start with an opening event"
    doc = await db.status_history.find_one({})
    assert doc["status"] == OPERATIONAL
    assert doc["changed_by"] == owner["email"]


@needs_mongo
async def test_status_toggle_writes_history_and_cache_together(
    client, db, owner
):
    await login(client, owner)
    service_id = await make_service(client)

    res = await client.post(
        f"/api/v1/admin/services/{service_id}/status",
        json={"status": MAJOR, "note": "Elevated latency in EU region"},
    )
    assert res.status_code == 200

    from bson import ObjectId

    service = await db.services.find_one({"_id": ObjectId(service_id)})
    assert service["current_status"] == MAJOR

    latest = await db.status_history.find_one(sort=[("created_at", -1)])
    assert latest["status"] == MAJOR
    assert latest["note"] == "Elevated latency in EU region"
    assert latest["changed_by"] == owner["email"]


@needs_mongo
async def test_unknown_status_is_rejected(client, db, owner):
    await login(client, owner)
    service_id = await make_service(client)
    res = await client.post(
        f"/api/v1/admin/services/{service_id}/status",
        json={"status": "on_fire"},
    )
    assert res.status_code == 422
    # And nothing was written.
    assert await db.status_history.count_documents({"status": "on_fire"}) == 0


@needs_mongo
async def test_toggling_a_missing_service_is_404(client, db, owner):
    await login(client, owner)
    res = await client.post(
        "/api/v1/admin/services/507f1f77bcf86cd799439011/status",
        json={"status": MAJOR},
    )
    assert res.status_code == 404


@needs_mongo
async def test_malformed_id_is_400_not_500(client, db, owner):
    await login(client, owner)
    res = await client.post(
        "/api/v1/admin/services/not-an-objectid/status",
        json={"status": MAJOR},
    )
    assert res.status_code == 400


@needs_mongo
async def test_reorder_produces_a_dense_sequence(client, db, owner):
    await login(client, owner)
    ids = [await make_service(client, n) for n in ("A", "B", "C")]

    res = await client.post(
        "/api/v1/admin/services/reorder", json={"ids": list(reversed(ids))}
    )
    assert res.status_code == 200

    listed = (await client.get("/api/v1/admin/services")).json()
    assert [s["name"] for s in listed] == ["C", "B", "A"]
    assert [s["position"] for s in listed] == [0, 1, 2]


@needs_mongo
async def test_deleting_a_service_removes_its_history(client, db, owner):
    await login(client, owner)
    service_id = await make_service(client)
    await client.post(
        f"/api/v1/admin/services/{service_id}/status", json={"status": MAJOR}
    )
    assert await db.status_history.count_documents({}) == 2

    res = await client.delete(f"/api/v1/admin/services/{service_id}")
    assert res.status_code == 200
    assert await db.status_history.count_documents({}) == 0


@needs_mongo
async def test_deleting_a_group_keeps_its_services(client, db, owner):
    await login(client, owner)
    group_id = (
        await client.post("/api/v1/admin/groups", json={"name": "API"})
    ).json()["id"]
    res = await client.post(
        "/api/v1/admin/services", json={"name": "Webhooks", "group_id": group_id}
    )
    service_id = res.json()["id"]

    await client.delete(f"/api/v1/admin/groups/{group_id}")

    listed = (await client.get("/api/v1/admin/services")).json()
    assert len(listed) == 1
    assert listed[0]["id"] == service_id
    assert listed[0]["group_id"] is None
