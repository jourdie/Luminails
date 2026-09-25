-- Add searchable catalog metadata to SKU records.
-- SKU remains a catalog reference only; package tables continue to control checkout.
alter table public.catalog_skus
  add column if not exists series text,
  add column if not exists color text;

create index if not exists catalog_skus_series_idx
  on public.catalog_skus (lower(series));

create index if not exists catalog_skus_color_idx
  on public.catalog_skus (lower(color));
