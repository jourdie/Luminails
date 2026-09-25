-- Complete redemption quantity handling, proportional refund reversals and customer metrics.

alter table public.commerce_orders
  add column if not exists refunded_amount_idr bigint not null default 0 check (refunded_amount_idr >= 0);

drop trigger if exists commerce_orders_loyalty_trigger on public.commerce_orders;
create trigger commerce_orders_loyalty_trigger
after insert or update of customer_id, payment_status, total_idr, subtotal_idr, discount_idr, refunded_amount_idr on public.commerce_orders
for each row execute function private.handle_order_loyalty();

create or replace function private.create_loyalty_point_lot()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  expiry_months integer;
  lot record;
  remaining_to_consume bigint;
  lot_points bigint;
begin
  if new.points_delta > 0 and new.entry_type in ('earn', 'adjustment_plus', 'reversal') then
    -- Earned points first offset a negative balance; only the remainder can expire as a lot.
    lot_points := greatest(0, new.points_delta - greatest(0, -coalesce(new.balance_before, 0)));
    if lot_points > 0 then
      select expiry_months into expiry_months from public.loyalty_point_settings where key = 'default';
      insert into public.loyalty_point_lots (customer_id, ledger_id, original_points, remaining_points, expires_at)
      values (new.customer_id, new.id, lot_points, lot_points, coalesce(new.expires_at, new.created_at + make_interval(months => coalesce(expiry_months, 12))));
    end if;
  elsif new.points_delta < 0 and new.entry_type in ('redeem', 'expired', 'expire', 'adjustment_minus', 'reversal') then
    remaining_to_consume := -new.points_delta;
    for lot in select * from public.loyalty_point_lots where customer_id = new.customer_id and remaining_points > 0 order by expires_at, earned_at for update loop
      exit when remaining_to_consume <= 0;
      update public.loyalty_point_lots set remaining_points = remaining_points - least(remaining_points, remaining_to_consume) where id = lot.id;
      remaining_to_consume := remaining_to_consume - least(lot.remaining_points, remaining_to_consume);
    end loop;
  end if;
  return new;
end;
$$;

create or replace function private.sync_customer_loyalty(p_customer_id uuid, p_order_id uuid default null)
returns void language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  order_row public.commerce_orders%rowtype;
  settings_row public.loyalty_point_settings%rowtype;
  tier_id uuid;
  tier_multiplier numeric := 1;
  eligible_spend bigint;
  earned_points bigint;
  issued_points bigint;
  refunded_eligible bigint;
  target_reversal bigint;
  existing_reversal bigint;
  package_row public.commerce_packages%rowtype;
