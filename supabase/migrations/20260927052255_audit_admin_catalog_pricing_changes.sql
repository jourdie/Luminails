-- Extend the existing audit trail to every admin-managed catalog and pricing
-- record. Customer-owned changes are ignored by the trigger permission gate.

create or replace function private.write_admin_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  old_json jsonb;
  new_json jsonb;
  entity_id uuid;
begin
  if auth.uid() is null or not (
    public.has_admin_permission('catalog')
    or public.has_admin_permission('orders')
    or public.has_admin_permission('pricing')
    or public.has_admin_permission('promotions')
    or public.has_admin_permission('packages')
    or public.has_admin_permission('inventory')
    or public.has_admin_permission('settings')
  ) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  old_json := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_json := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  entity_id := nullif(coalesce(
    new_json->>'id', old_json->>'id',
    new_json->>'package_id', old_json->>'package_id',
    new_json->>'promotion_id', old_json->>'promotion_id',
    new_json->>'benefit_id', old_json->>'benefit_id',
    new_json->>'sku_id', old_json->>'sku_id',
    new_json->>'user_id', old_json->>'user_id'
  ), '')::uuid;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), lower(tg_op), tg_table_name, entity_id, old_json, new_json);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Existing trigger names are dropped first so this migration is safe to rerun
-- during local development and does not create duplicate audit events.
drop trigger if exists catalog_brands_admin_audit_trigger on public.catalog_brands;
create trigger catalog_brands_admin_audit_trigger after insert or update or delete on public.catalog_brands for each row execute function private.write_admin_audit_log();
drop trigger if exists catalog_products_admin_audit_trigger on public.catalog_products;
create trigger catalog_products_admin_audit_trigger after insert or update or delete on public.catalog_products for each row execute function private.write_admin_audit_log();
drop trigger if exists catalog_skus_admin_audit_trigger on public.catalog_skus;
create trigger catalog_skus_admin_audit_trigger after insert or update or delete on public.catalog_skus for each row execute function private.write_admin_audit_log();
drop trigger if exists catalog_sku_prices_admin_audit_trigger on public.catalog_sku_prices;
create trigger catalog_sku_prices_admin_audit_trigger after insert or update or delete on public.catalog_sku_prices for each row execute function private.write_admin_audit_log();
drop trigger if exists pricing_tiers_admin_audit_trigger on public.pricing_tiers;
create trigger pricing_tiers_admin_audit_trigger after insert or update or delete on public.pricing_tiers for each row execute function private.write_admin_audit_log();
drop trigger if exists package_prices_admin_audit_trigger on public.commerce_package_prices;
create trigger package_prices_admin_audit_trigger after insert or update or delete on public.commerce_package_prices for each row execute function private.write_admin_audit_log();
drop trigger if exists package_types_admin_audit_trigger on public.commerce_package_types;
create trigger package_types_admin_audit_trigger after insert or update or delete on public.commerce_package_types for each row execute function private.write_admin_audit_log();
drop trigger if exists package_items_admin_audit_trigger on public.commerce_package_items;
create trigger package_items_admin_audit_trigger after insert or update or delete on public.commerce_package_items for each row execute function private.write_admin_audit_log();
drop trigger if exists package_allowed_skus_admin_audit_trigger on public.commerce_package_allowed_skus;
create trigger package_allowed_skus_admin_audit_trigger after insert or update or delete on public.commerce_package_allowed_skus for each row execute function private.write_admin_audit_log();
drop trigger if exists package_images_admin_audit_trigger on public.commerce_package_images;
create trigger package_images_admin_audit_trigger after insert or update or delete on public.commerce_package_images for each row execute function private.write_admin_audit_log();
drop trigger if exists package_tier_benefits_admin_audit_trigger on public.commerce_package_tier_benefits;
create trigger package_tier_benefits_admin_audit_trigger after insert or update or delete on public.commerce_package_tier_benefits for each row execute function private.write_admin_audit_log();
drop trigger if exists package_tier_benefit_skus_admin_audit_trigger on public.commerce_package_tier_benefit_skus;
create trigger package_tier_benefit_skus_admin_audit_trigger after insert or update or delete on public.commerce_package_tier_benefit_skus for each row execute function private.write_admin_audit_log();
drop trigger if exists promotion_admin_audit_trigger on public.commerce_promotions;
create trigger promotion_admin_audit_trigger after insert or update or delete on public.commerce_promotions for each row execute function private.write_admin_audit_log();
drop trigger if exists promotion_skus_admin_audit_trigger on public.promotion_skus;
create trigger promotion_skus_admin_audit_trigger after insert or update or delete on public.promotion_skus for each row execute function private.write_admin_audit_log();
drop trigger if exists promotion_categories_admin_audit_trigger on public.promotion_categories;
create trigger promotion_categories_admin_audit_trigger after insert or update or delete on public.promotion_categories for each row execute function private.write_admin_audit_log();
drop trigger if exists promotion_tiers_admin_audit_trigger on public.promotion_pricing_tiers;
create trigger promotion_tiers_admin_audit_trigger after insert or update or delete on public.promotion_pricing_tiers for each row execute function private.write_admin_audit_log();
drop trigger if exists promotion_customers_admin_audit_trigger on public.promotion_eligible_customers;
create trigger promotion_customers_admin_audit_trigger after insert or update or delete on public.promotion_eligible_customers for each row execute function private.write_admin_audit_log();
drop trigger if exists promotion_bundle_items_admin_audit_trigger on public.promotion_bundle_items;
create trigger promotion_bundle_items_admin_audit_trigger after insert or update or delete on public.promotion_bundle_items for each row execute function private.write_admin_audit_log();
drop trigger if exists inventory_locations_admin_audit_trigger on public.inventory_locations;
create trigger inventory_locations_admin_audit_trigger after insert or update or delete on public.inventory_locations for each row execute function private.write_admin_audit_log();
drop trigger if exists inventory_stock_admin_audit_trigger on public.inventory_stock;
create trigger inventory_stock_admin_audit_trigger after insert or update or delete on public.inventory_stock for each row execute function private.write_admin_audit_log();
drop trigger if exists store_settings_admin_audit_trigger on public.commerce_store_settings;
create trigger store_settings_admin_audit_trigger after insert or update or delete on public.commerce_store_settings for each row execute function private.write_admin_audit_log();
drop trigger if exists admin_memberships_audit_trigger on public.admin_memberships;
create trigger admin_memberships_audit_trigger after insert or update or delete on public.admin_memberships for each row execute function private.write_admin_audit_log();
