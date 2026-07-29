# Public Status Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public status page that shows every service's current status and a 90-day uptime bar computed from status-change history.

**Architecture:** A FastAPI service owns MongoDB and every piece of derived data, exposing one public endpoint `GET /api/v1/status/summary`. A Next.js App Router frontend renders that single JSON response server-side and never touches the database. Uptime is computed from `status_history` change events on request, not stored.

**Tech Stack:** Python 3.11+, FastAPI, PyMongo `AsyncMongoClient`, Pydantic v2, pytest, MongoDB 6+, Next.js 15 (App Router), TypeScript, Tailwind CSS v4.

## Global Constraints

- Only code under `api/` may connect to MongoDB. `web/` consumes HTTP JSON only.
- The five status values are a closed set, spelled exactly: `operational`, `degraded_performance`, `partial_outage`, `major_outage`, `maintenance`.
- Severity rank, used for both "worst status" and the global banner: `major_outage` (4) > `partial_outage` (3) > `degraded_performance` (2) > `maintenance` (1) > `operational` (0). A major outage outranks a concurrent maintenance window.
- Downtime weights: `operational` 0.0, `degraded_performance` 0.5, `partial_outage` 0.75, `major_outage` 1.0. `maintenance` is excluded from the uptime denominator entirely.
- All datetimes are timezone-aware UTC. The Mongo client is constructed with `tz_aware=True` so reads come back aware, not naive.
- Product name comes from the `PRODUCT_NAME` environment variable, default `"Status"`. It is never hardcoded in a component.
- Every status is conveyed by icon **and** text label. Never color alone.
- Dark mode uses the OS preference via Tailwind's default `prefers-color-scheme` behavior. No theme toggle, no theme JavaScript.
- Do not create collections beyond `service_groups`, `services`, `status_history`. Incidents, feedback, subscribers, and admin users belong to later cycles.
- Commit after every task.

---

### Task 1: Repository scaffold, Mongo connection, schema validators and indexes

**Files:**
- Create: `api/requirements.txt`
- Create: `api/__init__.py`
- Create: `api/constants.py`
- Create: `api/db.py`
- Create: `api/test_db.py`
- Create: `.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: `api/constants.py` exporting `STATUSES: list[str]`, `SEVERITY: dict[str, int]`, `DOWNTIME_WEIGHT: dict[str, float]`, `MAINTENANCE: str`, `OPERATIONAL: str`. `api/db.py` exporting `get_client() -> AsyncMongoClient`, `get_db()`, and `async def setup(db) -> None`.

- [ ] **Step 1: Create the dependency file**

Create `api/requirements.txt`:

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
pymongo==4.10.1
pydantic==2.10.4
python-dotenv==1.0.1
pytest==8.3.4
pytest-asyncio==0.25.0
httpx==0.28.1
```

- [ ] **Step 2: Create the environment example**

Create `.env.example`:

```
MONGO_URL=mongodb://localhost:27017
MONGO_DB=statuspage
PRODUCT_NAME=Status
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Then copy it to `.env` locally and start MongoDB before continuing.

- [ ] **Step 3: Create the constants module**

Create `api/__init__.py` as an empty file. Create `api/constants.py`:

```python
"""Status vocabulary shared by every module. One source of truth."""

OPERATIONAL = "operational"
DEGRADED = "degraded_performance"
PARTIAL = "partial_outage"
MAJOR = "major_outage"
MAINTENANCE = "maintenance"

STATUSES = [OPERATIONAL, DEGRADED, PARTIAL, MAJOR, MAINTENANCE]

# Higher wins when picking the "worst" status. A major outage outranks a
# concurrent maintenance window, so maintenance sits below the real failures.
SEVERITY = {
    OPERATIONAL: 0,
    MAINTENANCE: 1,
    DEGRADED: 2,
    PARTIAL: 3,
    MAJOR: 4,
}

# Fraction of a span that counts as downtime. Maintenance has no entry: it is
# excluded from the denominator rather than weighted.
DOWNTIME_WEIGHT = {
    OPERATIONAL: 0.0,
    DEGRADED: 0.5,
    PARTIAL: 0.75,
    MAJOR: 1.0,
}

BANNER = {
    OPERATIONAL: "All Systems Operational",
    MAINTENANCE: "Scheduled Maintenance in Progress",
    DEGRADED: "Degraded Performance",
    PARTIAL: "Partial System Outage",
    MAJOR: "Major System Outage",
}
```

- [ ] **Step 4: Write the failing test for schema enforcement**

Create `api/test_db.py`:

```python
import os

