# GRC Report — Custom Membership Build

## Context

GRC Report (grcreport.com) is a governance, risk and compliance news publication. The site is built in **Webflow** and articles live in the **Webflow CMS**. Some articles are synced in from an external provider (Corlytics).

We are adding a paid membership so that subscribers get full article access, a personal dashboard, custom alerts, and saved articles.

We originally used **Outseta** for auth + billing. We are replacing it with a custom build. The reason is specific and non-negotiable: the client wants the **native black Apple Pay button** (Stripe's Express Checkout Element) on the checkout. Outseta renders Apple Pay only as a tab inside their own payment selector, inside a Stripe iframe we cannot style. Building custom is the only way to get that button.

Assume Outseta is being removed entirely unless told otherwise.

## Stack

| Layer | Tool |
|---|---|
| Frontend | Webflow (static pages + CMS) |
| Auth + database | Supabase (Postgres, Supabase Auth, RLS) |
| API | Vercel serverless functions |
| Payments | Stripe |
| Deploy | GitHub → Vercel (I connect Vercel myself; you push to GitHub) |

### Working agreement

- **Push code to GitHub.** I have connected the repo to Vercel myself, so a push is a deploy. Do not attempt to configure Vercel.
- All frontend code ends up pasted into Webflow custom code blocks (page `<head>`, before `</body>`, or Embed elements). It must be **plain browser JS** — no build step, no bundler, no JSX, no npm imports on the frontend. Load Supabase and Stripe from CDN.
- Serverless functions live in `/api` and can use npm packages normally.
- Never expose the Supabase service role key or Stripe secret key to the frontend. Anon key and Stripe publishable key are fine.

## Existing Webflow pages

These already exist and should be wired up, not recreated:

| Path | Purpose |
|---|---|
| `/access/sign-up` | Registration + checkout |
| `/access/sign-in` | Login |
| `/access/access-checkout` | Checkout (may be merged into sign-up) |
| `/access/account/settings` | Account settings |
| `/access/account/biling` | Billing (note: existing typo in the slug) |
| `/dashboard/home` | Access Dashboard — main member landing |
| `/dashboard/research` | Research / search |
| `/dashboard/alerts` | Manage alerts |
| `/dashboard/saved` | Saved articles |

The navbar already has two buttons wired for visibility switching. They currently use Outseta attributes (`data-o-anonymous` / `data-o-authenticated`) which need to be replaced with our own logic:

- **Access Log In** — shown when logged out, links to `/access/sign-in`
- **Access Dashboard** — shown when logged in, links to `/dashboard/home`

## Features to build

1. **Auth** — email/password signup and login, email confirmation, password reset, Google OAuth. Session persisted in the browser.
2. **Subscriptions** — monthly and yearly plans. Checkout must show the native black Apple Pay button first, with a card form as fallback.
3. **Article gating** — non-subscribers see a preview; subscribers see the full article.
4. **Dashboard gating** — `/dashboard/*` requires an active subscription.
5. **Saved articles** — bookmark/unbookmark from the article page, list on `/dashboard/saved`.
6. **Recently viewed** — track article views per user, show recent history on the dashboard.
7. **Alerts** — users subscribe to regulators, sections, or enforcement thresholds. Storing the preferences is in scope now; the delivery mechanism (email digest) is a later phase and depends on data we do not have yet.
8. **Billing management** — use Stripe's hosted billing portal rather than building our own.

## Database schema

Starting point — adjust if you see a problem with it:

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  first_name text,
  last_name text,
  stripe_customer_id text unique,
  created_at timestamptz default now()
);

create table subscriptions (
  id text primary key,                    -- Stripe subscription id
  user_id uuid references profiles on delete cascade,
  status text not null,                   -- active, trialing, past_due, canceled
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false
);

create table bookmarks (
  user_id uuid references profiles on delete cascade,
  article_slug text not null,
  created_at timestamptz default now(),
  primary key (user_id, article_slug)
);

