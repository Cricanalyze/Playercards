# RivalCard (Cricanalyze/Playercards)
Original ask: run https://github.com/Cricanalyze/Playercards as-is.

## Done (2026-06)
- Code imported (backend, frontend), deps installed (yarn --ignore-engines due to node 20 vs >=22 for @wallet-standard/base)
- Backend running: /api and /api/sports OK, seed data loaded
- ADMIN_EMAIL set

## Blocker
- CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY (Emergent-managed Clerk) still empty -> /api/clerk/config enabled:false -> frontend renders blank
- scripts/ and tests/ folders from repo not copied (protected path)
