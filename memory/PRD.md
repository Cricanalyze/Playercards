# RivalCard (Cricanalyze/Playercards)

## Original asks
1. Run https://github.com/Cricanalyze/Playercards as-is.
2. Turn on Clerk login; add a sample cricket card on the home page.
3. Add the website functions and the subscription model (no redesign): card creator, 25 templates in 5 collections, background tools by plan, Free/Basic/Pro/Team plans (₹0/18/45/79 a month, ₹0/180/450/790 a year, 2/5/15/40 cards a month), backend enforcement, Super Admin subscription controls, Razorpay payments, user/admin management.

## Architecture
- FastAPI (backend/server.py) + MongoDB + React (CRA, shadcn). Auth uses the user's own Clerk dev keys (CLERK_OWN_*), with a fallback in clerk_auth.py.
- Catalog seed is in backend/seed_catalog.py (PLANS, 25 TEMPLATES, BACKGROUNDS). A one-time migration (meta "subs_v2") replaced the old plans and templates; admin edits after that are kept.
- Entitlements: get_entitlements() uses the highest-order active subscription against the LIVE plan document. Usage is tracked per calendar month (UTC) in `usage`, with idempotent `usage_events` (unique request_id). consume() increments atomically and only below the limit.
- Credits: every /api/cards/export call (download or share) uses 1 credit. A duplicate request_id is never charged. Sign-in is required to download. Template locks and features_used are checked on the backend.
- Background removal runs in the browser (MediaPipe). /api/tools/bg-removal checks the plan and counts usage first. If processing fails, a retry reuses the same request_id, so no second credit is used.
- Razorpay: orders API, HMAC signature check on /billing/verify, payment fetched and amount checked, auto-capture when the payment is only authorized, /billing/webhook with signature check and idempotent events (captured, failed, authorized, refund). A plan activates only after verification.

## Implemented (2026-06)
- Run, Clerk login, cricket demo card. iteration_1 passed.
- Subscription model and all of the admin controls listed above. iteration_2: backend 39/39 passed, frontend 100%.
- Fixed after iteration_2: pending grants now start automatically; extend is blocked for canceled or refunded subscriptions; disabling a plan keeps existing subscribers; authorized payments are captured; switching plans asks for confirmation; bg-removal retries are free; date inputs use the dark picker.

## Pending configuration
- RAZORPAY_WEBHOOK_SECRET is not set (the webhook returns 503). Add it in the secrets card and point the Razorpay webhook at /api/billing/webhook.
- Production needs live Razorpay and live Clerk keys.

## Backlog
- P1: auto-renewing plans with Razorpay Subscriptions; proration or credit when switching plans.
- P2: admin CRUD for the background library; coupon codes; GST invoices.
- Old backend/tests/test_rivalcard_*.py are obsolete. tests/test_subscriptions_v2.py is the current suite.
