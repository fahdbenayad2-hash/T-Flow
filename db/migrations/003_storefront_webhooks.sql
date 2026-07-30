-- T-Flow storefront webhook foundation
-- Safe to run after 002_saas_orders.sql.

-- ============================================================================
-- 1. Secure webhook metadata on existing store integrations
-- ============================================================================

alter table public.store_integrations
  add column if not exists secret_hash text,
  add column if not exists last_received_at timestamptz,
  add column if not exists received_count bigint not null default 0,
  add column if not exists error_count bigint not null default 0;

create unique index if not exists idx_store_integrations_webhook_key
  on public.store_integrations(external_account_id)
  where provider = 'webhook' and external_account_id is not null;

comment on column public.store_integrations.secret_hash is
  'SHA-256 hash of the webhook secret. The plaintext secret is shown only once.';

-- ============================================================================
-- 2. Webhook delivery log
-- ============================================================================

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.store_integrations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  external_order_id text,
  status text not null,
  order_uuid uuid references public.orders(id) on delete set null,
  request_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  constraint webhook_events_status check (
    status in ('accepted', 'duplicate', 'rejected')
  )
);

create index if not exists idx_webhook_events_integration_created
  on public.webhook_events(integration_id, created_at desc);

create index if not exists idx_webhook_events_store_created
  on public.webhook_events(store_id, created_at desc);

alter table public.webhook_events enable row level security;

drop policy if exists "Store admins can view webhook events" on public.webhook_events;
create policy "Store admins can view webhook events"
  on public.webhook_events for select
  using (public.has_store_role(store_id, 'admin'));

-- Inserts and updates are intentionally service-role only. Public webhook
-- requests never receive direct database credentials.

-- ============================================================================
-- 3. Atomic integration counters
-- ============================================================================

create or replace function public.record_webhook_result(
  target_integration_id uuid,
  result_is_error boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.store_integrations
  set
    last_received_at = now(),
    received_count = received_count + case when result_is_error then 0 else 1 end,
    error_count = error_count + case when result_is_error then 1 else 0 end
  where id = target_integration_id
    and provider = 'webhook';
$$;

revoke all on function public.record_webhook_result(uuid, boolean) from public;
revoke all on function public.record_webhook_result(uuid, boolean) from anon;
revoke all on function public.record_webhook_result(uuid, boolean) from authenticated;
grant execute on function public.record_webhook_result(uuid, boolean) to service_role;

-- ============================================================================
-- Done
-- ============================================================================
