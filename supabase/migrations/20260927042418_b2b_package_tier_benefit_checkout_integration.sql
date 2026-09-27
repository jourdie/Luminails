-- Enforce package benefits configured against B2B pricing tiers.
-- The existing loyalty-tier benefit tables remain supported for backward compatibility.
-- New package benefits are always customer-selected from the admin whitelist.

create or replace function private.apply_selected_package_benefits(
  p_order_id uuid,
  p_package_id uuid,
  p_package_quantity integer,
  p_selected_benefits jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  customer_id_value uuid;
  effective_loyalty_tier_id uuid;
  effective_pricing_tier_id uuid;
  stock_location_id uuid;
  benefit record;
  chosen record;
  chosen_total integer;
  chosen_count integer;
  stock_row public.inventory_stock%rowtype;
  required_qty integer;
begin
  if p_package_quantity < 1 then
    raise exception 'INVALID_PACKAGE_QUANTITY';
  end if;
  if p_selected_benefits is null then p_selected_benefits := '[]'::jsonb; end if;
  if jsonb_typeof(p_selected_benefits) <> 'array' then
    raise exception 'INVALID_PACKAGE_BENEFIT_SELECTION';
  end if;

  select customer_id into customer_id_value
  from public.commerce_orders
  where id = p_order_id;

  select customer_tier_id, pricing_tier_id
    into effective_loyalty_tier_id, effective_pricing_tier_id
  from public.customer_profiles
  where id = customer_id_value;

  if effective_pricing_tier_id is null then
    select id into effective_pricing_tier_id
    from public.pricing_tiers
    where code = 'STANDARD' and is_active = true
    limit 1;
  end if;

  -- Accept either legacy loyalty benefits or the new B2B pricing-tier benefits.
  if exists (
    select 1
    from jsonb_to_recordset(p_selected_benefits) as picked(benefit_id uuid, sku_id uuid, quantity integer)
    where picked.benefit_id is null or picked.sku_id is null or picked.quantity is null or picked.quantity < 1
      or not exists (
        select 1
        from public.commerce_package_benefits legacy_benefit
        where legacy_benefit.id = picked.benefit_id
          and legacy_benefit.package_id = p_package_id
          and legacy_benefit.variant_rule = 'customer_selected'
          and (legacy_benefit.customer_tier_id is null or legacy_benefit.customer_tier_id = effective_loyalty_tier_id)
      )
      and not exists (
        select 1
        from public.commerce_package_tier_benefits tier_benefit
        where tier_benefit.id = picked.benefit_id
          and tier_benefit.package_id = p_package_id
          and tier_benefit.pricing_tier_id = effective_pricing_tier_id
      )
  ) then
    raise exception 'INVALID_PACKAGE_BENEFIT_SELECTION';
  end if;

  -- Backward-compatible legacy loyalty-tier benefits.
  for benefit in
    select configured.*
    from public.commerce_package_benefits configured
    where configured.package_id = p_package_id
      and configured.variant_rule = 'customer_selected'
      and (configured.customer_tier_id is null or configured.customer_tier_id = effective_loyalty_tier_id)
  loop
    select count(*)::integer, coalesce(sum(picked.quantity), 0)::integer
      into chosen_count, chosen_total
      from jsonb_to_recordset(p_selected_benefits) as picked(benefit_id uuid, sku_id uuid, quantity integer)
      where picked.benefit_id = benefit.id;
    if chosen_count = 0 then raise exception 'PACKAGE_BENEFIT_SELECTION_REQUIRED'; end if;
    if chosen_total <> benefit.quantity then raise exception 'PACKAGE_BENEFIT_QUANTITY'; end if;
    if exists (
      select 1
      from jsonb_to_recordset(p_selected_benefits) as picked(benefit_id uuid, sku_id uuid, quantity integer)
      where picked.benefit_id = benefit.id
        and not exists (
          select 1
          from public.commerce_package_benefit_allowed_skus allowed
          join public.catalog_skus sku on sku.id = allowed.sku_id and sku.is_active = true
          where allowed.benefit_id = benefit.id and allowed.sku_id = picked.sku_id
        )
    ) then
      raise exception 'PACKAGE_BENEFIT_SKU_NOT_ALLOWED';
    end if;

    select id into stock_location_id from public.inventory_locations where code = 'MAIN' and is_active = true limit 1;
    if stock_location_id is null then
      select id into stock_location_id from public.inventory_locations where is_active = true order by created_at limit 1;
    end if;
    if stock_location_id is null then raise exception 'INVENTORY_LOCATION_NOT_CONFIGURED'; end if;

    for chosen in
      select picked.sku_id, picked.quantity, sku.sku, sku.name
      from jsonb_to_recordset(p_selected_benefits) as picked(benefit_id uuid, sku_id uuid, quantity integer)
      join public.catalog_skus sku on sku.id = picked.sku_id
      where picked.benefit_id = benefit.id
    loop
      required_qty := chosen.quantity * p_package_quantity;
      select * into stock_row
      from public.inventory_stock stock
      where stock.location_id = stock_location_id and stock.sku_id = chosen.sku_id
      for update;
      if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < required_qty then
        raise exception 'INSUFFICIENT_STOCK:%', chosen.name;
      end if;
      update public.inventory_stock
        set reserved_quantity = reserved_quantity + required_qty, updated_at = timezone('utc', now())
        where id = stock_row.id;
      insert into public.inventory_movements
        (location_id, sku_id, movement_type, quantity_delta, reason, order_id)
      values
        (stock_location_id, chosen.sku_id, 'reservation', required_qty,
          'Package customer-selected benefit', p_order_id);
      insert into public.commerce_order_items
        (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, package_id, metadata)
      values
        (p_order_id, chosen.sku_id, chosen.sku, chosen.name, required_qty, 0, 'component', p_package_id,
          jsonb_build_object('package_benefit', true, 'variant_rule', 'customer_selected',
            'benefit_id', benefit.id, 'selected_per_package', chosen.quantity));
    end loop;
  end loop;

  -- Current B2B pricing-tier benefits. The customer must select exactly the
  -- configured quantity from the whitelist for every benefit assigned to tier.
  for benefit in
    select configured.*
    from public.commerce_package_tier_benefits configured
    where configured.package_id = p_package_id
      and configured.pricing_tier_id = effective_pricing_tier_id
  loop
    select count(*)::integer, coalesce(sum(picked.quantity), 0)::integer
      into chosen_count, chosen_total
      from jsonb_to_recordset(p_selected_benefits) as picked(benefit_id uuid, sku_id uuid, quantity integer)
      where picked.benefit_id = benefit.id;
    if chosen_count = 0 then raise exception 'PACKAGE_BENEFIT_SELECTION_REQUIRED'; end if;
    if chosen_total <> benefit.quantity then raise exception 'PACKAGE_BENEFIT_QUANTITY'; end if;
    if exists (
      select 1
      from jsonb_to_recordset(p_selected_benefits) as picked(benefit_id uuid, sku_id uuid, quantity integer)
      where picked.benefit_id = benefit.id
        and not exists (
          select 1
          from public.commerce_package_tier_benefit_skus allowed
          join public.catalog_skus sku on sku.id = allowed.sku_id and sku.is_active = true
          where allowed.benefit_id = benefit.id and allowed.sku_id = picked.sku_id
        )
    ) then
      raise exception 'PACKAGE_BENEFIT_SKU_NOT_ALLOWED';
    end if;

    select id into stock_location_id from public.inventory_locations where code = 'MAIN' and is_active = true limit 1;
    if stock_location_id is null then
      select id into stock_location_id from public.inventory_locations where is_active = true order by created_at limit 1;
    end if;
    if stock_location_id is null then raise exception 'INVENTORY_LOCATION_NOT_CONFIGURED'; end if;

    for chosen in
      select picked.sku_id, picked.quantity, sku.sku, sku.name
      from jsonb_to_recordset(p_selected_benefits) as picked(benefit_id uuid, sku_id uuid, quantity integer)
      join public.catalog_skus sku on sku.id = picked.sku_id
      where picked.benefit_id = benefit.id
    loop
      required_qty := chosen.quantity * p_package_quantity;
      select * into stock_row
      from public.inventory_stock stock
      where stock.location_id = stock_location_id and stock.sku_id = chosen.sku_id
      for update;
      if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < required_qty then
        raise exception 'INSUFFICIENT_STOCK:%', chosen.name;
      end if;
      update public.inventory_stock
        set reserved_quantity = reserved_quantity + required_qty, updated_at = timezone('utc', now())
        where id = stock_row.id;
      insert into public.inventory_movements
        (location_id, sku_id, movement_type, quantity_delta, reason, order_id)
      values
        (stock_location_id, chosen.sku_id, 'reservation', required_qty,
          'Package B2B tier benefit', p_order_id);
      insert into public.commerce_order_items
        (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, package_id, metadata)
      values
        (p_order_id, chosen.sku_id, chosen.sku, chosen.name, required_qty, 0, 'component', p_package_id,
          jsonb_build_object('package_benefit', true, 'benefit_type', benefit.benefit_type,
            'pricing_tier_id', benefit.pricing_tier_id, 'benefit_id', benefit.id,
            'selected_per_package', chosen.quantity));
    end loop;
  end loop;
end;
$$;

revoke all on function private.apply_selected_package_benefits(uuid, uuid, integer, jsonb) from public, anon;
