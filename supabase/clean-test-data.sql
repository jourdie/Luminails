-- Luminails E2E test reset
--
-- Run manually against the TEST Supabase project only, after applying all
-- migrations. This intentionally keeps auth.users, admin_memberships, the
-- pricing/customer tier configuration, package types, the default inventory
-- location, store settings, and loyalty settings so the admin workspace stays
-- usable after the reset.
--
-- Public customer_profiles are removed, but auth.users are not. Create fresh
-- test users with new email addresses when the auth project also needs to be
-- tested from a completely new-user state.

begin;

truncate table
  public.promotion_redemptions,
  public.promotion_skus,
  public.promotion_categories,
  public.promotion_pricing_tiers,
  public.promotion_eligible_customers,
  public.promotion_bundle_items,
  public.commerce_promotions,
  public.commerce_package_benefit_allowed_skus,
  public.commerce_package_tier_benefit_skus,
  public.commerce_package_tier_benefits,
  public.commerce_package_benefits,
  public.commerce_package_eligibility,
  public.commerce_package_allowed_skus,
  public.commerce_package_images,
  public.commerce_package_prices,
  public.commerce_package_quantity_prices,
  public.commerce_package_items,
  public.commerce_packages,
  public.inventory_movements,
  public.inventory_stock,
  public.commerce_payment_transactions,
  public.commerce_payment_events,
  public.commerce_notification_outbox,
  public.commerce_shipments,
  public.commerce_order_events,
  public.commerce_order_items,
  public.loyalty_redemptions,
  public.loyalty_ledger,
  public.loyalty_point_lots,
  public.loyalty_accounts,
  public.loyalty_reward_catalog,
  public.customer_addresses,
  public.commerce_orders,
  public.commerce_recommendations,
  public.admin_notifications,
  public.admin_audit_logs,
  public.customer_profiles,
  public.b2b_memberships,
  public.b2b_accounts,
  public.catalog_sku_prices,
  public.catalog_skus,
  public.catalog_products,
  public.catalog_brands,
  public.catalog_categories,
  public.commerce_trusted_logos
restart identity;

do $$
declare
  remaining_rows bigint;
begin
  select sum(row_count)
  into remaining_rows
  from (
    select count(*) as row_count from public.commerce_orders
    union all select count(*) from public.catalog_products
    union all select count(*) from public.catalog_skus
    union all select count(*) from public.commerce_packages
    union all select count(*) from public.commerce_promotions
    union all select count(*) from public.commerce_recommendations
    union all select count(*) from public.customer_profiles
    union all select count(*) from public.b2b_accounts
    union all select count(*) from public.loyalty_accounts
    union all select count(*) from public.admin_audit_logs
    union all select count(*) from public.catalog_categories
    union all select count(*) from public.commerce_trusted_logos
  ) counts;

  if coalesce(remaining_rows, 0) <> 0 then
    raise exception 'E2E reset verification failed: % rows remain in reset scope', remaining_rows;
  end if;
end;
$$;

commit;
