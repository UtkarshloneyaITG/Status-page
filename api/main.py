"""The public API. One endpoint this cycle."""

import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import admin_services, auth, feedback
from api.constants import BANNER, OPERATIONAL, SEVERITY
from api.db import get_client, get_db
from api.models import Day, Group, Indicator, Service, Summary
from api.uptime import compute_days, overall_percent

CACHE_SECONDS = 60

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.client = get_client()
    app.state.db = get_db(app.state.client)
    yield
    await app.state.client.close()


app = FastAPI(title="Status Page API", lifespan=lifespan)

# The admin UI sends its session cookie cross-origin, and credentialed CORS
# forbids a "*" origin — so origins are explicit. Add a badge embedder's origin
# to CORS_ORIGINS to let it read the summary from the browser.
# ponytail: comma-separated env var, not a config system.
_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin_services.router)
app.include_router(feedback.public_router)
app.include_router(feedback.admin_router)

# ponytail: single-process memo. Swap for Redis only if this runs on more than
# one worker and the recompute cost actually shows up in latency.
_cache: dict[str, tuple[float, Summary]] = {}


async def _build_summary(db) -> Summary:
    now = datetime.now(timezone.utc)

    groups = [g async for g in db.service_groups.find().sort("position", 1)]
    services = [s async for s in db.services.find().sort("position", 1)]

    history: dict[object, list[dict]] = {s["_id"]: [] for s in services}
    cursor = db.status_history.find().sort("created_at", 1)
    async for event in cursor:
        if event["service_id"] in history:
            history[event["service_id"]].append(event)

    def to_service(doc) -> Service:
        events = history[doc["_id"]]
        days = compute_days(events, doc.get("created_at", now), now, days=90)
        return Service(
            id=str(doc["_id"]),
            name=doc["name"],
            description=doc.get("description"),
            status=doc["current_status"],
            uptime_percent=overall_percent(days),
            days=[Day(**d) for d in days],
        )

    built = {doc["_id"]: to_service(doc) for doc in services}

    grouped = [
        Group(
            id=str(g["_id"]),
            name=g["name"],
            services=[
                built[s["_id"]] for s in services
                if s.get("group_id") == g["_id"]
            ],
        )
        for g in groups
    ]
    ungrouped = [
        built[s["_id"]] for s in services if s.get("group_id") is None
    ]

    worst = OPERATIONAL
    for service in built.values():
        if SEVERITY[service.status] > SEVERITY[worst]:
            worst = service.status

    return Summary(
        product_name=os.getenv("PRODUCT_NAME", "Status"),
        updated_at=now.isoformat(),
        indicator=Indicator(level=worst, text=BANNER[worst]),
        groups=grouped,
        ungrouped=ungrouped,
    )


@app.get("/api/v1/status/summary", response_model=Summary)
async def summary() -> Summary:
    hit = _cache.get("summary")
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    built = await _build_summary(app.state.db)
    _cache["summary"] = (time.monotonic(), built)
    return built
