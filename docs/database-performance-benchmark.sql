-- Run this in Supabase SQL Editor before and after applying
-- 20261002130000_query_performance_indexes.sql.
-- Replace the sample SKU with one that exists in production.

-- 1) Public catalog listing: active SKUs + published parent + display order.
explain (analyze, buffers, format text)
select sku.id, sku.sku, sku.name, sku.sort_order
from public.catalog_skus sku
join public.catalog_products product on product.id = sku.product_id
where sku.is_active = true
  and product.is_published = true
order by sku.sort_order
limit 1000;

-- 2) Admin SKU page: exact count and first page.
explain (analyze, buffers, format text)
select sku.id, sku.sku, sku.name, sku.public_reference_price_idr, sku.stock_quantity
from public.catalog_skus sku
join public.catalog_products product on product.id = sku.product_id
where sku.is_active = true
order by sku.name, sku.id
limit 10;

-- 3) Admin SKU search. This is the query most helped by pg_trgm.
explain (analyze, buffers, format text)
select sku.id, sku.sku, sku.name, sku.category_label, sku.series, sku.color
from public.catalog_skus sku
where sku.sku ilike '%starter%'
   or sku.name ilike '%starter%'
   or sku.category_label ilike '%starter%'
   or sku.series ilike '%starter%'
   or sku.color ilike '%starter%'
order by sku.name, sku.id
limit 10;

-- 4) Package links loaded by SKU. The reverse indexes prevent a scan of all
-- package links when the storefront has many packages.
explain (analyze, buffers, format text)
select package_id, sku_id
from public.commerce_package_items
where sku_id in (
  select id from public.catalog_skus order by sort_order limit 10
);

explain (analyze, buffers, format text)
select package_id, sku_id
from public.commerce_package_allowed_skus
where sku_id in (
  select id from public.catalog_skus order by sort_order limit 10
);

-- 5) Public package listing and admin recent-record ordering.
explain (analyze, buffers, format text)
select id, slug, title, sort_order
from public.commerce_packages
where status = 'published'
order by sort_order, id
limit 200;

explain (analyze, buffers, format text)
select id, created_at
from public.admin_audit_logs
order by created_at desc, id
limit 500;

-- Optional: after the application has traffic, inspect observed averages.
-- pg_stat_statements may need to be enabled by the Supabase project.
select
  calls,
  round((total_exec_time / nullif(calls, 0))::numeric, 3) as avg_exec_ms,
  round((mean_exec_time)::numeric, 3) as mean_exec_ms,
  rows,
  left(query, 240) as query
from pg_stat_statements
where query ilike '%catalog_skus%'
   or query ilike '%commerce_packages%'
   or query ilike '%admin_audit_logs%'
order by total_exec_time desc
limit 30;
