-- GRC Report membership schema. Run in the Supabase SQL editor.

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
  primary key (user_id, article_slug)     -- one row per article; upsert refreshes viewed_at
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  alert_type text not null,               -- 'regulator' | 'section' | 'threshold'
  alert_value text not null,              -- 'CFPB' | 'AI Governance' | '10000000'
  created_at timestamptz default now()
);

-- RLS: the browser talks to these tables directly with the anon key,
-- so RLS is the security boundary.
alter table profiles      enable row level security;
alter table subscriptions enable row level security;
alter table bookmarks     enable row level security;
alter table article_views enable row level security;
alter table alerts        enable row level security;

-- Owner has full access to their own rows.
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own bookmarks" on bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own article_views" on article_views
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own alerts" on alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- subscriptions: read-only for the owner. No insert/update/delete policy on
-- purpose — only the Stripe webhook writes here via the service role key
-- (which bypasses RLS). A user must never grant themselves a subscription.
create policy "read own subscription" on subscriptions
  for select using (auth.uid() = user_id);
