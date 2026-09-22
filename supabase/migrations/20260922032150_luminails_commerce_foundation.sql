create extension if not exists pgcrypto;

create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  operations_product_id text,
  slug text not null unique,
  brand text not null,
  name text not null,
  category text not null,
  short_description text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (operations_product_id)
);

comment on table public.catalog_products is 'Customer-safe storefront projection; SKU and operational stock remain in Luminails Operations.';

create table public.catalog_skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  operations_sku_id text,
  sku text not null unique,
  name text not null,
  category_label text not null,
  public_reference_price_idr integer check (public_reference_price_idr is null or public_reference_price_idr >= 0),
  shade_code text,
  tone text not null default 'tone-clear',
  badge text,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (operations_sku_id)
);

comment on table public.catalog_skus is 'Customer-safe SKU publication mapping; never add HPP, supplier cost, margin, or deposit fields here.';

create table public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  business_name text,
  business_type text,
  whatsapp text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.b2b_accounts (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_type text,
  tier_code text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.b2b_memberships (
  account_id uuid not null references public.b2b_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'buyer' check (role in ('owner', 'buyer')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (account_id, user_id)
);

create index catalog_products_public_idx on public.catalog_products (is_published, sort_order, category);
create index catalog_skus_product_active_idx on public.catalog_skus (product_id, is_active, sort_order);
create index b2b_memberships_user_idx on public.b2b_memberships (user_id, account_id);

alter table public.catalog_products enable row level security;
alter table public.catalog_skus enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.b2b_accounts enable row level security;
alter table public.b2b_memberships enable row level security;

create policy "published products are public"
  on public.catalog_products for select
  to anon, authenticated
  using (is_published = true);

create policy "active skus on published products are public"
  on public.catalog_skus for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.catalog_products product
      where product.id = catalog_skus.product_id
        and product.is_published = true
    )
  );

create policy "customers can read their own profile"
  on public.customer_profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "customers can update their own profile"
  on public.customer_profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "members can read their b2b accounts"
  on public.b2b_accounts for select
  to authenticated
  using (
    exists (
      select 1
      from public.b2b_memberships membership
      where membership.account_id = b2b_accounts.id
        and membership.user_id = (select auth.uid())
    )
  );

create policy "members can read their memberships"
  on public.b2b_memberships for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.catalog_products to anon, authenticated;
grant select on public.catalog_skus to anon, authenticated;
grant select, insert, update on public.customer_profiles to authenticated;
grant select on public.b2b_accounts to authenticated;
grant select on public.b2b_memberships to authenticated;
