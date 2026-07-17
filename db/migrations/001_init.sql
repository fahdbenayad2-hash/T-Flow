-- Femme Soir — Database Migration (safe to re-run)
-- Run this in Supabase SQL Editor

-- ==========================================
-- 1. Custom Types (safe)
-- ==========================================
do $$ begin
  create type app_role as enum ('admin', 'confirmation_agent', 'shipping_manager');
exception when duplicate_object then null;
end $$;

-- ==========================================
-- 2. Tables
-- ==========================================
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);

create table if not exists order_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  store text default 'main',
  agent_id uuid references auth.users,
  assigned_at timestamptz default now(),
  unique(order_id, store)
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  actor_id uuid references auth.users,
  action text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);

create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  note text,
  is_blacklisted boolean default false,
  updated_by uuid references auth.users,
  updated_at timestamptz default now()
);

create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  agent_id uuid references auth.users,
  outcome text check (outcome in ('answered', 'no_answer', 'postponed')),
  note text,
  follow_up_at timestamptz,
  created_at timestamptz default now()
);

-- ==========================================
-- 3. Security Helper Function
-- ==========================================
create or replace function public.has_role(check_user_id uuid, check_role app_role)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from user_roles
    where user_id = check_user_id and role = check_role
  );
$$;

-- ==========================================
-- 4. Profiles Auto-Creation Trigger
-- ==========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  if new.email = coalesce(
    current_setting('app.settings.default_admin_email', true),
    'fahdbenayad2@gmail.com'
  ) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ==========================================
-- 5. RLS — Enable on All Tables
-- ==========================================
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table order_assignments enable row level security;
alter table audit_log enable row level security;
alter table customer_notes enable row level security;
alter table call_logs enable row level security;

-- ==========================================
-- 6. RLS Policies (drop & recreate for safety)
-- ==========================================

-- profiles
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on profiles;
create policy "Admins can view all profiles"
  on profiles for select
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- user_roles
drop policy if exists "Users can view own roles" on user_roles;
create policy "Users can view own roles"
  on user_roles for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can manage all roles" on user_roles;
create policy "Admins can manage all roles"
  on user_roles for all
  using (public.has_role(auth.uid(), 'admin'));

-- order_assignments
drop policy if exists "Agents can view assigned orders" on order_assignments;
create policy "Agents can view assigned orders"
  on order_assignments for select
  using (
    auth.uid() = agent_id
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "Admins can manage assignments" on order_assignments;
create policy "Admins can manage assignments"
  on order_assignments for all
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Confirmation agents can view their assignments" on order_assignments;
create policy "Confirmation agents can view their assignments"
  on order_assignments for select
  using (public.has_role(auth.uid(), 'confirmation_agent'));

drop policy if exists "Shipping managers can view assignments" on order_assignments;
create policy "Shipping managers can view assignments"
  on order_assignments for select
  using (public.has_role(auth.uid(), 'shipping_manager'));

-- audit_log
drop policy if exists "Admins can view all audit logs" on audit_log;
create policy "Admins can view all audit logs"
  on audit_log for select
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Authenticated users can insert audit logs" on audit_log;
create policy "Authenticated users can insert audit logs"
  on audit_log for insert
  with check (auth.uid() is not null);

drop policy if exists "Confirmation agents can view audit logs" on audit_log;
create policy "Confirmation agents can view audit logs"
  on audit_log for select
  using (public.has_role(auth.uid(), 'confirmation_agent'));

-- customer_notes
drop policy if exists "Authenticated users can view customer notes" on customer_notes;
create policy "Authenticated users can view customer notes"
  on customer_notes for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated users can insert customer notes" on customer_notes;
create policy "Authenticated users can insert customer notes"
  on customer_notes for insert
  with check (auth.uid() is not null);

drop policy if exists "Authenticated users can update customer notes" on customer_notes;
create policy "Authenticated users can update customer notes"
  on customer_notes for update
  using (auth.uid() is not null);

drop policy if exists "Only admins can toggle blacklist" on customer_notes;
create policy "Only admins can toggle blacklist"
  on customer_notes for update
  using (public.has_role(auth.uid(), 'admin'));

-- call_logs
drop policy if exists "Agents can view own call logs" on call_logs;
create policy "Agents can view own call logs"
  on call_logs for select
  using (
    auth.uid() = agent_id
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "Agents can insert own call logs" on call_logs;
create policy "Agents can insert own call logs"
  on call_logs for insert
  with check (auth.uid() = agent_id);

drop policy if exists "Admins can manage all call logs" on call_logs;
create policy "Admins can manage all call logs"
  on call_logs for all
  using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- 7. Indexes for Performance
-- ==========================================
create index if not exists idx_audit_log_order_id on audit_log(order_id);
create index if not exists idx_audit_log_created_at on audit_log(created_at desc);
create index if not exists idx_call_logs_order_id on call_logs(order_id);
create index if not exists idx_call_logs_agent_id on call_logs(agent_id);
create index if not exists idx_call_logs_follow_up on call_logs(follow_up_at) where outcome = 'postponed';
create index if not exists idx_order_assignments_order_id on order_assignments(order_id);
create index if not exists idx_order_assignments_agent_id on order_assignments(agent_id);
create index if not exists idx_customer_notes_phone on customer_notes(phone);
create index if not exists idx_user_roles_user_id on user_roles(user_id);

-- ==========================================
-- Done!
-- ==========================================