import pytest
from pymongo.errors import WriteError

from api.constants import MAJOR
from api.db import get_client, setup

pytestmark = pytest.mark.asyncio

# ponytail: these hit a real MongoDB. Skipping when MONGO_URL is unset keeps
# `pytest` green on a machine without a database; CI sets the variable.
needs_mongo = pytest.mark.skipif(
    not os.getenv("MONGO_URL"), reason="MONGO_URL not set"
)


@pytest.fixture
async def db():
    client = get_client()
    name = "statuspage_test"
    await client.drop_database(name)
    database = client[name]
    await setup(database)
    yield database
    await client.drop_database(name)
    await client.close()


@needs_mongo
async def test_setup_is_idempotent(db):
    await setup(db)
    await setup(db)
    names = await db.list_collection_names()
    assert {"services", "service_groups", "status_history"} <= set(names)


@needs_mongo
async def test_rejects_unknown_status(db):
    with pytest.raises(WriteError):
        await db.services.insert_one(
            {"name": "API", "current_status": "on_fire", "position": 0}
        )


@needs_mongo
async def test_accepts_known_status(db):
    result = await db.services.insert_one(
        {"name": "API", "current_status": MAJOR, "position": 0}
    )
    assert result.inserted_id is not None
```

Create `pytest.ini` at the **repository root**, not inside `api/`, so `python -m pytest api/` run from the root picks it up:

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `python -m pytest api/test_db.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.db'`

- [ ] **Step 6: Write the database module**

Create `api/db.py`:

```python
"""Mongo connection plus the idempotent schema setup.

MongoDB has no migration files. This module is the equivalent step: it applies
a JSON Schema validator per collection so a bad status value is rejected by the
database, not by application code, and it creates the indexes the read paths
need. Safe to run repeatedly.
"""

import os

from dotenv import load_dotenv
from pymongo import ASCENDING, AsyncMongoClient

from api.constants import STATUSES

load_dotenv()


def get_client() -> AsyncMongoClient:
    # tz_aware=True so datetimes come back as aware UTC rather than naive.
    return AsyncMongoClient(
        os.getenv("MONGO_URL", "mongodb://localhost:27017"), tz_aware=True
    )


def get_db(client: AsyncMongoClient | None = None):
    client = client or get_client()
    return client[os.getenv("MONGO_DB", "statuspage")]


def _obj(properties: dict, required: list[str]) -> dict:
    return {
        "$jsonSchema": {
            "bsonType": "object",
            "required": required,
            "properties": properties,
        }
    }


VALIDATORS = {
    "service_groups": _obj(
        {
            "name": {"bsonType": "string"},
            "position": {"bsonType": "int"},
        },
        ["name", "position"],
    ),
    "services": _obj(
        {
            "name": {"bsonType": "string"},
            "description": {"bsonType": ["string", "null"]},
            "group_id": {"bsonType": ["objectId", "null"]},
            "current_status": {"enum": STATUSES},
            "position": {"bsonType": "int"},
            "created_at": {"bsonType": "date"},
        },
        ["name", "current_status", "position"],
    ),
    "status_history": _obj(
        {
            "service_id": {"bsonType": "objectId"},
            "status": {"enum": STATUSES},
            "note": {"bsonType": ["string", "null"]},
            "changed_by": {"bsonType": ["string", "null"]},
            "created_at": {"bsonType": "date"},
        },
        ["service_id", "status", "created_at"],
    ),
}

INDEXES = {
    "service_groups": [[("position", ASCENDING)]],
    "services": [[("position", ASCENDING)]],
    "status_history": [[("service_id", ASCENDING), ("created_at", ASCENDING)]],
}


async def setup(db) -> None:
    existing = set(await db.list_collection_names())
    for name, validator in VALIDATORS.items():
        if name in existing:
            await db.command("collMod", name, validator=validator)
        else:
            await db.create_collection(name, validator=validator)
    for name, keys in INDEXES.items():
        for key in keys:
            await db[name].create_index(key)


if __name__ == "__main__":
    import asyncio

    async def main():
        client = get_client()
        await setup(get_db(client))
        print("schema validators and indexes applied")
        await client.close()

    asyncio.run(main())
```

