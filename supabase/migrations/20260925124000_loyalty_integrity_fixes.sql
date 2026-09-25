-- Integrity fixes for package rules, loyalty reversals, FIFO lots and admin audit.

create or replace function private.enforce_package_checkout_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  order_row public.commerce_orders%rowtype;
  package_row public.commerce_packages%rowtype;
  profile_tier_id uuid;
begin
  if new.item_type <> 'package' or new.package_id is null then return new; end if;
  select * into order_row from public.commerce_orders where id = new.order_id;
  select * into package_row from public.commerce_packages where id = new.package_id;
  if order_row.id is null or package_row.id is null then raise exception 'PACKAGE_CHECKOUT_CONTEXT_NOT_FOUND'; end if;
  select customer_tier_id into profile_tier_id from public.customer_profiles where id = order_row.customer_id;
  if exists (
    select 1 from public.commerce_package_eligibility rule
    where rule.package_id = package_row.id
      and (
        (rule.customer_id is not null and rule.customer_id <> order_row.customer_id)
        or (rule.customer_tier_id is not null and rule.customer_tier_id <> profile_tier_id)
        or (rule.brand_id is not null and rule.brand_id <> package_row.brand_id)
        or (rule.sku_id is not null and not exists (
          select 1 from public.commerce_package_items member
          where member.package_id = package_row.id and member.sku_id = rule.sku_id
          union all
          select 1 from public.commerce_package_allowed_skus allowed
          where allowed.package_id = package_row.id and allowed.sku_id = rule.sku_id
        ))
        or new.quantity < rule.minimum_quantity
        or coalesce(order_row.subtotal_idr, order_row.total_idr, 0) < rule.minimum_order_value_idr
      )
  ) then raise exception 'PACKAGE_NOT_ELIGIBLE'; end if;
  return new;
end;
$$;

create or replace function public.get_customer_package_eligibility(p_package_ids uuid[])
returns table(package_id uuid, is_eligible boolean)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_tier_id uuid;
begin
  if actor_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select customer_tier_id into actor_tier_id from public.customer_profiles where id = actor_id;
  return query
  select package_row.id,
    not exists (
      select 1 from public.commerce_package_eligibility rule
      where rule.package_id = package_row.id
        and (
          (rule.customer_id is not null and rule.customer_id <> actor_id)
          or (rule.customer_tier_id is not null and rule.customer_tier_id <> actor_tier_id)
          or (rule.brand_id is not null and rule.brand_id <> package_row.brand_id)
          or (rule.sku_id is not null and not exists (
            select 1 from public.commerce_package_items member
            where member.package_id = package_row.id and member.sku_id = rule.sku_id
            union all
            select 1 from public.commerce_package_allowed_skus allowed
            where allowed.package_id = package_row.id and allowed.sku_id = rule.sku_id
          ))
          or package_row.price_idr < rule.minimum_order_value_idr
        )
    )
  from public.commerce_packages package_row
  join public.catalog_brands brand on brand.id = package_row.brand_id
  where package_row.id = any(p_package_ids)
    and package_row.status = 'published'
    and brand.is_published = true;
end;
$$;

create or replace function private.normalize_loyalty_reversal()
returns trigger
language plpgsql
as $$
begin
  -- Order refunds remove earned points; cancelled reward redemptions return spent points.
  if new.entry_type = 'reversal' and new.redemption_id is not null and new.points_delta < 0 then
    new.points_delta := abs(new.points_delta);
  elsif new.entry_type = 'reversal' and new.redemption_id is null and new.points_delta > 0 then
    new.points_delta := -new.points_delta;
  end if;
  return new;
end;
$$;

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
begin
  if new.points_delta > 0 and new.entry_type in ('earn', 'adjustment_plus', 'reversal') then
    select expiry_months into expiry_months from public.loyalty_point_settings where key = 'default';
    insert into public.loyalty_point_lots (customer_id, ledger_id, original_points, remaining_points, expires_at)
    values (new.customer_id, new.id, new.points_delta, new.points_delta, coalesce(new.expires_at, new.created_at + make_interval(months => coalesce(expiry_months, 12))));
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

