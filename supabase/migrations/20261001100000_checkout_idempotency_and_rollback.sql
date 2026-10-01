-- Make checkout retries and payment failures safe to repeat.

alter table public.commerce_payment_transactions
  drop constraint if exists commerce_payment_transactions_status_check;

alter table public.commerce_payment_transactions
  add constraint commerce_payment_transactions_status_check
  check (status in ('pending', 'authorized', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded'));

create or replace function private.release_checkout_reservations(
  p_order_id uuid,
  p_reason text default 'Order dibatalkan'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  movement_row record;
  released_count integer := 0;
begin
  for movement_row in
    select location_id,
           sku_id,
           sum(case when movement_type = 'reservation' then quantity_delta else 0 end)
             + sum(case when movement_type = 'release' then quantity_delta else 0 end) as remaining_quantity
      from public.inventory_movements
     where order_id = p_order_id
       and movement_type in ('reservation', 'release')
     group by location_id, sku_id
    having sum(case when movement_type = 'reservation' then quantity_delta else 0 end)
             + sum(case when movement_type = 'release' then quantity_delta else 0 end) > 0
  loop
    update public.inventory_stock
       set reserved_quantity = greatest(0, reserved_quantity - movement_row.remaining_quantity),
           updated_at = timezone('utc', now())
     where location_id = movement_row.location_id
       and sku_id = movement_row.sku_id;

    if not found then
      raise exception 'INVENTORY_STOCK_NOT_FOUND:%', movement_row.sku_id;
    end if;

    insert into public.inventory_movements
      (location_id, sku_id, movement_type, quantity_delta, reason, order_id, created_by)
    values
      (movement_row.location_id, movement_row.sku_id, 'release', -movement_row.remaining_quantity,
       left(coalesce(p_reason, 'Order dibatalkan'), 200), p_order_id, auth.uid());

    released_count := released_count + movement_row.remaining_quantity;
  end loop;

  return released_count;
end;
$$;

revoke all on function private.release_checkout_reservations(uuid, text) from public, anon, authenticated;

create or replace function private.reverse_checkout_reward(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  redemption_row public.loyalty_redemptions%rowtype;
begin
  select * into redemption_row
    from public.loyalty_redemptions
   where order_id = p_order_id
   for update;

  if redemption_row.id is null or redemption_row.status <> 'applied' then
    return false;
  end if;

  insert into public.loyalty_ledger
    (customer_id, order_id, redemption_id, entry_type, points_delta, points_type, description)
  values
    (redemption_row.customer_id, p_order_id, redemption_row.id, 'reversal', redemption_row.points_redeemed,
     'free_product', 'Points dikembalikan karena pembayaran order gagal atau expired')
  on conflict (customer_id, order_id, entry_type) do nothing;

  update public.loyalty_redemptions
     set status = 'reversed'
   where id = redemption_row.id
     and status = 'applied';

  perform private.sync_customer_loyalty(redemption_row.customer_id);
  return true;
end;
$$;

revoke all on function private.reverse_checkout_reward(uuid) from public, anon, authenticated;

create or replace function private.release_checkout_promotion(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  redemption_row record;
begin
  select promotion_id, customer_id into redemption_row
    from public.promotion_redemptions
   where order_id = p_order_id
   limit 1;

  if redemption_row.promotion_id is null then
    return false;
  end if;

  update public.commerce_promotions
     set usage_count = greatest(0, usage_count - 1),
         updated_at = timezone('utc', now())
   where id = redemption_row.promotion_id;

  update public.promotion_eligible_customers
     set usage_count = greatest(0, usage_count - 1)
   where promotion_id = redemption_row.promotion_id
     and customer_id = redemption_row.customer_id;

  return true;
end;
$$;

revoke all on function private.release_checkout_promotion(uuid) from public, anon, authenticated;

-- Reuse the idempotent rollback primitives for customer/admin cancellation too.
create or replace function public.cancel_checkout_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  order_row public.commerce_orders%rowtype;
begin
  if actor_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select * into order_row
    from public.commerce_orders
   where id = p_order_id
   for update;

  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.customer_id is distinct from actor_id and not public.has_admin_permission('orders') then
    raise exception 'ORDER_PERMISSION_REQUIRED';
  end if;
  if order_row.status in ('paid', 'fulfilling', 'completed', 'cancelled') then
    raise exception 'ORDER_CANNOT_BE_CANCELLED';
  end if;

  perform private.release_checkout_reservations(p_order_id, 'Order dibatalkan');
  perform private.reverse_checkout_reward(p_order_id);
  perform private.release_checkout_promotion(p_order_id);

  update public.commerce_orders
     set status = 'cancelled',
         payment_failure_reason = coalesce(payment_failure_reason, 'Order dibatalkan oleh customer/admin')
   where id = p_order_id;

  update public.commerce_shipments
     set status = 'cancelled', updated_at = timezone('utc', now())
   where order_id = p_order_id;

  insert into public.commerce_order_events
    (order_id, event_type, status, message, created_by)
  values
    (p_order_id, 'cancelled', 'cancelled', 'Order dibatalkan dan reservation dilepas.', actor_id);

  return jsonb_build_object('order_id', p_order_id, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_checkout_order(uuid) from public, anon;
grant execute on function public.cancel_checkout_order(uuid) to authenticated;

-- The payment adapter calls this function after verifying the provider signature.
-- The inbox insert and all order side effects are one transaction, so a retry is safe.
create or replace function public.apply_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_order_id uuid,
  p_payment_status text,
  p_payment_reference text default null,
  p_amount_idr bigint default null,
  p_failure_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  event_id uuid;
  existing_event_order_id uuid;
  order_row public.commerce_orders%rowtype;
  normalized_provider text := nullif(trim(p_provider), '');
  normalized_event_id text := nullif(trim(p_provider_event_id), '');
  normalized_reference text := nullif(trim(p_payment_reference), '');
  normalized_failure text := nullif(trim(p_failure_reason), '');
  released_quantity integer := 0;
begin
  if current_user <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if normalized_provider is null or normalized_event_id is null then raise exception 'PAYMENT_EVENT_ID_REQUIRED'; end if;
  if p_order_id is null then raise exception 'ORDER_ID_REQUIRED'; end if;
  if p_payment_status not in ('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded') then
    raise exception 'INVALID_PAYMENT_STATUS';
  end if;

  insert into public.commerce_payment_events
    (provider, provider_event_id, order_id, payment_status, payment_reference, payload)
  values
    (normalized_provider, normalized_event_id, p_order_id, p_payment_status, normalized_reference, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, provider_event_id) do nothing
  returning id into event_id;

  if event_id is null then
    select id, order_id into event_id, existing_event_order_id
      from public.commerce_payment_events
     where provider = normalized_provider
       and provider_event_id = normalized_event_id;
    if existing_event_order_id is distinct from p_order_id then raise exception 'PAYMENT_EVENT_ORDER_MISMATCH'; end if;
    return jsonb_build_object('duplicate', true, 'event_id', event_id);
  end if;

  select * into order_row
    from public.commerce_orders
   where id = p_order_id
   for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;

  if p_payment_status = 'paid' and p_amount_idr is distinct from order_row.total_idr then
    raise exception 'PAYMENT_AMOUNT_MISMATCH';
  end if;
  if normalized_reference is not null and exists (
    select 1 from public.commerce_payment_transactions
     where provider = normalized_provider
       and external_id = normalized_reference
       and order_id is distinct from p_order_id
  ) then
    raise exception 'PAYMENT_REFERENCE_REUSED';
  end if;

  if order_row.payment_status = p_payment_status then
    insert into public.commerce_payment_transactions
      (order_id, provider, external_id, status, amount_idr, raw_response, updated_at)
    values
      (p_order_id, normalized_provider, normalized_reference, p_payment_status,
       coalesce(p_amount_idr, order_row.total_idr), coalesce(p_payload, '{}'::jsonb), timezone('utc', now()))
    on conflict (provider, external_id) do update set
      status = excluded.status,
      amount_idr = excluded.amount_idr,
      raw_response = excluded.raw_response,
      updated_at = timezone('utc', now());
    update public.commerce_payment_events
       set processed_at = coalesce(processed_at, timezone('utc', now())),
           updated_at = timezone('utc', now())
     where id = event_id;
    return jsonb_build_object('duplicate', false, 'already_applied', true, 'event_id', event_id, 'order_id', p_order_id);
  end if;

  if p_payment_status in ('failed', 'expired') then
    if order_row.payment_status <> 'pending' then
      raise exception 'PAYMENT_STATUS_CONFLICT:%:%', order_row.payment_status, p_payment_status;
    end if;

    released_quantity := private.release_checkout_reservations(
      p_order_id,
      case when p_payment_status = 'expired' then 'Payment expired' else 'Payment gagal' end
    );
    perform private.reverse_checkout_reward(p_order_id);
    perform private.release_checkout_promotion(p_order_id);

    update public.commerce_orders
       set status = case when status in ('submitted_for_review', 'awaiting_payment') then 'cancelled' else status end,
           payment_status = p_payment_status,
           payment_provider = normalized_provider,
           payment_reference = normalized_reference,
           payment_failure_reason = normalized_failure,
           payment_expires_at = null
     where id = p_order_id;
  elsif p_payment_status = 'paid' then
    if order_row.payment_status <> 'pending' or order_row.status = 'cancelled' then
      raise exception 'PAYMENT_STATUS_CONFLICT:%:%', order_row.payment_status, p_payment_status;
    end if;

    update public.commerce_orders
       set status = case when status in ('submitted_for_review', 'awaiting_payment') then 'paid' else status end,
           payment_status = 'paid',
           payment_provider = normalized_provider,
           payment_reference = normalized_reference,
           payment_failure_reason = null,
           payment_expires_at = null
     where id = p_order_id;
  else
    update public.commerce_orders
       set payment_status = p_payment_status,
           payment_provider = normalized_provider,
           payment_reference = normalized_reference,
           payment_failure_reason = normalized_failure
     where id = p_order_id;
  end if;

  insert into public.commerce_payment_transactions
    (order_id, provider, external_id, status, amount_idr, raw_response, updated_at)
  values
    (p_order_id, normalized_provider, normalized_reference, p_payment_status,
     coalesce(p_amount_idr, order_row.total_idr), coalesce(p_payload, '{}'::jsonb), timezone('utc', now()))
  on conflict (provider, external_id) do update set
    status = excluded.status,
    amount_idr = excluded.amount_idr,
    raw_response = excluded.raw_response,
    updated_at = timezone('utc', now());

  update public.commerce_payment_events
     set processed_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where id = event_id;

  return jsonb_build_object(
    'duplicate', false,
    'event_id', event_id,
    'order_id', p_order_id,
    'payment_status', p_payment_status,
    'released_quantity', released_quantity
  );
end;
$$;

revoke all on function public.apply_payment_event(text, text, uuid, text, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, uuid, text, text, bigint, text, jsonb) to service_role;

comment on function public.apply_payment_event(text, text, uuid, text, text, bigint, text, jsonb) is
  'Idempotently applies a verified payment event and atomically rolls back checkout reservations on failed or expired payment.';
