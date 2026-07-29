# Cycle 2 Implementation Plan — Admin, Incidents, Feedback, Notifications

**Goal:** Complete build-order steps 3–8: admin authentication and service management, the incident lifecycle, the public feedback channel and its triage inbox, email/RSS/public API, and maintenance windows plus settings.

**Architecture:** Unchanged from cycle 1. FastAPI owns MongoDB and all derived data; Next.js renders from HTTP JSON. Admin routes sit behind a signed session cookie issued by FastAPI. Everything that could be a scheduled job is instead derived on read, so there is no cron process to operate.

**Tech Stack:** As cycle 1, plus `bcrypt` (password hashing), `itsdangerous` (cookie signing), and MongoDB GridFS (screenshot storage). No new services, no third-party vendors.

> **Note on plan form.** Cycle 1's plan was written for context-free subagents, so it transcribed every line of code. This cycle is being executed inline in the authoring session, so this plan specifies decisions, interfaces, and the non-obvious logic in full, and leaves mechanical CRUD bodies to the implementation. Where a design choice is load-bearing or easy to get wrong, the code is here.

## Global Constraints

Cycle 1's constraints all still bind. Added for this cycle:

- Only code under `api/` may connect to MongoDB. `web/` consumes HTTP JSON only.
- Admin write endpoints live under `/api/v1/admin/…` and require a valid session. Public endpoints stay under `/api/v1/…` and never require auth.
- Roles are ordered: `owner` > `admin` > `responder`. A route declares the minimum role it needs.
- Passwords are bcrypt hashed. A plaintext password is never stored, logged, or returned.
- The session cookie is `HttpOnly`, `SameSite=Lax`, and signed with `SESSION_SECRET`. It is `Secure` whenever the request is HTTPS.
- No scheduled jobs. Maintenance activation, the feedback live-signal, and uptime rollups are all computed on read.
- Email sending is a no-op when SMTP environment variables are unset — the app must run fully without mail configured.
- New collections only as listed per task. Do not create anything the brief did not name.
- Every `_id` is serialized as a string, never an ObjectId.
- Commit after every task. Run the full suite before each commit.

## Design Decisions

These resolve the ambiguities in the brief; they are the reason several tasks are smaller than they look.

**Maintenance is derived, not scheduled.** The brief says a window "auto-flips affected services to `maintenance` at start, and back at end." A scheduler would need a process to run. Instead, a service's *effective* status is `maintenance` when a window covering `now` names it, and its stored `current_status` is left untouched. Nothing to run, nothing to get stuck, and the flip is exact rather than dependent on a tick.

The same windows are overlaid onto the uptime computation as maintenance spans, so a planned window is still excluded from the uptime denominator exactly as cycle 1 specified. This is the one genuinely fiddly piece of logic in the cycle and gets its own tests.

**The feedback live-signal is derived.** "3+ users report the same service within 15 minutes while it's still operational" is a query over `feedback`, evaluated when the summary is built. No background watcher, no alert queue. The admin "alert" is a flag on the admin overview payload.

**Screenshots go in GridFS.** MongoDB ships it, the deployment already has Mongo, and it avoids adding object storage for what is an occasional 5 MB upload.

**Rate limiting is in-process.** A dict of IP to timestamps, 3 per hour. Single-process only — noted in code with the upgrade path, since the alternative is standing up Redis for a form that gets a handful of submissions.

**Incident templates are seed data, not a feature.** A template is a stored title and message; "applying" one is the frontend prefilling a form. No template engine.

---

## Task 1: Auth foundation

**Files:** create `api/auth.py`, `api/tests/test_auth.py`; modify `api/db.py` (validator + index), `api/main.py` (router), `api/seed.py` (seed an owner)

**Collection:** `admin_users` — `email` (unique), `password_hash`, `role` (`owner|admin|responder`), `created_at`

**Produces:**
- `hash_password(pw: str) -> str`, `verify_password(pw: str, hashed: str) -> bool`
- `issue_session(response, user) -> None`, `read_session(request) -> dict | None`
- `require_role(minimum: str)` — a FastAPI dependency factory returning the session user, raising 401 when unauthenticated and 403 when under-privileged
- `POST /api/v1/auth/login` `{email, password}` → sets cookie, returns `{email, role}`
- `POST /api/v1/auth/logout` → clears cookie
- `GET /api/v1/auth/me` → `{email, role}` or 401

