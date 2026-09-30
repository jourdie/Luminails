-- Narrow E2E reset: brands, products/SKUs, packages, and their dependants.
-- This does not delete customers, orders, promotions, admin users, or settings.

begin;

delete from public.commerce_package_benefit_allowed_skus;
delete from public.commerce_package_tier_benefit_skus;
delete from public.commerce_package_tier_benefits;
delete from public.commerce_package_benefits;
delete from public.commerce_package_eligibility;
delete from public.commerce_package_allowed_skus;
delete from public.commerce_package_images;
delete from public.commerce_package_prices;
delete from public.commerce_package_items;
delete from public.inventory_movements
where sku_id in (select id from public.catalog_skus);
delete from public.inventory_stock
where sku_id in (select id from public.catalog_skus);
delete from public.loyalty_reward_catalog
where sku_id in (select id from public.catalog_skus);
delete from public.catalog_sku_prices;
delete from public.commerce_packages;
delete from public.catalog_skus;
delete from public.catalog_products;
delete from public.catalog_brands;
delete from public.commerce_package_types;
delete from public.catalog_categories;

do $$
declare
  remaining_rows bigint;
begin
  select sum(row_count)
  into remaining_rows
  from (
    select count(*) as row_count from public.catalog_brands
    union all select count(*) from public.catalog_products
    union all select count(*) from public.catalog_skus
    union all select count(*) from public.commerce_packages
    union all select count(*) from public.commerce_package_items
    union all select count(*) from public.commerce_package_prices
    union all select count(*) from public.commerce_package_types
    union all select count(*) from public.catalog_categories
    union all select count(*) from public.commerce_trusted_logos
  ) counts;

  if coalesce(remaining_rows, 0) <> 0 then
    raise exception 'Catalog/package reset verification failed: % rows remain', remaining_rows;
  end if;
end;
$$;

commit;
