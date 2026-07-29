# Public Status Page — Design (Cycle 1)

Date: 2026-07-29
Scope: build-order steps 1–2 (schema + seed data, public status page with services and uptime bars)

## Context

The full product brief describes four largely independent subsystems: a public status
page, a user feedback channel, an admin dashboard, and a notifications/feeds/API layer.
Specifying all four at once produces a document too large to hold in working memory and
a plan that drifts before anything ships. This spec covers only the first cycle. Later
cycles get their own spec → plan → implementation pass.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Frontend | Next.js App Router, TypeScript, Tailwind | Per brief |
| Backend | FastAPI + PyMongo `AsyncMongoClient` | User chose Python + MongoDB; Motor is deprecated in favor of PyMongo's built-in async client, so this is one dependency fewer |
| Database | MongoDB | User chose |
| Boundary | Only `api/` touches MongoDB | One place knows the schema |
| Product name | `PRODUCT_NAME` env var, default `"Status"` | Name deferred by user |
| Admin auth | Deferred to cycle 2 | No admin surface exists in cycle 1 |
| Captcha | None; honeypot + rate limit only, in the feedback cycle | User chose |

## Architecture

```
d:\Chat-boat-status-page\
  api\                    FastAPI service
    main.py               app instance + routes
    db.py                 Mongo client, collection validators, index setup
    models.py             Pydantic models
    uptime.py             90-day rollup computed from status_history
    seed.py               seed script
    test_uptime.py        pytest check on the weighting logic
  web\                    Next.js frontend
    app\page.tsx          server component; fetches the API
    components\           StatusBanner, ServiceRow, UptimeBar, Legend
  docs\superpowers\specs\ this document
```

Two processes in development: `uvicorn api.main:app --reload` and `next dev`. Deploy
target is Vercel for `web/` and any Python host for `api/`. `web/` reads
`NEXT_PUBLIC_API_URL`; server components fetch server-side so the browser never needs
direct API access.

### Why the boundary sits here

The data model is non-trivial — uptime is derived, not stored. Putting that derivation
in exactly one language avoids two implementations drifting apart. TypeScript sees
typed JSON and renders it; it never queries Mongo and never recomputes uptime.

## Data Model

Three collections in cycle 1. The remaining collections from the brief
(`incidents`, `incident_updates`, `incident_services`, `maintenances`, `feedback`,
`feedback_votes`, `subscribers`, `admin_users`) are introduced in the cycle that first
needs them.

```
service_groups   _id, name, position
services         _id, name, description, group_id (nullable), current_status,
                 position, created_at
status_history   _id, service_id, status, note, changed_by, created_at
```

`services.current_status` is a denormalized cache of the most recent `status_history`
entry for that service. The public page reads it directly without a lookup.
`status_history` remains the source of truth; any write that changes a service's status
appends a history event and updates the cache in the same operation.

`services.group_id` is nullable — a service can sit at the top level with no group.

### Status values

Exactly five, closed set:

`operational` · `degraded_performance` · `partial_outage` · `major_outage` · `maintenance`

### Schema enforcement

MongoDB has no migration files. The equivalent step, run and confirmed before any UI
work, is a script in `db.py` that:

1. Applies a JSON Schema validator to each collection, so an invalid `status` value is
   rejected by the database rather than by application code.
2. Creates indexes: `status_history(service_id, created_at)`, `services(position)`,
   `service_groups(position)`.

This script is idempotent — safe to re-run against an existing database.

## Uptime Computation

`status_history` stores change events, not one row per day. To compute a given day, walk
the events whose spans overlap that day and weight each span by severity:

| Status | Contribution |
|---|---|
| `operational` | 100% up |
| `maintenance` | excluded from the denominator entirely |
| `degraded_performance` | 50% down |
| `partial_outage` | 75% down |
| `major_outage` | 100% down |

Excluding maintenance from the denominator, rather than counting it as uptime or
downtime, means a planned window neither inflates nor penalizes the figure. A day made
entirely of maintenance has no uptime percentage and renders as its own state.

A day's bar color is the **worst** status observed during that day, independent of the
percentage — a two-minute major outage colors the day red even though the day is
99.9% up. This is deliberate: the bar signals "something happened," the percentage
quantifies it.

Days before a service's `created_at`, and days with no covering event, are "no data":
gray, and excluded from the percentage denominator.

The rollup is computed on request and cached in-process for 60 seconds. Ninety days
across a small number of services is a trivial scan. Marked in code with a `ponytail:`
comment naming the ceiling and the upgrade path (a nightly rollup collection) should
services × history volume outgrow a single query.

## API

One endpoint in cycle 1:

```
GET /api/v1/status/summary
```

Returns the global indicator, the group tree, every service with its current status,
its computed uptime percentage, and its 90 element day array. The public page renders
entirely from this single response. This is the same endpoint the brief specifies for
embedding a status badge elsewhere, so it is public and unauthenticated.

Each day element carries: date, worst status, uptime percentage (nullable), and a
nullable incident reference — the incident field is present in the response shape from
cycle 1 but always null until incidents exist, so the frontend contract does not change
when cycle 2 lands.

## Frontend

### Global banner

Worst current status across all services, mapped per the brief:

| Condition | Text | Color |
|---|---|---|
| all operational | All Systems Operational | green |
| any maintenance | Scheduled Maintenance in Progress | blue |
| any degraded | Degraded Performance | yellow |
| any partial outage | Partial System Outage | orange |
| any major outage | Major System Outage | red |

Evaluated worst-first: a major outage wins over a concurrent maintenance window.

### Service list

Collapsible groups. Each service row shows name, status label, a 90-segment uptime bar,
and the computed percentage. Segments are thin, evenly spaced, rounded caps. Hover or
focus shows a tooltip with date, status, and uptime percentage.

### Accessibility

Every status is conveyed by icon **and** text label, never color alone. The banner is
an ARIA live region so a status change is announced. Uptime segments are keyboard
reachable and expose their tooltip content to assistive technology. Full keyboard
navigation throughout.

### Presentation

Dark mode, responsive, generous whitespace, one accent color, Inter or the system font
stack.

## Out of Scope for Cycle 1

Deferred deliberately, not forgotten: incident history section and `/incidents/[id]`,
`/uptime`, `/history`, RSS and Atom feeds, email subscribe, the admin dashboard, the
feedback channel, maintenance windows, settings. The incident section does not render
at all in cycle 1 — no placeholder markup, no stub collections.

## Testing

One runnable check: `api/test_uptime.py`, asserting the severity weighting, the
maintenance exclusion, and the no-data case. Plain pytest, no fixtures or framework
beyond that. The uptime rollup is the only non-trivial logic in this cycle; the rest is
rendering.

## Build Order Within Cycle 1

1. `db.py` validators and indexes — run and confirm against a live MongoDB before any UI
2. `models.py`, `uptime.py`, `test_uptime.py` — check passes
3. `seed.py` — realistic services, groups, and 90 days of history including outages
4. `GET /api/v1/status/summary`
5. Next.js page and components against the live endpoint
