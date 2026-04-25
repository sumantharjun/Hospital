---
name: Lab Management System — project structure
description: Lab system built on top of existing Hospital monorepo — backend modules and frontend panel location
type: project
---

A full Lab Management & Diagnostics System was added to the Hospital monorepo.

**Backend modules added** (under `backend/src/`):
- `labPatient/` — patient registration (labPatientId, demographics, registration charge)
- `labTest/` — test catalog with parameters + reference ranges
- `labPackage/` — bundled test packages
- `labOrder/` — test orders + sample tracking (PENDING → COLLECTED → IN_PROGRESS → COMPLETED)
- `labResult/` — result entry, auto abnormal-flag, approve/reject workflow
- `labBilling/` — bill generation, payment recording (CASH/CARD/UPI), partial payments
- `labSettings/` — lab name, registration charge, report header/footer, PDF config
- `labReport/` — PDFKit diagnostic report PDF + analytics endpoint

All routes registered under `/api/lab/*` in `routes.ts`.

User model updated: added `LAB_ADMIN` and `LAB_OPERATOR` roles + `labId` field.

**Frontend** (`lab_panel/`):
- Single Next.js app, port 3006, App Router + TypeScript + Tailwind
- Role-based route groups: `(admin)` and `(operator)` protected by `middleware.ts`
- Admin pages: dashboard, test catalog (CRUD + parameters), packages, users, pricing/settings, reports/analytics, audit
- Operator pages: dashboard, patient registration, new order, orders list, sample collection, result entry, billing, payments

**Why:** Single unified frontend (not separate per role) because only 2 roles with high UI overlap.
