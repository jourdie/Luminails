-- Query-performance indexes for the public storefront and admin workspaces.
-- These indexes target the actual WHERE/JOIN/ORDER BY patterns used by the app.

create extension if not exists pg_trgm with schema extensions;

-- Public catalog: filter active SKUs, join published parents, then sort once.
create index if not exists catalog_products_published_sort_idx
  on public.catalog_products (sort_order, id)
  where is_published = true;

create index if not exists catalog_products_brand_idx
  on public.catalog_products (brand, id);

create index if not exists catalog_skus_public_active_sort_idx
  on public.catalog_skus (sort_order, id)
  where is_active = true;

-- Admin SKU listing: server-side filtering and sorting now return only one page.
create index if not exists catalog_skus_admin_name_idx
  on public.catalog_skus (name, id);

create index if not exists catalog_skus_admin_sku_idx
  on public.catalog_skus (sku, id);

create index if not exists catalog_skus_admin_price_idx
  on public.catalog_skus (public_reference_price_idr, id);

create index if not exists catalog_skus_admin_stock_idx
  on public.catalog_skus (stock_quantity desc, id);

-- ilike '%term%' cannot use a normal btree index. Trigram indexes keep admin
-- search from falling back to a full table scan as the SKU table grows.
create index if not exists catalog_skus_sku_trgm_idx
  on public.catalog_skus using gin (sku extensions.gin_trgm_ops);

create index if not exists catalog_skus_name_trgm_idx
  on public.catalog_skus using gin (name extensions.gin_trgm_ops);

create index if not exists catalog_skus_category_label_trgm_idx
  on public.catalog_skus using gin (category_label extensions.gin_trgm_ops);

create index if not exists catalog_skus_series_trgm_idx
  on public.catalog_skus using gin (series extensions.gin_trgm_ops);

create index if not exists catalog_skus_color_trgm_idx
  on public.catalog_skus using gin (color extensions.gin_trgm_ops);

-- The storefront looks up package links by SKU. Existing indexes were package
-- first, so these reverse indexes avoid scanning link tables for each catalog.
create index if not exists commerce_package_items_sku_idx
  on public.commerce_package_items (sku_id, package_id);

create index if not exists commerce_package_allowed_skus_sku_idx
  on public.commerce_package_allowed_skus (sku_id, package_id);

create index if not exists commerce_order_items_sku_idx
  on public.commerce_order_items (sku_id, order_id);

-- Public package pages and recommendations read published rows in display order.
create index if not exists commerce_packages_published_sort_idx
  on public.commerce_packages (sort_order, id)
  where status = 'published';

-- Admin tabs that order recent records should not sort large tables in memory.
create index if not exists inventory_stock_updated_idx
  on public.inventory_stock (updated_at desc, id);

create index if not exists customer_profiles_created_idx
  on public.customer_profiles (created_at desc, id);

create index if not exists loyalty_reward_catalog_created_idx
  on public.loyalty_reward_catalog (created_at desc, id);

create index if not exists loyalty_ledger_created_idx
  on public.loyalty_ledger (created_at desc, id);

create index if not exists loyalty_redemptions_created_idx
  on public.loyalty_redemptions (created_at desc, id);

create index if not exists loyalty_point_lots_expiry_idx
  on public.loyalty_point_lots (expires_at, customer_id)
  where remaining_points > 0;

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc, id);