- [ ] **Step 7: Run the setup script against a live database**

Run: `python -m api.db`
Expected: prints `schema validators and indexes applied`

This is the "confirm the migration before generating UI" gate from the build order. Do not proceed past this task until it succeeds against a real MongoDB.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `python -m pytest api/test_db.py -v`
Expected: 3 passed

- [ ] **Step 9: Commit**

```bash
git add api/ .env.example
git commit -m "feat: mongo connection, schema validators, indexes"
```

---

### Task 2: Uptime computation

**Files:**
- Create: `api/uptime.py`
- Create: `api/test_uptime.py`

**Interfaces:**
- Consumes: `api.constants` — `SEVERITY`, `DOWNTIME_WEIGHT`, `MAINTENANCE`.
- Produces: `api/uptime.py` exporting `compute_days(events, created_at, now, days=90) -> list[dict]` and `overall_percent(day_stats) -> float | None`. Each returned day dict has keys `date` (str, `YYYY-MM-DD`), `status` (str or `None`), `uptime` (float or `None`), `incident_id` (always `None` this cycle). `events` is a list of dicts with keys `status` and `created_at`, sorted ascending by `created_at`.

This module is pure: it takes events and returns numbers. No database, no I/O. That is what makes it directly testable.

> **Correction applied during execution.** The test block below and the implementation below contradicted each other on whether the window includes today: the implementation's `first = today - DAY * (days - 1)` includes today, while `test_returns_the_requested_number_of_days_ending_today` pinned `NOW` to midnight and asserted a window ending yesterday. Ruling: **the window includes today as a partial day clipped at `now`**, so the implementation stands and the fixture was wrong. As shipped (commit `e5a326a`), `NOW` is `2026-01-04 12:00 UTC`, every `days=3` is `days=4`, and a `test_today_is_clipped_at_now_not_the_full_day` case pins the partial-day arithmetic. Read `api/test_uptime.py` for the current tests.

- [ ] **Step 1: Write the failing tests**

Create `api/test_uptime.py`:

```python
from datetime import datetime, timedelta, timezone

from api.constants import DEGRADED, MAINTENANCE, MAJOR, OPERATIONAL, PARTIAL
from api.uptime import compute_days, overall_percent

DAY = timedelta(days=1)
BIRTH = datetime(2026, 1, 1, tzinfo=timezone.utc)
NOW = datetime(2026, 1, 4, tzinfo=timezone.utc)


def at(day: int, hour: int = 0) -> datetime:
    return datetime(2026, 1, day, hour, tzinfo=timezone.utc)


def test_full_operational_day_is_100_percent():
    events = [{"status": OPERATIONAL, "created_at": BIRTH}]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["date"] == "2026-01-01"
    assert days[0]["status"] == OPERATIONAL
    assert days[0]["uptime"] == 100.0


def test_half_day_major_outage_is_50_percent():
    events = [
        {"status": OPERATIONAL, "created_at": BIRTH},
        {"status": MAJOR, "created_at": at(1, 12)},
        {"status": OPERATIONAL, "created_at": at(2)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["uptime"] == 50.0
    assert days[0]["status"] == MAJOR


def test_half_day_degraded_is_75_percent():
    events = [
        {"status": OPERATIONAL, "created_at": BIRTH},
        {"status": DEGRADED, "created_at": at(1, 12)},
        {"status": OPERATIONAL, "created_at": at(2)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["uptime"] == 75.0
    assert days[0]["status"] == DEGRADED


def test_full_day_partial_outage_is_25_percent():
    events = [
        {"status": PARTIAL, "created_at": BIRTH},
        {"status": OPERATIONAL, "created_at": at(2)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["uptime"] == 25.0


def test_maintenance_is_excluded_from_the_denominator():
    events = [{"status": MAINTENANCE, "created_at": BIRTH}]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["status"] == MAINTENANCE
    assert days[0]["uptime"] is None


def test_maintenance_does_not_dilute_a_real_outage():
    # Half the day is maintenance, the other half is a major outage.
    # The denominator is only the non-maintenance half, so uptime is 0%.
    events = [
        {"status": MAINTENANCE, "created_at": BIRTH},
        {"status": MAJOR, "created_at": at(1, 12)},
        {"status": OPERATIONAL, "created_at": at(2)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["uptime"] == 0.0
    assert days[0]["status"] == MAJOR


def test_days_before_creation_have_no_data():
    born = at(2)
    events = [{"status": OPERATIONAL, "created_at": born}]
    days = compute_days(events, born, NOW, days=3)
    assert days[0]["date"] == "2026-01-01"
    assert days[0]["status"] is None
    assert days[0]["uptime"] is None


def test_worst_status_wins_the_day_even_when_brief():
    # Six minutes of major outage still colors the day red.
    events = [
        {"status": OPERATIONAL, "created_at": BIRTH},
        {"status": MAJOR, "created_at": at(1, 12)},
        {"status": OPERATIONAL, "created_at": datetime(
            2026, 1, 1, 12, 6, tzinfo=timezone.utc)},
    ]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["status"] == MAJOR
    assert days[0]["uptime"] > 99.0


def test_returns_the_requested_number_of_days_ending_today():
    events = [{"status": OPERATIONAL, "created_at": BIRTH}]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert [d["date"] for d in days] == [
        "2026-01-01", "2026-01-02", "2026-01-03"]


def test_incident_id_is_present_but_null_this_cycle():
    events = [{"status": OPERATIONAL, "created_at": BIRTH}]
    days = compute_days(events, BIRTH, NOW, days=3)
    assert days[0]["incident_id"] is None


def test_no_events_at_all_is_all_no_data():
    days = compute_days([], BIRTH, NOW, days=3)
    assert all(d["status"] is None and d["uptime"] is None for d in days)


def test_overall_percent_ignores_no_data_days():
    stats = [
        {"uptime": 100.0},
        {"uptime": None},
        {"uptime": 50.0},
    ]
    assert overall_percent(stats) == 75.0


def test_overall_percent_is_none_when_nothing_measurable():
    assert overall_percent([{"uptime": None}]) is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest api/test_uptime.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.uptime'`

