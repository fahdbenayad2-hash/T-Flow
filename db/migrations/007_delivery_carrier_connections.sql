-- Server-only carrier credentials, isolated per store.

create table if not exists public.delivery_carrier_connections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null,
  account_label text not null default '',
  api_id text not null,
  api_token_encrypted text not null,
  base_url text not null,
  is_active boolean not null default true,
  connection_status text not null default 'untested',
  last_tested_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_carrier_provider check (provider in ('yalidine')),
  constraint delivery_carrier_connection_status
    check (connection_status in ('untested', 'connected', 'error')),
  unique (store_id, provider)
);

create index if not exists idx_delivery_carrier_connections_store
  on public.delivery_carrier_connections(store_id, provider);

create or replace trigger delivery_carrier_connections_touch_updated_at
  before update on public.delivery_carrier_connections
  for each row execute function public.tflow_touch_updated_at();

alter table public.delivery_carrier_connections enable row level security;

-- Credentials are only accessed through role-checked server functions.
revoke all on table public.delivery_carrier_connections from anon, authenticated;

comment on table public.delivery_carrier_connections is
  'Server-only delivery credentials. API tokens are AES-GCM encrypted before storage.';

notify pgrst, 'reload schema';
