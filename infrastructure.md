# Infrastructure

Custom membership for [grcreport.com](https://grcreport.com): auth + Stripe
subscriptions + a members area, replacing Outseta. Frontend is Webflow (plain
browser JS in embeds); the backend is Vercel serverless functions.

## Stack

| Layer | Tool |
|---|---|
| Frontend | Webflow (static pages + CMS, custom-code embeds) |
| Auth + database | Supabase (Postgres, Auth, RLS) |
| API | Vercel serverless functions (`/api`) |
| Payments | Stripe |
| Auth emails | Resend (SMTP) — from `noreply@stack.grcreport.com` |
| Deploy | push to GitHub → Vercel builds |

## What's built

**Database (Supabase)** — [db/](db/)
- `profiles` — one row per user, auto-created by a trigger on signup.
- `subscriptions` — keyed by `email` + `stripe_customer_id`; `user_id` is linked
  by email. RLS: a user reads only their own; only the Stripe webhook writes
  (service role).
- Trigger `handle_new_user` — creates the profile and links any existing
  subscription by email.
- RPC `email_exists` — used by the signup form to check availability.

**Auth** — [webflow/site-wide.html](webflow/site-wide.html),
[sign-in.html](webflow/sign-in.html),
[reset-request.html](webflow/reset-request.html),
[reset-update.html](webflow/reset-update.html)
- Site-wide Supabase client, navbar visibility switching, logout, sign-in,
  password reset. Email confirmation is off (signup returns a session
  immediately).

**Payments** — [api/](api/), [webflow/checkout.html](webflow/checkout.html)
- `api/create-subscription` — takes `{email, firstName, lastName, priceId}` (no
  JWT — the user doesn't exist yet), creates a Stripe customer + subscription
  (`default_incomplete`), returns the client secret. CORS for the Webflow domain.
- `api/stripe-webhook` — the only writer of `subscriptions`; writes email +
  customer + status and links `user_id` by email.
- `webflow/checkout.html` — single-page signup + checkout on `/access/sign-up`.

## Checkout flow

Single page, order **plan → details → payment**:

1. **Plan** — Monthly / Annual (annual shows a "Save 20%" badge). Selecting a
   plan updates the amount.
2. **Details** — email, first name, last name, password, terms. The email is
   validated as it's entered (format + availability); errors show under the field.
3. **Payment** — Apple Pay (black button) when the device supports it, otherwise
   the Stripe card form. "Pay with card" reveals the card form; if no wallet is
   available it shows immediately.

Order of operations on pay:
1. Validate the whole form (incl. a fresh email check).
2. `elements.submit()` (card validation).
3. `POST /api/create-subscription` → Stripe subscription + client secret.
4. `stripe.confirmPayment()` → the charge.
5. **Only after a successful charge** → `supabase.auth.signUp()` creates the account.
6. Redirect to `/dashboard/home`; the trigger links the subscription to the new
   user by email.

The account is created only after payment, so abandoned checkouts leave no
orphaned accounts. If someone pays then closes the tab, the webhook has already
written the subscription by email and it links up when the account is created.

## To do

- **Member area** — UI built in Webflow; needs to connect with Supabase (Stripe
  billing portal, account settings, bookmarks, recently viewed).
- **Alerts** — build the UI in Webflow; connect with Supabase and Resend
  (regulator / section / threshold preferences + email delivery).
- **Google login** — code is wired in sign-in/sign-up; needs the Google provider
  (Client ID/Secret) configured in Supabase to work.
- **Email templates** — restyle the Supabase auth emails (confirm / reset) to
  match GRC Report.
- **Before launch** — switch to live Stripe keys, register the production domain
  under Stripe → Payment method domains, add 3-D Secure recovery for the card path.
