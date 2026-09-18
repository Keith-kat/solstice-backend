# Solstice backend (scaffold)

A minimal Node/Express API to sit behind `solstice-app.jsx` and
`solstice-extensions.jsx`. Mirrors the pattern used for the Safina
backend: every external integration (M-Pesa, WhatsApp, and now
Flutterwave for Phase 3) degrades to a mock response when credentials
are absent in `.env`, so the rest of the app can be built and demoed
before Daraja/Meta/Flutterwave onboarding finishes.

## Run it

```bash
cp .env.example .env   # fill in what you have; leave the rest blank to mock
npm install
npm run dev
```

## What's implemented

- **Host-Only Commission** (`services/commissionService.js`) — 15% base,
  discounted to 12% once a listing is `photographed`. This is what ties
  the Photography & Verification add-on to real, ongoing revenue impact
  instead of a one-off fee.
- **Featured Listings** (`POST /api/properties/:id/feature`) — 3/7/14-day
  boosts at KES 500/1,200/2,000, paid via M-Pesa STK push, sorted to the
  top of `GET /api/properties` while `featuredUntil` is in the future.
- **Photography & Verification** (`POST /api/properties/:id/verification-visit`,
  `PATCH /api/properties/:id/photographed`) — fee-waived for the first
  `FREE_PHOTOGRAPHY_COHORT_SIZE` listings (your manual Phase-1 onboarding
  batch), KES `PHOTOGRAPHY_FEE_KES` after that.
- **Escrow** (`routes/bookings.js`) — deposit sits `held` until 24h after
  check-in, then `POST /api/bookings/:id/release-payout` computes the
  host's cut via commissionService and pays out (wire to `b2cPayout`).
- **Direct WhatsApp Pipeline** (`services/whatsappService.js`) — booking
  confirmations fire automatically from the M-Pesa callback, not from a
  page the guest has to reload.
- **Double-blind reviews** (`routes/reviews.js`) — both sides' reviews
  stay hidden until both are in, or 14 days pass.
- **Partner Perks** (`routes/partners.js`) — Phase 2 stub: register a
  partner, log a referral, take a commission cut.
- **Phase 3 regional payments** (`services/regionalPaymentsService.js`) —
  Flutterwave stub for TZS/UGX/RWF mobile money, mocked until you sign.

## Current state

- In-memory arrays stand in for a database — swap for Postgres/Supabase
  in each route file without changing the request/response shape. Note:
  each route file currently holds its own array, so a booking and its
  property aren't joined yet — that's a real limitation to fix with a
  shared datastore, not a demo shortcut to leave in production.
- `/api/properties` only ever returns `status: "verified"` listings by
  default — the verification gate is enforced server-side, which is the
  actual trust guarantee, not just a UI badge.
- Every mock path was actually exercised (STK push → callback → escrow
  hold → WhatsApp confirmation; boost purchase; photography → commission
  discount; double-blind review reveal) — see the smoke test in the
  build notes if you want to rerun it yourself.

## Left to finish

- Real datastore + migrations, with foreign keys joining bookings ↔
  properties ↔ agents so `release-payout` can look up the host's own
  phone number automatically
- Auth (agent login, staff/admin role for the verification queue)
- Matching the M-Pesa B2C result callback back to a payout record
- Image/document upload for listing photos and title-deed verification
- A cron (or queue) to call `release-payout` automatically instead of
  needing a manual trigger
