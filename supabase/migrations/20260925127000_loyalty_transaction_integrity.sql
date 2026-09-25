-- Finalize points transaction paths introduced by the loyalty/reward flow.

-- A partial refund can keep payment_status unchanged, so refunded_amount_idr
-- must be part of the order-loyalty change detector.
create or replace function private.handle_order_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.customer_id is not null
     and new.payment_status in ('paid', 'partially_refunded', 'refunded', 'failed')
     and (
       tg_op = 'INSERT'
       or old.customer_id is distinct from new.customer_id
       or old.payment_status is distinct from new.payment_status
       or old.total_idr is distinct from new.total_idr
       or old.subtotal_idr is distinct from new.subtotal_idr
       or old.discount_idr is distinct from new.discount_idr
       or old.refunded_amount_idr is distinct from new.refunded_amount_idr
     )
  then
    perform private.sync_customer_loyalty(new.customer_id, new.id);
  end if;

  if tg_op = 'UPDATE' and old.customer_id is not null and old.customer_id is distinct from new.customer_id then
    perform private.sync_customer_loyalty(old.customer_id);
  end if;
  return new;
end;
$$;

-- Recreate the trigger so the refund amount column is watched even on
-- projects that ran an earlier version of the order trigger.
drop trigger if exists commerce_orders_loyalty_trigger on public.commerce_orders;
create trigger commerce_orders_loyalty_trigger
after insert or update of customer_id, payment_status, total_idr, subtotal_idr, discount_idr, refunded_amount_idr
on public.commerce_orders
for each row execute function private.handle_order_loyalty();

-- The quantity-aware wrapper creates the redemption row itself, therefore it
-- must also append the immutable negative ledger entry that consumes points.
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
  redemption_id uuid;
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

  select * into reward_row
  from public.loyalty_reward_catalog
  where sku_id = p_reward_sku_id and is_active = true
  for update;
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
  insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id)
  values (stock_location_id, p_reward_sku_id, 'reservation', p_reward_quantity, 'Luminails Points reward reservation', order_id);
  insert into public.commerce_order_items (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, metadata)
  values (order_id, p_reward_sku_id, reward_item.sku, reward_item.name, p_reward_quantity, 0, 'loyalty_reward', jsonb_build_object('points_redeemed', p_reward_points, 'reward_quantity', p_reward_quantity));
  insert into public.loyalty_redemptions (customer_id, order_id, sku_id, points_redeemed, reward_points_cost, quantity, status, applied_at)
  values (actor_id, order_id, p_reward_sku_id, p_reward_points, p_reward_points, p_reward_quantity, 'applied', timezone('utc', now()))
  returning id into redemption_id;
  insert into public.loyalty_ledger (customer_id, order_id, redemption_id, entry_type, points_delta, points_type, description, reference_text)
  values (actor_id, order_id, redemption_id, 'redeem', -points_total, 'free_product', 'Points redeemed for free product', 'quantity ' || p_reward_quantity::text);
  update public.loyalty_accounts set last_redemption_at = timezone('utc', now()) where customer_id = actor_id;
  return result || jsonb_build_object('points_redeemed', points_total, 'reward_quantity', p_reward_quantity);
end;
$$;

revoke all on function public.create_checkout_order_with_reward_quantity(text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb) from public, anon;
grant execute on function public.create_checkout_order_with_reward_quantity(text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb) to authenticated;

-- Redemptions contain operational history and must be visible in the audit log.
drop trigger if exists loyalty_redemption_admin_audit_trigger on public.loyalty_redemptions;
create trigger loyalty_redemption_admin_audit_trigger
after insert or update or delete on public.loyalty_redemptions
for each row execute function private.write_admin_audit_log();
