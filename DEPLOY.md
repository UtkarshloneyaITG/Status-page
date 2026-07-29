# Deploying

Two pieces, deployed separately:

- **Backend** — FastAPI, on Render. Owns MongoDB.
- **Frontend** — Next.js, on Vercel. Talks to the backend over HTTP.

They land on different hosts, which matters for exactly one thing: the admin
session cookie. Cross-site cookies need `SameSite=None; Secure`, so the backend
env vars below set that. Get it wrong and the public page works fine while
admin login silently fails.

---

## Part 1 — MongoDB Atlas

You already have a cluster. Two things to check before deploying:

1. **Network access.** Atlas blocks unknown IPs by default and Render's free
   tier has no fixed outbound IP. In Atlas go to **Network Access → Add IP
   Address → Allow access from anywhere** (`0.0.0.0/0`). Your database is still
   protected by its username and password.
2. **A database user** with read/write on the `statuspage` database. Note the
   connection string — you need it in the next part.

---

## Part 2 — Backend on Render

### 2.1 Push the repo

Already done — the code is on `main` at
`github.com/UtkarshloneyaITG/Status-page`. Push any later changes before
deploying; Render builds from GitHub, not from your disk.

### 2.2 Create the service

1. Sign in at [render.com](https://render.com) and connect your GitHub account.
2. **New → Blueprint**, pick the `Status-page` repo.
3. Render reads [`render.yaml`](render.yaml) and proposes a web service called
   `statuspage-api`. Accept it.

Doing it without the blueprint (**New → Web Service**) works too — set these
by hand:

| Setting | Value |
|---|---|
| Runtime | Python 3 |
| Build command | `pip install -r api/requirements.txt` |
| Start command | `uvicorn api.main:app --host 0.0.0.0 --port $PORT --proxy-headers` |
| Health check path | `/api/v1/status/summary` |

### 2.3 Set the environment variables

In the service's **Environment** tab:

| Key | Value |
|---|---|
| `MONGO_URL` | your Atlas connection string |
| `MONGO_DB` | `statuspage` |
| `SESSION_SECRET` | a long random string (the blueprint generates one) |
| `PRODUCT_NAME` | whatever the page should be called |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://status-page.vercel.app` |
| `COOKIE_SAMESITE` | `none` |
| `COOKIE_SECURE` | `true` |
| `PYTHON_VERSION` | `3.12.10` |

`CORS_ORIGINS` must be the exact origin — scheme included, **no trailing
slash**. Credentialed CORS forbids `*`, so a wildcard will not work here. You
won't know the Vercel URL until Part 3, so set a placeholder now and come back.

### 2.4 Deploy and check

Deploy, then open `https://<your-service>.onrender.com/api/v1/status/summary`.
You should get JSON. If it 500s, check the logs — a bad `MONGO_URL` or an Atlas
IP block are the two usual causes.

### 2.5 Create the admin account

The database has no admin user until you make one. From your machine, with
`.env` pointing `MONGO_URL` at Atlas:

```
python -m api.db      # applies validators and indexes
python -m api.seed    # demo data + an admin, prints the password
```

`api.seed` **drops and repopulates** the collections. On a database you care
about, create just the admin instead:

```
python -c "import asyncio,os;from api.db import get_client,get_db;from api.auth import hash_password;from datetime import datetime,timezone;
async def m():
    c=get_client();d=get_db(c)
    await d.admin_users.insert_one({'email':'you@example.com','password_hash':hash_password('a-real-password'),'created_at':datetime.now(timezone.utc)})
    await c.close()
asyncio.run(m())"
```

> Render's free tier sleeps after inactivity, so the first request after an
> idle period takes 30–60 seconds. Fine for a status page; upgrade if that
> bothers you.

---

## Part 3 — Frontend on Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project**, import the same
   repo.
2. **Root Directory: `web`.** This is the step people miss — the repo root is
   the Python app, and Vercel will fail to build if you leave it at `./`.
   Framework preset and build command are detected automatically.
3. Add one environment variable:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<your-service>.onrender.com` |

   No trailing slash.
4. Deploy.
5. Copy the resulting URL, put it in Render's `CORS_ORIGINS`, and let Render
   redeploy.

The page renders even when the backend is unreachable — it shows "Status
unavailable" rather than failing the build, so a cold Render service never
breaks a Vercel deploy.

---

## Part 4 — Verify

1. Open the Vercel URL. Services and uptime bars appear.
2. Click **Report an issue**, submit one. You get an `RPT-####` code.
3. Go to `/admin/login`, sign in. The report is in the inbox.
   - If login appears to succeed but the inbox bounces you back, the cookie was
     rejected: re-check `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, and that
     `CORS_ORIGINS` exactly matches your Vercel origin.
4. **Mark fixed.** It appears at `/reports` on the public page.

---

## Environment variable reference

Backend (Render):

| Key | Required | Notes |
|---|---|---|
| `MONGO_URL` | yes | Atlas connection string |
| `MONGO_DB` | no | defaults to `statuspage` |
| `SESSION_SECRET` | yes | random; sessions reset if it changes |
| `CORS_ORIGINS` | yes | comma-separated exact origins, no wildcard |
| `COOKIE_SAMESITE` | yes in prod | `none` when frontend and API differ in host |
| `COOKIE_SECURE` | yes in prod | `true` |
| `PRODUCT_NAME` | no | defaults to `Status` |
| `SEED_ADMIN_PASSWORD` | no | only read by `api.seed` |

Frontend (Vercel):

| Key | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | backend origin, no trailing slash |
