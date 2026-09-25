-- Server-side guards for package eligibility and reward redemption.
-- These run inside the checkout transaction, so UI changes cannot bypass them.

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
  if new.item_type <> 'package' or new.package_id is null then
    return new;
  end if;

  select * into order_row from public.commerce_orders where id = new.order_id;
  select * into package_row from public.commerce_packages where id = new.package_id;
  if order_row.id is null or package_row.id is null then
    raise exception 'PACKAGE_CHECKOUT_CONTEXT_NOT_FOUND';
  end if;

  select customer_tier_id into profile_tier_id from public.customer_profiles where id = order_row.customer_id;
  if exists (select 1 from public.commerce_package_eligibility rule where rule.package_id = package_row.id)
     and not exists (
       select 1
       from public.commerce_package_eligibility rule
       where rule.package_id = package_row.id
         and (rule.customer_id is null or rule.customer_id = order_row.customer_id)
         and (rule.customer_tier_id is null or rule.customer_tier_id = profile_tier_id)
         and (rule.brand_id is null or rule.brand_id = package_row.brand_id)
         and (rule.sku_id is null or exists (
           select 1 from public.commerce_package_items member
           where member.package_id = package_row.id and member.sku_id = rule.sku_id
         ) or exists (
           select 1 from public.commerce_package_allowed_skus allowed
           where allowed.package_id = package_row.id and allowed.sku_id = rule.sku_id
         ))
         and new.quantity >= rule.minimum_quantity
         and coalesce(order_row.subtotal_idr, order_row.total_idr, 0) >= rule.minimum_order_value_idr
     ) then
    raise exception 'PACKAGE_NOT_ELIGIBLE';
  end if;
  return new;
end;
$$;

drop trigger if exists commerce_order_package_eligibility_trigger on public.commerce_order_items;
create trigger commerce_order_package_eligibility_trigger
before insert on public.commerce_order_items
for each row execute function private.enforce_package_checkout_eligibility();

create or replace function private.enforce_package_reward_redemption()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  package_allows_reward boolean;
begin
  select package.allow_reward_redemption into package_allows_reward
  from public.commerce_order_items item
  join public.commerce_packages package on package.id = item.package_id
  where item.order_id = new.order_id and item.item_type = 'package'
  limit 1;
  if package_allows_reward is false then
    raise exception 'REWARD_NOT_ALLOWED_FOR_PACKAGE';
  end if;
  return new;
end;
$$;

drop trigger if exists loyalty_redemption_package_guard_trigger on public.loyalty_redemptions;
create trigger loyalty_redemption_package_guard_trigger
before insert on public.loyalty_redemptions
for each row execute function private.enforce_package_reward_redemption();

-- A reversal always removes points. This also protects the existing cancellation RPC,
-- which may send a positive value when returning redeemed points.
create or replace function private.normalize_loyalty_reversal()
returns trigger
language plpgsql
as $$
begin
  if new.entry_type = 'reversal' and new.points_delta > 0 then
    new.points_delta := -new.points_delta;
  end if;
  return new;
end;
$$;

drop trigger if exists loyalty_reversal_sign_trigger on public.loyalty_ledger;
create trigger loyalty_reversal_sign_trigger
before insert on public.loyalty_ledger
for each row execute function private.normalize_loyalty_reversal();