begin
  perform public.recalculate_customer_tier(p_customer_id);
  if p_order_id is null then return; end if;
  select * into order_row from public.commerce_orders where id = p_order_id and customer_id = p_customer_id;
  if order_row.id is null then return; end if;

  if order_row.payment_status in ('paid', 'partially_refunded') then
    if not exists (select 1 from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn') then
      select * into settings_row from public.loyalty_point_settings where key = 'default';
      select customer_tier_id into tier_id from public.customer_profiles where id = p_customer_id;
      select coalesce(point_multiplier, 1) into tier_multiplier from public.customer_tiers where id = tier_id;
      eligible_spend := greatest(0, coalesce(order_row.subtotal_idr, order_row.total_idr, 0) - coalesce(order_row.discount_idr, 0));
      earned_points := floor((eligible_spend / greatest(1, coalesce(settings_row.point_unit_value_idr, 10000))) * coalesce(tier_multiplier, 1))::bigint;
      select package.* into package_row from public.commerce_order_items member join public.commerce_packages package on package.id = member.package_id where member.order_id = p_order_id and member.item_type = 'package' limit 1;
      if package_row.id is not null then
        if package_row.points_earning_mode = 'none' then earned_points := 0;
        elsif package_row.points_earning_mode = 'reduced' then earned_points := floor(earned_points * least(1, package_row.points_multiplier))::bigint;
        else earned_points := floor(earned_points * package_row.points_multiplier)::bigint;
        end if;
      end if;
      if earned_points > 0 then
        insert into public.loyalty_ledger (customer_id, order_id, entry_type, points_delta, points_type, description, expires_at, reference_text)
        values (p_customer_id, p_order_id, 'earn', earned_points, 'free_product', 'Points dari order paid: ' || p_order_id::text, timezone('utc', now()) + make_interval(months => coalesce(settings_row.expiry_months, 12)), 'eligible spend ' || eligible_spend::text);
      end if;
    end if;
  end if;

  if order_row.payment_status in ('partially_refunded', 'refunded', 'failed') then
    select coalesce(points_delta, 0) into issued_points from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn' order by created_at limit 1;
    if coalesce(issued_points, 0) > 0 then
      eligible_spend := greatest(0, coalesce(order_row.subtotal_idr, order_row.total_idr, 0) - coalesce(order_row.discount_idr, 0));
      refunded_eligible := case when order_row.payment_status in ('refunded', 'failed') then eligible_spend else least(eligible_spend, greatest(0, order_row.refunded_amount_idr)) end;
      target_reversal := case when eligible_spend > 0 then floor(issued_points * refunded_eligible / eligible_spend)::bigint else 0 end;
      existing_reversal := coalesce((select sum(-points_delta) from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'reversal' and redemption_id is null), 0);
      if target_reversal > existing_reversal then
        insert into public.loyalty_ledger (customer_id, order_id, entry_type, points_delta, points_type, description, reference_text)
        values (p_customer_id, p_order_id, 'reversal', -(target_reversal - existing_reversal), 'free_product', 'Reversal points karena refund/cancel', 'refund amount ' || coalesce(order_row.refunded_amount_idr, eligible_spend)::text);
      end if;
    end if;
  end if;
end;
$$;

-- Quantity-aware checkout wrapper. The existing checkout RPC remains backward compatible.
create or replace function public.create_checkout_order_with_reward_quantity(
  p_package_slug text,
  p_quantity integer,
  p_address_id uuid,
  p_customer_notes text default null,
  p_promotion_code text default null,
  p_shipping_method text default 'paxel_factory',
  p_shipping_provider text default 'paxel',
  p_reward_sku_id uuid default null,
  p_reward_points bigint default 0,
  p_reward_quantity integer default 1,
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
  result jsonb;
  order_id uuid;
  reward_row public.loyalty_reward_catalog%rowtype;
  stock_location_id uuid;
  stock_row public.inventory_stock%rowtype;
  reward_item record;
  points_total bigint;
begin
  if actor_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_reward_quantity is null or p_reward_quantity < 1 or p_reward_quantity > 100 then raise exception 'INVALID_REWARD_QUANTITY'; end if;
  result := public.create_checkout_order(
    p_package_slug => p_package_slug,
    p_quantity => p_quantity,
    p_address_id => p_address_id,
    p_customer_notes => p_customer_notes,
    p_promotion_code => p_promotion_code,
    p_shipping_method => p_shipping_method,
    p_shipping_provider => p_shipping_provider,
    p_reward_sku_id => null,
    p_reward_points => 0,
    p_idempotency_key => p_idempotency_key,
    p_selected_skus => p_selected_skus
  );
  if coalesce((result->>'duplicate')::boolean, false) then return result; end if;
  order_id := (result->>'order_id')::uuid;
  if p_reward_sku_id is null then return result; end if;
  if p_reward_points <= 0 then raise exception 'INVALID_REWARD'; end if;
  select * into reward_row from public.loyalty_reward_catalog where sku_id = p_reward_sku_id and is_active = true for update;
  if reward_row.id is null or reward_row.points_cost <> p_reward_points then raise exception 'INVALID_REWARD'; end if;
  points_total := p_reward_points * p_reward_quantity;
  select id into stock_location_id from public.inventory_locations where code = 'MAIN' and is_active = true limit 1;
  if stock_location_id is null then select id into stock_location_id from public.inventory_locations where is_active = true order by created_at limit 1; end if;
  if stock_location_id is null then raise exception 'INVENTORY_LOCATION_NOT_CONFIGURED'; end if;
  select sku, name into reward_item from public.catalog_skus where id = p_reward_sku_id and is_active = true;
  if reward_item.sku is null then raise exception 'REWARD_NOT_AVAILABLE'; end if;
  select * into stock_row from public.inventory_stock stock where stock.location_id = stock_location_id and stock.sku_id = p_reward_sku_id for update;
  if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < p_reward_quantity then raise exception 'INSUFFICIENT_REWARD_STOCK'; end if;
  update public.inventory_stock set reserved_quantity = reserved_quantity + p_reward_quantity, updated_at = timezone('utc', now()) where id = stock_row.id;
  insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id) values (stock_location_id, p_reward_sku_id, 'reservation', p_reward_quantity, 'Luminails Points reward reservation', order_id);
  insert into public.commerce_order_items (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, metadata)
  values (order_id, p_reward_sku_id, reward_item.sku, reward_item.name, p_reward_quantity, 0, 'loyalty_reward', jsonb_build_object('points_redeemed', p_reward_points, 'reward_quantity', p_reward_quantity));
  insert into public.loyalty_redemptions (customer_id, order_id, sku_id, points_redeemed, reward_points_cost, quantity, status, applied_at)
  values (actor_id, order_id, p_reward_sku_id, p_reward_points, p_reward_points, p_reward_quantity, 'applied', timezone('utc', now()));
  update public.loyalty_accounts set last_redemption_at = timezone('utc', now()) where customer_id = actor_id;
  return result || jsonb_build_object('points_redeemed', points_total, 'reward_quantity', p_reward_quantity);
end;
$$;

revoke all on function public.create_checkout_order_with_reward_quantity(text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb) from public, anon;
grant execute on function public.create_checkout_order_with_reward_quantity(text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb) to authenticated;