Session payload is `{"email": ..., "role": ...}` signed with `itsdangerous.URLSafeTimedSerializer`, max age 7 days. Roles compare by index into `ROLE_ORDER = ["responder", "admin", "owner"]`.

Login must not reveal whether an email exists: the same 401 and the same timing path for unknown email and wrong password (verify against a dummy hash when the user is absent).

`SESSION_SECRET` comes from the environment. When unset, generate a random one at import and log a warning that sessions will not survive a restart — the app must still run.

**Tests:** hash/verify round-trip; wrong password rejected; `require_role` allows equal and higher roles and rejects lower; login sets a cookie and `/me` reads it; unknown email and wrong password are indistinguishable; expired/tampered cookie rejected.

**Seed:** one owner, `admin@example.com`, password from `SEED_ADMIN_PASSWORD` or a printed random one. Never a hardcoded default password.

---

## Task 2: Service and group management

**Files:** create `api/admin_services.py`, `api/tests/test_admin_services.py`; modify `api/main.py`

**Produces (all `require_role("admin")`):**
- `POST|PATCH|DELETE /api/v1/admin/services`, `POST /api/v1/admin/services/reorder` `{ids: [...]}` → rewrites `position` to array order
- `POST|PATCH|DELETE /api/v1/admin/groups`, `POST /api/v1/admin/groups/reorder`
- `POST /api/v1/admin/services/{id}/status` `{status, note?}` → **the status toggle**

The status toggle is the one operation with real invariants: it appends a `status_history` event *and* updates `services.current_status`, both or neither, with `changed_by` set to the session email. Order matters — write history first, then the cache, so a crash leaves the cache stale rather than the history missing.

Deleting a service deletes its `status_history` too, otherwise uptime queries carry orphans.

**Tests:** toggle writes both history and cache; toggle to an invalid status is rejected by the DB validator; reorder produces a dense 0..n-1 sequence; delete removes history; every endpoint 401s anonymously and 403s for `responder`.

---

## Task 3: Incidents

**Files:** create `api/incidents.py`, `api/tests/test_incidents.py`; modify `api/db.py`, `api/main.py`

**Collections:** `incidents` (`title`, `body`, `status`, `impact`, `started_at`, `resolved_at`, `created_by`, `postmortem`), `incident_updates` (`incident_id`, `status`, `message`, `created_at`), `incident_services` (`incident_id`, `service_id`)

`incidents.status` is a closed set: `investigating|identified|monitoring|resolved`. Enforce it in the JSON Schema validator, same as service statuses.

**Produces:**
- Admin (`responder` and up): create incident (title, affected service ids, initial status, first update message); post update (advances status); resolve; edit; delete; set postmortem
- Public: `GET /api/v1/incidents?limit=&before=` grouped by date, `GET /api/v1/incidents/{id}` with affected services and the full update timeline

Resolving sets `resolved_at`, appends a resolved update, and **flips every affected service back to `operational`** — which means writing `status_history` events through the same code path Task 2 uses, not a direct field write. The confirmation the brief mentions is a frontend concern; the API always flips.

**Tests:** creating an incident with two services links both; posting updates advances status and preserves order; resolving flips affected services and writes history for each; resolving twice is idempotent; deleting an incident removes its updates and links; public list excludes nothing but is ordered newest-first.

---

## Task 4: Maintenance windows and the uptime overlay

**Files:** create `api/maintenance.py`, `api/tests/test_maintenance.py`; modify `api/uptime.py`, `api/tests/test_uptime.py`, `api/db.py`, `api/main.py`

**Collection:** `maintenances` — `title`, `body`, `scheduled_start`, `scheduled_end`, `status`, plus a `service_ids` array

**The overlay.** `api/uptime.py` gains one parameter and one helper:

```python
def _apply_windows(spans, windows):
    """Replace the portion of each span covered by a maintenance window.

    A window outranks whatever the service was doing at the time: a planned
    window during an outage is still planned. Returns spans in the same
    (status, start, end) shape, split where windows partially overlap.
    """
    out = []
    for status, start, end in spans:
        pieces = [(start, end)]
        for w_start, w_end in windows:
            nxt = []
            for p_start, p_end in pieces:
                if w_end <= p_start or w_start >= p_end:
                    nxt.append((p_start, p_end))
                    continue
                if p_start < w_start:
                    nxt.append((p_start, w_start))
                if w_end < p_end:
                    nxt.append((w_end, p_end))
                out.append((MAINTENANCE, max(p_start, w_start),
                            min(p_end, w_end)))
            pieces = nxt
        out.extend((status, s, e) for s, e in pieces)
    return out
```

