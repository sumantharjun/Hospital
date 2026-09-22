# Deployment Guide — Hostinger (panels) + Render (API)

This repo is **8 independently deployable apps**: one API and seven Next.js
panels. There is no workspace tooling — each directory is its own npm project.

```
                                  ┌──────────────────────┐
  Hostinger shared hosting        │  MongoDB Atlas       │
  7 static sites, 1 subdomain each└──────────┬───────────┘
        │                                    │
        │  HTTPS: REST + Socket.IO           │
        └────────────►  hospital-api  (Render, 1 instance)
                              │
                              └── persistent disk → /var/data/uploads
```

The panels are **static HTML** — no Node.js runs on Hostinger. Every page is a
client component that fetches from the Render API, so a static export loses
nothing. `next build` writes a self-contained `out/` directory per panel.

| Directory | Deploy to | Suggested subdomain |
|---|---|---|
| `backend` | Render web service | `hospital-api.onrender.com` |
| `Admiin_panel` | Hostinger | `admin.yourdomain.com` |
| `Doctor_pannel` | Hostinger | `doctor.yourdomain.com` |
| `Receptionist_pannel` | Hostinger | `reception.yourdomain.com` |
| `nurse` | Hostinger | `nurse.yourdomain.com` |
| `patient-_pannel` | Hostinger | `patient.yourdomain.com` |
| `pharma_pannel` | Hostinger | `pharmacy.yourdomain.com` |
| `dis_pannel` | Hostinger | `distributor.yourdomain.com` |

**Deploy the API first.** The panels need its URL baked in at build time.

---

## Step 1 — MongoDB Atlas

1. Create a free M0 cluster at <https://cloud.mongodb.com>.
2. **Database Access → Add New Database User.** Give it a strong password and
   `readWrite` on a `hospital` database. Save the credentials.
3. **Network Access → Add IP Address → Allow access from anywhere**
   (`0.0.0.0/0`). Render does not publish stable outbound IPs on lower plans,
   so access is controlled by credentials.
4. **Connect → Drivers** and copy the connection string. Insert your password
   and the database name:

   ```
   mongodb+srv://hospital_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/hospital?retryWrites=true&w=majority
   ```
<!-- mongodb+srv://HospitalDB_AadhyaX:AadhyaX_HospitalDB@cluster0.mey66lg.mongodb.net/?appName=Cluster0 -->
> ⚠️ **Rotate the leaked credential.** A working Atlas credential
> (`d:123@cluster0.qv3mrd1...`) is in this repo's git history from
> `backend/scripts/seed-dummy-data.ts`. The hardcoded fallback is gone from the
> code, but history is public — delete or rotate that database user.

## Step 2 — Backend on Render

The blueprint is [`render.yaml`](./render.yaml).

1. Push this repo to GitHub.
2. <https://dashboard.render.com> → **New → Blueprint** → connect the repo.
   Render reads `render.yaml` and provisions `hospital-api` with
   `rootDir: backend`, a 10 GB disk at `/var/data/uploads`, and a generated
   `JWT_SECRET`.
3. It will prompt for the variables marked `sync: false`. Set:

   | Variable | Value |
   |---|---|
   | `MONGO_URI` | your Atlas string from step 1 |
   | `ALLOWED_ORIGINS` | leave blank for now — filled in at step 5 |
   | `TEXT_LOCAL_API_KEY` | your TextLocal key (**OTP login fails without it**) |

   `ALLOWED_ORIGINS` is required in production, so put a placeholder such as
   `https://admin.yourdomain.com` in to let the first deploy boot.

4. Click **Apply** and wait for the build. Confirm it is up:

   ```bash
   curl https://hospital-api.onrender.com/api/health
   # {"status":"ok"}
   ```

Full variable reference: [`backend/.env.example`](./backend/.env.example).

**Two things to know:**

- The service **refuses to boot** without `MONGO_URI`, `JWT_SECRET`, and
  `ALLOWED_ORIGINS` in production. That is deliberate — each one silently
  weakened security before. If the deploy fails, read the log; it names the
  missing variable.
- **Keep `numInstances: 1`.** OTP codes and Socket.IO presence live in process
  memory with no Redis adapter. A second instance causes random login failures
  and missing real-time updates.

> On Render's free tier the service sleeps after inactivity, which drops all
> WebSocket connections and wipes pending OTP codes. Use the **Starter** plan
> (set in `render.yaml`) for anything real.

## Step 3 — Create the subdomains in Hostinger

In **hPanel → Domains → Subdomains**, create all seven:

```
admin        doctor       reception     nurse
patient      pharmacy     distributor
```

Note each one's **document root**. Hostinger defaults to
`/public_html/<subdomain>` or `/domains/<subdomain>.yourdomain.com/public_html`
depending on account age — check the Subdomains list and write the paths down.

