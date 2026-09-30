-- Catalog admins can create the product parent automatically when creating a SKU.
drop policy if exists "Package admins can create sku parent products" on public.catalog_products;
create policy "Catalog admins can create sku parent products"
  on public.catalog_products for insert
  to authenticated
  with check (public.has_admin_permission('catalog') or public.has_admin_permission('packages'));
