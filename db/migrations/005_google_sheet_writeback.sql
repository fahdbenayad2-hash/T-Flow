-- Reliable T-Flow -> Google Sheets operational-field write-back.

create table if not exists public.integration_write_queue (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  integration_id uuid not null references public.store_integrations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'google_sheets_oauth',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_write_queue_status
    check (status in ('pending', 'processing', 'completed', 'failed')),
  unique (integration_id, order_id)
);

create index if not exists idx_integration_write_queue_ready
  on public.integration_write_queue(integration_id, next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table public.integration_write_queue enable row level security;
revoke all on table public.integration_write_queue from anon, authenticated;

drop trigger if exists integration_write_queue_touch_updated_at
  on public.integration_write_queue;
create trigger integration_write_queue_touch_updated_at
  before update on public.integration_write_queue
  for each row execute function public.tflow_touch_updated_at();

create or replace function public.tflow_enqueue_google_sheet_writeback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_integration_id uuid;
  target_sheet_row integer;
begin
  -- Imports always update last_synced_at. They must not create a feedback loop.
  if new.source <> 'google_oauth'
    or new.deleted_at is not null
    or new.last_synced_at is distinct from old.last_synced_at
    or (
      new.status is not distinct from old.status
      and new.notes is not distinct from old.notes
    )
  then
    return new;
  end if;

  begin
    target_integration_id := nullif(new.raw_data ->> 'integrationId', '')::uuid;
    target_sheet_row := nullif(new.raw_data ->> 'sheetRow', '')::integer;
  exception when invalid_text_representation then
    return new;
  end;

  if target_integration_id is null or target_sheet_row is null or target_sheet_row < 2 then
    return new;
  end if;

  insert into public.integration_write_queue (
    store_id,
    integration_id,
    order_id,
    provider,
    payload,
    status,
    attempts,
    next_attempt_at,
    last_error
  ) values (
    new.store_id,
    target_integration_id,
    new.id,
    'google_sheets_oauth',
    jsonb_build_object(
      'sheetRow', target_sheet_row,
      'status', new.status,
      'notes', new.notes
    ),
    'pending',
    0,
    now(),
    null
  )
  on conflict (integration_id, order_id) do update set
    payload = excluded.payload,
    status = 'pending',
    attempts = 0,
    next_attempt_at = now(),
    last_error = null,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists orders_enqueue_google_sheet_writeback on public.orders;
create trigger orders_enqueue_google_sheet_writeback
  after update of status, notes on public.orders
  for each row execute function public.tflow_enqueue_google_sheet_writeback();

comment on table public.integration_write_queue is
  'Durable outbox for operational updates written from T-Flow back to external providers.';
