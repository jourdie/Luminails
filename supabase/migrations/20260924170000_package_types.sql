-- Package types are admin-managed labels used by customer-facing package filters.
create table if not exists public.commerce_package_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.commerce_package_types (slug, name, description, sort_order)
values
  ('home-studio', 'Home studio', 'Paket untuk nail artist atau studio rumahan.', 10),
  ('salon', 'Salon', 'Paket untuk kebutuhan operasional salon.', 20),
  ('restock', 'Restock', 'Paket pengadaan ulang barang yang sering dipakai.', 30)
on conflict (slug) do nothing;

alter table public.commerce_packages
  add column if not exists package_type_id uuid references public.commerce_package_types(id) on delete restrict;

update public.commerce_packages package
set package_type_id = type.id
from public.commerce_package_types type
where package.package_type_id is null and type.slug = package.audience;

create index if not exists commerce_packages_type_idx
  on public.commerce_packages (package_type_id, status, sort_order);

alter table public.commerce_package_types enable row level security;
revoke all on public.commerce_package_types from anon, authenticated;
grant select on public.commerce_package_types to anon, authenticated;
grant insert, update, delete on public.commerce_package_types to authenticated;

create policy "active package types are public"
  on public.commerce_package_types for select
  to anon, authenticated
  using (is_active = true);

create policy "admins can manage package types"
  on public.commerce_package_types for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));