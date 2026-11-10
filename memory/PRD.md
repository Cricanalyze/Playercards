# FlexoCards — PRD

## Original problem statement
Run the existing RivalCard app from github.com/Cricanalyze/Playercards (branch `main2`) as-is: player-card maker for 60+ sports/esports (crop/zoom/adjust, live preview, PNG download/share/save), 25 templates (Free/Basic/Pro/Premium/Exclusive), plan-gated background tools, plans Free ₹0 / Basic ₹18 / Pro ₹45 / Team ₹79 monthly (×10 yearly) with 2/5/15/40 cards a month, user dashboard, Razorpay checkout (test mode), Super Admin panel, Clerk sign-in (owner's own keys).

Follow-up requests: rebrand to **FlexoCards** (Buddy Innovations and Technologies Private Limited) with user logo/favicon; account required for all cards; block screenshots/print; blog with admin + invited player authors; mobile responsive; public share links on paid plans only; paid users can edit cards for 6 h, Free can't edit after create/download; admin Razorpay key settings; email via Emergent (default) or Hostinger SMTP, editable in admin; branded templates for all emails incl. OTP; social links from admin; Coming Soon + scheduled Maintenance pages; MongoDB URL override (default = platform DB); Pro storybook (flip-book, 5 s/card story video, PDF), all downloadable; pricing page features; skeleton loaders; FAQ updates; revenue features (top-up packs, coupons + referrals, watermark passes, GST invoices).

## Architecture
- React (CRA) + FastAPI + MongoDB (motor). Clerk auth (own instance, `clerk_auth.py`). Razorpay Orders API.
- `server.py` (all routes, `/api`), `settings_store.py` (admin-editable settings with Fernet-encrypted secrets, always stored in the platform DB `cfg_db`), `mailer.py` (Emergent email + SMTP, guardrail gate, HTML template), `email_templates.py`, `storage.py` (Emergent object storage), `rbac.py`.
- Site gate middleware returns 423 for non-staff API calls during Coming Soon/Maintenance.
- Storybook images, share images and blog images in object storage (storybook images private and auth-served).

## Implemented (Oct 2026)
- Imported main2 and ran it; rebrand, logo/favicon, Clerk wording “Continue to FlexoCards”
- Blog (markdown editor, image upload, review flow, authors), public share links, 6 h edit window
- Screen guard (best-effort), print block, mobile fixes, skeleton loaders, boot preloader, FAQ
- Admin Settings: site status, database (test/switch/copy/backup/use default), store prices, GST invoice details, Razorpay keys, email provider + SMTP, Clerk email webhook, template previews, social links, email log
- Branded emails: welcome, receipts, purchase, invitation, blog, referral, OTP/reset/magic link/security (via Clerk `email.created` webhook once connected)
- Storybook (Pro/Team): flip-book + downloadable HTML flip-book + page-turn video, story video (5 s/card, MP4/WebM), PDF
- Revenue: card packs (bonus cards never expire), watermark-free passes, coupons (admin CRUD), referrals (both get bonus cards), GST invoices (numbered, CGST/SGST/IGST, PDF)
- Test pass iteration_1: backend 16/17 (failure fixed: coupon timezone); UI issues fixed (mobile Create overflow, payment labels, credits pill, pending orders, seller state dropdown, coupon end-of-day expiry, reverse referrals, coupon max-use reservations, GST-exclusive charging, watermark replay)

## Known limits
- Razorpay payment completion not automated end to end in the UI (third-party iframe). Capture → invoice → wallet was verified on the backend.
- Razorpay webhook secret not set yet, so refunds and late captures don't update on their own.
- Clerk OTP emails stay Clerk-branded until the owner adds the webhook signing secret and turns off “Delivered by Clerk”.
- Screenshot blocking is best-effort; OS and phone screenshots can't be fully blocked.
- Changing the database doesn't migrate data unless “copy data” is on; settings stay in the platform DB.

## Backlog
- P0: Auto-renewing plans (Razorpay Subscriptions / UPI Autopay) (3)
- P0: Bulk team/academy cards from a spreadsheet with sponsor logo (5)
- P1: Storybook video music and premium transitions (9)
- P1: Admin payments list invoice button; live Clerk/Razorpay keys before launch
- P2: Gift a plan, paid template drops, printed cards, AI add-ons

## Session (Jun 2026) — main3 import + redesign
- Imported branch main3; runs with user's own Clerk dev keys (ADMIN_EMAIL set). EMERGENT_EMAIL_KEY optional (mailer won't send until set). Razorpay keys not set → payments "pending setup".
- Public pages redesigned (3D tilt/flip cards, scroll-driven stadium "how it works", trading-card collector look): components/arena/*, Home, Explore, Pricing, Blog, Help, Header, Footer. Fonts: Big Shoulders Display + Permanent Marker.
- Storybook removed from Pro/Team plans → paid add-on ₹29 for 30 days (kind=storybook checkout, users.storybook_until, stacks on renewal; price editable in Admin › Store). Entitlements expose storybook/storybook_until.
- "Secured by Clerk" footer hidden via CSS (.cl-footer).
- Test: iteration_2 frontend 100%.
- Jun 2026 (iter 3): Storybook 90-day bundle ₹69 (item 90d) + 30d ₹29; both editable in Admin › Store. Hourly reminder email 3 days before storybook_until (once per period, users.storybook_reminded_for). Phone tilt via deviceorientation on touch devices (iOS permission asked on first tap). All "Secured by Clerk" footers hidden (sign-in, UserButton popover, Manage account). QA users seeded via backend/qa_users.py. Test iteration_3: 100%.
- Pending: Razorpay keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) for real payments; email key for reminders to deliver.
- Jun 2026 (iter 4): Emergent managed email enabled (EMERGENT_EMAIL_KEY). Welcome, receipts, storybook reminder verified sending (202). Added previews for purchase / storybook reminder / referral templates. Owner will add Razorpay & live keys from admin panel. Email links use site URL (APP_PUBLIC_URL / Admin › Email "site URL") — set to the live domain after deploy.
- Jun 2026 (iter 5): Razorpay TEST keys added; plans, packs, storybook 30d/90d checkout verified incl. a full test payment → captured, invoice PDF, receipt email. Unfinished checkouts hidden from billing history. Webhook secret still not set.
- Jun 2026 (iter 6): Home = one fixed WebGL stadium (components/three/HomeWorld.jsx) behind all sections; camera keyframes per section id (top, sports, templates, how 0/0.5/1, benefits, pricing, faq, cta-section). Scene: grass + pitch, stands with instanced crowd, floodlights, LED boundary boards, scoreboard, trophy podium, 3 real 3D cards (snapshots via html-to-image toJpeg, cached in sessionStorage), floating sports objects, bouncing ball at stumps. Loads after idle; PerformanceMonitor lowers DPR; phones skip light cones/sparkles and use fewer objects. No drag controls. CSS Tilt3D on benefits/pricing/contact. Test iteration_6 passed; LED mirroring, pricing overlap and step crossfade fixed after.
