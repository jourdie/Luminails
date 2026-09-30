-- Retire B2B tier pricing and package benefits.
-- Keep legacy tables/columns for historical order compatibility, but make the
-- only active customer benefit path: loyalty customer tier -> points -> rewards.

drop trigger if exists commerce_orders_refresh_b2b_tier on public.commerce_orders;

create or replace function public.recalculate_b2b_tier(p_account_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  paid_total bigint;
  paid_count integer;
  standard_tier uuid;
begin
  select id into standard_tier
  from public.pricing_tiers
  where code = 'STANDARD' and is_active = true
  limit 1;

  select coalesce(sum(total_idr), 0), count(*)::integer
    into paid_total, paid_count
  from public.commerce_orders
  where account_id = p_account_id
    and payment_status = 'paid';

  update public.b2b_accounts
  set pricing_tier_id = standard_tier,
      lifetime_paid_amount_idr = paid_total,
      paid_order_count = paid_count,
      updated_at = timezone('utc', now())
  where id = p_account_id;

  update public.customer_profiles profile
  set pricing_tier_id = standard_tier,
      lifetime_paid_amount_idr = paid_total,
      paid_order_count = paid_count,
      updated_at = timezone('utc', now())
  where exists (
    select 1
    from public.b2b_memberships membership
    where membership.account_id = p_account_id
      and membership.user_id = profile.id
  );
end;
$$;

create or replace function public.force_standard_pricing_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  standard_tier uuid;
begin
  select id into standard_tier
  from public.pricing_tiers
  where code = 'STANDARD' and is_active = true
  limit 1;
  if standard_tier is not null then
    new.pricing_tier_id := standard_tier;
  end if;
  return new;
end;
$$;

drop trigger if exists customer_profiles_force_standard_pricing_tier on public.customer_profiles;
create trigger customer_profiles_force_standard_pricing_tier
before insert or update of pricing_tier_id on public.customer_profiles
for each row execute function public.force_standard_pricing_tier();

do $$
begin
  if to_regclass('public.b2b_accounts') is not null then
    execute 'drop trigger if exists b2b_accounts_force_standard_pricing_tier on public.b2b_accounts';
    execute 'create trigger b2b_accounts_force_standard_pricing_tier before insert or update of pricing_tier_id on public.b2b_accounts for each row execute function public.force_standard_pricing_tier()';
  end if;
  if to_regclass('public.loyalty_accounts') is not null then
    execute 'drop trigger if exists loyalty_accounts_force_standard_pricing_tier on public.loyalty_accounts';
    execute 'create trigger loyalty_accounts_force_standard_pricing_tier before insert or update of pricing_tier_id on public.loyalty_accounts for each row execute function public.force_standard_pricing_tier()';
  end if;
end;
$$;

update public.customer_profiles
set pricing_tier_id = (select id from public.pricing_tiers where code = 'STANDARD' and is_active = true limit 1)
where exists (select 1 from public.pricing_tiers where code = 'STANDARD' and is_active = true);

update public.b2b_accounts
set pricing_tier_id = (select id from public.pricing_tiers where code = 'STANDARD' and is_active = true limit 1)
where exists (select 1 from public.pricing_tiers where code = 'STANDARD' and is_active = true);

update public.loyalty_accounts
set pricing_tier_id = (select id from public.pricing_tiers where code = 'STANDARD' and is_active = true limit 1)
where exists (select 1 from public.pricing_tiers where code = 'STANDARD' and is_active = true);

create or replace function public.standardize_package_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select price_idr into new.unit_price_idr
  from public.commerce_packages
  where id = new.package_id;
  return new;
end;
$$;

drop trigger if exists commerce_package_prices_standardize on public.commerce_package_prices;
create trigger commerce_package_prices_standardize
before insert or update of package_id, unit_price_idr on public.commerce_package_prices
for each row execute function public.standardize_package_price();

update public.commerce_package_prices prices
set unit_price_idr = packages.price_idr
from public.commerce_packages packages
where packages.id = prices.package_id;

create or replace function public.sync_package_price_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.commerce_package_prices
  set unit_price_idr = new.price_idr
  where package_id = new.id;
  return new;
end;
$$;

drop trigger if exists commerce_packages_sync_standard_price on public.commerce_packages;
create trigger commerce_packages_sync_standard_price
after update of price_idr on public.commerce_packages
for each row execute function public.sync_package_price_rows();

create or replace function public.standardize_catalog_sku_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select public_reference_price_idr into new.unit_price_idr
  from public.catalog_skus
  where id = new.sku_id;
  return new;
end;
$$;

drop trigger if exists catalog_sku_prices_standardize on public.catalog_sku_prices;
create trigger catalog_sku_prices_standardize
before insert or update of sku_id, unit_price_idr on public.catalog_sku_prices
for each row execute function public.standardize_catalog_sku_price();

update public.catalog_sku_prices prices
set unit_price_idr = skus.public_reference_price_idr
from public.catalog_skus skus
where skus.id = prices.sku_id
  and skus.public_reference_price_idr is not null;

-- No free item is granted because of a legacy B2B tier. The function remains
-- available for old RPC signatures and simply validates the package quantity.
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
begin
  if p_package_quantity < 1 then
    raise exception 'INVALID_PACKAGE_QUANTITY';
  end if;
end;
$$;