-- T-Flow subscription foundation
-- Adds one store-scoped subscription with a 14-day Growth trial.

create table if not exists public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  plan_code text not null default 'growth',
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider text,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_subscriptions_plan check (plan_code in ('starter', 'growth', 'pro')),
  constraint store_subscriptions_status check (
    status in ('trialing', 'active', 'past_due', 'cancelled')
  )
);

create index if not exists idx_store_subscriptions_status
  on public.store_subscriptions(status, current_period_end);

drop trigger if exists store_subscriptions_touch_updated_at on public.store_subscriptions;
create trigger store_subscriptions_touch_updated_at
  before update on public.store_subscriptions
  for each row execute function public.tflow_touch_updated_at();

create or replace function public.tflow_create_store_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_subscriptions (store_id, plan_code, status, trial_ends_at)
  values (new.id, 'growth', 'trialing', now() + interval '14 days')
  on conflict (store_id) do nothing;
  return new;
end;
$$;

drop trigger if exists stores_create_subscription on public.stores;
create trigger stores_create_subscription
  after insert on public.stores
  for each row execute function public.tflow_create_store_subscription();

insert into public.store_subscriptions (store_id, plan_code, status, trial_ends_at)
select id, 'growth', 'trialing', now() + interval '14 days'
from public.stores
on conflict (store_id) do nothing;

alter table public.store_subscriptions enable row level security;

drop policy if exists "Store admins can view subscription" on public.store_subscriptions;
create policy "Store admins can view subscription"
  on public.store_subscriptions for select
  using (public.has_store_role(store_id, 'admin'));

-- Subscription changes are intentionally service-role only. A payment webhook
-- or a platform operator will activate paid plans in a later migration.

comment on table public.store_subscriptions is
  'Store plan state. Paid changes must be written by trusted server-side code only.';