Then **hPanel → Security → SSL** and issue a free Let's Encrypt certificate for
**every** subdomain. Do this before step 5: the panels are forced to HTTPS by
`.htaccess`, and the API rejects non-HTTPS origins you haven't allow-listed.

## Step 4 — Build the seven panels

`NEXT_PUBLIC_API_BASE` is **compiled into the JavaScript**, not read at runtime.
It must be correct at build time, and changing it later means rebuilding and
re-uploading.

From the repo root, with Node 22+ installed locally:

```bash
./scripts/build-panels.sh https://hospital-api.onrender.com
```

This builds all seven and writes upload-ready archives to `dist-upload/`:

```
dist-upload/Admiin_panel.zip          dist-upload/patient-_pannel.zip
dist-upload/Doctor_pannel.zip         dist-upload/pharma_pannel.zip
dist-upload/Receptionist_pannel.zip   dist-upload/dis_pannel.zip
dist-upload/nurse.zip
```

The script refuses a trailing slash, warns on a non-HTTPS URL, and fails if
`.htaccess` is missing from an archive. To rebuild one panel only:

```bash
./scripts/build-panels.sh https://hospital-api.onrender.com Doctor_pannel
```

## Step 5 — Upload to Hostinger

For each panel, in **hPanel → Files → File Manager**:

1. Navigate to that subdomain's document root (from step 3).
2. Delete the placeholder `default.php` / `index.html` if present.
3. **Upload** the matching zip from `dist-upload/`.
4. Right-click the zip → **Extract** → extract **into the current folder**.
5. Delete the zip.

The document root should now contain `index.html`, `_next/`, `404.html`, and
**`.htaccess`**.

> **Check `.htaccess` actually arrived.** It is a hidden file — in File Manager
> enable **Settings → Show hidden files**. Without it you lose HTTPS
> enforcement, caching, and (on the reception panel) the legacy redirects.

Prefer FTP? Point FileZilla at the same document root and upload the **contents**
of the panel's `out/` directory — not the `out/` folder itself.

## Step 6 — Close the CORS loop

The API must now allow-list the real panel origins. In **Render → hospital-api
→ Environment**, set `ALLOWED_ORIGINS` to all seven, comma-separated, **no
trailing slashes, no spaces**:

```
https://admin.yourdomain.com,https://doctor.yourdomain.com,https://reception.yourdomain.com,https://nurse.yourdomain.com,https://patient.yourdomain.com,https://pharmacy.yourdomain.com,https://distributor.yourdomain.com
```

Save — Render redeploys automatically.

This one variable drives **both** REST CORS and Socket.IO CORS. A panel missing
from it will load but every API call and live update will fail with a CORS error
in the browser console.

## Step 7 — Create the first admin

There are no users yet. `POST /api/users/signup` allows creating a `SUPER_ADMIN`
**only while zero super admins exist**; after that the path closes permanently
and only a signed-in `SUPER_ADMIN` can create another.

Open `https://admin.yourdomain.com/signup/` and register the first account, or:

```bash
curl -X POST https://hospital-api.onrender.com/api/users/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ops Admin","email":"admin@yourdomain.com","password":"<strong-password>","role":"SUPER_ADMIN"}'
```

Confirm the door is shut — this must return **403**:

```bash
curl -X POST https://hospital-api.onrender.com/api/users/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"x","email":"x@y.com","password":"x","role":"SUPER_ADMIN"}'
```

Every other account is created from the admin panel by a signed-in admin.

> `npm run seed` does **not** work — the script has 49 pre-existing type errors
> and fails under `ts-node`. It was already broken before this deployment work.

## Step 8 — Smoke test

```bash
API=https://hospital-api.onrender.com

curl $API/api/health                        # {"status":"ok"}

# Allow-listed origin is accepted...
curl -sI -H 'Origin: https://admin.yourdomain.com' $API/api/health | grep -i access-control-allow-origin
# ...and an unlisted one gets no CORS header, so browsers block it.
curl -sI -H 'Origin: https://evil.example' $API/api/health | grep -i access-control-allow-origin

# Patient data is no longer anonymous (must be 401)
curl -s -o /dev/null -w '%{http_code}\n' $API/api/patient-records/anything

# The old hardcoded OTP is closed (must NOT return a token)
curl -s -X POST $API/api/public/otp/verify \
  -H 'Content-Type: application/json' -d '{"phone":"9999999999","otp":"1234"}'
```

Then in a browser, for each panel:

- It loads over **https** and the padlock is clean.
- Log in; the dashboard fetches data (no CORS errors in the console).
- **Network → WS** shows a live `socket.io` connection.
- Open a deep link directly, e.g.
  `https://doctor.yourdomain.com/consultation/?id=<appointmentId>` — it must
  load on a hard refresh, not 404.
