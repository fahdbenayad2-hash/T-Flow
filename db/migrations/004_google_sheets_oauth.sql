-- Google Sheets OAuth accounts and per-sheet integrations.
-- OAuth tokens are encrypted by the application before they reach this table.

create table if not exists public.google_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  connected_by uuid references auth.users(id) on delete set null,
  google_user_id text not null,
  email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, google_user_id)
);

create index if not exists idx_google_accounts_store
  on public.google_accounts(store_id, created_at desc);

alter table public.google_accounts enable row level security;

-- Tokens are server-only. Even admins receive account metadata through
-- role-checked server functions, never by selecting this table directly.
revoke all on table public.google_accounts from anon, authenticated;

drop trigger if exists google_accounts_touch_updated_at on public.google_accounts;
create trigger google_accounts_touch_updated_at
  before update on public.google_accounts
  for each row execute function public.tflow_touch_updated_at();

comment on table public.google_accounts is
  'Server-only Google OAuth accounts. Token columns contain AES-GCM encrypted values.';

comment on column public.store_integrations.config is
  'Non-secret provider settings only. OAuth tokens are encrypted in google_accounts.';
