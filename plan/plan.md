# RivalCard: Run the Playercards App As-Is

## Platform
Web app

## What it is
RivalCard is a player card maker for 60+ sports and esports, including cricket. It has templates, background tools, paid plans and a Super Admin panel.
This job brings up the existing code from the `main2` branch of github.com/Cricanalyze/Playercards and gets it running. No new features.

## Who it's for
- Players, fans and teams who design and download player cards
- The owner (Super Admin) who manages plans, templates, users and payments

## Core features and experience
These features are already in the code, and the run should show them working:
- Card creator for all sports: crop, zoom, rotate, reposition, adjust brightness, contrast and saturation, see a live preview, download a PNG, share and save
- 25 templates in Free, Basic, Pro, Premium and Exclusive collections; locked templates can't be downloaded
- Background tools that depend on the plan, including background removal in the browser
- Plans: Free ₹0, Basic ₹18, Pro ₹45 and Team ₹79 a month (₹0, ₹180, ₹450 and ₹790 a year), with 2, 5, 15 and 40 cards a month. Each download or share uses 1 credit, and credits reset on the 1st of each month
- User dashboard with the current plan, credits left, reset date, expiry and payment history
- Razorpay checkout that turns a plan on only after the payment is verified
- Super Admin panel to manage plans, templates, users, subscriptions, payments, reports and the audit log
- Sample cricket card on the home page

## Phase 1
- Import the `main2` branch exactly as it is and start the app
- Sign-in through the owner's own Clerk login, which needs the Clerk publishable and secret keys
- Razorpay in test mode, which needs the Razorpay test Key ID and Key Secret
- Check that the site loads past its loading screen and that sign-in, creating a card, downloading it and a test checkout all work

Later (not in this run):
- Razorpay webhook secret, so refunds and late payments update on their own
- Plans that renew automatically, and credit for unused time when switching plans
- Admin screen for managing background images, coupon codes and GST invoices
- Switching to live Clerk and Razorpay keys before going public

## Assumptions
- Sign-in stays on the owner's own Clerk login, as the code has it now (the question was skipped)
- No redesign and no changes to the code beyond what it needs to run
- The existing Super Admin email and starting data (sports, templates, plans) are kept as they are in the repo
- Until the webhook secret is added, refunds and payments confirmed late won't update on their own; payments confirmed in the checkout window still work
- Keys are collected by the build agent at build time; none are stored in this plan