- [ ] **Step 3: Write the implementation**

Create `api/uptime.py`:

```python
"""Derive per-day uptime from status-change events.

status_history stores changes, not daily rows. A day's figure is the weighted
downtime across the spans overlapping that day. Maintenance is excluded from
the denominator so a planned window neither inflates nor penalizes the number.

The bar color is the worst status seen in the day, independent of the
percentage: a two-minute major outage colors the day red even though the day is
99.9% up. The bar signals that something happened; the percentage quantifies it.
"""

from datetime import datetime, timedelta

from api.constants import DOWNTIME_WEIGHT, MAINTENANCE, SEVERITY

DAY = timedelta(days=1)


def _spans(events, floor: datetime, ceiling: datetime):
    """Event list to (status, start, end) tuples clipped to [floor, ceiling)."""
    out = []
    for i, event in enumerate(events):
        start = event["created_at"]
        end = events[i + 1]["created_at"] if i + 1 < len(events) else ceiling
        start = max(start, floor)
        end = min(end, ceiling)
        if end > start:
            out.append((event["status"], start, end))
    return out


def compute_days(events, created_at: datetime, now: datetime, days: int = 90):
    """Return `days` day-stat dicts, oldest first, ending on now's date.

    ponytail: re-walks the event list per day, so O(days x events). At 90 days
    and a handful of events that is nothing. If history grows past a few
    thousand events per service, precompute spans once and bucket them by day.
    """
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    first = today - DAY * (days - 1)

    out = []
    for offset in range(days):
        day_start = first + DAY * offset
        day_end = day_start + DAY
        floor = max(day_start, created_at)
        ceiling = min(day_end, now)

        stat = {
            "date": day_start.date().isoformat(),
            "status": None,
            "uptime": None,
            "incident_id": None,
        }

        if ceiling > floor:
            spans = _spans(events, floor, ceiling)
            if spans:
                stat["status"] = max(
                    (s for s, _, _ in spans), key=lambda s: SEVERITY[s]
                )
                measured = 0.0
                downtime = 0.0
                for status, start, end in spans:
                    if status == MAINTENANCE:
                        continue
                    seconds = (end - start).total_seconds()
                    measured += seconds
                    downtime += seconds * DOWNTIME_WEIGHT[status]
                if measured > 0:
                    stat["uptime"] = round(
                        100.0 * (1.0 - downtime / measured), 4)

        out.append(stat)
    return out


def overall_percent(day_stats):
    """Mean of the days that have data. None when nothing is measurable."""
    measured = [d["uptime"] for d in day_stats if d["uptime"] is not None]
    if not measured:
        return None
    return round(sum(measured) / len(measured), 4)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest api/test_uptime.py -v`
