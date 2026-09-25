-- Close the customer-facing eligibility and redemption invariants at the database boundary.

drop policy if exists "customers can read package benefits for own tier" on public.commerce_package_benefits;
create policy "customers can read package benefits for own tier"
  on public.commerce_package_benefits for select
  to authenticated
  using (
    customer_tier_id is null
    or customer_tier_id = (select customer_tier_id from public.customer_profiles where id = (select auth.uid()))
  );

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
    not exists (select 1 from public.commerce_package_eligibility rule where rule.package_id = package_row.id)
    or exists (
      select 1
      from public.commerce_package_eligibility rule
      where rule.package_id = package_row.id
        and (rule.customer_id is null or rule.customer_id = actor_id)
        and (rule.customer_tier_id is null or rule.customer_tier_id = actor_tier_id)
        and (rule.brand_id is null or rule.brand_id = package_row.brand_id)
        and (rule.sku_id is null or exists (select 1 from public.commerce_package_items member where member.package_id = package_row.id and member.sku_id = rule.sku_id) or exists (select 1 from public.commerce_package_allowed_skus allowed where allowed.package_id = package_row.id and allowed.sku_id = rule.sku_id))
        and package_row.price_idr >= rule.minimum_order_value_idr
    )
  from public.commerce_packages package_row
  join public.catalog_brands brand on brand.id = package_row.brand_id
  where package_row.id = any(p_package_ids)
    and package_row.status = 'published'
    and brand.is_published = true;
end;
$$;

revoke all on function public.get_customer_package_eligibility(uuid[]) from public, anon;
grant execute on function public.get_customer_package_eligibility(uuid[]) to authenticated;

create or replace function private.validate_loyalty_redemption_limits()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  reward_limit integer;
begin
  select max_redemption_quantity into reward_limit
  from public.loyalty_reward_catalog
  where sku_id = new.sku_id and is_active = true;
  if reward_limit is null then raise exception 'REWARD_NOT_AVAILABLE'; end if;
  if new.quantity > reward_limit then raise exception 'REWARD_MAX_QUANTITY_REACHED'; end if;
  return new;
end;
$$;

drop trigger if exists loyalty_redemption_limits_trigger on public.loyalty_redemptions;
create trigger loyalty_redemption_limits_trigger
before insert on public.loyalty_redemptions
for each row execute function private.validate_loyalty_redemption_limits();

create or replace function private.handle_loyalty_redemption_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.status not in ('cancelled', 'reversed') and new.status in ('cancelled', 'reversed') then
    if not exists (
      select 1 from public.loyalty_ledger ledger
      where ledger.redemption_id = new.id and ledger.entry_type = 'reversal'
    ) then
      insert into public.loyalty_ledger (customer_id, order_id, redemption_id, entry_type, points_delta, points_type, description, reference_text)
      values (new.customer_id, new.order_id, new.id, 'reversal', -coalesce(new.points_total, new.points_redeemed * greatest(1, new.quantity)), 'free_product', 'Points dikembalikan karena redemption dibatalkan', 'redemption ' || new.id::text);
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

drop trigger if exists loyalty_redemption_status_change_trigger on public.loyalty_redemptions;
create trigger loyalty_redemption_status_change_trigger
after update of status on public.loyalty_redemptions
for each row execute function private.handle_loyalty_redemption_status_change();

-- Public helper functions are callable only for the caller's own customer record;
-- internal order triggers with a null auth.uid() remain supported.
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
  order by tier.priority desc, tier.minimum_rolling_spend_idr desc limit 1;
  return selected_id;
end;
$$;

create or replace function public.recalculate_customer_tier(p_customer_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare auto_id uuid; effective_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_customer_id and not public.has_admin_permission('pricing') and not public.has_admin_permission('orders') then raise exception 'TIER_PERMISSION_REQUIRED'; end if;
  auto_id := public.calculate_customer_tier(p_customer_id);
  select case when manual_tier_override_enabled and manual_tier_id is not null and (manual_tier_expires_at is null or manual_tier_expires_at > timezone('utc', now())) then manual_tier_id else auto_id end into effective_id from public.customer_profiles where id = p_customer_id;
  update public.customer_profiles set auto_customer_tier_id = auto_id, customer_tier_id = effective_id, updated_at = timezone('utc', now()) where id = p_customer_id;
  update public.loyalty_accounts set customer_tier_id = effective_id, tier_code = coalesce((select code from public.customer_tiers where id = effective_id), tier_code), updated_at = timezone('utc', now()) where customer_id = p_customer_id;
  return effective_id;
end;
$$;

revoke all on function public.calculate_customer_tier(uuid, timestamptz) from public, anon;
revoke all on function public.recalculate_customer_tier(uuid) from public, anon;
grant execute on function public.calculate_customer_tier(uuid, timestamptz) to authenticated;
grant execute on function public.recalculate_customer_tier(uuid) to authenticated;