create or replace function private.validate_loyalty_redemption_total()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare account_points bigint;
begin
  new.points_total := new.points_redeemed * greatest(1, new.quantity);
  select available_points into account_points from public.loyalty_accounts where customer_id = new.customer_id for update;
  if coalesce(account_points, 0) < new.points_total then raise exception 'INSUFFICIENT_POINTS'; end if;
  return new;
end;
$$;

drop trigger if exists loyalty_redemption_total_trigger on public.loyalty_redemptions;
create trigger loyalty_redemption_total_trigger
before insert on public.loyalty_redemptions
for each row execute function private.validate_loyalty_redemption_total();

create or replace function private.handle_loyalty_redemption_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.status not in ('cancelled', 'reversed') and new.status in ('cancelled', 'reversed') then
    if not exists (select 1 from public.loyalty_ledger ledger where ledger.redemption_id = new.id and ledger.entry_type = 'reversal') then
      insert into public.loyalty_ledger (customer_id, order_id, redemption_id, entry_type, points_delta, points_type, description, reference_text)
      values (new.customer_id, new.order_id, new.id, 'reversal', coalesce(new.points_total, new.points_redeemed * greatest(1, new.quantity)), 'free_product', 'Points dikembalikan karena redemption dibatalkan', 'redemption ' || new.id::text);
    end if;
    update public.loyalty_reward_catalog
    set reward_stock = case when reward_stock > 0 then reward_stock + new.quantity else reward_stock end,
        redemption_count = greatest(0, redemption_count - new.quantity),
        updated_at = timezone('utc', now())
    where sku_id = new.sku_id;
  end if;
  return new;
end;
$$;

create or replace function public.expire_loyalty_points(p_as_of timestamptz default timezone('utc', now()))
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare lot record; expired_total integer := 0;
begin
  if auth.uid() is not null and not (public.has_admin_permission('pricing') or public.has_admin_permission('orders')) then
    raise exception 'POINT_EXPIRY_PERMISSION_REQUIRED';
  end if;
  for lot in select * from public.loyalty_point_lots where remaining_points > 0 and expires_at <= p_as_of order by expires_at, earned_at for update loop
    insert into public.loyalty_ledger (customer_id, entry_type, points_delta, points_type, description, reference_text)
    values (lot.customer_id, 'expired', -lot.remaining_points, 'free_product', 'Points expired FIFO', lot.id::text);
    update public.loyalty_point_lots set remaining_points = 0 where id = lot.id;
    expired_total := expired_total + 1;
  end loop;
  return expired_total;
end;
$$;

