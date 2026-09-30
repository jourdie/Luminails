-- Add-on checkout is intentionally package-scoped.
-- Tools and accessories can be added only through this package checkout wrapper.

create or replace function public.create_checkout_order_with_addons(
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
  p_selected_skus jsonb default null,
  p_selected_benefits jsonb default null,
  p_contact_phone text default null,
  p_add_on_skus jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result jsonb;
  order_id uuid;
  stock_location_id uuid;
  stock_row public.inventory_stock%rowtype;
  add_on record;
  chosen record;
  add_on_total bigint := 0;
  add_on_count integer := 0;
  add_on_distinct_count integer := 0;
  add_on_quantity integer := 0;
  required_quantity integer;
begin
  if actor_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  if p_add_on_skus is not null and jsonb_typeof(p_add_on_skus) <> 'array' then
    raise exception 'INVALID_ADD_ON_SELECTION';
  end if;

  select count(*)::integer,
         count(distinct chosen.sku_id)::integer,
         coalesce(sum(chosen.quantity), 0)::integer
    into add_on_count, add_on_distinct_count, add_on_quantity
    from jsonb_to_recordset(coalesce(p_add_on_skus, '[]'::jsonb))
      as chosen(sku_id uuid, quantity integer);

  if add_on_count <> add_on_distinct_count
     or exists (
       select 1
       from jsonb_to_recordset(coalesce(p_add_on_skus, '[]'::jsonb))
         as chosen(sku_id uuid, quantity integer)
       where chosen.sku_id is null
          or chosen.quantity is null
          or chosen.quantity < 1
          or chosen.quantity > 100
     ) then
    raise exception 'INVALID_ADD_ON_SELECTION';
  end if;

  if add_on_quantity > 1000 then raise exception 'INVALID_ADD_ON_SELECTION'; end if;

  result := public.create_checkout_order_with_contact_phone(
    p_package_slug => p_package_slug,
    p_quantity => p_quantity,
    p_address_id => p_address_id,
    p_customer_notes => p_customer_notes,
    p_promotion_code => p_promotion_code,
    p_shipping_method => p_shipping_method,
    p_shipping_provider => p_shipping_provider,
    p_reward_sku_id => p_reward_sku_id,
    p_reward_points => p_reward_points,
    p_reward_quantity => p_reward_quantity,
    p_idempotency_key => p_idempotency_key,
    p_selected_skus => p_selected_skus,
    p_selected_benefits => p_selected_benefits,
    p_contact_phone => p_contact_phone
  );

  if coalesce((result->>'duplicate')::boolean, false) then return result; end if;
  order_id := (result->>'order_id')::uuid;
  if order_id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if add_on_count = 0 then return result; end if;

  select id into stock_location_id
    from public.inventory_locations
   where code = 'MAIN' and is_active = true
   limit 1;
  if stock_location_id is null then
    select id into stock_location_id
      from public.inventory_locations
     where is_active = true
     order by created_at
     limit 1;
  end if;
  if stock_location_id is null then raise exception 'INVENTORY_LOCATION_NOT_CONFIGURED'; end if;

  for chosen in
    select selected.sku_id, selected.quantity
      from jsonb_to_recordset(coalesce(p_add_on_skus, '[]'::jsonb))
        as selected(sku_id uuid, quantity integer)
  loop
    select sku.id,
           sku.sku,
           sku.name,
           sku.public_reference_price_idr
      into add_on
      from public.catalog_skus sku
      join public.catalog_products product on product.id = sku.product_id
     where sku.id = chosen.sku_id
       and sku.is_active = true
       and product.is_published = true
       and sku.product_type in ('TOOL', 'ACCESSORY');

    if add_on.id is null then raise exception 'ADD_ON_NOT_ALLOWED'; end if;
    if add_on.public_reference_price_idr is null then raise exception 'ADD_ON_PRICE_NOT_CONFIGURED'; end if;

    required_quantity := chosen.quantity;
    select * into stock_row
      from public.inventory_stock stock
     where stock.location_id = stock_location_id
       and stock.sku_id = add_on.id
     for update;
    if stock_row.id is null
       or stock_row.on_hand_quantity - stock_row.reserved_quantity < required_quantity then
      raise exception 'INSUFFICIENT_ADD_ON_STOCK:%', add_on.name;
    end if;

    update public.inventory_stock
       set reserved_quantity = reserved_quantity + required_quantity,
           updated_at = timezone('utc', now())
     where id = stock_row.id;

    insert into public.inventory_movements
      (location_id, sku_id, movement_type, quantity_delta, reason, order_id)
    values
      (stock_location_id, add_on.id, 'reservation', required_quantity,
       'Package add-on reservation', order_id);

    insert into public.commerce_order_items
      (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity,
       unit_price_idr, item_type, metadata)
    values
      (order_id, add_on.id, add_on.sku, add_on.name, required_quantity,
       add_on.public_reference_price_idr, 'add_on',
       jsonb_build_object('package_add_on', true, 'reference_price', true));

    add_on_total := add_on_total + (required_quantity * add_on.public_reference_price_idr);
  end loop;

  update public.commerce_orders order_row
     set subtotal_idr = order_row.subtotal_idr + add_on_total,
         total_idr = order_row.total_idr + add_on_total
   where order_row.id = order_id
     and order_row.customer_id = actor_id;

  update public.commerce_order_items package_item
     set metadata = coalesce(package_item.metadata, '{}'::jsonb)
       || jsonb_build_object(
            'add_on_skus', coalesce(p_add_on_skus, '[]'::jsonb),
            'add_on_total_idr', add_on_total
          )
   where package_item.order_id = order_id
     and package_item.item_type = 'package';

  return result
    || jsonb_build_object(
         'add_on_total_idr', add_on_total,
         'subtotal_idr', coalesce((result->>'subtotal_idr')::bigint, 0) + add_on_total,
         'total_idr', coalesce((result->>'total_idr')::bigint, 0) + add_on_total
       );
end;
$$;

revoke all on function public.create_checkout_order_with_addons(
  text, integer, uuid, text, text, text, text, uuid, bigint, integer, text,
  jsonb, jsonb, text, jsonb
) from public, anon;

grant execute on function public.create_checkout_order_with_addons(
  text, integer, uuid, text, text, text, text, uuid, bigint, integer, text,
  jsonb, jsonb, text, jsonb
) to authenticated;
