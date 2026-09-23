alter table public.admin_memberships
  add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table public.admin_memberships
  drop constraint if exists admin_memberships_permissions_object_check;

alter table public.admin_memberships
  add constraint admin_memberships_permissions_object_check
  check (jsonb_typeof(permissions) = 'object');

update public.admin_memberships
set permissions = case role
  when 'catalog_manager' then jsonb_build_object('catalog', true, 'promotions', true)
  when 'orders_manager' then jsonb_build_object('orders', true, 'notifications', true)
  when 'support' then jsonb_build_object('orders', true, 'notifications', true)
  else jsonb_build_object('catalog', true, 'orders', true, 'notifications', true, 'pricing', true, 'promotions', true)
end
where permissions = '{}'::jsonb;

create or replace function public.is_admin_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.is_active = true
      and membership.role = 'owner'
  );
$$;

create or replace function public.has_admin_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.is_active = true
      and (
        membership.role = 'owner'
        or coalesce(membership.permissions, '{}'::jsonb) @> jsonb_build_object(required_permission, true)
      )
  );
$$;

create or replace function public.get_admin_memberships()
returns table (
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  role text,
  permissions jsonb,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin_owner() then
    raise exception 'Only an active owner can manage admin memberships';
  end if;

  return query
    select
      membership.user_id,
      auth_user.email,
      coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'name', split_part(coalesce(auth_user.email, ''), '@', 1)),
      auth_user.raw_user_meta_data ->> 'avatar_url',
      membership.role,
      membership.permissions,
      membership.is_active,
      membership.created_at
    from public.admin_memberships membership
    join auth.users auth_user on auth_user.id = membership.user_id
    order by membership.created_at;
end;
$$;

create or replace function public.upsert_admin_membership_by_email(
  p_email text,
  p_role text,
  p_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
  existing_role text;
  safe_permissions jsonb;
begin
  if not public.is_admin_owner() then
    raise exception 'Only an active owner can manage admin memberships';
  end if;

  if p_role not in ('catalog_manager', 'orders_manager', 'support') then
    raise exception 'New admins must use a non-owner role';
  end if;

  select auth_user.id
    into target_user_id
  from auth.users auth_user
  where lower(auth_user.email) = lower(trim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No Supabase Auth account exists for this email';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'The current owner cannot be replaced from this form';
  end if;

  select membership.role
    into existing_role
  from public.admin_memberships membership
  where membership.user_id = target_user_id;

  if existing_role = 'owner' then
    raise exception 'An owner cannot be edited from this form';
  end if;

  safe_permissions := jsonb_build_object(
    'catalog', p_permissions ->> 'catalog' = 'true',
    'orders', p_permissions ->> 'orders' = 'true',
    'notifications', p_permissions ->> 'notifications' = 'true',
    'pricing', p_permissions ->> 'pricing' = 'true',
    'promotions', p_permissions ->> 'promotions' = 'true'
  );

  insert into public.admin_memberships (user_id, role, permissions, is_active)
  values (target_user_id, p_role, safe_permissions, true)
  on conflict (user_id) do update set
    role = excluded.role,
    permissions = excluded.permissions,
    is_active = true;
end;
$$;

create or replace function public.set_admin_membership_status(
  p_user_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if not public.is_admin_owner() then
    raise exception 'Only an active owner can manage admin memberships';
  end if;

  if p_user_id = (select auth.uid()) and not p_is_active then
    raise exception 'The current owner cannot deactivate itself';
  end if;

  select role into target_role
  from public.admin_memberships
  where user_id = p_user_id;

  if target_role is null then
    raise exception 'Admin membership not found';
  end if;

  if target_role = 'owner' then
    raise exception 'An owner cannot be deactivated from this form';
  end if;

  update public.admin_memberships
  set is_active = p_is_active
  where user_id = p_user_id;
end;
$$;

drop policy if exists "admins can read pricing configuration" on public.pricing_tiers;
drop policy if exists "owners can manage pricing configuration" on public.pricing_tiers;
drop policy if exists "admins can manage product listings" on public.catalog_products;
drop policy if exists "admins can manage sku listings" on public.catalog_skus;
drop policy if exists "admins can manage sku prices" on public.catalog_sku_prices;
drop policy if exists "admins can read orders" on public.commerce_orders;
drop policy if exists "admins can read order items" on public.commerce_order_items;
drop policy if exists "admins can read notifications" on public.admin_notifications;
drop policy if exists "admins can mark notifications read" on public.admin_notifications;

create policy "admins can read pricing configuration"
  on public.pricing_tiers for select
  to authenticated
  using (public.has_admin_permission('pricing'));

create policy "admins can manage pricing configuration"
  on public.pricing_tiers for all
  to authenticated
  using (public.has_admin_permission('pricing'))
  with check (public.has_admin_permission('pricing'));

create policy "admins can manage product listings"
  on public.catalog_products for all
  to authenticated
  using (public.has_admin_permission('catalog'))
  with check (public.has_admin_permission('catalog'));

create policy "admins can manage sku listings"
  on public.catalog_skus for all
  to authenticated
  using (public.has_admin_permission('catalog'))
  with check (public.has_admin_permission('catalog'));

create policy "admins can manage sku prices"
  on public.catalog_sku_prices for all
  to authenticated
  using (public.has_admin_permission('catalog'))
  with check (public.has_admin_permission('catalog'));

create policy "admins can read orders"
  on public.commerce_orders for select
  to authenticated
  using (public.has_admin_permission('orders'));

create policy "admins can read order items"
  on public.commerce_order_items for select
  to authenticated
  using (public.has_admin_permission('orders'));

create policy "admins can read notifications"
  on public.admin_notifications for select
  to authenticated
  using (public.has_admin_permission('notifications'));

create policy "admins can mark notifications read"
  on public.admin_notifications for update
  to authenticated
  using (public.has_admin_permission('notifications'))
  with check (public.has_admin_permission('notifications'));

drop policy if exists "users can read their own admin membership" on public.admin_memberships;
create policy "users can read their own admin membership"
  on public.admin_memberships for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant execute on function public.is_admin_owner() to authenticated;
grant execute on function public.has_admin_permission(text) to authenticated;
grant execute on function public.get_admin_memberships() to authenticated;
grant execute on function public.upsert_admin_membership_by_email(text, text, jsonb) to authenticated;
grant execute on function public.set_admin_membership_status(uuid, boolean) to authenticated;

revoke execute on function public.is_admin_owner() from anon, public;
revoke execute on function public.has_admin_permission(text) from anon, public;
revoke execute on function public.get_admin_memberships() from anon, public;
revoke execute on function public.upsert_admin_membership_by_email(text, text, jsonb) from anon, public;
revoke execute on function public.set_admin_membership_status(uuid, boolean) from anon, public;
