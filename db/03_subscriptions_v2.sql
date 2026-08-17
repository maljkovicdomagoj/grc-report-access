-- Phase 2 v2: subscriptions keyed by email + stripe_customer_id so the webhook
-- can write BEFORE the Supabase user exists (account is created after payment).
-- user_id is linked later by matching email. Test env: safe to drop + recreate.

drop table if exists public.subscriptions;
create table public.subscriptions (
  id text primary key,                    -- Stripe subscription id
  stripe_customer_id text not null,
  email text not null,
  user_id uuid references public.profiles on delete set null,
  status text not null,                   -- active, trialing, past_due, canceled, incomplete
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false
);
create index on public.subscriptions (email);

alter table public.subscriptions enable row level security;
-- select only, owner scoped. Only the webhook (service role) writes.
create policy "read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- New-user trigger: create the profile AND link any subscription already paid
-- under this email (covers pay-then-create-account and abandoned-tab recovery).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email,
          new.raw_user_meta_data ->> 'first_name',
          new.raw_user_meta_data ->> 'last_name');
  update public.subscriptions
     set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null;
  return new;
end;
$$;

-- Reliable email-availability check for the signup form (returns only a boolean).
create or replace function public.email_exists(e text)
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from auth.users where lower(email) = lower(e));
$$;
grant execute on function public.email_exists(text) to anon, authenticated;