`compute_days(events, created_at, now, days=90, windows=())` calls it after `_spans`. `windows` is a list of `(start, end)` tuples already clipped to the service.

**Effective status.** `effective_status(service, windows, now)` returns `maintenance` when a window covering `now` names the service, else `service["current_status"]`. The summary endpoint and the admin views both use it; nothing writes a maintenance status to `services.current_status`.

**Produces:** admin CRUD for windows; the summary endpoint gains an `upcoming_maintenance` array.

**Tests:** a window fully inside an operational span splits it into three and the day's uptime denominator shrinks; a window overlapping an outage replaces the overlap and the outage keeps the remainder; a window covering a whole day yields `uptime: None` and status `maintenance`; `effective_status` returns `maintenance` only inside the window; a service not named by the window is unaffected. Cycle 1's uptime tests must still pass unchanged with `windows` defaulted.

---

## Task 5: Feedback submission

**Files:** create `api/feedback.py`, `api/tests/test_feedback.py`; modify `api/db.py`, `api/main.py`

**Collections:** `feedback` (per the brief's data model), `feedback_votes` (`feedback_id`, `voter_hash`)

**Produces:** `POST /api/v1/feedback` (multipart, public, no auth) accepting type, service_id, title (≤120), description (≤2000), email, screenshot, honeypot field, and auto-captured browser metadata.

Protections, in order of cheapness:
1. **Honeypot** — a field named `website`; non-empty means bot. Return `201` with a fake ref code so the bot learns nothing.
2. **Rate limit** — 3 per IP per hour, in-process dict. Exceeding returns 429.
3. No captcha, per the human's choice. The honeypot and limit are the whole defence.

`ref_code` is `RPT-` plus a 4-digit number from a counter, unique-indexed. Screenshots: images only, ≤5 MB, stored in GridFS, referenced by `screenshot_url` = `/api/v1/feedback/{ref}/screenshot`. New items are `status: "new"` and `is_public: false` — nothing appears publicly until an admin approves it.

**Tests:** valid submission returns a `RPT-` code and persists; honeypot submission returns 201 but writes nothing; the fourth submission from one IP within the hour is 429; over-length title and description rejected; a non-image and an oversized upload rejected; new items are not public.

---

## Task 6: Public feedback list, upvotes, live signal

**Files:** modify `api/feedback.py`, `api/tests/test_feedback.py`, `api/main.py`

**Produces:**
- `GET /api/v1/feedback?type=&status=&service_id=&sort=newest|top` — **only `is_public: true`**
- `POST /api/v1/feedback/{ref}/vote` — one per voter, `voter_hash` = sha256 of IP + user agent + a server salt. Re-voting is idempotent, not an error.
- `GET /api/v1/feedback/{ref}` — single item with admin reply
- Live signal folded into the summary endpoint: `live_signals: [{service_id, service_name, count}]`

Live signal query: group public-or-not `feedback` created in the last 15 minutes by `service_id`, keep groups of 3 or more whose service's effective status is `operational`.

**Tests:** non-public items are absent from the list; filters and both sort orders work; a second vote from the same hash does not double-count; the live signal fires at 3 and not at 2; it does not fire when the service is already non-operational.

---

## Task 7: Feedback triage

**Files:** create `api/admin_feedback.py`, `api/tests/test_admin_feedback.py`; modify `api/main.py`

**Produces (all `require_role("responder")`):** inbox with filters defaulting to `status=new`; per-item status change, public reply, `is_public` toggle, incident link, duplicate merge, internal note; bulk status change and bulk publish over a list of refs; a `similar` grouping that buckets by service and a normalized title.

Setting status to `fixed` triggers the reporter email from Task 8 when an address was given. Merging sets `duplicate_of` on the loser and moves its votes to the winner.

**Tests:** status change persists and is visible to the admin list; a public reply appears on the public item once published; merge sets `duplicate_of` and transfers votes without double-counting; bulk actions apply to every named ref and skip unknown ones; every endpoint 401s anonymously.

---

## Task 8: Subscribers, email, RSS and Atom

**Files:** create `api/notify.py`, `api/feeds.py`, `api/tests/test_notify.py`, `api/tests/test_feeds.py`; modify `api/main.py`, `api/db.py`

**Collection:** `subscribers` — `email`, `verified`, `unsubscribe_token`

**Produces:**
- `POST /api/v1/subscribe` → sends a verification link; `GET /api/v1/subscribe/verify?token=`; `GET /api/v1/unsubscribe?token=`
- `send_incident_email(incident, update)` — fan-out to verified subscribers on incident create, update, and resolve
- `send_feedback_resolved(item)` — the Task 7 trigger
- `GET /history.rss` and `GET /history.atom` — last 50 incident updates

`api/notify.py` reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. When `SMTP_HOST` is unset, `send()` logs the message and returns without sending, so tests and local development never need a mail server. Sending happens in a FastAPI `BackgroundTasks` so a slow relay cannot stall an incident update.

Feeds are built with `xml.etree.ElementTree` from the standard library. No feed dependency.

**Tests:** subscribe stores unverified and does not receive incident mail; verification flips the flag; unsubscribe by token removes; with SMTP unset `send()` is a no-op and returns cleanly; feeds parse as valid XML and contain the most recent update titles; feed entries carry stable GUIDs.

---

## Task 9: Settings and admin user management

**Files:** create `api/settings.py`, `api/tests/test_settings.py`; modify `api/main.py`, `api/db.py`

**Collection:** `settings` — a single document, `_id: "site"`, holding page title, logo URL, brand color, custom domain, timezone, and footer links

**Produces:** `GET /api/v1/settings` (public, feeds the page shell); `PATCH /api/v1/admin/settings` (`admin`); admin user list, invite, role change, delete (all `owner`).

An owner cannot delete or demote the last remaining owner — a lockout is unrecoverable without database access.

`PRODUCT_NAME` from cycle 1 becomes the fallback when the settings document has no title, so nothing breaks before settings are first saved.

**Tests:** settings round-trip; defaults apply to a fresh database; non-owner cannot change roles; the last owner cannot be demoted or deleted; a brand color that is not a hex value is rejected.

---

## Task 10: Public frontend additions

**Files:** create `web/app/incidents/[id]/page.tsx`, `web/app/history/page.tsx`, `web/app/uptime/page.tsx`, `web/components/IncidentList.tsx`, `web/components/IncidentUpdate.tsx`, `web/components/FeedbackPanel.tsx`, `web/components/FeedbackList.tsx`, `web/components/SubscribeBox.tsx`, `web/components/LiveSignal.tsx`; modify `web/app/page.tsx`, `web/lib/api.ts`

Incident history grouped by date newest-first, ~15 days then a link to `/history`; days with nothing show "No incidents reported". Each update tagged with its lifecycle stage and a UTC timestamp. The feedback panel is the submit form ("Something not working? Tell us."), the list carries the six status badges — each with icon and text, never colour alone — plus upvote, filter bar, and sort.

`/uptime` shows 90-day and per-month breakdowns per service.

**Verification:** every new route renders against the live API; badges legible in light and dark; no horizontal scroll at 375px.

## Task 11: Admin frontend

**Files:** `web/app/admin/**` — login, overview, services, incidents, feedback, maintenance, settings; `web/middleware.ts` guarding `/admin/*`

Overview cards: global status, unreviewed report count, open incidents, active maintenance. Services page carries the five-way status toggle with an optimistic update and the "Create an incident for this?" prompt on any non-operational selection. Reordering is drag-based, persisted through the reorder endpoint. Feedback inbox defaults to New with bulk selection.

**Verification:** login round-trip; a status toggle is reflected on the public page; an incident resolve flips its services back; every admin route redirects to login when signed out.

---

## Whole-cycle verification

- `python -m pytest api/tests -q` — all green, output pristine
- `npm run build` in `web/` succeeds
- Signed out, no `/admin` route renders and no admin API call succeeds
- With SMTP unset the whole app runs and no send is attempted
- `/history.rss` and `/history.atom` parse as valid XML
- No collections beyond those named in this plan and cycle 1
