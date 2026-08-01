-- Store-scoped delivery batches and shipment tracking.

create table if not exists public.delivery_batches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  reference text not null,
  carrier text not null,
  status text not null default 'ready',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_batches_status check (status in ('ready', 'dispatched', 'closed')),
  unique (store_id, reference)
);

create table if not exists public.delivery_shipments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  batch_id uuid not null references public.delivery_batches(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  tracking_number text not null,
  status text not null default 'ready',
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_shipments_status
    check (status in ('ready', 'in_transit', 'delivered', 'exception')),
  unique (store_id, order_id),
  unique (store_id, tracking_number)
);

create index if not exists idx_delivery_batches_store_created
  on public.delivery_batches(store_id, created_at desc);
create index if not exists idx_delivery_shipments_store_status
  on public.delivery_shipments(store_id, status);
create index if not exists idx_delivery_shipments_batch
  on public.delivery_shipments(batch_id);

create or replace trigger delivery_batches_touch_updated_at
  before update on public.delivery_batches
  for each row execute function public.tflow_touch_updated_at();

create or replace trigger delivery_shipments_touch_updated_at
  before update on public.delivery_shipments
  for each row execute function public.tflow_touch_updated_at();

alter table public.delivery_batches enable row level security;
alter table public.delivery_shipments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'delivery_batches'
      and policyname = 'Store members can view delivery batches'
  ) then
    create policy "Store members can view delivery batches"
      on public.delivery_batches for select
      using (public.is_store_member(store_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'delivery_shipments'
      and policyname = 'Store members can view delivery shipments'
  ) then
    create policy "Store members can view delivery shipments"
      on public.delivery_shipments for select
      using (public.is_store_member(store_id));
  end if;
end
$$;

-- Writes intentionally go through role-checked server functions using service-role.

notify pgrst, 'reload schema';
