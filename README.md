# Hospital Ecosystem

A hospital management platform: one API and seven role-specific web panels.

```
backend/              Express + Mongoose + Socket.IO API  (TypeScript)
Admiin_panel/         Super admin / hospital admin        (Next.js, pages router)
Doctor_pannel/        Doctors                             (Next.js, app router)
Receptionist_pannel/  Front desk                          (Next.js, app router, JS)
nurse/                Nursing staff                       (Next.js, app router, JS)
patient-_pannel/      Patients                            (Next.js, app router)
pharma_pannel/        Pharmacy                            (Next.js, pages router)
dis_pannel/           Distributors / warehouse            (Next.js, pages router)
```

Each directory is an **independent npm project** with its own lockfile — there is
no workspace root. Install and build them separately.

## Stack

- **API** — Express 4, Mongoose 8 (MongoDB), Socket.IO 4, JWT auth, TypeScript
- **Panels** — Next.js 16, React 19, Tailwind CSS 4
- **Roles** — `SUPER_ADMIN`, `HOSPITAL_ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST`,
  `PATIENT`, `PHARMACY_STAFF`, `DISTRIBUTOR`, `DELIVERY_AGENT`

Every panel talks to the same API over `NEXT_PUBLIC_API_BASE`, for both REST and
Socket.IO. Auth is a JWT in `localStorage`, sent as `Authorization: Bearer`.

## Quick start

Requires Node 22+ and a MongoDB instance.

```bash
# API
cd backend
cp .env.example .env          # set MONGO_URI
npm install
npm run dev                   # :4000

# A panel, in another terminal
cd Admiin_panel
cp .env.example .env.local    # NEXT_PUBLIC_API_BASE=http://localhost:4000
npm install
npm run dev
```

Panels all default to port 3000 and will collide with each other — pass
`--port` when running more than one. Set `ALLOW_DEV_OTP=true` in `backend/.env`
to have OTP codes printed to the server log instead of sent by SMS.

Create the first account at the admin panel's `/signup` page; it can create a
`SUPER_ADMIN` only while none exists yet.

## Deploying

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — MongoDB Atlas, the API on Render
(blueprint in [`render.yaml`](./render.yaml)), and the seven panels as static
sites on Hostinger shared hosting.

The panels are built as **static HTML** (`output: "export"`): every page is a
client component and no server-only Next.js features are used, so there is no
Node.js runtime to host. Build and package all seven with:

```bash
./scripts/build-panels.sh https://hospital-api.onrender.com
```

That writes an upload-ready zip per panel into `dist-upload/`. `NEXT_PUBLIC_API_BASE`
is compiled into the bundle, so changing the API URL means rebuilding.

The backend runs as a **single instance**: OTP state and Socket.IO presence are
held in process memory with no Redis adapter.

## API surface

`registerRoutes` in `backend/src/routes.ts` is the routing table. Public
(unauthenticated) paths are limited to:

- `/api/public/*` — OTP login, medicine and product search, uploads
- `/api/users/signup` — patient self-registration, plus first-run admin bootstrap
- `/api/users/login`, `/api/users/otp/*` — authentication
- `/api/health`, `/health`

Everything else requires a bearer token; most routes further restrict by role
via `requireRole`.