Expected: 13 passed

- [ ] **Step 5: Commit**

```bash
git add api/uptime.py api/test_uptime.py
git commit -m "feat: compute 90-day uptime from status history"
```

---

### Task 3: Seed data

**Files:**
- Create: `api/seed.py`

**Interfaces:**
- Consumes: `api.db.get_client`, `api.db.get_db`, `api.db.setup`, `api.constants`.
- Produces: a populated database. No importable functions other tasks depend on.

- [ ] **Step 1: Write the seed script**

Create `api/seed.py`:

```python
"""Wipe and repopulate the database with realistic demo data.

Generates 90 days of status history including a handful of outages and one
maintenance window, so the uptime bars have something to show.
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone

from api.constants import DEGRADED, MAINTENANCE, MAJOR, OPERATIONAL, PARTIAL
from api.db import get_client, get_db, setup

GROUPS = [
    {"name": "API", "position": 0},
    {"name": "Applications", "position": 1},
]

SERVICES = [
    ("REST API", "Core HTTP API", 0, 0),
    ("Webhooks", "Outbound event delivery", 0, 1),
    ("GraphQL API", "GraphQL gateway", 0, 2),
    ("Web App", "Browser client", 1, 3),
    ("Mobile App", "iOS and Android clients", 1, 4),
    ("Status Page", "This page", None, 5),
]

# (day offset from 90 days ago, hour, duration hours, status)
OUTAGES = [
    (12, 3, 4, DEGRADED),
    (31, 14, 2, MAJOR),
    (44, 9, 6, PARTIAL),
    (58, 22, 1, DEGRADED),
    (73, 2, 3, MAINTENANCE),
    (81, 16, 5, PARTIAL),
]


async def main():
    client = get_client()
    db = get_db(client)

    for name in ("services", "service_groups", "status_history"):
        await db[name].drop()
    await setup(db)

    now = datetime.now(timezone.utc).replace(microsecond=0)
    birth = now - timedelta(days=90)

    group_ids = []
    for group in GROUPS:
        result = await db.service_groups.insert_one(dict(group))
        group_ids.append(result.inserted_id)

    rng = random.Random(20260729)  # fixed seed so reseeding is reproducible

    for name, description, group_index, position in SERVICES:
        service = {
            "name": name,
            "description": description,
            "group_id": group_ids[group_index] if group_index is not None
            else None,
            "current_status": OPERATIONAL,
            "position": position,
            "created_at": birth,
        }
        result = await db.services.insert_one(service)
        service_id = result.inserted_id

        history = [
            {
                "service_id": service_id,
                "status": OPERATIONAL,
                "note": None,
                "changed_by": "seed",
                "created_at": birth,
            }
        ]

        # Each service gets a random subset of the outages, so the bars differ.
        for offset, hour, duration, status in OUTAGES:
            if rng.random() > 0.55:
                continue
            start = birth + timedelta(days=offset, hours=hour)
            history.append(
                {
                    "service_id": service_id,
                    "status": status,
                    "note": "Scheduled maintenance window"
                    if status == MAINTENANCE
                    else "Elevated error rates",
                    "changed_by": "seed",
                    "created_at": start,
                }
            )
            history.append(
                {
                    "service_id": service_id,
                    "status": OPERATIONAL,
                    "note": None,
                    "changed_by": "seed",
                    "created_at": start + timedelta(hours=duration),
                }
            )

        history.sort(key=lambda e: e["created_at"])
        await db.status_history.insert_many(history)
        await db.services.update_one(
            {"_id": service_id},
            {"$set": {"current_status": history[-1]["status"]}},
        )

    counts = {
        name: await db[name].count_documents({})
        for name in ("service_groups", "services", "status_history")
    }
    print("seeded:", counts)
    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Run the seed script**

Run: `python -m api.seed`
Expected: `seeded: {'service_groups': 2, 'services': 6, 'status_history': ...}` where the history count is above 6.

- [ ] **Step 3: Verify the data is shaped correctly**

Run:

```bash
python -c "import asyncio;from api.db import get_client,get_db;c=get_client();d=get_db(c);print(asyncio.run(d.services.find_one()))"
```

Expected: a service document with `current_status` set to one of the five values and a `created_at` about 90 days in the past.

- [ ] **Step 4: Commit**

```bash
git add api/seed.py
git commit -m "feat: seed script with 90 days of demo history"
```

---

### Task 4: The summary endpoint

**Files:**
- Create: `api/models.py`
- Create: `api/main.py`
- Create: `api/test_main.py`

**Interfaces:**
- Consumes: `api.db.get_client`, `api.db.get_db`, `api.uptime.compute_days`, `api.uptime.overall_percent`, `api.constants.SEVERITY`, `api.constants.BANNER`, `api.constants.OPERATIONAL`.
- Produces: `GET /api/v1/status/summary` returning the JSON shape defined below. This is the only contract the frontend depends on.

Response shape:

```json
{
  "product_name": "Status",
  "updated_at": "2026-07-29T12:00:00+00:00",
  "indicator": { "level": "major_outage", "text": "Major System Outage" },
  "groups": [
    { "id": "...", "name": "API", "services": [ ... ] }
  ],
  "ungrouped": [ ... ]
}
```

A service object:

```json
{
  "id": "...",
  "name": "REST API",
  "description": "Core HTTP API",
  "status": "operational",
  "uptime_percent": 99.4812,
  "days": [
    { "date": "2026-05-01", "status": "operational",
      "uptime": 100.0, "incident_id": null }
  ]
}
```

- [ ] **Step 1: Write the failing test**

Create `api/test_main.py`:

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest api/test_main.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.main'`