- On the reception panel, `https://reception.yourdomain.com/dashboard`
  should redirect to `/reception/dashboard/`.

---

## Redeploying

**Changed panel code, or the API URL moved:**

```bash
./scripts/build-panels.sh https://hospital-api.onrender.com
```

Re-upload only the panels you changed. Because `NEXT_PUBLIC_API_BASE` is baked
in, *any* API URL change requires rebuilding and re-uploading **all seven**.

Users may hold a cached copy: `.htaccess` marks HTML `must-revalidate` and
hashed assets `immutable`, so a normal reload picks up new builds.

**Changed backend code:** push to GitHub; Render redeploys automatically.

---

## Environment variables

### Backend (Render)

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | **yes** | Refuses to boot without it |
| `JWT_SECRET` | **yes** in prod | Boot fails if unset or the old dev default |
| `ALLOWED_ORIGINS` | **yes** in prod | Drives REST **and** Socket.IO CORS |
| `NODE_ENV` | yes | `production` enables the boot guards |
| `UPLOAD_DIR` | yes | Must point at the mounted disk |
| `PORT` | no | Render injects its own |
| `TEXT_LOCAL_API_KEY` | for OTP login | Without it `/otp/send` returns 503 |
| `TEXT_LOCAL_SENDER` | no | Defaults to `TXTLCL` |
| `ALLOW_DEV_OTP` | no | Dev only; ignored when `NODE_ENV=production` |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | no | Email notifications |
| `TWILIO_*` | no | WhatsApp notifications |

### Panels (build time only)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | **yes** | Passed by `scripts/build-panels.sh`; no trailing slash |

---

## Local development

```bash
# API
cd backend
cp .env.example .env        # set MONGO_URI; ALLOW_DEV_OTP=true logs OTP codes
npm install && npm run dev  # :4000

# A panel
cd Admiin_panel
cp .env.example .env.local
npm install && npm run dev
```

In development any `localhost` origin is accepted, so `ALLOWED_ORIGINS` can stay
empty. Panels default to port 3000 and **collide** — run extra ones with
`npm run dev -- --port 3001`. Only `nurse` pins a port already (3002).

To preview a production build exactly as Hostinger serves it:

```bash
cd Doctor_pannel && npm run build && (cd out && python3 -m http.server 8080)
```

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Panel loads, every request fails with a CORS error | Its origin is not in `ALLOWED_ORIGINS`, or there is a trailing slash / `http://` vs `https://` mismatch |
| Blank page, console says `API_BASE is not configured` | Built without `NEXT_PUBLIC_API_BASE` — rebuild with `scripts/build-panels.sh` |
| Deep link 404s on refresh, but works when clicked | `.htaccess` missing from the document root, or the upload flattened the directory structure |
| Real-time updates never arrive | Socket.IO blocked by CORS (same fix as row 1), or the Render instance is asleep on the free tier |
| Login says OTP delivery unavailable (503) | `TEXT_LOCAL_API_KEY` is not set on Render |
| Render deploy fails instantly | A required env var is missing; the boot error names it |
| Mixed-content warnings | Panel is https but `NEXT_PUBLIC_API_BASE` was built with `http://` |

---

## Known limitations

Carried into production knowingly; none block this deploy.

1. **The backend cannot scale horizontally.** OTP codes
   (`backend/src/shared/services/otp.service.ts`) and Socket.IO presence
   (`socket.server.ts`) are in-process, with no Socket.IO Redis adapter. Move
   OTPs to Redis and add `@socket.io/redis-adapter` before adding instances.
   `redis` is already a dependency but unused.
2. **Uploads live on one Render disk.** Fine at one instance; move to S3 or
   Cloudinary before scaling out.
3. **`/api/finance` is authenticated but not row-scoped.** Any signed-in user,
   including a patient, can read finance entries — the patient invoices page
   depends on this endpoint, so it could not be role-gated without breaking it.
4. **`GET /api/users/check-role/:email` is deliberately public** — the admin
   login page calls it pre-auth. It no longer returns the exact role but still
   reveals whether an email is registered.
5. **No rate limiting.** `/api/users/login` and `/otp/send` are brute-forceable.
   Adding `express-rate-limit` to those two routes is the next thing worth doing.
6. **Tokens cannot be revoked.** Stateless JWTs, 7-day expiry, kept in
   `localStorage`; logout is client-side only.
7. **Dead code:** `Receptionist_pannel/app/components/PatientRegistrationForm.js`
   and `NursePanel.js` are never imported and call endpoints that do not exist.
   Safe to delete.
8. **Weak default password** for pharmacy-created delivery agents
   (`"delivery123"` in `pharma_pannel/services/api.ts`).
