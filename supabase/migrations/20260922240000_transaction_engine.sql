-- Transaction engine: multi-address checkout, promotion eligibility, stock reservations,
-- payment/shipping adapters, order history, and non-cash Luminails Points.

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  province text,
  postal_code text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists customer_addresses_customer_idx on public.customer_addresses (customer_id, is_default desc, created_at desc);
alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from anon, authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;

create policy "customers manage their own addresses"
  on public.customer_addresses for all to authenticated
  using ((select auth.uid()) = customer_id)
  with check ((select auth.uid()) = customer_id);

alter table public.commerce_orders
  add column if not exists address_id uuid references public.customer_addresses(id) on delete set null,
  add column if not exists address_snapshot jsonb,
  add column if not exists pricing_tier_id uuid references public.pricing_tiers(id) on delete set null,
  add column if not exists subtotal_idr bigint not null default 0 check (subtotal_idr >= 0),
  add column if not exists discount_idr bigint not null default 0 check (discount_idr >= 0),
  add column if not exists shipping_fee_idr bigint not null default 0 check (shipping_fee_idr >= 0),
  add column if not exists promotion_id uuid references public.commerce_promotions(id) on delete set null,
  add column if not exists promotion_code text,
  add column if not exists shipping_method text not null default 'paxel_factory',
  add column if not exists shipping_provider text,
  add column if not exists payment_provider text,
  add column if not exists payment_reference text,
  add column if not exists customer_notes text,
  add column if not exists idempotency_key text;

create unique index if not exists commerce_orders_customer_idempotency_idx
  on public.commerce_orders (customer_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists commerce_orders_tracking_idx on public.commerce_orders (fulfillment_status, updated_at desc);

alter table public.commerce_order_items
  add column if not exists item_type text not null default 'component',
  add column if not exists package_id uuid references public.commerce_packages(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.commerce_order_items add constraint commerce_order_items_type_check
    check (item_type in ('package', 'component', 'loyalty_reward'));
exception when duplicate_object then null;
end $$;

create table if not exists public.commerce_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'payment', 'fulfillment', 'tracking', 'note', 'cancelled')),
  status text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists commerce_order_events_order_idx on public.commerce_order_events (order_id, created_at desc);
alter table public.commerce_order_events enable row level security;
revoke all on public.commerce_order_events from anon, authenticated;
grant select on public.commerce_order_events to authenticated;
create policy "admins can update orders"
  on public.commerce_orders for update to authenticated
  using (public.has_admin_permission('orders'))
  with check (public.has_admin_permission('orders'));
grant update on public.commerce_orders to authenticated;

create policy "customers read their order events"
  on public.commerce_order_events for select to authenticated
  using (exists (select 1 from public.commerce_orders order_row where order_row.id = commerce_order_events.order_id and order_row.customer_id = (select auth.uid())));
create policy "admins read order events"
  on public.commerce_order_events for select to authenticated
  using (public.has_admin_permission('orders'));

create table if not exists public.commerce_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.commerce_orders(id) on delete cascade,
  shipping_type text not null default 'free_factory' check (shipping_type in ('free_factory', 'third_party', 'pickup', 'manual')),
  provider_code text,
  service_level text,
  tracking_number text,
  tracking_url text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled')),
  estimated_delivery_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.commerce_shipments enable row level security;
revoke all on public.commerce_shipments from anon, authenticated;
grant select on public.commerce_shipments to authenticated;
create policy "customers read their shipment"
  on public.commerce_shipments for select to authenticated
  using (exists (select 1 from public.commerce_orders order_row where order_row.id = commerce_shipments.order_id and order_row.customer_id = (select auth.uid())));
create policy "admins manage shipments"
  on public.commerce_shipments for all to authenticated
  using (public.has_admin_permission('orders'))
  with check (public.has_admin_permission('orders'));

