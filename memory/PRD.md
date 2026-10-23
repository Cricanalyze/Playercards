# RivalCard — PRD

## Original problem statement
All-sports player card platform ("Your Game. Your Identity. Your Card."): mobile-first web app where players of ANY sport/esport create premium collectible cards (sport → template → photo → details → stats → live preview → HD PNG card + 9:16 story → share). Includes extensive Super Admin panel (users, subscriptions, plans, sports registry, templates, RBAC with invitations, audit logs, analytics). Budget ₹1k–10k, no paid APIs for basic card creation. Phased: 1–5 first.

## User choices
- Build Phases 1–5. Auth: email+password (delivered via Emergent-managed Clerk). Payments: none yet (free + admin complimentary grants). Owner: admin@playercard.app / admin123. Later: user requested background removal + custom background (added).

## Architecture
- Frontend: React (CRA/craco) + Tailwind + shadcn, html-to-image export (pixelRatio 3 → 1080×1512 card, 1080×1920 story), MediaPipe on-device segmentation (wasm self-hosted in /public/mediapipe, model from Google CDN), fonts self-hosted via @fontsource.
- Backend: FastAPI + MongoDB (motor). Files: server.py (routes), rbac.py (roles/permissions), seed_data.py (60 sports, 8 templates, 4 plans), clerk_auth.py.
- Collections: users, sports, templates, plans, subscriptions (with plan_snapshot + history), payments (empty), saved_cards (text only, no photos), events, audit_logs, admin_invitations (sha256 token hash), moderation_reports.

## Implemented (2026-06)
- Homepage (hero w/ fictional demo cards, sports directory, featured templates, how it works, benefits, pricing, FAQ, contact, footer), Explore, Pricing, Help, Privacy, Terms.
- Card editor: 60 sports searchable by category, 8 distinct templates, upload/validate/downscale photo, zoom/drag/position, background removal + presets/colours/custom image backgrounds, conditional fields, per-sport stats (max 6), accent colours, visibility toggles, undo/reset, card+story preview, PNG export, Web Share API + manual fallback, result dialog actions.
- Server-side entitlement service; premium templates require entitlement at /api/cards/export (402 otherwise); watermark decided server-side.
- Accounts (Clerk): saved cards, plan/subscription/billing history, delete my data.
- Admin: overview metrics (DB-backed, date filters, definitions), users (search/filter/sort/paginate, detail, suspend+revoke sessions, soft-delete with typed confirm, role/permission change with own-email reconfirm), subscriptions (grant complimentary/promotion, extend, cancel renewal, revoke, lazy expiry), plans CRUD (snapshot protects existing subs), sports CRUD, templates CRUD (validated layout schema), invitations (single-use expiring hashed tokens, verified-email match, revoke), audit log, reports.
- RBAC guards: no self role change, only super_admin grants super_admin, last super_admin protected, can't grant perms you lack; rate limits on public endpoints.

## Backlog
- P0: Razorpay hosted checkout + webhook signature verification + idempotency + refunds (Phase 9)
- P1: Coupons; email notifications for security changes (needs email provider); Team Pack shared theme workflow; favourite templates UI
- P2: Public shareable card links (opt-in), richer analytics charts, production deployment docs/custom domain
