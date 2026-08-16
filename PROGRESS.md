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

## In progress / needs verification
- **Google OAuth** — wired in code; needs the Google provider (Client ID/Secret)
  configured in Supabase → Authentication → Providers to actually work.
- **Express Checkout / Apple Pay test** — [webflow/checkout-test.html](webflow/checkout-test.html)
  renders the black Apple Pay button + card fallback (Link disabled, plan-card
  hook, "Pay another way"). Verify by: registering the domain in Stripe → Payment
  method domains (test mode), setting the test publishable key, publishing, and
  opening in Safari. Does NOT charge yet.

## Not started
- **Phase 2 — Payments:** `/api/create-subscription` (server-side subscription,
  `payment_behavior: 'default_incomplete'`), confirm on frontend,
  `/api/stripe-webhook` writing to `subscriptions`.
- **Phase 3 — Gating:** CMS `preview`/`full_body` split, `/api/article`, dashboard
  route guard.
- **Phase 4 — Member area:** Stripe billing portal, account settings, bookmarks,
  recently viewed.
- **Phase 5 — Alerts:** preference storage + management UI.

## Config still to do
- Supabase Auth → URL Configuration: add `/access/reset-password` (and prod
  domain) to the redirect allowlist.
- Custom SMTP for production auth emails (launch task — default mailer is
  dev-only, heavily rate-limited).
- Stripe + Webflow env vars in Vercel (added when Phase 2 / 3 start).
- Register the production domain in Stripe → Payment method domains before launch.
