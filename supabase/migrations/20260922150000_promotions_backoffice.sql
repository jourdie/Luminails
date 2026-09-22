create table public.commerce_promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  promotion_type text not null check (promotion_type in ('new_user', 'repeat_order', 'bundle', 'seasonal', 'custom_voucher')),
  audience_type text not null default 'all' check (audience_type in ('all', 'new_user', 'repeat_customer', 'pricing_tier', 'custom_customer')),
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'fixed_amount', 'fixed_price', 'free_shipping')),
  discount_value numeric(12, 2) not null default 0 check (discount_value >= 0),
  bundle_price_idr bigint check (bundle_price_idr is null or bundle_price_idr >= 0),
  minimum_order_amount_idr bigint not null default 0 check (minimum_order_amount_idr >= 0),
  minimum_item_quantity integer not null default 0 check (minimum_item_quantity >= 0),
  repeat_order_min_count integer not null default 0 check (repeat_order_min_count >= 0),
  voucher_code text unique,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_limit_per_customer integer check (usage_limit_per_customer is null or usage_limit_per_customer > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'expired')),
  is_stackable boolean not null default false,
  is_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at is null or ends_at > starts_at),
  check (discount_type <> 'percentage' or discount_value <= 100),
  check (promotion_type <> 'bundle' or bundle_price_idr is not null)
);

comment on table public.commerce_promotions is 'Back-office promotion campaigns: new user, repeat order, bundle, seasonal, and custom customer voucher rules.';

create table public.promotion_skus (
  promotion_id uuid not null references public.commerce_promotions(id) on delete cascade,
  sku_id uuid not null references public.catalog_skus(id) on delete cascade,
  primary key (promotion_id, sku_id)
);

create table public.promotion_categories (
  promotion_id uuid not null references public.commerce_promotions(id) on delete cascade,
  category text not null,
  primary key (promotion_id, category)
);

create table public.promotion_pricing_tiers (
  promotion_id uuid not null references public.commerce_promotions(id) on delete cascade,
  pricing_tier_id uuid not null references public.pricing_tiers(id) on delete cascade,
  primary key (promotion_id, pricing_tier_id)
);

create table public.promotion_eligible_customers (
  promotion_id uuid not null references public.commerce_promotions(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (promotion_id, customer_id)
);

create table public.promotion_bundle_items (
  promotion_id uuid not null references public.commerce_promotions(id) on delete cascade,
  sku_id uuid not null references public.catalog_skus(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  primary key (promotion_id, sku_id)
);

create table public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.commerce_promotions(id) on delete restrict,
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  customer_id uuid references public.customer_profiles(id) on delete set null,
  discount_amount_idr bigint not null default 0 check (discount_amount_idr >= 0),
  redeemed_at timestamptz not null default timezone('utc', now()),
  unique (promotion_id, order_id)
);

create index commerce_promotions_active_idx on public.commerce_promotions (is_active, starts_at, ends_at, promotion_type);
create index promotion_eligible_customers_customer_idx on public.promotion_eligible_customers (customer_id, promotion_id);
create index promotion_redemptions_customer_idx on public.promotion_redemptions (customer_id, redeemed_at desc);

alter table public.commerce_promotions enable row level security;
alter table public.promotion_skus enable row level security;
alter table public.promotion_categories enable row level security;
alter table public.promotion_pricing_tiers enable row level security;
alter table public.promotion_eligible_customers enable row level security;
alter table public.promotion_bundle_items enable row level security;
alter table public.promotion_redemptions enable row level security;

create policy "admins can manage promotions"
  on public.commerce_promotions for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'catalog_manager')
    )
  )
  with check (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'catalog_manager')
    )
  );

create policy "customers can read public active promotions"
  on public.commerce_promotions for select
  to authenticated
  using (
    is_active = true
    and status in ('scheduled', 'active')
    and starts_at <= timezone('utc', now())
    and (ends_at is null or ends_at > timezone('utc', now()))
    and audience_type <> 'custom_customer'
  );

create policy "customers can read eligible custom promotions"
  on public.commerce_promotions for select
  to authenticated
  using (
    is_active = true
    and status in ('scheduled', 'active')
    and starts_at <= timezone('utc', now())
    and (ends_at is null or ends_at > timezone('utc', now()))
    and exists (
      select 1 from public.promotion_eligible_customers eligible
      where eligible.promotion_id = commerce_promotions.id
        and eligible.customer_id = (select auth.uid())
    )
  );

create policy "admins can manage promotion sku targets"
  on public.promotion_skus for all to authenticated
  using (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')))
  with check (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')));

create policy "admins can manage promotion category targets"
  on public.promotion_categories for all to authenticated
  using (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')))
  with check (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')));

create policy "admins can manage promotion tier targets"
  on public.promotion_pricing_tiers for all to authenticated
  using (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')))
  with check (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')));

create policy "admins can manage eligible promotion customers"
  on public.promotion_eligible_customers for all to authenticated
  using (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')))
  with check (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')));

create policy "eligible customers can read their promotion access"
  on public.promotion_eligible_customers for select to authenticated
  using ((select auth.uid()) = customer_id);

create policy "admins can manage bundle items"
  on public.promotion_bundle_items for all to authenticated
  using (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')))
  with check (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager')));

create policy "admins can read promotion redemptions"
  on public.promotion_redemptions for select to authenticated
  using (exists (select 1 from public.admin_memberships membership where membership.user_id = (select auth.uid()) and membership.is_active = true and membership.role in ('owner', 'catalog_manager', 'orders_manager', 'support')));

grant select, insert, update, delete on public.commerce_promotions to authenticated;
grant select, insert, update, delete on public.promotion_skus to authenticated;
grant select, insert, update, delete on public.promotion_categories to authenticated;
grant select, insert, update, delete on public.promotion_pricing_tiers to authenticated;
grant select, insert, update, delete on public.promotion_eligible_customers to authenticated;
grant select, insert, update, delete on public.promotion_bundle_items to authenticated;
grant select on public.promotion_redemptions to authenticated;
