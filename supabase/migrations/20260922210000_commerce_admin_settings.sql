-- Admin-managed store settings and audited inventory adjustments.

create table if not exists public.commerce_store_settings (
  key text primary key check (key in ('whatsapp')),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.commerce_store_settings (key, value, is_public)
values (
  'whatsapp',
  jsonb_build_object(
    'phone', '6289501086888',
    'message', 'Halo Luminails, saya mau konsultasi package dan order.'
  ),
  true
)
on conflict (key) do nothing;

alter table public.commerce_store_settings enable row level security;

revoke all on public.commerce_store_settings from anon, authenticated;
grant select on public.commerce_store_settings to anon, authenticated;
grant insert, update, delete on public.commerce_store_settings to authenticated;

create policy "public can read public store settings"
  on public.commerce_store_settings for select
  to anon, authenticated
  using (is_public and key = 'whatsapp');

create policy "settings admins can manage store settings"
  on public.commerce_store_settings for all
  to authenticated
  using (public.has_admin_permission('settings'))
  with check (public.has_admin_permission('settings'));

create or replace function public.adjust_inventory_stock(
  p_stock_id uuid,
  p_on_hand_quantity integer,
  p_reserved_quantity integer,
  p_reorder_point integer,
  p_reason text
)
returns setof public.inventory_stock
language plpgsql
set search_path = public
as $$
declare
  existing_stock public.inventory_stock%rowtype;
  delta integer;
begin
  if not public.has_admin_permission('inventory') then
    raise exception 'Inventory permission required';
  end if;
  if p_on_hand_quantity < 0 or p_reserved_quantity < 0 or p_reserved_quantity > p_on_hand_quantity or p_reorder_point < 0 then
    raise exception 'Invalid inventory quantities';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for inventory adjustments';
  end if;

  select * into existing_stock from public.inventory_stock where id = p_stock_id for update;
  if existing_stock.id is null then
    raise exception 'Inventory stock row not found';
  end if;

  delta := p_on_hand_quantity - existing_stock.on_hand_quantity;

  update public.inventory_stock
  set on_hand_quantity = p_on_hand_quantity,
      reserved_quantity = p_reserved_quantity,
      reorder_point = p_reorder_point,
      updated_at = timezone('utc', now())
  where id = p_stock_id;

  if delta <> 0 then
    insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, created_by)
    values (existing_stock.location_id, existing_stock.sku_id, 'adjustment', delta, trim(p_reason), (select auth.uid()));
  end if;

  return query select * from public.inventory_stock where id = p_stock_id;
end;
$$;

grant execute on function public.adjust_inventory_stock(uuid, integer, integer, integer, text) to authenticated;
revoke execute on function public.adjust_inventory_stock(uuid, integer, integer, integer, text) from anon, public;

update public.admin_memberships
set permissions = permissions || case role
  when 'owner' then jsonb_build_object('settings', true)
  else '{}'::jsonb
end;

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
  select auth_user.id into target_user_id
  from auth.users auth_user
  where lower(auth_user.email) = lower(trim(p_email))
  limit 1;
  if target_user_id is null then raise exception 'No Supabase Auth account exists for this email'; end if;
  if target_user_id = (select auth.uid()) then raise exception 'The current owner cannot be replaced from this form'; end if;
  select membership.role into existing_role from public.admin_memberships membership where membership.user_id = target_user_id;
  if existing_role = 'owner' then raise exception 'An owner cannot be edited from this form'; end if;

  safe_permissions := jsonb_build_object(
    'catalog', p_permissions ->> 'catalog' = 'true',
    'packages', p_permissions ->> 'packages' = 'true',
    'inventory', p_permissions ->> 'inventory' = 'true',
    'orders', p_permissions ->> 'orders' = 'true',
    'notifications', p_permissions ->> 'notifications' = 'true',
    'pricing', p_permissions ->> 'pricing' = 'true',
    'promotions', p_permissions ->> 'promotions' = 'true',
    'settings', p_permissions ->> 'settings' = 'true'
  );
  insert into public.admin_memberships (user_id, role, permissions, is_active)
  values (target_user_id, p_role, safe_permissions, true)
  on conflict (user_id) do update set role = excluded.role, permissions = excluded.permissions, is_active = true;
end;
$$;

grant execute on function public.upsert_admin_membership_by_email(text, text, jsonb) to authenticated;
revoke execute on function public.upsert_admin_membership_by_email(text, text, jsonb) from anon, public;