create table article_views (
  user_id uuid references profiles on delete cascade,
  article_slug text not null,
  viewed_at timestamptz default now(),
  primary key (user_id, article_slug)
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  alert_type text not null,               -- 'regulator' | 'section' | 'threshold'
  alert_value text not null,              -- 'CFPB' | 'AI Governance' | '10000000'
  created_at timestamptz default now()
);
```

### RLS

Enable RLS on every table.

- `bookmarks`, `article_views`, `alerts`, `profiles` — full access where `auth.uid() = user_id`. These are read and written directly from the browser with the anon key; RLS is the security boundary.
- `subscriptions` — **select only** for the owning user. No insert or update policy at all. Only the Stripe webhook writes to this table, using the service role key, which bypasses RLS. This is deliberate: a user must never be able to grant themselves a subscription.

## Checkout requirements

This is the part the whole rebuild exists for, so it needs to be right.

- Use Stripe's **Express Checkout Element** with `buttonTheme: { applePay: 'black' }`.
- The Apple Pay button goes **above** the card form, per Apple's guidelines.
- Render a normal Payment Element as fallback — Express Checkout only appears when the user has a card in their wallet.
- Create the subscription server-side with `payment_behavior: 'default_incomplete'`, return the client secret, confirm on the frontend.
- Pass `user_id` into the Stripe subscription `metadata` so the webhook can link the subscription back to a Supabase user.
- The domain must be registered under Stripe → Settings → Payment method domains for Apple Pay to render. `grc-report-v-1.webflow.io` is already registered; the production domain will need adding.

### Webhook

`/api/stripe-webhook` handles at minimum:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

It upserts into `subscriptions` using the service role key. Remember to disable Next.js body parsing so the raw body is available for signature verification.

## Gating strategy — read this carefully

Webflow serves CMS content statically. If the full article body is bound anywhere on the page and merely hidden with JavaScript, **anyone can read it in view-source**. This is real: it is how most no-code membership gating actually works, and it is not acceptable for a publication charging for access.

The approach:

- Split the CMS article into two fields: `preview` (first two or three paragraphs, public) and `full_body` (gated).
- Webflow binds **only** `preview`. `full_body` must not appear in any binding on any page.
- The frontend calls `/api/article` with the user's JWT. The function verifies the token, checks for an active subscription, then fetches `full_body` from the Webflow CMS API and returns it. No subscription → 403.

For `/dashboard/*` pages a client-side redirect guard is enough, because those pages are empty shells that fetch their data from Supabase at runtime. RLS means an unauthenticated visitor who bypasses the redirect sees nothing. **Exception:** if a dashboard page contains a Webflow CMS Collection List of gated content, that content is static and will leak — apply the preview/full_body rule there too.

## Build order

Build and verify each phase before moving to the next. Do not scaffold everything at once.

1. **Auth** — Supabase project, `profiles`, RLS, signup/login/logout/reset/Google OAuth wired into the existing Webflow pages. Navbar button switching.
2. **Payments** — Stripe products and prices, `/api/create-subscription`, Express Checkout Element with the black Apple Pay button, webhook writing to `subscriptions`.
3. **Gating** — CMS field split, `/api/article`, dashboard route guard.
4. **Member area** — Stripe billing portal, account settings, bookmarks, recently viewed.
5. **Alerts** — preference storage and management UI. Delivery is out of scope for now.

## Environment variables

```
SUPABASE_URL
SUPABASE_ANON_KEY            # safe in frontend
SUPABASE_SERVICE_ROLE_KEY    # server only
STRIPE_SECRET_KEY            # server only
STRIPE_PUBLISHABLE_KEY       # safe in frontend
STRIPE_WEBHOOK_SECRET        # server only
WEBFLOW_API_TOKEN            # server only
WEBFLOW_SITE_ID              # 63e17201c0e9876f45c22d5a
```

## Notes and open questions

- Use Stripe test keys throughout development. Switch to live keys only at launch.
- Supabase free tier is fine for development, but production needs Pro ($25/mo) — the free tier has no automated backups and pauses projects after seven days of inactivity.
- Alert delivery depends on what data Corlytics actually sends (regulators, enforcement amounts, categories). That is still an open question with the client, so build the storage and UI but do not design the delivery pipeline yet.
- When you produce frontend code, output it as a **complete, self-contained block ready to paste into a Webflow embed**, and tell me exactly which page and which slot it goes in.
