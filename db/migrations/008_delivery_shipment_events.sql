-- Immutable shipment timeline used by real carriers and the local simulator.

create table if not exists public.delivery_shipment_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  shipment_id uuid not null references public.delivery_shipments(id) on delete cascade,
  status text not null,
  source text not null default 'carrier',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint delivery_shipment_event_status
    check (status in ('ready', 'in_transit', 'delivered', 'exception')),
  constraint delivery_shipment_event_source
    check (source in ('carrier', 'simulator', 'manual'))
);

create index if not exists idx_delivery_shipment_events_shipment_time
  on public.delivery_shipment_events(shipment_id, occurred_at desc);
create index if not exists idx_delivery_shipment_events_store_time
  on public.delivery_shipment_events(store_id, occurred_at desc);

alter table public.delivery_shipment_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'delivery_shipment_events'
      and policyname = 'Store members can view shipment events'
  ) then
    create policy "Store members can view shipment events"
      on public.delivery_shipment_events for select
      using (public.is_store_member(store_id));
  end if;
end
$$;

-- Writes go through role-checked server functions.
notify pgrst, 'reload schema';
