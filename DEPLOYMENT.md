# Deployment — Lab Panel (Vercel) + Backend (Render)

This deploys two things from this monorepo:

| Component | Folder | Host | URL (fill in) |
|-----------|--------|------|---------------|
| Backend API | `backend/` | Render | `https://hospital-backend.onrender.com` |
| Lab Panel | `lab_panel/` | Vercel | `https://<your-lab-panel>.vercel.app` |

MongoDB is already on Atlas — no DB to provision. Redis is in
`package.json` but unused, so no Redis service is needed.

---

## 1. Backend → Render

The repo ships a `render.yaml` blueprint.

1. Push this branch to GitHub (already done if you ran the deploy steps).
2. Render Dashboard → **New → Blueprint** → connect `sumantharjun/Hospital`.
   Render reads `render.yaml` and creates the `hospital-backend` web service
   (root dir `backend`, build `npm ci && npm run build`, start `npm start`).
3. Set these env vars (marked `sync: false`) in the Render dashboard:
   - `MONGO_URI` — your MongoDB Atlas connection string.
   - `JWT_SECRET` — any strong secret. **Must match** the value you set on Vercel.
   - `FRONTEND_URL` — the Vercel lab-panel URL (set after step 2 below; only
     matters if a panel uses Socket.io — the lab panel currently does not).
   - `NODE_ENV` and `PORT` are handled automatically.
4. Deploy. Verify: open `https://<backend>.onrender.com/api/health` → `{"status":"ok"}`.

> Note: the Render **free** plan sleeps after ~15 min idle; the first request
> after sleep takes ~30–50s to wake. Upgrade to a paid instance to avoid this.

### Seed the lab data (one-time)
The lab users/tests aren't created automatically. From a machine with the
production `MONGO_URI` in `backend/.env`:
```bash
cd backend && npm run seed:lab
```
This creates `labadmin@lab.com` / `operator@lab.com` (both `Lab@1234`).

---

## 2. Lab Panel → Vercel

Vercel auto-detects Next.js. Because this is a monorepo, point the project at
the subfolder.

1. Vercel → **Add New → Project** → import `sumantharjun/Hospital`.
2. **Root Directory:** `lab_panel`.
3. Framework preset: **Next.js** (auto). Build/output are auto-detected.
4. Environment Variables:
   - `NEXT_PUBLIC_API_BASE` = `https://<backend>.onrender.com`  (no trailing slash)
   - `JWT_SECRET` = the same secret used on Render.
5. Deploy. Log in at `/login` with `operator@lab.com` / `Lab@1234`.

After Vercel gives you the panel URL, go back and set `FRONTEND_URL` on Render
to that URL (optional for the lab panel today, required if you later add
realtime/Socket.io features to it).

---

## Redeploys
Both services have auto-deploy on push to the `Lab` branch. Push commits and
they rebuild automatically.
