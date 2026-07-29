-- T-Flow SaaS order storage foundation
-- Safe to run after 001_init.sql. The application remains on Google Sheets
-- until ORDER_STORAGE_MODE is explicitly changed.

-- ============================================================================
-- 1. Stores and memberships
-- ============================================================================

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  currency text not null default 'DZD',
  timezone text not null default 'Africa/Algiers',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (store_id, user_id, role)
);

-- ============================================================================
-- 2. Orders
-- ============================================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  source text not null default 'google_sheets',
  source_order_id text not null,
  sheet_row integer,
  customer_name text not null default '',
  phone text not null default '',
  wilaya text not null default '',
  baladiya text not null default '',
  address text not null default '',
  notes text not null default '',
  product text not null default '',
  color text not null default '',
  size text not null default '',
  price numeric(14, 2) not null default 0,
  quantity integer not null default 1,
  delivery_type text not null default '',
  ordered_at timestamptz,
  ordered_at_text text not null default '',
  status text not null default 'قيد المعالجة',
  raw_data jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint orders_source_format check (source ~ '^[a-z0-9_]+$'),
  constraint orders_sheet_row_valid check (sheet_row is null or sheet_row >= 2),
  constraint orders_quantity_valid check (quantity >= 0),
  unique (store_id, source, source_order_id)
);

create unique index if not exists idx_orders_store_sheet_row
  on public.orders(store_id, sheet_row)
  where source = 'google_sheets' and sheet_row is not null and deleted_at is null;

create index if not exists idx_orders_store_status
  on public.orders(store_id, status)
  where deleted_at is null;

create index if not exists idx_orders_store_phone
  on public.orders(store_id, phone)
  where deleted_at is null;

create index if not exists idx_orders_store_updated
  on public.orders(store_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_orders_store_ordered
  on public.orders(store_id, ordered_at desc nulls last)
  where deleted_at is null;

-- ============================================================================
-- 3. Integration and migration bookkeeping
-- ============================================================================

create table if not exists public.store_integrations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null,
  external_account_id text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, provider, external_account_id)
);

comment on column public.store_integrations.config is
  'Non-secret provider settings only. API secrets stay in server environment variables or a secrets vault.';

create table if not exists public.order_sync_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null default 'google_sheets',
  direction text not null default 'import',
  status text not null default 'running',
  scanned_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  deleted_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  error_summary jsonb not null default '[]'::jsonb,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint order_sync_runs_direction check (direction in ('import', 'export', 'bidirectional')),
  constraint order_sync_runs_status check (status in ('running', 'completed', 'failed'))
);

alter table public.order_sync_runs
  add column if not exists deleted_count integer not null default 0;

create index if not exists idx_order_sync_runs_store_started
  on public.order_sync_runs(store_id, started_at desc);

-- Link existing operational tables to a store without breaking current data.
alter table public.audit_log add column if not exists store_id uuid references public.stores(id);
alter table public.audit_log add column if not exists order_uuid uuid references public.orders(id);
alter table public.call_logs add column if not exists store_id uuid references public.stores(id);
alter table public.call_logs add column if not exists order_uuid uuid references public.orders(id);
alter table public.order_assignments add column if not exists store_id uuid references public.stores(id);
alter table public.order_assignments add column if not exists order_uuid uuid references public.orders(id);

create index if not exists idx_audit_log_store_created
  on public.audit_log(store_id, created_at desc);
create index if not exists idx_call_logs_store_created
  on public.call_logs(store_id, created_at desc);

-- ============================================================================
-- 4. Updated-at and optimistic-version triggers
-- ============================================================================

create or replace function public.tflow_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.tflow_touch_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  if row(new.*) is distinct from row(old.*) then
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists stores_touch_updated_at on public.stores;
create trigger stores_touch_updated_at
  before update on public.stores
  for each row execute function public.tflow_touch_updated_at();

