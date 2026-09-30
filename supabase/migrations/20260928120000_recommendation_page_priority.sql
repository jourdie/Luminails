-- Curated recommendations can point to a package or a SKU.
-- SKU recommendations still resolve to a package in the storefront; direct SKU checkout remains blocked.
create table if not exists public.commerce_recommendations (
  id uuid primary key default gen_random_uuid(),
  placement text not null default 'package_detail',
  package_id uuid references public.commerce_packages(id) on delete cascade,
  sku_id uuid references public.catalog_skus(id) on delete cascade,
  priority integer not null default 100,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commerce_recommendations_target_check check ((package_id is not null) <> (sku_id is not null)),
  constraint commerce_recommendations_placement_check check (placement in ('package_detail', 'home', 'packages')),
  constraint commerce_recommendations_priority_check check (priority >= 0)
);

create unique index if not exists commerce_recommendations_package_unique
  on public.commerce_recommendations (placement, package_id)
  where package_id is not null;
create unique index if not exists commerce_recommendations_sku_unique
  on public.commerce_recommendations (placement, sku_id)
  where sku_id is not null;
create index if not exists commerce_recommendations_public_idx
  on public.commerce_recommendations (placement, is_active, priority, starts_at, ends_at);

alter table public.commerce_recommendations enable row level security;

revoke all on public.commerce_recommendations from anon, authenticated;
grant select on public.commerce_recommendations to anon, authenticated;
grant select, insert, update, delete on public.commerce_recommendations to authenticated;

drop policy if exists "published recommendation targets are public" on public.commerce_recommendations;
create policy "published recommendation targets are public"
  on public.commerce_recommendations for select
  to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= timezone('utc', now()))
    and (ends_at is null or ends_at > timezone('utc', now()))
    and (
      (package_id is not null and exists (
        select 1
        from public.commerce_packages package
        join public.catalog_brands brand on brand.id = package.brand_id
        where package.id = commerce_recommendations.package_id
          and package.status = 'published'
          and brand.is_published = true
      ))
      or (sku_id is not null and exists (
        select 1
        from public.catalog_skus sku
        join public.catalog_products product on product.id = sku.product_id
        where sku.id = commerce_recommendations.sku_id
          and sku.is_active = true
          and product.is_published = true
      ))
    )
  );

drop policy if exists "admins can manage recommendations" on public.commerce_recommendations;
create policy "admins can manage recommendations"
  on public.commerce_recommendations for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));