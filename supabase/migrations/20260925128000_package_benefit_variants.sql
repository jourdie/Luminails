-- Customer-selected package benefits.
-- A package benefit remains a package component; this table defines
-- the SKU variants that a customer may choose.

create table if not exists public.commerce_package_benefit_allowed_skus (
  benefit_id uuid not null references public.commerce_package_benefits(id) on delete cascade,
  sku_id uuid not null references public.catalog_skus(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (benefit_id, sku_id)
);

create index if not exists package_benefit_allowed_skus_lookup_idx
  on public.commerce_package_benefit_allowed_skus (benefit_id, sort_order);

alter table public.commerce_package_benefit_allowed_skus enable row level security;
revoke all on public.commerce_package_benefit_allowed_skus from anon, authenticated;
grant select on public.commerce_package_benefit_allowed_skus to authenticated;
grant insert, update, delete on public.commerce_package_benefit_allowed_skus to authenticated;
-- policies follow
-- customers read variants
drop policy if exists customers_read_package_benefit_variants
  on public.commerce_package_benefit_allowed_skus;
create policy customers_read_package_benefit_variants
  on public.commerce_package_benefit_allowed_skus for select
  to authenticated
  using (
    exists (
      select 1 from public.commerce_package_benefits benefit
      join public.commerce_packages package on package.id = benefit.package_id
      join public.catalog_brands brand on brand.id = package.brand_id
      join public.customer_profiles profile on profile.id = (select auth.uid())
        and (benefit.customer_tier_id is null or benefit.customer_tier_id = profile.customer_tier_id)
      where benefit.id = commerce_package_benefit_allowed_skus.benefit_id
        and package.status = 'published'
        and brand.is_published = true
    )
    or public.has_admin_permission('packages')
  );

drop policy if exists admins_manage_package_benefit_variants
  on public.commerce_package_benefit_allowed_skus;
create policy admins_manage_package_benefit_variants
  on public.commerce_package_benefit_allowed_skus for all
  to authenticated
  using (public.has_admin_permission('packages'))
  with check (public.has_admin_permission('packages'));

-- Automatic package benefits are only the admin-selected rows.
-- Customer-selected rows are inserted after the caller's choices are validated.
create or replace function private.apply_package_benefits_to_order()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  order_customer_id uuid;
  effective_tier_id uuid;
  stock_location_id uuid;
  benefit record;
  sku_row record;
  stock_row public.inventory_stock%rowtype;
  required_qty integer;
begin
  if new.item_type <> 'package' or new.package_id is null then return new; end if;
  select customer_id into order_customer_id from public.commerce_orders where id = new.order_id;
  select customer_tier_id into effective_tier_id from public.customer_profiles where id = order_customer_id;
  select id into stock_location_id from public.inventory_locations where code = 'MAIN' and is_active = true limit 1;
  if stock_location_id is null then
    select id into stock_location_id from public.inventory_locations where is_active = true order by created_at limit 1;
  end if;
  if stock_location_id is null then raise exception 'INVENTORY_LOCATION_NOT_CONFIGURED'; end if;

  for benefit in
    select configured.reward_sku_id, configured.quantity, configured.notes, configured.variant_rule
    from public.commerce_package_benefits configured
    where configured.package_id = new.package_id
      and configured.variant_rule = 'admin_selected'
      and (configured.customer_tier_id is null or configured.customer_tier_id = effective_tier_id)
  loop
    required_qty := benefit.quantity * new.quantity;
    select sku, name into sku_row from public.catalog_skus
      where id = benefit.reward_sku_id and is_active = true;
    if sku_row.sku is null then raise exception 'PACKAGE_BENEFIT_SKU_NOT_FOUND'; end if;
    select * into stock_row from public.inventory_stock stock
      where stock.location_id = stock_location_id and stock.sku_id = benefit.reward_sku_id for update;
    if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < required_qty then
      raise exception 'INSUFFICIENT_STOCK:%', sku_row.name;
    end if;
    update public.inventory_stock
      set reserved_quantity = reserved_quantity + required_qty, updated_at = timezone('utc', now())
      where id = stock_row.id;
    insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id)
      values (stock_location_id, benefit.reward_sku_id, 'reservation', required_qty,
        'Package admin-selected benefit: ' || coalesce(benefit.notes, 'benefit'), new.order_id);
    insert into public.commerce_order_items
      (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, package_id, metadata)
      values (new.order_id, benefit.reward_sku_id, sku_row.sku, sku_row.name, required_qty, 0, 'component',
        new.package_id, jsonb_build_object('package_benefit', true, 'variant_rule', benefit.variant_rule, 'notes', benefit.notes));
  end loop;
  return new;