drop trigger if exists integrations_touch_updated_at on public.store_integrations;
create trigger integrations_touch_updated_at
  before update on public.store_integrations
  for each row execute function public.tflow_touch_updated_at();

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.tflow_touch_order();

-- ============================================================================
-- 5. Store-scoped authorization helpers
-- ============================================================================

create or replace function public.is_store_member(check_store_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.store_members
    where store_id = check_store_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.has_store_role(check_store_id uuid, check_role app_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.store_members
    where store_id = check_store_id
      and user_id = auth.uid()
      and role = check_role
      and is_active = true
  );
$$;

revoke all on function public.is_store_member(uuid) from public;
revoke all on function public.has_store_role(uuid, app_role) from public;
grant execute on function public.is_store_member(uuid) to authenticated;
grant execute on function public.has_store_role(uuid, app_role) to authenticated;

-- ============================================================================
-- 6. Row-level security
-- ============================================================================

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.orders enable row level security;
alter table public.store_integrations enable row level security;
alter table public.order_sync_runs enable row level security;

drop policy if exists "Members can view stores" on public.stores;
create policy "Members can view stores"
  on public.stores for select
  using (public.is_store_member(id));

drop policy if exists "Store admins can update stores" on public.stores;
create policy "Store admins can update stores"
  on public.stores for update
  using (public.has_store_role(id, 'admin'))
  with check (public.has_store_role(id, 'admin'));

drop policy if exists "Members can view memberships" on public.store_members;
create policy "Members can view memberships"
  on public.store_members for select
  using (public.is_store_member(store_id));

drop policy if exists "Store admins can manage memberships" on public.store_members;
create policy "Store admins can manage memberships"
  on public.store_members for all
  using (public.has_store_role(store_id, 'admin'))
  with check (public.has_store_role(store_id, 'admin'));

drop policy if exists "Store members can view orders" on public.orders;
create policy "Store members can view orders"
  on public.orders for select
  using (public.is_store_member(store_id));

drop policy if exists "Order operators can create orders" on public.orders;
drop policy if exists "Order operators can update orders" on public.orders;
drop policy if exists "Store admins can delete orders" on public.orders;

-- Direct order writes are intentionally not exposed to authenticated clients.
-- All mutations pass through role-checked server functions using service-role.
-- This prevents callers from bypassing field-level permissions via PostgREST.

drop policy if exists "Store admins can view integrations" on public.store_integrations;
create policy "Store admins can view integrations"
  on public.store_integrations for select
  using (public.has_store_role(store_id, 'admin'));

drop policy if exists "Store admins can manage integrations" on public.store_integrations;
create policy "Store admins can manage integrations"
  on public.store_integrations for all
  using (public.has_store_role(store_id, 'admin'))
  with check (public.has_store_role(store_id, 'admin'));

drop policy if exists "Store admins can view sync runs" on public.order_sync_runs;
create policy "Store admins can view sync runs"
  on public.order_sync_runs for select
  using (public.has_store_role(store_id, 'admin'));

-- Sync runs are written by server-side service-role operations. No direct
-- authenticated insert/update policy is intentionally granted.

-- ============================================================================
-- 7. Bootstrap one main store for existing installations
-- ============================================================================

do $$
declare
  default_owner uuid;
  default_store uuid;
begin
  select user_id
    into default_owner
  from public.user_roles
  where role = 'admin'
  order by id
  limit 1;

  if default_owner is null then
    return;
  end if;

  insert into public.stores (owner_id, name, slug)
  values (default_owner, 'T-Flow Main Store', 'main')
  on conflict (slug) do nothing
  returning id into default_store;

  if default_store is null then
    select id into default_store from public.stores where slug = 'main';
  end if;

  insert into public.store_members (store_id, user_id, role)
  select default_store, user_id, role
  from public.user_roles
  on conflict (store_id, user_id, role) do nothing;
end;
$$;

-- ============================================================================
-- Done. Keep ORDER_STORAGE_MODE=sheets until import verification is complete.
-- ============================================================================
