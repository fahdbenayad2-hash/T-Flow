-- T-Flow billing and invoice ledger.
-- Chargily checkouts are created server-side and activated only by a signed webhook.

alter table public.store_subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz;

create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_code text not null,
  provider text not null default 'chargily',
  external_checkout_id text unique,
  status text not null default 'pending',
  amount integer not null,
  currency text not null default 'dzd',
  checkout_url text,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_invoices_plan check (plan_code in ('growth', 'pro')),
  constraint subscription_invoices_status check (
    status in ('pending', 'paid', 'failed', 'expired', 'cancelled')
  ),
  constraint subscription_invoices_amount check (amount > 0),
  constraint subscription_invoices_currency check (currency = 'dzd')
);

create index if not exists idx_subscription_invoices_store_created
  on public.subscription_invoices(store_id, created_at desc);

drop trigger if exists subscription_invoices_touch_updated_at on public.subscription_invoices;
create trigger subscription_invoices_touch_updated_at
  before update on public.subscription_invoices
  for each row execute function public.tflow_touch_updated_at();

alter table public.subscription_invoices enable row level security;

drop policy if exists "Store admins can view invoices" on public.subscription_invoices;
create policy "Store admins can view invoices"
  on public.subscription_invoices for select
  using (public.has_store_role(store_id, 'admin'));

comment on table public.subscription_invoices is
  'Immutable store-scoped checkout ledger. State changes are service-role only.';
