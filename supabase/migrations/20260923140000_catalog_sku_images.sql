-- Store customer-facing SKU photography in Supabase Storage.
alter table public.catalog_skus
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-images',
  'catalog-images',
  true,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = 6291456, 
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public catalog images are readable" on storage.objects;
create policy "Public catalog images are readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'catalog-images');

drop policy if exists "Admins can upload catalog images" on storage.objects;
create policy "Admins can upload catalog images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'catalog-images'
    and (public.has_admin_permission('catalog') or public.has_admin_permission('packages'))
  );

drop policy if exists "Admins can update catalog images" on storage.objects;
create policy "Admins can update catalog images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and (public.has_admin_permission('catalog') or public.has_admin_permission('packages'))
  )
  with check (
    bucket_id = 'catalog-images'
    and (public.has_admin_permission('catalog') or public.has_admin_permission('packages'))
  );

drop policy if exists "Admins can delete catalog images" on storage.objects;
create policy "Admins can delete catalog images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and (public.has_admin_permission('catalog') or public.has_admin_permission('packages'))
  );

drop policy if exists "Admins can manage sku listings" on public.catalog_skus;
create policy "Admins can manage sku listings"
  on public.catalog_skus for all
  to authenticated
  using (public.has_admin_permission('catalog') or public.has_admin_permission('packages'))
  with check (public.has_admin_permission('catalog') or public.has_admin_permission('packages'));
drop policy if exists "Package admins can create sku parent products" on public.catalog_products;
create policy "Package admins can create sku parent products"
  on public.catalog_products for insert
  to authenticated
  with check (public.has_admin_permission('packages'));