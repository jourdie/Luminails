-- Catalog listing metadata for the B2B product/SKU master.
-- Keep the legacy catalog columns for backwards compatibility while making
-- commerce behaviour explicit and filterable in the admin listing.
alter table public.catalog_skus
  add column if not exists image_url text,
  add column if not exists product_type text not null default 'OTHER',
  add column if not exists counts_toward_bottle_moq boolean not null default false,
  add column if not exists stock_status text not null default 'in_stock',
  add column if not exists stock_quantity integer not null default 0;

alter table public.catalog_skus
  drop constraint if exists catalog_skus_product_type_check,
  add constraint catalog_skus_product_type_check
    check (product_type in ('GEL_POLISH', 'PREP', 'TOOL', 'ACCESSORY', 'LAMP', 'OTHER')),
  drop constraint if exists catalog_skus_stock_status_check,
  add constraint catalog_skus_stock_status_check
    check (stock_status in ('in_stock', 'low_stock', 'out_of_stock', 'preorder')),
  drop constraint if exists catalog_skus_stock_quantity_check,
  add constraint catalog_skus_stock_quantity_check
    check (stock_quantity >= 0);

create index if not exists catalog_skus_listing_search_idx
  on public.catalog_skus (product_type, is_active, counts_toward_bottle_moq, sort_order);

create index if not exists catalog_skus_listing_sku_name_idx
  on public.catalog_skus (lower(sku), lower(name));

comment on column public.catalog_skus.product_type is 'Explicit commerce type used by catalog and checkout behaviour.';
comment on column public.catalog_skus.counts_toward_bottle_moq is 'Whether this SKU counts toward the B2B qualifying bottle minimum.';
comment on column public.catalog_skus.stock_quantity is 'Customer-safe stock snapshot for listing; operational inventory remains authoritative.';
