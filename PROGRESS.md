# Progress

Status of the GRC Report custom membership build. See
[grc-report-membership-spec.md](grc-report-membership-spec.md) for the full spec
and [README.md](README.md) for setup.

## Done

### Infrastructure
- Repo connected to Vercel (push = deploy).
- Supabase project created; Vercel ↔ Supabase integration added the DB/auth env
  vars with a `STORAGE_` prefix (see [.env.example](.env.example)).
- `db/schema.sql` run in Supabase → tables + RLS live.
- `db/02_auth_trigger.sql` run → new users auto-get a `profiles` row (confirmed:
  signup creates a row).

### Phase 1 — Auth  ✅ working
| Piece | File | Where it lives in Webflow |
|---|---|---|
| Supabase client + navbar switching + logout | [webflow/site-wide.html](webflow/site-wide.html) | Site-wide Header Code (or inside the navbar component) |
| Sign-up (+ Google) | [webflow/sign-up.html](webflow/sign-up.html) | Embed on `/access/sign-up` |
| Sign-in (+ Google, login-status readout) | [webflow/sign-in.html](webflow/sign-in.html) | Embed on `/access/sign-in` |
| Password reset — request | [webflow/reset-request.html](webflow/reset-request.html) | Embed on `/access/sign-in` (or its own page) |
| Password reset — set new password | [webflow/reset-update.html](webflow/reset-update.html) | Embed on new page `/access/reset-password` |

- Logout: add attribute `data-auth-logout` to any button/link.
- Navbar: reuses the existing `data-o-anonymous` / `data-o-authenticated`
  attributes; our code toggles them by session state.

## Deferred (do later, agreed)
- **Google login** — buttons are wired in `sign-in`/`sign-up`; still need to
  configure the Google provider (Client ID/Secret) in Supabase → Authentication →
  Providers (and a Google Cloud OAuth client) before it works.
- **Email template look** — restyle the Supabase auth emails (confirm / reset) to
  match GRC Report instead of the default template (Authentication → Emails).

## In progress / needs verification
- **Express Checkout / Apple Pay test** — [webflow/checkout-test.html](webflow/checkout-test.html)
  renders the black Apple Pay button + card fallback (Link disabled, plan-card
  hook, "Pay another way"). Verify by: registering the domain in Stripe → Payment
  method domains (test mode), setting the test publishable key, publishing, and
  opening in Safari. Does NOT charge yet.

## Phase 2 — Payments (v2 flow: account created AFTER payment)
- DB: [db/03_subscriptions_v2.sql](db/03_subscriptions_v2.sql) — subscriptions now
  keyed by `email` + `stripe_customer_id` (webhook can write before the user
  exists); `user_id` linked by email via the new-user trigger. Adds
  `email_exists()` RPC for the signup email check.
- Server: [api/create-subscription.js](api/create-subscription.js) takes
  `{email, firstName, lastName, priceId}` (no JWT — user doesn't exist yet);
  [api/stripe-webhook.js](api/stripe-webhook.js) writes email + customer, links
  user_id by email.
- Frontend: [webflow/checkout.html](webflow/checkout.html) — single-page form
  (plan → details → pay), email validated on entry, Apple Pay + card, account
  created only after payment succeeds.
- Superseded: `webflow/sign-up.html`, `webflow/checkout-test.html`.

## Not started
- **Phase 3 — Gating:** CMS `preview`/`full_body` split, `/api/article`, dashboard
  route guard.
- **Phase 4 — Member area:** Stripe billing portal, account settings, bookmarks,
  recently viewed.
- **Phase 5 — Alerts:** preference storage + management UI.

## Config still to do
- Supabase Auth → URL Configuration: add `/access/reset-password` (and prod
  domain) to the redirect allowlist.
- ~~Custom SMTP for auth emails~~ ✅ done — Resend, sending from
  `noreply@stack.grcreport.com` (removed the default-mailer rate limit).
- Stripe + Webflow env vars in Vercel (added when Phase 2 / 3 start).
- Register the production domain in Stripe → Payment method domains before launch.