create table if not exists public.commerce_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete cascade,
  provider text not null check (provider in ('manual', 'midtrans', 'xendit')),
  external_id text,
  status text not null default 'pending' check (status in ('pending', 'authorized', 'paid', 'failed', 'expired', 'refunded')),
  amount_idr bigint not null check (amount_idr >= 0),
  raw_response jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider, external_id)
);
alter table public.commerce_payment_transactions enable row level security;
revoke all on public.commerce_payment_transactions from anon, authenticated;
grant select on public.commerce_payment_transactions to authenticated;
create policy "customers read their payment transactions"
  on public.commerce_payment_transactions for select to authenticated
  using (exists (select 1 from public.commerce_orders order_row where order_row.id = commerce_payment_transactions.order_id and order_row.customer_id = (select auth.uid())));
create policy "admins manage payment transactions"
  on public.commerce_payment_transactions for all to authenticated
  using (public.has_admin_permission('orders'))
  with check (public.has_admin_permission('orders'));

-- Replace the former monetary-sounding loyalty names with explicit points names.
alter table public.loyalty_accounts rename column available_credit_idr to available_points;
alter table public.loyalty_accounts rename column lifetime_earned_idr to lifetime_earned_points;
alter table public.loyalty_accounts rename column lifetime_redeemed_idr to lifetime_redeemed_points;
alter table public.loyalty_redemptions rename column credit_value_idr to points_redeemed;
alter table public.loyalty_redemptions rename column product_value_idr to reward_points_cost;
alter table public.loyalty_ledger rename column credit_amount_idr to points_delta;
alter table public.loyalty_ledger rename column credit_type to points_type;

