-- Commerce package and inventory foundation.
-- Public data is deliberately separated from operational stock and admin-only controls.

create table if not exists public.catalog_brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug)),
  name text not null,
  tagline text,
  description text,
  visual_tone text not null default 'clay' check (visual_tone in ('clay', 'ivory', 'plum', 'champagne')),
  is_published boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commerce_packages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.catalog_brands(id) on delete restrict,
  slug text not null unique check (slug = lower(slug)),
  title text not null,
  audience text not null check (audience in ('home-studio', 'salon', 'restock')),
  description text not null,
  long_description text,
  price_idr bigint not null check (price_idr >= 0),
  compare_at_price_idr bigint check (compare_at_price_idr is null or compare_at_price_idr >= price_idr),
  badge text,
  visual_tone text not null default 'clay' check (visual_tone in ('clay', 'ivory', 'plum')),
  delivery_note text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commerce_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.commerce_packages(id) on delete cascade,
  sku_id uuid not null references public.catalog_skus(id) on delete restrict,
  item_name_snapshot text not null,
  item_note text,
  quantity integer not null check (quantity > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (package_id, sku_id)
);

create table if not exists public.commerce_package_prices (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.commerce_packages(id) on delete cascade,
  pricing_tier_id uuid not null references public.pricing_tiers(id) on delete cascade,
  unit_price_idr bigint not null check (unit_price_idr >= 0),
  effective_from timestamptz not null default timezone('utc', now()),
  effective_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  check (effective_until is null or effective_until > effective_from),
  unique (package_id, pricing_tier_id, effective_from)
);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_stock (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.inventory_locations(id) on delete cascade,
  sku_id uuid not null references public.catalog_skus(id) on delete restrict,
  on_hand_quantity integer not null default 0 check (on_hand_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= on_hand_quantity),
  reorder_point integer not null default 0 check (reorder_point >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (location_id, sku_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  sku_id uuid not null references public.catalog_skus(id) on delete restrict,
  movement_type text not null check (movement_type in ('receiving', 'adjustment', 'reservation', 'release', 'fulfillment', 'return')),
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text,
  order_id uuid references public.commerce_orders(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists catalog_brands_public_idx on public.catalog_brands (is_published, sort_order);
create index if not exists commerce_packages_public_idx on public.commerce_packages (status, brand_id, sort_order);
create index if not exists commerce_package_items_package_idx on public.commerce_package_items (package_id, sort_order);
create index if not exists commerce_package_prices_lookup_idx on public.commerce_package_prices (package_id, pricing_tier_id, is_active, effective_from desc);
create index if not exists inventory_stock_sku_idx on public.inventory_stock (sku_id, location_id);
create index if not exists inventory_movements_sku_idx on public.inventory_movements (sku_id, location_id, created_at desc);

alter table public.catalog_brands enable row level security;
alter table public.commerce_packages enable row level security;
alter table public.commerce_package_items enable row level security;
alter table public.commerce_package_prices enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on public.catalog_brands, public.commerce_packages, public.commerce_package_items, public.commerce_package_prices, public.inventory_locations, public.inventory_stock, public.inventory_movements from anon, authenticated;

grant select on public.catalog_brands, public.commerce_packages, public.commerce_package_items to anon, authenticated;
grant select on public.commerce_package_prices to authenticated;
grant select, insert, update, delete on public.catalog_brands, public.commerce_packages, public.commerce_package_items, public.commerce_package_prices to authenticated;
grant select, insert, update, delete on public.inventory_locations, public.inventory_stock, public.inventory_movements to authenticated;

create policy "published brands are public"
  on public.catalog_brands for select
  to anon, authenticated
  using (is_published = true);

create policy "published packages are public"
  on public.commerce_packages for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.catalog_brands brand
      where brand.id = commerce_packages.brand_id and brand.is_published = true
    )
  );

create policy "items of published packages are public"
  on public.commerce_package_items for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.commerce_packages package
      join public.catalog_brands brand on brand.id = package.brand_id
      join public.catalog_skus sku on sku.id = commerce_package_items.sku_id
      join public.catalog_products product on product.id = sku.product_id
      where package.id = commerce_package_items.package_id
        and package.status = 'published'
        and brand.is_published = true
        and sku.is_active = true
        and product.is_published = true
    )
  );

create policy "admins can manage brands"
  on public.catalog_brands for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));

create policy "admins can manage packages"
  on public.commerce_packages for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));

create policy "admins can manage package items"
  on public.commerce_package_items for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));

create policy "customers can read package prices for their tier"
  on public.commerce_package_prices for select
  to authenticated
  using (
    is_active = true
    and effective_from <= timezone('utc', now())
    and (effective_until is null or effective_until > timezone('utc', now()))
    and (
      public.has_admin_permission('packages')
      or exists (
        select 1 from public.customer_profiles profile
        where profile.id = (select auth.uid())
          and profile.pricing_tier_id = commerce_package_prices.pricing_tier_id
      )
    )
  );

create policy "admins can manage package prices"
  on public.commerce_package_prices for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));

create policy "admins can manage inventory locations"
  on public.inventory_locations for all
  to authenticated
  using (public.has_admin_permission('inventory'))
  with check (public.has_admin_permission('inventory'));

create policy "admins can manage inventory stock"
  on public.inventory_stock for all
  to authenticated
  using (public.has_admin_permission('inventory'))
  with check (public.has_admin_permission('inventory'));

create policy "admins can read inventory movements"
  on public.inventory_movements for select
  to authenticated
  using (public.has_admin_permission('inventory'));

create policy "admins can create inventory movements"
  on public.inventory_movements for insert
  to authenticated
  with check (public.has_admin_permission('inventory') and created_by = (select auth.uid()));

-- Extend existing admin presets while preserving any custom permissions already selected.
update public.admin_memberships
set permissions = permissions || case role
  when 'catalog_manager' then jsonb_build_object('packages', true)
  when 'orders_manager' then jsonb_build_object('inventory', true)
  when 'support' then '{}'::jsonb
  else jsonb_build_object('packages', true, 'inventory', true)
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

  select membership.role into existing_role
  from public.admin_memberships membership
  where membership.user_id = target_user_id;

  if existing_role = 'owner' then raise exception 'An owner cannot be edited from this form'; end if;

  safe_permissions := jsonb_build_object(
    'catalog', p_permissions ->> 'catalog' = 'true',
    'packages', p_permissions ->> 'packages' = 'true',
    'inventory', p_permissions ->> 'inventory' = 'true',
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

grant execute on function public.upsert_admin_membership_by_email(text, text, jsonb) to authenticated;
revoke execute on function public.upsert_admin_membership_by_email(text, text, jsonb) from anon, public;

-- Keep the existing owner-only admin lookup compatible with its declared text return type.
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
      auth_user.email::text,
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

grant execute on function public.get_admin_memberships() to authenticated;
revoke execute on function public.get_admin_memberships() from anon, public;
