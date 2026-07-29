import os

import pytest
from httpx import ASGITransport, AsyncClient

from api.constants import BANNER, OPERATIONAL, STATUSES
from api.db import get_client, get_db
from api.main import _cache, app

pytestmark = pytest.mark.asyncio

needs_mongo = pytest.mark.skipif(
    not os.getenv("MONGO_URL"), reason="MONGO_URL not set"
)


@pytest.fixture
async def client():
    # ASGITransport does not run lifespan events, so wire up the same state the
    # lifespan handler would have set.
    mongo = get_client()
    app.state.client = mongo
    app.state.db = get_db(mongo)
    _cache.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as ac:
        yield ac
    await mongo.close()


@needs_mongo
async def test_summary_returns_the_expected_top_level_shape(client):
    body = (await client.get("/api/v1/status/summary")).json()
    assert set(body) == {
        "product_name", "updated_at", "indicator", "groups", "ungrouped"}
    assert body["indicator"]["level"] in STATUSES
    assert body["indicator"]["text"] == BANNER[body["indicator"]["level"]]


@needs_mongo
async def test_every_service_has_ninety_days(client):
    body = (await client.get("/api/v1/status/summary")).json()
    services = [s for g in body["groups"] for s in g["services"]]
    services += body["ungrouped"]
    assert services, "seed the database first: python -m api.seed"
    for service in services:
        assert len(service["days"]) == 90
        assert service["status"] in STATUSES
        assert set(service["days"][0]) == {
            "date", "status", "uptime", "incident_id"}


@needs_mongo
async def test_indicator_is_the_worst_current_status(client):
    body = (await client.get("/api/v1/status/summary")).json()
    services = [s for g in body["groups"] for s in g["services"]]
    services += body["ungrouped"]
    statuses = {s["status"] for s in services}
    if statuses == {OPERATIONAL}:
        assert body["indicator"]["level"] == OPERATIONAL
    else:
        assert body["indicator"]["level"] != OPERATIONAL


@needs_mongo
async def test_ids_are_strings_not_objectids(client):
    body = (await client.get("/api/v1/status/summary")).json()
    for group in body["groups"]:
        assert isinstance(group["id"], str)
        for service in group["services"]:
            assert isinstance(service["id"], str)