end;
$$;

drop function if exists public.create_checkout_order_with_reward_quantity(
  text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb
);

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
  p_selected_skus jsonb default null,
  p_selected_benefits jsonb default null
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
  package_id_value uuid;
  redemption_id uuid;
  reward_row public.loyalty_reward_catalog%rowtype;
  reward_tier public.customer_tiers%rowtype;
  customer_tier public.customer_tiers%rowtype;
  account_row public.loyalty_accounts%rowtype;
  stock_location_id uuid;
  stock_row public.inventory_stock%rowtype;
  reward_item record;
  points_total bigint;
  order_subtotal bigint;
begin
  if actor_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'INVALID_QUANTITY'; end if;
  if p_reward_quantity is null or p_reward_quantity < 1 or p_reward_quantity > 100 then
    raise exception 'INVALID_REWARD_QUANTITY';
  end if;

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
  order_subtotal := coalesce((result->>'subtotal_idr')::bigint, 0);

  select item.package_id into package_id_value
    from public.commerce_order_items item
    where item.order_id = order_id and item.item_type = 'package'
    limit 1;
  if package_id_value is null then raise exception 'PACKAGE_CHECKOUT_CONTEXT_NOT_FOUND'; end if;
  perform private.apply_selected_package_benefits(order_id, package_id_value, p_quantity, p_selected_benefits);
  update public.commerce_packages
    set usage_count = usage_count + 1, updated_at = timezone('utc', now())
    where id = package_id_value;

  if p_reward_sku_id is null and p_reward_points = 0 then return result; end if;
  if p_reward_sku_id is null or p_reward_points <= 0 then raise exception 'INVALID_REWARD'; end if;

  select * into reward_row
    from public.loyalty_reward_catalog
    where sku_id = p_reward_sku_id and is_active = true
    for update;
  if reward_row.id is null or reward_row.points_cost <> p_reward_points then raise exception 'INVALID_REWARD'; end if;
  if reward_row.starts_at is not null and reward_row.starts_at > timezone('utc', now()) then raise exception 'REWARD_NOT_STARTED'; end if;
  if reward_row.ends_at is not null and reward_row.ends_at <= timezone('utc', now()) then raise exception 'REWARD_EXPIRED'; end if;
  if order_subtotal < reward_row.minimum_order_value_idr then raise exception 'REWARD_MINIMUM_ORDER_NOT_REACHED'; end if;
  if reward_row.reward_stock > 0 and reward_row.reward_stock < p_reward_quantity then raise exception 'REWARD_OUT_OF_STOCK'; end if;
  if p_reward_quantity > reward_row.max_redemption_quantity then raise exception 'REWARD_MAX_QUANTITY_REACHED'; end if;

  select tier.* into customer_tier
    from public.customer_tiers tier
    join public.customer_profiles profile on profile.customer_tier_id = tier.id
    where profile.id = actor_id;
  if reward_row.minimum_customer_tier_id is not null then
    select * into reward_tier from public.customer_tiers where id = reward_row.minimum_customer_tier_id;
    if reward_tier.id is null or customer_tier.id is null
       or customer_tier.minimum_rolling_spend_idr < reward_tier.minimum_rolling_spend_idr then
      raise exception 'REWARD_TIER_NOT_ELIGIBLE';
    end if;
  end if;

  points_total := p_reward_points * p_reward_quantity;
  select * into account_row from public.loyalty_accounts where customer_id = actor_id for update;
  if account_row.customer_id is null or account_row.available_points < points_total then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  select id into stock_location_id from public.inventory_locations
    where code = 'MAIN' and is_active = true limit 1;
  if stock_location_id is null then
    select id into stock_location_id from public.inventory_locations
      where is_active = true order by created_at limit 1;
  end if;
  if stock_location_id is null then raise exception 'INVENTORY_LOCATION_NOT_CONFIGURED'; end if;
  select sku, name into reward_item from public.catalog_skus
    where id = p_reward_sku_id and is_active = true;
  if reward_item.sku is null then raise exception 'REWARD_NOT_AVAILABLE'; end if;
  select * into stock_row from public.inventory_stock stock
    where stock.location_id = stock_location_id and stock.sku_id = p_reward_sku_id for update;
  if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < p_reward_quantity then
    raise exception 'INSUFFICIENT_REWARD_STOCK';
  end if;
  update public.inventory_stock
    set reserved_quantity = reserved_quantity + p_reward_quantity, updated_at = timezone('utc', now())
    where id = stock_row.id;
  insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id)
    values (stock_location_id, p_reward_sku_id, 'reservation', p_reward_quantity,
      'Luminails Points reward reservation', order_id);
  insert into public.commerce_order_items
    (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, metadata)
    values (order_id, p_reward_sku_id, reward_item.sku, reward_item.name, p_reward_quantity, 0,
      'loyalty_reward', jsonb_build_object('points_redeemed', p_reward_points, 'reward_quantity', p_reward_quantity));
  insert into public.loyalty_redemptions
    (customer_id, order_id, sku_id, points_redeemed, reward_points_cost, quantity, status, applied_at)
    values (actor_id, order_id, p_reward_sku_id, p_reward_points, p_reward_points, p_reward_quantity,
      'applied', timezone('utc', now()))
    returning id into redemption_id;
  insert into public.loyalty_ledger
    (customer_id, order_id, redemption_id, entry_type, points_delta, points_type, description, reference_text)
    values (actor_id, order_id, redemption_id, 'redeem', -points_total, 'free_product',
      'Points redeemed for free product', 'quantity ' || p_reward_quantity::text);
  update public.loyalty_reward_catalog
    set reward_stock = case when reward_stock > 0 then reward_stock - p_reward_quantity else reward_stock end,
        redemption_count = redemption_count + p_reward_quantity,
        updated_at = timezone('utc', now())
    where id = reward_row.id;
  update public.loyalty_accounts set last_redemption_at = timezone('utc', now()) where customer_id = actor_id;
  return result || jsonb_build_object('points_redeemed', points_total, 'reward_quantity', p_reward_quantity);
