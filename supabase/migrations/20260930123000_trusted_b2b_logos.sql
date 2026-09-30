create table if not exists public.commerce_trusted_logos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists commerce_trusted_logos_public_idx
  on public.commerce_trusted_logos (is_active, sort_order, name);

alter table public.commerce_trusted_logos enable row level security;
revoke all on public.commerce_trusted_logos from anon, authenticated;
grant select on public.commerce_trusted_logos to anon, authenticated;
grant insert, update, delete on public.commerce_trusted_logos to authenticated;

drop policy if exists "active trusted logos are public" on public.commerce_trusted_logos;
create policy "active trusted logos are public"
  on public.commerce_trusted_logos for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "admins can manage trusted logos" on public.commerce_trusted_logos;
create policy "admins can manage trusted logos"
  on public.commerce_trusted_logos for all
  to authenticated
  using (public.has_admin_permission('settings'))
  with check (public.has_admin_permission('settings'));