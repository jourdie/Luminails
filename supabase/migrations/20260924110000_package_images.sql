-- Store a customer-facing gallery at package level.
-- Admin may upload up to five JPG/PNG/WEBP images per package.
create table if not exists public.commerce_package_images (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.commerce_packages(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists commerce_package_images_lookup_idx
  on public.commerce_package_images (package_id, sort_order);

alter table public.commerce_package_images enable row level security;

revoke all on public.commerce_package_images from anon, authenticated;
grant select on public.commerce_package_images to anon, authenticated;
grant select, insert, update, delete on public.commerce_package_images to authenticated;

drop policy if exists "Published package images are public" on public.commerce_package_images;
create policy "Published package images are public"
  on public.commerce_package_images for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.commerce_packages package
      join public.catalog_brands brand on brand.id = package.brand_id
      where package.id = commerce_package_images.package_id
        and package.status = 'published'
        and brand.is_published = true
    )
  );

drop policy if exists "Package admins can manage package images" on public.commerce_package_images;
create policy "Package admins can manage package images"
  on public.commerce_package_images for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'package-images',
  'package-images',
  true,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = 6291456,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public package images are readable" on storage.objects;
create policy "Public package images are readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'package-images');

drop policy if exists "Package admins can upload package images" on storage.objects;
create policy "Package admins can upload package images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'package-images'
    and public.has_admin_permission('packages')
  );

drop policy if exists "Package admins can update package images" on storage.objects;
create policy "Package admins can update package images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'package-images'
    and public.has_admin_permission('packages')
  )
  with check (
    bucket_id = 'package-images'
    and public.has_admin_permission('packages')
  );

drop policy if exists "Package admins can delete package images" on storage.objects;
create policy "Package admins can delete package images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'package-images'
    and public.has_admin_permission('packages')
  );