end;
$$;

revoke all on function public.create_checkout_order_with_reward_quantity(
  text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb, jsonb
) from public, anon;
grant execute on function public.create_checkout_order_with_reward_quantity(
  text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb, jsonb
) to authenticated;

drop trigger if exists commerce_order_package_benefits_trigger on public.commerce_order_items;
create trigger commerce_order_package_benefits_trigger
after insert on public.commerce_order_items
for each row execute function private.apply_package_benefits_to_order();

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
  effective_tier_id uuid;
  stock_location_id uuid;
  benefit record;
  chosen record;
  chosen_total integer;
  chosen_count integer;
  stock_row public.inventory_stock%rowtype;
  required_qty integer;
begin
  if p_selected_benefits is null then p_selected_benefits := '[]'::jsonb; end if;
  if jsonb_typeof(p_selected_benefits) <> 'array' then
    raise exception 'INVALID_PACKAGE_BENEFIT_SELECTION';
  end if;
  select customer_id into customer_id_value from public.commerce_orders where id = p_order_id;
  select customer_tier_id into effective_tier_id from public.customer_profiles where id = customer_id_value;

  if exists (
    select 1
    from jsonb_to_recordset(p_selected_benefits) as picked(benefit_id uuid, sku_id uuid, quantity integer)
    where picked.benefit_id is null or picked.sku_id is null or picked.quantity is null or picked.quantity < 1
      or not exists (
        select 1 from public.commerce_package_benefits benefit
        where benefit.id = picked.benefit_id
          and benefit.package_id = p_package_id
          and benefit.variant_rule = 'customer_selected'
          and (benefit.customer_tier_id is null or benefit.customer_tier_id = effective_tier_id)
      )
  ) then
    raise exception 'INVALID_PACKAGE_BENEFIT_SELECTION';
  end if;

  for benefit in
    select configured.*
    from public.commerce_package_benefits configured
    where configured.package_id = p_package_id
      and configured.variant_rule = 'customer_selected'
      and (configured.customer_tier_id is null or configured.customer_tier_id = effective_tier_id)
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
          select 1 from public.commerce_package_benefit_allowed_skus allowed
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
      select * into stock_row from public.inventory_stock stock
        where stock.location_id = stock_location_id and stock.sku_id = chosen.sku_id for update;
      if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < required_qty then
        raise exception 'INSUFFICIENT_STOCK:%', chosen.name;
      end if;
      update public.inventory_stock
        set reserved_quantity = reserved_quantity + required_qty, updated_at = timezone('utc', now())
        where id = stock_row.id;
      insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id)
        values (stock_location_id, chosen.sku_id, 'reservation', required_qty,
          'Package customer-selected benefit', p_order_id);
      insert into public.commerce_order_items
        (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, package_id, metadata)
        values (p_order_id, chosen.sku_id, chosen.sku, chosen.name, required_qty, 0, 'component', p_package_id,
          jsonb_build_object('package_benefit', true, 'variant_rule', 'customer_selected',
            'benefit_id', benefit.id, 'selected_per_package', chosen.quantity));
    end loop;
  end loop;
end;
$$;
