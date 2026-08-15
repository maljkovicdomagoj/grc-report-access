# GRC Report — Custom Membership

Custom auth + Stripe subscriptions + article gating for [grcreport.com](https://grcreport.com),
replacing Outseta so the checkout can show the native black Apple Pay button.

See [grc-report-membership-spec.md](grc-report-membership-spec.md) for the full spec.

## Stack

- **Frontend** — Webflow (plain browser JS pasted into embeds; Supabase + Stripe from CDN, no build step)
- **Auth + DB** — Supabase (Postgres, Auth, RLS)
- **API** — Vercel serverless functions in `/api`
- **Payments** — Stripe
- **Deploy** — push to GitHub → Vercel builds

## Layout

```
api/            Vercel serverless functions (added per phase)
db/schema.sql   Supabase tables + RLS — run once in the Supabase SQL editor
.env.example    required environment variables
```

## Setup

1. Create a Supabase project, run `db/schema.sql` in the SQL editor.
2. Copy `.env.example` and set the values as Vercel environment variables.
   Never expose `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or
   `STRIPE_WEBHOOK_SECRET` to the frontend.

## Build order

Phases are built and verified one at a time (see spec):
auth → payments → gating → member area → alerts.
