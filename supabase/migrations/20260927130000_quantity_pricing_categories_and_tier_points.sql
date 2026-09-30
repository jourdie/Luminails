-- Catalog categories, quantity-based package pricing, and configurable customer-tier earning.

create table if not exists public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.catalog_categories (slug, name, sort_order)
values
  ('essentials', 'Essentials', 10),
  ('colors', 'Colors', 20),
  ('tools', 'Tools', 30),
  ('accessories', 'Accessories', 40)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order, updated_at = timezone('utc', now());

alter table public.catalog_products
  add column if not exists category_id uuid references public.catalog_categories(id) on delete restrict;

alter table public.catalog_skus
  add column if not exists category_id uuid references public.catalog_categories(id) on delete restrict;

create index if not exists catalog_products_category_idx on public.catalog_products (category_id, is_published, sort_order);
create index if not exists catalog_skus_category_idx on public.catalog_skus (category_id, is_active, sort_order);

alter table public.catalog_categories enable row level security;
revoke all on public.catalog_categories from anon, authenticated;
grant select on public.catalog_categories to anon, authenticated;
grant insert, update, delete on public.catalog_categories to authenticated;

drop policy if exists "active catalog categories are public" on public.catalog_categories;
create policy "active catalog categories are public"
  on public.catalog_categories for select to anon, authenticated
  using (is_active = true or public.has_admin_permission('catalog'));

drop policy if exists "catalog admins manage catalog categories" on public.catalog_categories;
create policy "catalog admins manage catalog categories"
  on public.catalog_categories for all to authenticated
  using (public.has_admin_permission('catalog'))
  with check (public.has_admin_permission('catalog'));

alter table public.commerce_packages
  add column if not exists pricing_model text not null default 'tier'
    check (pricing_model in ('tier', 'quantity_range')),
  add column if not exists selection_minimum integer,
  add column if not exists selection_maximum integer;

alter table public.commerce_packages drop constraint if exists commerce_packages_selection_capacity_check;
alter table public.commerce_packages add constraint commerce_packages_selection_capacity_check
  check (
    (selection_mode = 'fixed' and selection_capacity is null and selection_minimum is null and selection_maximum is null)
    or
    (selection_mode = 'free_pick' and selection_capacity > 0 and selection_minimum is null and selection_maximum is null)
    or
    (selection_mode = 'free_pick' and selection_capacity is null and selection_minimum > 0 and (selection_maximum is null or selection_maximum >= selection_minimum))
  );

create table if not exists public.commerce_package_quantity_prices (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.commerce_packages(id) on delete cascade,
  minimum_quantity integer not null check (minimum_quantity > 0),
  maximum_quantity integer check (maximum_quantity is null or maximum_quantity >= minimum_quantity),
  unit_price_idr bigint not null check (unit_price_idr >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (package_id, minimum_quantity)
);

create index if not exists commerce_package_quantity_prices_lookup_idx
  on public.commerce_package_quantity_prices (package_id, minimum_quantity, maximum_quantity)
  where is_active = true;

create or replace function public.validate_package_quantity_price_range()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_active and exists (
    select 1
    from public.commerce_package_quantity_prices existing
    where existing.package_id = new.package_id
      and existing.id <> new.id
      and existing.is_active
      and new.minimum_quantity <= coalesce(existing.maximum_quantity, 2147483647)
      and existing.minimum_quantity <= coalesce(new.maximum_quantity, 2147483647)
  ) then
    raise exception 'PACKAGE_QUANTITY_PRICE_RANGE_OVERLAP';
  end if;
  return new;
end;
$$;

drop trigger if exists package_quantity_price_range_validation on public.commerce_package_quantity_prices;
create trigger package_quantity_price_range_validation
before insert or update on public.commerce_package_quantity_prices
for each row execute function public.validate_package_quantity_price_range();

alter table public.commerce_package_quantity_prices enable row level security;
revoke all on public.commerce_package_quantity_prices from anon, authenticated;
grant select on public.commerce_package_quantity_prices to anon, authenticated;
grant insert, update, delete on public.commerce_package_quantity_prices to authenticated;

drop policy if exists "published package quantity prices are public" on public.commerce_package_quantity_prices;
create policy "published package quantity prices are public"
  on public.commerce_package_quantity_prices for select to anon, authenticated
  using (exists (
    select 1 from public.commerce_packages package
    join public.catalog_brands brand on brand.id = package.brand_id
    where package.id = commerce_package_quantity_prices.package_id
      and package.status = 'published'
      and brand.is_published = true
  ) or public.has_admin_permission('packages'));

drop policy if exists "package admins manage package quantity prices" on public.commerce_package_quantity_prices;
create policy "package admins manage package quantity prices"
  on public.commerce_package_quantity_prices for all to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));

alter table public.customer_tiers
  add column if not exists points_per_10000_idr numeric(10,2) not null default 1.00
    check (points_per_10000_idr >= 0);

-- The old seeded BASIC/VIP tiers are configuration defaults, not business data.
-- Existing customer assignments are cleared so the admin can start with tiers it creates.
update public.customer_profiles
set auto_customer_tier_id = null,
    customer_tier_id = null,
    manual_tier_id = null,
    manual_tier_override_enabled = false,
    updated_at = timezone('utc', now())
where to_regclass('public.customer_profiles') is not null;

update public.loyalty_accounts
set customer_tier_id = null,
    updated_at = timezone('utc', now())
where to_regclass('public.loyalty_accounts') is not null;

delete from public.customer_tiers;

comment on column public.customer_tiers.points_per_10000_idr is
  'Points earned per Rp10.000 eligible paid spend. Tier attainment thresholds remain separate.';
