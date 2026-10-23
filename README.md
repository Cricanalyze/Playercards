# RivalCard — All-Sports Player Card Platform

"Your Game. Your Identity. Your Card."

## Stack (all free tiers to start)
| Part | Tech | Cost |
|---|---|---|
| Frontend | React + Tailwind + shadcn/ui | Free |
| Backend | FastAPI (Python) | Free |
| Database | MongoDB (MongoDB Atlas free M0 when self-hosting) | Free |
| Login | Emergent-managed Clerk (email + password, verification, reset) | Free on Emergent |
| Card export | html-to-image in the browser | Free |
| Background removal | MediaPipe (runs in the browser) | Free |
| Payments | Not enabled yet (Razorpay planned) | Fees only per transaction later |

## Project structure
```
backend/
  server.py      # all API routes (/api/...), entitlements, admin
  rbac.py        # roles + permissions (code = source of truth)
  seed_data.py   # 60 sports, 8 templates, 4 plans (seeded once on startup)
  clerk_auth.py  # session verification
frontend/src/
  pages/         # Home, Create (editor), Explore, Pricing, Help, Legal, Dashboard, Invite
  admin/         # /admin panel pages
  components/card/  # PlayerCard + 8 template layouts
  components/editor/ # editor panels + export/share
  lib/           # api, card utils, background removal
```

## Run locally (simple)
1. Backend: `cd backend && pip install -r requirements.txt && uvicorn server:app --port 8001`
2. Frontend: `cd frontend && yarn install && yarn start`
On Emergent everything already runs automatically (supervisor), with hot reload.

## Environment variables
backend/.env: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `ADMIN_EMAIL` (owner email(s), comma separated), `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (managed by Emergent — never commit).
frontend/.env: `REACT_APP_BACKEND_URL`.

## Owner (Super Admin) bootstrap
Whoever signs in with a *verified* email listed in `ADMIN_EMAIL` becomes Super Admin on first sign-in. Invite other admins from Admin → Admins & Invites (single-use links, expire, can be revoked).

## Database "migrations"
MongoDB needs no schema migration. On startup the backend upserts default sports/templates/plans (only if missing — your admin edits are kept) and creates indexes.

## Deploy
Use Emergent's Deploy button (recommended). Custom domain: Deployments → Custom domain, then add the DNS records shown. Backups: enable automated backups on your MongoDB host, or `mongodump` weekly.

## GitHub
Use "Save to GitHub" in Emergent. `.env` files and secrets must never be committed.

## Troubleshooting
- Download does nothing on iPhone: long-press the image in the popup → Save to Photos.
- Background removal slow first time: it downloads a free ~16 MB model once.
- Admin page says Access denied: your account has no admin permissions.