create table public.loyalty_reward_catalog (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null unique references public.catalog_skus(id) on delete restrict,
  points_cost bigint not null check (points_cost > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.loyalty_reward_catalog enable row level security;
revoke all on public.loyalty_reward_catalog from anon, authenticated;
grant select on public.loyalty_reward_catalog to authenticated;
create policy "customers read active loyalty rewards"
  on public.loyalty_reward_catalog for select to authenticated
  using (is_active = true);
create policy "pricing admins manage loyalty rewards"
  on public.loyalty_reward_catalog for all to authenticated
  using (public.has_admin_permission('pricing'))
  with check (public.has_admin_permission('pricing'));
grant insert, update, delete on public.loyalty_reward_catalog to authenticated;

comment on column public.loyalty_accounts.available_points is 'Non-cash Luminails Points. Never a wallet balance and never redeemable for cash.';
comment on column public.loyalty_redemptions.points_redeemed is 'Points spent to claim one configured free product.';
comment on column public.loyalty_ledger.points_delta is 'Signed non-cash points movement.';

create or replace function private.sync_customer_loyalty(p_customer_id uuid, p_order_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_tier_code text := 'STANDARD';
  standard_rate integer;
  premium_rate integer;
  order_total bigint;
  lifetime_total bigint;
  paid_count integer;
  next_tier_id uuid;
  next_tier_code text;
  next_rate_bps integer;
  earned_points bigint;
  balance bigint;
  earned_total bigint;
  redeemed_total bigint;
begin
  select standard_rate_bps, premium_rate_bps into standard_rate, premium_rate
  from public.loyalty_program_settings where key = 'default' and is_active = true limit 1;
  standard_rate := coalesce(standard_rate, 200);
  premium_rate := coalesce(premium_rate, 500);

  select coalesce(tier.code, 'STANDARD') into current_tier_code
  from public.customer_profiles profile
  left join public.pricing_tiers tier on tier.id = profile.pricing_tier_id
  where profile.id = p_customer_id;

  if p_order_id is not null then
    select total_idr into order_total from public.commerce_orders
    where id = p_order_id and customer_id = p_customer_id and payment_status = 'paid';
    if order_total is not null and not exists (
      select 1 from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn'
    ) then
      earned_points := floor(order_total * (case when current_tier_code = 'B2B_PREMIUM' then premium_rate else standard_rate end) / 10000.0)::bigint;
      if earned_points > 0 then
        insert into public.loyalty_ledger (customer_id, order_id, entry_type, points_delta, points_type, description)
        values (p_customer_id, p_order_id, 'earn', earned_points, 'free_product', current_tier_code || ' points earned from paid order');
      end if;
    end if;
  end if;

  select coalesce(sum(total_idr), 0), count(*)::integer into lifetime_total, paid_count
  from public.commerce_orders where customer_id = p_customer_id and payment_status = 'paid';
  select tier.id, tier.code into next_tier_id, next_tier_code
  from public.pricing_tiers tier
  where tier.is_active = true and tier.minimum_lifetime_spend_idr <= lifetime_total and tier.minimum_paid_order_count <= paid_count
  order by tier.minimum_lifetime_spend_idr desc, tier.minimum_paid_order_count desc, tier.sort_order desc limit 1;
  next_tier_code := coalesce(next_tier_code, 'STANDARD');
  next_rate_bps := case when next_tier_code = 'B2B_PREMIUM' then premium_rate else standard_rate end;
  update public.customer_profiles set pricing_tier_id = next_tier_id, lifetime_paid_amount_idr = lifetime_total, paid_order_count = paid_count, updated_at = timezone('utc', now()) where id = p_customer_id;
  select coalesce(sum(points_delta) filter (where points_delta > 0), 0), coalesce(sum(-points_delta) filter (where points_delta < 0), 0), greatest(coalesce(sum(points_delta), 0), 0)
  into earned_total, redeemed_total, balance from public.loyalty_ledger where customer_id = p_customer_id;
  insert into public.loyalty_accounts (customer_id, pricing_tier_id, tier_code, cashback_rate_bps, available_points, lifetime_earned_points, lifetime_redeemed_points)
  values (p_customer_id, next_tier_id, next_tier_code, next_rate_bps, balance, earned_total, redeemed_total)
  on conflict (customer_id) do update set pricing_tier_id = excluded.pricing_tier_id, tier_code = excluded.tier_code, cashback_rate_bps = excluded.cashback_rate_bps, available_points = excluded.available_points, lifetime_earned_points = excluded.lifetime_earned_points, lifetime_redeemed_points = excluded.lifetime_redeemed_points, updated_at = timezone('utc', now());
end;
$$;
revoke all on function private.sync_customer_loyalty(uuid, uuid) from public, anon, authenticated;

create or replace function public.create_checkout_order(
  p_package_slug text,
  p_quantity integer,
  p_address_id uuid,
  p_customer_notes text default null,
  p_promotion_code text default null,
  p_shipping_method text default 'paxel_factory',
  p_shipping_provider text default 'paxel',
  p_reward_sku_id uuid default null,
  p_reward_points bigint default 0,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  profile_row public.customer_profiles%rowtype;
  tier_row public.pricing_tiers%rowtype;
  package_row public.commerce_packages%rowtype;
  brand_published boolean;
  address_row public.customer_addresses%rowtype;
  promo_row public.commerce_promotions%rowtype;
  reward_row public.loyalty_reward_catalog%rowtype;
  account_row public.loyalty_accounts%rowtype;
  stock_location_id uuid;
  redemption_id uuid;
  order_id uuid;
  unit_price bigint;
  subtotal bigint;
  discount bigint := 0;
  shipping_fee bigint := 0;
  total bigint;
  paid_count integer;
  package_item record;
  stock_row public.inventory_stock%rowtype;
  required_qty integer;
  effective_code text;
  existing_order_id uuid;
begin
  if actor_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'INVALID_QUANTITY'; end if;
  if p_shipping_method not in ('paxel_factory', 'third_party', 'pickup', 'manual') then raise exception 'INVALID_SHIPPING_METHOD'; end if;

  if p_idempotency_key is not null then
    select id into existing_order_id from public.commerce_orders where customer_id = actor_id and idempotency_key = p_idempotency_key;
    if existing_order_id is not null then return jsonb_build_object('order_id', existing_order_id, 'duplicate', true); end if;
  end if;

  select * into profile_row from public.customer_profiles where id = actor_id;
  if profile_row.id is null then raise exception 'PROFILE_REQUIRED'; end if;
  select * into address_row from public.customer_addresses where id = p_address_id and customer_id = actor_id;
  if address_row.id is null then raise exception 'ADDRESS_REQUIRED'; end if;
  select * into package_row from public.commerce_packages where slug = lower(trim(p_package_slug)) and status = 'published';
  if package_row.id is null then raise exception 'PACKAGE_NOT_FOUND'; end if;
  select is_published into brand_published from public.catalog_brands where id = package_row.brand_id;
  if not coalesce(brand_published, false) then raise exception 'PACKAGE_NOT_FOUND'; end if;

  select tier.* into tier_row from public.pricing_tiers tier where tier.id = profile_row.pricing_tier_id and tier.is_active = true;
  if tier_row.id is null then select * into tier_row from public.pricing_tiers where code = 'STANDARD' and is_active = true limit 1; end if;
  select coalesce((select package_price.unit_price_idr from public.commerce_package_prices package_price where package_price.package_id = package_row.id and package_price.pricing_tier_id = tier_row.id and package_price.is_active = true and package_price.effective_from <= timezone('utc', now()) and (package_price.effective_until is null or package_price.effective_until > timezone('utc', now())) order by package_price.effective_from desc limit 1), package_row.price_idr) into unit_price;
  subtotal := unit_price * p_quantity;

  select count(*)::integer into paid_count from public.commerce_orders where customer_id = actor_id and payment_status = 'paid';
  if p_promotion_code is not null and nullif(trim(p_promotion_code), '') is not null then
    select * into promo_row from public.commerce_promotions
    where is_active = true and status in ('active', 'scheduled') and starts_at <= timezone('utc', now()) and (ends_at is null or ends_at > timezone('utc', now()))
      and (upper(code) = upper(trim(p_promotion_code)) or upper(coalesce(voucher_code, '')) = upper(trim(p_promotion_code)))
    for update;
    if promo_row.id is null then raise exception 'PROMOTION_NOT_ELIGIBLE'; end if;
    if promo_row.usage_limit is not null and promo_row.usage_count >= promo_row.usage_limit then raise exception 'PROMOTION_LIMIT_REACHED'; end if;
    if promo_row.audience_type = 'new_user' and paid_count > 0 then raise exception 'PROMOTION_NOT_ELIGIBLE'; end if;
    if promo_row.audience_type = 'repeat_customer' and paid_count < greatest(1, promo_row.repeat_order_min_count) then raise exception 'PROMOTION_NOT_ELIGIBLE'; end if;
    if promo_row.audience_type = 'pricing_tier' and not exists (select 1 from public.promotion_pricing_tiers target where target.promotion_id = promo_row.id and target.pricing_tier_id = tier_row.id) then raise exception 'PROMOTION_NOT_ELIGIBLE'; end if;
    if promo_row.audience_type = 'custom_customer' and not exists (select 1 from public.promotion_eligible_customers target where target.promotion_id = promo_row.id and target.customer_id = actor_id and (target.usage_limit is null or target.usage_count < target.usage_limit)) then raise exception 'PROMOTION_NOT_ELIGIBLE'; end if;
    if promo_row.usage_limit_per_customer is not null and (select count(*) from public.promotion_redemptions redemption where redemption.promotion_id = promo_row.id and redemption.customer_id = actor_id) >= promo_row.usage_limit_per_customer then raise exception 'PROMOTION_LIMIT_REACHED'; end if;
    if subtotal < promo_row.minimum_order_amount_idr or p_quantity < promo_row.minimum_item_quantity then raise exception 'PROMOTION_MINIMUM_NOT_MET'; end if;
    if exists (select 1 from public.promotion_skus target where target.promotion_id = promo_row.id) and not exists (select 1 from public.promotion_skus target join public.commerce_package_items member on member.sku_id = target.sku_id where target.promotion_id = promo_row.id and member.package_id = package_row.id) then raise exception 'PROMOTION_NOT_ELIGIBLE'; end if;
    if promo_row.promotion_type = 'bundle' and exists (select 1 from public.promotion_bundle_items bundle where not exists (select 1 from public.commerce_package_items member where member.package_id = package_row.id and member.sku_id = bundle.sku_id and member.quantity * p_quantity >= bundle.quantity)) then raise exception 'PROMOTION_NOT_ELIGIBLE'; end if;
    discount := case promo_row.discount_type when 'percentage' then floor(subtotal * promo_row.discount_value / 100.0)::bigint when 'fixed_amount' then least(subtotal, promo_row.discount_value::bigint) when 'fixed_price' then greatest(0, subtotal - coalesce(promo_row.bundle_price_idr, subtotal)) else 0 end;
    effective_code := coalesce(promo_row.voucher_code, promo_row.code);
  end if;

  select id into stock_location_id from public.inventory_locations where code = 'MAIN' and is_active = true limit 1;
  if stock_location_id is null then select id into stock_location_id from public.inventory_locations where is_active = true order by created_at limit 1; end if;
  if stock_location_id is null then raise exception 'INVENTORY_LOCATION_NOT_CONFIGURED'; end if;

  if p_reward_sku_id is not null or coalesce(p_reward_points, 0) > 0 then
    if p_reward_sku_id is null or p_reward_points <= 0 then raise exception 'INVALID_REWARD'; end if;
    select * into reward_row from public.loyalty_reward_catalog where sku_id = p_reward_sku_id and is_active = true;
    if reward_row.id is null or reward_row.points_cost <> p_reward_points then raise exception 'INVALID_REWARD'; end if;
    select * into account_row from public.loyalty_accounts where customer_id = actor_id for update;
    if account_row.customer_id is null or account_row.available_points < p_reward_points then raise exception 'INSUFFICIENT_POINTS'; end if;
  end if;

  insert into public.commerce_orders (customer_id, account_id, source_channel, status, payment_status, fulfillment_status, total_idr, address_id, address_snapshot, pricing_tier_id, subtotal_idr, discount_idr, shipping_fee_idr, promotion_id, promotion_code, shipping_method, shipping_provider, customer_notes, idempotency_key)
  values (actor_id, null, 'web', 'submitted_for_review', 'pending', 'unallocated', greatest(0, subtotal - discount + shipping_fee), address_row.id, to_jsonb(address_row) - 'customer_id', tier_row.id, subtotal, discount, shipping_fee, promo_row.id, effective_code, p_shipping_method, nullif(trim(p_shipping_provider), ''), nullif(trim(p_customer_notes), ''), nullif(trim(p_idempotency_key), ''))
  returning id into order_id;

  insert into public.commerce_order_items (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, package_id, metadata)
  values (order_id, null, 'PACKAGE:' || package_row.slug, package_row.title, p_quantity, unit_price, 'package', package_row.id, jsonb_build_object('package_quantity', p_quantity, 'promotion_code', effective_code));

  for package_item in select member.*, sku.sku, sku.name from public.commerce_package_items member join public.catalog_skus sku on sku.id = member.sku_id where member.package_id = package_row.id order by member.sort_order loop
    required_qty := package_item.quantity * p_quantity;
    select * into stock_row from public.inventory_stock stock where stock.location_id = stock_location_id and stock.sku_id = package_item.sku_id for update;
    if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < required_qty then raise exception 'INSUFFICIENT_STOCK:%', package_item.name; end if;
    update public.inventory_stock set reserved_quantity = reserved_quantity + required_qty, updated_at = timezone('utc', now()) where id = stock_row.id;
    insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id) values (stock_location_id, package_item.sku_id, 'reservation', required_qty, 'Checkout reservation', order_id);
    insert into public.commerce_order_items (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, package_id, metadata) values (order_id, package_item.sku_id, package_item.sku, package_item.name, required_qty, 0, 'component', package_row.id, jsonb_build_object('package_component', true));
  end loop;

  if p_reward_sku_id is not null then
    select sku, name into package_item from public.catalog_skus where id = p_reward_sku_id;
    select * into stock_row from public.inventory_stock stock where stock.location_id = stock_location_id and stock.sku_id = p_reward_sku_id for update;
    if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < 1 then raise exception 'INSUFFICIENT_REWARD_STOCK'; end if;
    update public.inventory_stock set reserved_quantity = reserved_quantity + 1, updated_at = timezone('utc', now()) where id = stock_row.id;
    insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id) values (stock_location_id, p_reward_sku_id, 'reservation', 1, 'Luminails Points reward reservation', order_id);
    insert into public.commerce_order_items (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, metadata) values (order_id, p_reward_sku_id, package_item.sku, package_item.name, 1, 0, 'loyalty_reward', jsonb_build_object('points_redeemed', p_reward_points));
    insert into public.loyalty_redemptions (customer_id, order_id, sku_id, points_redeemed, reward_points_cost, status, applied_at) values (actor_id, order_id, p_reward_sku_id, p_reward_points, p_reward_points, 'applied', timezone('utc', now())) returning id into redemption_id;
    insert into public.loyalty_ledger (customer_id, order_id, redemption_id, entry_type, points_delta, points_type, description) values (actor_id, order_id, redemption_id, 'redeem', -p_reward_points, 'free_product', 'Points redeemed for free product');
  end if;

  insert into public.commerce_shipments (order_id, shipping_type, provider_code, service_level, status) values (order_id, case when p_shipping_method = 'paxel_factory' then 'free_factory' when p_shipping_method = 'third_party' then 'third_party' when p_shipping_method = 'pickup' then 'pickup' else 'manual' end, nullif(trim(p_shipping_provider), ''), case when p_shipping_method = 'paxel_factory' then 'next_day' else null end, 'pending');
  insert into public.commerce_order_events (order_id, event_type, status, message) values (order_id, 'created', 'submitted_for_review', 'Order dibuat dan stok berhasil direservasi.');
  if promo_row.id is not null then
    insert into public.promotion_redemptions (promotion_id, order_id, customer_id, discount_amount_idr) values (promo_row.id, order_id, actor_id, discount);
    update public.commerce_promotions set usage_count = usage_count + 1, updated_at = timezone('utc', now()) where id = promo_row.id;
    update public.promotion_eligible_customers set usage_count = usage_count + 1 where promotion_id = promo_row.id and customer_id = actor_id;
  end if;
  return jsonb_build_object('order_id', order_id, 'subtotal_idr', subtotal, 'discount_idr', discount, 'shipping_fee_idr', shipping_fee, 'total_idr', greatest(0, subtotal - discount + shipping_fee), 'promotion_code', effective_code, 'points_redeemed', coalesce(p_reward_points, 0));
exception
  when unique_violation then
    if p_idempotency_key is not null then
      select id into existing_order_id from public.commerce_orders where customer_id = actor_id and idempotency_key = p_idempotency_key;
      if existing_order_id is not null then return jsonb_build_object('order_id', existing_order_id, 'duplicate', true); end if;
    end if;
    raise;
end;
$$;

revoke all on function public.create_checkout_order(text, integer, uuid, text, text, text, text, uuid, bigint, text) from public, anon;
grant execute on function public.create_checkout_order(text, integer, uuid, text, text, text, text, uuid, bigint, text) to authenticated;

create or replace function public.set_order_tracking(p_order_id uuid, p_provider text, p_tracking_number text, p_tracking_url text default null, p_status text default 'in_transit')
returns public.commerce_shipments
language plpgsql
security invoker
set search_path = public
as $$
declare result_row public.commerce_shipments;
begin
  if not public.has_admin_permission('orders') then raise exception 'ORDER_PERMISSION_REQUIRED'; end if;
  update public.commerce_shipments set provider_code = nullif(trim(p_provider), ''), tracking_number = nullif(trim(p_tracking_number), ''), tracking_url = nullif(trim(p_tracking_url), ''), status = p_status, shipped_at = case when p_status in ('picked_up', 'in_transit', 'delivered') then coalesce(shipped_at, timezone('utc', now())) else shipped_at end, delivered_at = case when p_status = 'delivered' then timezone('utc', now()) else delivered_at end, updated_at = timezone('utc', now()) where order_id = p_order_id returning * into result_row;
  if result_row.id is null then raise exception 'SHIPMENT_NOT_FOUND'; end if;
  update public.commerce_orders set fulfillment_status = case when p_status = 'delivered' then 'completed' when p_status in ('picked_up', 'in_transit') then 'shipped' else fulfillment_status end, updated_at = timezone('utc', now()) where id = p_order_id;
  insert into public.commerce_order_events (order_id, event_type, status, message, metadata, created_by) values (p_order_id, 'tracking', p_status, 'Tracking order diperbarui.', jsonb_build_object('provider', p_provider, 'tracking_number', p_tracking_number), auth.uid());
  return result_row;
end;
$$;
grant execute on function public.set_order_tracking(uuid, text, text, text, text) to authenticated;
revoke execute on function public.set_order_tracking(uuid, text, text, text, text) from anon, public;







create or replace function public.cancel_checkout_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  order_row public.commerce_orders%rowtype;
  movement_row record;
  redemption_row public.loyalty_redemptions%rowtype;
  promotion_row public.commerce_promotions%rowtype;
begin
  if actor_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select * into order_row from public.commerce_orders where id = p_order_id for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.customer_id is distinct from actor_id and not public.has_admin_permission('orders') then raise exception 'ORDER_PERMISSION_REQUIRED'; end if;
  if order_row.status in ('paid', 'fulfilling', 'completed', 'cancelled') then raise exception 'ORDER_CANNOT_BE_CANCELLED'; end if;

  for movement_row in select * from public.inventory_movements where order_id = p_order_id and movement_type = 'reservation' loop
    update public.inventory_stock set reserved_quantity = greatest(0, reserved_quantity - movement_row.quantity_delta), updated_at = timezone('utc', now()) where location_id = movement_row.location_id and sku_id = movement_row.sku_id;
    insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id, created_by) values (movement_row.location_id, movement_row.sku_id, 'release', -movement_row.quantity_delta, 'Order dibatalkan', p_order_id, actor_id);
  end loop;

  select * into redemption_row from public.loyalty_redemptions where order_id = p_order_id for update;
  if redemption_row.id is not null and redemption_row.status = 'applied' then
    insert into public.loyalty_ledger (customer_id, order_id, redemption_id, entry_type, points_delta, points_type, description) values (redemption_row.customer_id, p_order_id, redemption_row.id, 'reversal', redemption_row.points_redeemed, 'free_product', 'Points dikembalikan karena order dibatalkan');
    update public.loyalty_redemptions set status = 'reversed' where id = redemption_row.id;
    perform private.sync_customer_loyalty(redemption_row.customer_id);
  end if;

  if order_row.promotion_id is not null then
    update public.commerce_promotions set usage_count = greatest(0, usage_count - 1), updated_at = timezone('utc', now()) where id = order_row.promotion_id returning * into promotion_row;
    update public.promotion_eligible_customers set usage_count = greatest(0, usage_count - 1) where promotion_id = order_row.promotion_id and customer_id = order_row.customer_id;
  end if;
  update public.commerce_orders set status = 'cancelled', updated_at = timezone('utc', now()) where id = p_order_id;
  update public.commerce_shipments set status = 'cancelled', updated_at = timezone('utc', now()) where order_id = p_order_id;
  insert into public.commerce_order_events (order_id, event_type, status, message, created_by) values (p_order_id, 'cancelled', 'cancelled', 'Order dibatalkan dan reservation dilepas.', actor_id);
  return jsonb_build_object('order_id', p_order_id, 'status', 'cancelled');
end;
$$;
revoke all on function public.cancel_checkout_order(uuid) from public, anon;
grant execute on function public.cancel_checkout_order(uuid) to authenticated;