-- Tier order is determined by spend thresholds; no separate priority input is used.
create or replace function public.calculate_customer_tier(p_customer_id uuid, p_as_of timestamptz default timezone('utc', now()))
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare selected_id uuid; rolling_spend bigint; months integer;
begin
  if auth.uid() is not null and auth.uid() <> p_customer_id and not public.has_admin_permission('pricing') and not public.has_admin_permission('orders') then raise exception 'TIER_PERMISSION_REQUIRED'; end if;
  select coalesce(max(tier.rolling_period_months), 6) into months from public.customer_tiers tier where tier.is_active = true;
  select coalesce(sum(greatest(0, coalesce(order_row.subtotal_idr, order_row.total_idr, 0) - coalesce(order_row.discount_idr, 0))), 0)::bigint into rolling_spend
  from public.commerce_orders order_row
  where order_row.customer_id = p_customer_id and order_row.payment_status in ('paid', 'partially_refunded')
    and order_row.created_at >= p_as_of - make_interval(months => months) and order_row.created_at <= p_as_of;
  select tier.id into selected_id from public.customer_tiers tier
  where tier.is_active = true and tier.minimum_rolling_spend_idr <= rolling_spend
    and (tier.maximum_rolling_spend_idr is null or tier.maximum_rolling_spend_idr >= rolling_spend)
  order by tier.minimum_rolling_spend_idr desc limit 1;
  return selected_id;
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
  elsif order_row.payment_status in ('refunded', 'failed') then
    if exists (select 1 from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn') and not exists (select 1 from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'reversal') then
      insert into public.loyalty_ledger (customer_id, order_id, entry_type, points_delta, points_type, description, reference_text)
      select p_customer_id, p_order_id, 'reversal', -points_delta, 'free_product', 'Reversal points karena order refund/cancel', 'reversal of ' || id::text from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn' limit 1;
    end if;
  end if;
end;
$$;

create or replace function private.write_admin_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare old_json jsonb; new_json jsonb; entity_id uuid;
begin
  if auth.uid() is null or not (public.has_admin_permission('pricing') or public.has_admin_permission('orders') or public.has_admin_permission('packages')) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  old_json := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_json := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  entity_id := nullif(coalesce(new_json->>'id', old_json->>'id'), '')::uuid;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), lower(tg_op), tg_table_name, entity_id, old_json, new_json);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Convert configured package benefits into zero-priced order items and reserve their stock.
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
  if stock_location_id is null then select id into stock_location_id from public.inventory_locations where is_active = true order by created_at limit 1; end if;
  if stock_location_id is null then raise exception 'INVENTORY_LOCATION_NOT_CONFIGURED'; end if;
  for benefit in
    select configured.reward_sku_id, configured.quantity, configured.variant_rule, configured.notes
    from public.commerce_package_benefits configured
    where configured.package_id = new.package_id
      and (configured.customer_tier_id is null or configured.customer_tier_id = effective_tier_id)
  loop
    required_qty := benefit.quantity * new.quantity;
    select sku, name into sku_row from public.catalog_skus where id = benefit.reward_sku_id and is_active = true;
    if sku_row.sku is null then raise exception 'PACKAGE_BENEFIT_SKU_NOT_FOUND'; end if;
    select * into stock_row from public.inventory_stock stock where stock.location_id = stock_location_id and stock.sku_id = benefit.reward_sku_id for update;
    if stock_row.id is null or stock_row.on_hand_quantity - stock_row.reserved_quantity < required_qty then raise exception 'INSUFFICIENT_STOCK:%', sku_row.name; end if;
    update public.inventory_stock set reserved_quantity = reserved_quantity + required_qty, updated_at = timezone('utc', now()) where id = stock_row.id;
    insert into public.inventory_movements (location_id, sku_id, movement_type, quantity_delta, reason, order_id)
    values (stock_location_id, benefit.reward_sku_id, 'reservation', required_qty, 'Package tier benefit: ' || coalesce(benefit.notes, benefit.variant_rule), new.order_id);
    insert into public.commerce_order_items (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type, package_id, metadata)
    values (new.order_id, benefit.reward_sku_id, sku_row.sku, sku_row.name, required_qty, 0, 'component', new.package_id, jsonb_build_object('package_benefit', true, 'variant_rule', benefit.variant_rule, 'notes', benefit.notes));
  end loop;
  return new;
end;
$$;

drop trigger if exists commerce_order_package_benefits_trigger on public.commerce_order_items;
create trigger commerce_order_package_benefits_trigger
after insert on public.commerce_order_items
for each row execute function private.apply_package_benefits_to_order();

drop trigger if exists customer_tiers_admin_audit_trigger on public.customer_tiers;
create trigger customer_tiers_admin_audit_trigger after insert or update or delete on public.customer_tiers for each row execute function private.write_admin_audit_log();
drop trigger if exists loyalty_rewards_admin_audit_trigger on public.loyalty_reward_catalog;
create trigger loyalty_rewards_admin_audit_trigger after insert or update or delete on public.loyalty_reward_catalog for each row execute function private.write_admin_audit_log();
drop trigger if exists package_eligibility_admin_audit_trigger on public.commerce_package_eligibility;
create trigger package_eligibility_admin_audit_trigger after insert or update or delete on public.commerce_package_eligibility for each row execute function private.write_admin_audit_log();
drop trigger if exists package_benefits_admin_audit_trigger on public.commerce_package_benefits;
create trigger package_benefits_admin_audit_trigger after insert or update or delete on public.commerce_package_benefits for each row execute function private.write_admin_audit_log();
drop trigger if exists package_admin_audit_trigger on public.commerce_packages;
create trigger package_admin_audit_trigger after insert or update or delete on public.commerce_packages for each row execute function private.write_admin_audit_log();
drop trigger if exists customer_profile_admin_audit_trigger on public.customer_profiles;
create trigger customer_profile_admin_audit_trigger after update on public.customer_profiles for each row execute function private.write_admin_audit_log();
