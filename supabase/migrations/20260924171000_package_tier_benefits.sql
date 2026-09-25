-- Tier-specific package benefits. A benefit can expose a curated SKU whitelist
-- that the customer may choose as free items at checkout.
create table if not exists public.commerce_package_tier_benefits (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.commerce_packages(id) on delete cascade,
  pricing_tier_id uuid not null references public.pricing_tiers(id) on delete cascade,
  benefit_type text not null default 'free_items' check (benefit_type = 'free_items'),
  quantity integer not null check (quantity > 0),
  label text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (package_id, pricing_tier_id)
);

create table if not exists public.commerce_package_tier_benefit_skus (
  benefit_id uuid not null references public.commerce_package_tier_benefits(id) on delete cascade,
  sku_id uuid not null references public.catalog_skus(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (benefit_id, sku_id)
);

create index if not exists package_tier_benefits_package_idx
  on public.commerce_package_tier_benefits (package_id, pricing_tier_id);
create index if not exists package_tier_benefit_skus_sku_idx
  on public.commerce_package_tier_benefit_skus (sku_id, benefit_id);

alter table public.commerce_package_tier_benefits enable row level security;
alter table public.commerce_package_tier_benefit_skus enable row level security;
revoke all on public.commerce_package_tier_benefits, public.commerce_package_tier_benefit_skus from anon, authenticated;
grant select on public.commerce_package_tier_benefits, public.commerce_package_tier_benefit_skus to authenticated;
grant insert, update, delete on public.commerce_package_tier_benefits, public.commerce_package_tier_benefit_skus to authenticated;

create policy "customers can read active tier benefits for published packages"
  on public.commerce_package_tier_benefits for select
  to authenticated
  using (
    exists (
      select 1 from public.customer_profiles profile
      join public.commerce_packages package on package.id = commerce_package_tier_benefits.package_id
      join public.catalog_brands brand on brand.id = package.brand_id
      where profile.id = (select auth.uid())
        and profile.pricing_tier_id = commerce_package_tier_benefits.pricing_tier_id
        and package.status = 'published'
        and brand.is_published = true
    )
    or public.has_admin_permission('packages')
  );

create policy "customers can read allowed benefit SKUs"
  on public.commerce_package_tier_benefit_skus for select
  to authenticated
  using (
    exists (
      select 1
      from public.commerce_package_tier_benefits benefit
      join public.commerce_packages package on package.id = benefit.package_id
      join public.catalog_brands brand on brand.id = package.brand_id
      join public.customer_profiles profile on profile.pricing_tier_id = benefit.pricing_tier_id
      where benefit.id = commerce_package_tier_benefit_skus.benefit_id
        and profile.id = (select auth.uid())
        and package.status = 'published'
        and brand.is_published = true
    )
    or public.has_admin_permission('packages')
  );

create policy "admins can manage package tier benefits"
  on public.commerce_package_tier_benefits for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));

create policy "admins can manage package tier benefit SKUs"
  on public.commerce_package_tier_benefit_skus for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));