- [ ] **Step 3: Write the response models**

Create `api/models.py`:

```python
"""Response models. These define the contract the frontend renders against."""

from pydantic import BaseModel


class Day(BaseModel):
    date: str
    status: str | None
    uptime: float | None
    # Always None this cycle. Present so the shape does not change when
    # incidents land in the next cycle.
    incident_id: str | None


class Service(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    uptime_percent: float | None
    days: list[Day]


class Group(BaseModel):
    id: str
    name: str
    services: list[Service]


class Indicator(BaseModel):
    level: str
    text: str


class Summary(BaseModel):
    product_name: str
    updated_at: str
    indicator: Indicator
    groups: list[Group]
    ungrouped: list[Service]
```

- [ ] **Step 4: Write the application**

Create `api/main.py`:

```python
"""The public API. One endpoint this cycle."""

import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

# The frontend fetches server-side, but a browser-embedded status badge is an
# explicit goal for this endpoint, so it is readable from anywhere.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python -m pytest api/ -v`
Expected: all tests pass, including Tasks 1 and 2.

- [ ] **Step 6: Verify the live endpoint**

Run: `uvicorn api.main:app --reload --port 8000`

Then in another shell: `curl -s localhost:8000/api/v1/status/summary | python -m json.tool | head -40`
Expected: JSON with `product_name`, an `indicator`, and groups containing services with 90-element `days` arrays.

- [ ] **Step 7: Commit**

```bash
git add api/models.py api/main.py api/test_main.py
git commit -m "feat: public status summary endpoint"
```

---

### Task 5: Frontend scaffold, status vocabulary, and the global banner

**Files:**
- Create: `web/` via `create-next-app`
- Create: `web/lib/api.ts`
- Create: `web/lib/status.ts`
- Create: `web/components/StatusBanner.tsx`
- Modify: `web/app/page.tsx`
- Modify: `web/app/layout.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: `GET /api/v1/status/summary` from Task 4.
- Produces: `web/lib/api.ts` exporting types `Day`, `Service`, `Group`, `Indicator`, `Summary` and `getSummary(): Promise<Summary>`. `web/lib/status.ts` exporting `STATUS_META: Record<string, StatusMeta>`, `NO_DATA: StatusMeta`, and `meta(status: string | null): StatusMeta`, where `StatusMeta` is `{label: string; dot: string; bar: string; text: string; icon: string}`. `web/components/StatusBanner.tsx` default-exporting `StatusBanner({ indicator }: { indicator: Indicator })`.

- [ ] **Step 1: Scaffold the Next.js app**

Run from the repository root:

```bash
npx create-next-app@latest web --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*" --no-turbopack --use-npm
```

Accept the defaults for anything else it asks.

- [ ] **Step 2: Add the API client and its types**

Create `web/lib/api.ts`:

```ts
export type Day = {
  date: string;
  status: string | null;
  uptime: number | null;
  incident_id: string | null;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  uptime_percent: number | null;
  days: Day[];
};

export type Group = { id: string; name: string; services: Service[] };
export type Indicator = { level: string; text: string };

