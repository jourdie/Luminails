-- Package selection modes: customers always order a package; free-pick only changes its allowed contents.
alter table public.commerce_packages add column if not exists selection_mode text not null default 'fixed';
alter table public.commerce_packages add column if not exists selection_capacity integer;
alter table public.commerce_packages drop constraint if exists commerce_packages_selection_mode_check;
alter table public.commerce_packages add constraint commerce_packages_selection_mode_check check (selection_mode in ('fixed', 'free_pick'));
alter table public.commerce_packages drop constraint if exists commerce_packages_selection_capacity_check;
alter table public.commerce_packages add constraint commerce_packages_selection_capacity_check check ((selection_mode = 'fixed' and selection_capacity is null) or (selection_mode = 'free_pick' and selection_capacity > 0));

create table if not exists public.commerce_package_allowed_skus (
  package_id uuid not null references public.commerce_packages(id) on delete cascade,
  sku_id uuid not null references public.catalog_skus(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (package_id, sku_id)
);
create index if not exists commerce_package_allowed_skus_lookup_idx on public.commerce_package_allowed_skus (package_id, sort_order);
alter table public.commerce_package_allowed_skus enable row level security;
revoke all on public.commerce_package_allowed_skus from anon, authenticated;
grant select on public.commerce_package_allowed_skus to anon, authenticated;
grant select, insert, update, delete on public.commerce_package_allowed_skus to authenticated;
drop policy if exists "published package allowed skus are public" on public.commerce_package_allowed_skus;
create policy "published package allowed skus are public" on public.commerce_package_allowed_skus for select to anon, authenticated using (exists (select 1 from public.commerce_packages package join public.catalog_brands brand on brand.id = package.brand_id join public.catalog_skus sku on sku.id = commerce_package_allowed_skus.sku_id where package.id = commerce_package_allowed_skus.package_id and package.status = 'published' and brand.is_published = true and sku.is_active = true));
drop policy if exists "admins can manage package allowed skus" on public.commerce_package_allowed_skus;
create policy "admins can manage package allowed skus" on public.commerce_package_allowed_skus for all to authenticated using (public.has_admin_permission('packages')) with check (public.has_admin_permission('packages'));

revoke all on function public.create_checkout_order(text, integer, uuid, text, text, text, text, uuid, bigint, text) from public, anon, authenticated;

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
  p_idempotency_key text default null,
  p_selected_skus jsonb default null
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
  selected_total integer := 0;
  selected_count integer := 0;
  distinct_count integer := 0;
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

  if package_row.selection_mode = 'free_pick' then
    if p_selected_skus is null or jsonb_typeof(p_selected_skus) <> 'array' then raise exception 'PACKAGE_SELECTION_REQUIRED'; end if;
    select coalesce(sum(chosen.quantity), 0), count(*)::integer, count(distinct chosen.sku_id)::integer into selected_total, selected_count, distinct_count from jsonb_to_recordset(p_selected_skus) as chosen(sku_id uuid, quantity integer);
    if selected_count = 0 then raise exception 'PACKAGE_SELECTION_REQUIRED'; end if;
    if selected_count <> distinct_count or exists (select 1 from jsonb_to_recordset(p_selected_skus) as chosen(sku_id uuid, quantity integer) where chosen.sku_id is null or chosen.quantity is null or chosen.quantity < 1) then raise exception 'INVALID_PACKAGE_SELECTION'; end if;
    if selected_total <> coalesce(package_row.selection_capacity, 0) then raise exception 'PACKAGE_SELECTION_CAPACITY'; end if;
    if exists (select 1 from jsonb_to_recordset(p_selected_skus) as chosen(sku_id uuid, quantity integer) where not exists (select 1 from public.commerce_package_allowed_skus allowed join public.catalog_skus sku on sku.id = allowed.sku_id where allowed.package_id = package_row.id and allowed.sku_id = chosen.sku_id and sku.is_active = true)) then raise exception 'SKU_NOT_ALLOWED'; end if;
  elsif p_selected_skus is not null and jsonb_typeof(p_selected_skus) = 'array' and jsonb_array_length(p_selected_skus) > 0 then
    raise exception 'INVALID_PACKAGE_SELECTION';
  end if;

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

  if package_row.selection_mode = 'free_pick' then
    for package_item in select chosen.sku_id, chosen.quantity, sku.sku, sku.name from jsonb_to_recordset(p_selected_skus) as chosen(sku_id uuid, quantity integer) join public.catalog_skus sku on sku.id = chosen.sku_id order by sku.sort_order loop
      required_qty := package_item.quantity * p_quantity;
      select * into stock_row from public.inventory_stock stock where stock.location_id = stock_location_id and stock.sku_id = package_item.sku_id for update;
      if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < required_qty then raise exception 'INSUFFICIENT_STOCK:%', package_item.name; end if;
      update public.inventory_stock set reserved_quantity = reserved_quantity + required_qty, updated_at = timezone('utc', now()) where id = stock_row.id;
      insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id) values (stock_location_id, package_item.sku_id, 'reservation', required_qty, 'Checkout reservation', order_id);
      insert into public.commerce_order_items (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, package_id, metadata) values (order_id, package_item.sku_id, package_item.sku, package_item.name, required_qty, 0, 'component', package_row.id, jsonb_build_object('package_component', true, 'free_pick', true));
    end loop;
  else
    for package_item in select member.*, sku.sku, sku.name from public.commerce_package_items member join public.catalog_skus sku on sku.id = member.sku_id where member.package_id = package_row.id order by member.sort_order loop
      required_qty := package_item.quantity * p_quantity;
      select * into stock_row from public.inventory_stock stock where stock.location_id = stock_location_id and stock.sku_id = package_item.sku_id for update;
      if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < required_qty then raise exception 'INSUFFICIENT_STOCK:%', package_item.name; end if;
      update public.inventory_stock set reserved_quantity = reserved_quantity + required_qty, updated_at = timezone('utc', now()) where id = stock_row.id;
      insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id) values (stock_location_id, package_item.sku_id, 'reservation', required_qty, 'Checkout reservation', order_id);
      insert into public.commerce_order_items (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, package_id, metadata) values (order_id, package_item.sku_id, package_item.sku, package_item.name, required_qty, 0, 'component', package_row.id, jsonb_build_object('package_component', true));
    end loop;
  end if;

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

revoke all on function public.create_checkout_order(text, integer, uuid, text, text, text, text, uuid, bigint, text, jsonb) from public, anon, authenticated;
 grant execute on function public.create_checkout_order(text, integer, uuid, text, text, text, text, uuid, bigint, text, jsonb) to authenticated;
