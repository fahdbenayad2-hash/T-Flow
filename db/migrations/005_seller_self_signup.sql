-- T-Flow seller self-registration
-- Creates an isolated store and owner membership when a seller signs up.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  registration_type text;
  seller_store_name text;
  seller_store_slug text;
  seller_store_id uuid;
begin
  registration_type := coalesce(new.raw_user_meta_data ->> 'registration_type', '');

  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name);

  if registration_type = 'seller' then
    seller_store_name := coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'store_name'), ''),
      'متجري'
    );
    seller_store_slug := 'store-' || replace(new.id::text, '-', '');

    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;

    insert into public.stores (owner_id, name, slug)
    values (new.id, seller_store_name, seller_store_slug)
    on conflict (slug) do update
      set name = excluded.name
    returning id into seller_store_id;

    insert into public.store_members (store_id, user_id, role)
    values (seller_store_id, new.id, 'admin')
    on conflict (store_id, user_id, role) do update
      set is_active = true;
  elsif new.email = coalesce(
    current_setting('app.settings.default_admin_email', true),
    'fahdbenayad2@gmail.com'
  ) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Creates profiles for all users and an isolated admin-owned store for seller self-signups.';

-- Global "admin" is an application capability, not permission to inspect
-- another seller's account. Team management goes through store-scoped server
-- functions, so remove the legacy cross-tenant policies.
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can manage all roles" on public.user_roles;

drop policy if exists "Admins can view all audit logs" on public.audit_log;
drop policy if exists "Confirmation agents can view audit logs" on public.audit_log;
drop policy if exists "Authenticated users can insert audit logs" on public.audit_log;
drop policy if exists "Store members can view audit logs" on public.audit_log;
create policy "Store members can view audit logs"
  on public.audit_log for select
  using (store_id is not null and public.is_store_member(store_id));

drop policy if exists "Store members can insert audit logs" on public.audit_log;
create policy "Store members can insert audit logs"
  on public.audit_log for insert
  with check (
    actor_id = auth.uid()
    and store_id is not null
    and public.is_store_member(store_id)
  );

drop policy if exists "Agents can view own call logs" on public.call_logs;
drop policy if exists "Agents can insert own call logs" on public.call_logs;
drop policy if exists "Admins can manage all call logs" on public.call_logs;
drop policy if exists "Store members can view call logs" on public.call_logs;
create policy "Store members can view call logs"
  on public.call_logs for select
  using (
    store_id is not null
    and public.is_store_member(store_id)
    and (
      agent_id = auth.uid()
      or public.has_store_role(store_id, 'admin')
    )
  );

drop policy if exists "Store members can insert call logs" on public.call_logs;
create policy "Store members can insert call logs"
  on public.call_logs for insert
  with check (
    agent_id = auth.uid()
    and store_id is not null
    and public.is_store_member(store_id)
  );

drop policy if exists "Agents can view assigned orders" on public.order_assignments;
drop policy if exists "Admins can manage assignments" on public.order_assignments;
drop policy if exists "Confirmation agents can view their assignments" on public.order_assignments;
drop policy if exists "Shipping managers can view assignments" on public.order_assignments;
drop policy if exists "Store members can view assignments" on public.order_assignments;
create policy "Store members can view assignments"
  on public.order_assignments for select
  using (
    store_id is not null
    and public.is_store_member(store_id)
    and (
      agent_id = auth.uid()
      or public.has_store_role(store_id, 'admin')
      or public.has_store_role(store_id, 'shipping_manager')
    )
  );

drop policy if exists "Store admins can manage assignments" on public.order_assignments;
create policy "Store admins can manage assignments"
  on public.order_assignments for all
  using (store_id is not null and public.has_store_role(store_id, 'admin'))
  with check (store_id is not null and public.has_store_role(store_id, 'admin'));
