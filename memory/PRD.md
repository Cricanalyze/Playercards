# RivalCard (Cricanalyze/Playercards)
Original ask: run https://github.com/Cricanalyze/Playercards as-is.

## Done (2026-06)
- Code imported (backend, frontend), deps installed (yarn --ignore-engines due to node 20 vs >=22 for @wallet-standard/base)
- Backend running: /api and /api/sports OK, seed data loaded
- ADMIN_EMAIL set

## Blocker
- CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY (Emergent-managed Clerk) still empty -> /api/clerk/config enabled:false -> frontend renders blank
- scripts/ and tests/ folders from repo not copied (protected path)

## Update (2026-06)
- Managed Clerk keys never arrived; switched to user's own Clerk keys (CLERK_OWN_PUBLISHABLE_KEY / CLERK_OWN_SECRET_KEY, fallback in clerk_auth.py; server.py uses helpers)
- Site now loads; /sign-in renders Clerk form (dev instance)
- Added cricket demo player "Arjun Mehra" (legendary_edition) as hero centre card in lib/cardUtils.js DEMO_PLAYERS
- Testing iteration_1: backend + frontend 100%
## Backlog
- Razorpay payments (planned in app), production Clerk (pk_live) keys before publish