export type Summary = {
  product_name: string;
  updated_at: string;
  indicator: Indicator;
  groups: Group[];
  ungrouped: Service[];
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getSummary(): Promise<Summary> {
  // The API already memoizes for 60s; matching that here keeps the page fresh
  // without hammering it.
  const res = await fetch(`${API}/api/v1/status/summary`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`status API returned ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Add the status vocabulary**

Create `web/lib/status.ts`. Class strings are written out in full because Tailwind only sees literal class names:

```ts
export type StatusMeta = {
  label: string;
  dot: string;
  bar: string;
  text: string;
  icon: string;
};

// Every status carries an icon and a label. Color is never the only signal.
export const STATUS_META: Record<string, StatusMeta> = {
  operational: {
    label: "Operational",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: "✓",
  },
  degraded_performance: {
    label: "Degraded Performance",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
    text: "text-amber-700 dark:text-amber-400",
    icon: "!",
  },
  partial_outage: {
    label: "Partial Outage",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
    icon: "▲",
  },
  major_outage: {
    label: "Major Outage",
    dot: "bg-red-600",
    bar: "bg-red-600",
    text: "text-red-700 dark:text-red-400",
    icon: "✕",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    icon: "⚙",
  },
};

export const NO_DATA: StatusMeta = {
  label: "No data",
  dot: "bg-slate-300 dark:bg-slate-700",
  bar: "bg-slate-200 dark:bg-slate-700",
  text: "text-slate-500 dark:text-slate-400",
  icon: "–",
};

export function meta(status: string | null): StatusMeta {
  return (status && STATUS_META[status]) || NO_DATA;
}
```

- [ ] **Step 4: Write the banner component**

Create `web/components/StatusBanner.tsx`:

```tsx
import type { Indicator } from "@/lib/api";
import { meta } from "@/lib/status";

export default function StatusBanner({
  indicator,
}: {
  indicator: Indicator;
}) {
  const m = meta(indicator.level);
  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${m.dot}`}
      >
        {m.icon}
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">
        {indicator.text}
      </h1>
    </section>
  );
}
```

- [ ] **Step 5: Set the page shell**

Replace `web/app/page.tsx`:

```tsx
import StatusBanner from "@/components/StatusBanner";
import { getSummary } from "@/lib/api";

export const metadata = { title: "Status" };

export default async function Page() {
  const summary = await getSummary();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400">
        {summary.product_name}
      </p>
      <StatusBanner indicator={summary.indicator} />
    </main>
  );
}
```

Replace the body of `web/app/layout.tsx` so the page picks up dark mode from the OS with no JavaScript:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Status",
  description: "Service status and uptime",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify it renders**

With `uvicorn api.main:app --port 8000` running, run `npm run dev` inside `web/` and open `http://localhost:3000`.
Expected: the product name and a banner reading one of the five texts, with a colored icon circle. Toggle your OS to dark mode and confirm the page follows.

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: next.js scaffold, status vocabulary, global banner"
```

---

### Task 6: Uptime bars, service rows, groups, and the legend

**Files:**
- Create: `web/components/UptimeBar.tsx`
- Create: `web/components/ServiceRow.tsx`
- Create: `web/components/ServiceGroup.tsx`
- Create: `web/components/Legend.tsx`
- Modify: `web/app/page.tsx`

**Interfaces:**
- Consumes: `Day`, `Service`, `Group` from `web/lib/api.ts`; `meta`, `STATUS_META` from `web/lib/status.ts`; `StatusBanner` from Task 5.
- Produces: the finished page. Nothing later in this cycle depends on it.

- [ ] **Step 1: Write the uptime bar**

Create `web/components/UptimeBar.tsx`. The tooltip is CSS-only — no state, no positioning library — and each segment carries its own `aria-label` so screen readers get the same information sighted users get on hover:

```tsx
import type { Day } from "@/lib/api";
import { meta } from "@/lib/status";

function describe(day: Day): string {
  const m = meta(day.status);
  const pct =
    day.uptime === null ? "no uptime data" : `${day.uptime.toFixed(2)}% uptime`;
  return `${day.date}: ${m.label}, ${pct}`;
}

export default function UptimeBar({ days }: { days: Day[] }) {
  return (
    <div
      role="group"
      aria-label="90 day uptime history"
      className="flex h-8 items-stretch gap-[2px]"
    >
      {days.map((day) => (
        <span
          key={day.date}
          tabIndex={0}
          role="img"
          aria-label={describe(day)}
          className="group relative flex-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
        >
          <span
            aria-hidden="true"
            className={`block h-full w-full rounded-full ${meta(day.status).bar}`}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block group-focus:block dark:bg-slate-100 dark:text-slate-900"
          >
            {describe(day)}
          </span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the service row**

Create `web/components/ServiceRow.tsx`:

```tsx
import type { Service } from "@/lib/api";
import { meta } from "@/lib/status";
import UptimeBar from "./UptimeBar";

export default function ServiceRow({ service }: { service: Service }) {
  const m = meta(service.status);
  return (
    <div className="border-b border-slate-200 py-5 last:border-0 dark:border-slate-800">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="font-medium">{service.name}</span>
        <span className={`flex items-center gap-1.5 text-sm ${m.text}`}>
          <span aria-hidden="true">{m.icon}</span>
          {m.label}
        </span>
      </div>
      <UptimeBar days={service.days} />
      <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>90 days ago</span>
        <span>
          {service.uptime_percent === null
            ? "No data"
            : `${service.uptime_percent.toFixed(2)}% uptime`}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the collapsible group**

Create `web/components/ServiceGroup.tsx`. Collapsing uses native `<details>`, so it works without JavaScript and is keyboard accessible for free:

```tsx
import type { Group } from "@/lib/api";
import ServiceRow from "./ServiceRow";

export default function ServiceGroup({ group }: { group: Group }) {
  return (
    <details
      open
      className="border-b border-slate-200 py-2 last:border-0 dark:border-slate-800"
    >
      <summary className="cursor-pointer py-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {group.name}
      </summary>
      <div className="pl-1">
        {group.services.map((service) => (
          <ServiceRow key={service.id} service={service} />
        ))}
      </div>
    </details>
  );
}
```

- [ ] **Step 4: Write the legend**

Create `web/components/Legend.tsx`:

```tsx
import { NO_DATA, STATUS_META } from "@/lib/status";

const ENTRIES = [...Object.values(STATUS_META), NO_DATA];

export default function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
      {ENTRIES.map((m) => (
        <li key={m.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${m.dot}`}
          />
          {m.label}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Assemble the page**

Replace `web/app/page.tsx`:

```tsx
import Legend from "@/components/Legend";
import ServiceGroup from "@/components/ServiceGroup";
import ServiceRow from "@/components/ServiceRow";
import StatusBanner from "@/components/StatusBanner";
import { getSummary } from "@/lib/api";

export default async function Page() {
  const summary = await getSummary();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400">
        {summary.product_name}
      </p>

      <StatusBanner indicator={summary.indicator} />

      <section className="mt-10 rounded-xl border border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        {summary.groups.map((group) => (
          <ServiceGroup key={group.id} group={group} />
        ))}
        {summary.ungrouped.map((service) => (
          <ServiceRow key={service.id} service={service} />
        ))}
      </section>

      <div className="mt-6">
        <Legend />
      </div>

      <p className="mt-10 text-xs text-slate-400 dark:text-slate-600">
        Updated {new Date(summary.updated_at).toUTCString()}
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Verify the finished page**

With the API running, reload `http://localhost:3000` and check each of these:

1. Every service shows a 90-segment bar with visible outage days in a different color.
2. Hovering a segment shows a tooltip with date, status label, and uptime percentage.
3. Tabbing into a bar moves through segments and shows the same tooltip on focus.
4. The group headers collapse and expand when clicked or activated with the keyboard.
5. The legend lists all five statuses plus "No data".
6. Narrowing the window to phone width keeps the layout readable with no horizontal scroll.
7. Switching the OS to dark mode changes the page.

- [ ] **Step 7: Run the full backend test suite one more time**

Run: `python -m pytest api/ -v`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat: uptime bars, service rows, groups, legend"
```

---

## Verification of the Whole Cycle

Before calling this cycle done:

- `python -m pytest api/ -v` passes.
- `python -m api.db` runs cleanly against a fresh database.
- `python -m api.seed` populates the database and the page reflects it.
- `curl localhost:8000/api/v1/status/summary` returns the documented shape.
- The page renders correctly at phone and desktop widths, in light and dark.
- No file under `web/` imports a MongoDB driver.
- No collections exist beyond `service_groups`, `services`, `status_history`.
