-- Keep each fulfillment order within one catalog brand.
-- Points remain customer-global: a balance earned from Brand A may be spent
-- on a later Brand B order. The reward SKU itself must match the package brand.

create or replace function private.validate_single_brand_order_item()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  package_brand_name text;
  sku_brand_name text;
begin
  if new.sku_id is null
     or new.item_type not in ('component', 'add_on', 'loyalty_reward') then
    return new;
  end if;

  select brand.name
    into package_brand_name
    from public.commerce_order_items package_item
    join public.commerce_packages package
      on package.id = package_item.package_id
    join public.catalog_brands brand
      on brand.id = package.brand_id
   where package_item.order_id = new.order_id
     and package_item.item_type = 'package'
   limit 1;

  if package_brand_name is null then
    raise exception 'SINGLE_BRAND_CHECK_NOT_CONFIGURED';
  end if;

  select product.brand
    into sku_brand_name
    from public.catalog_skus sku
    join public.catalog_products product
      on product.id = sku.product_id
   where sku.id = new.sku_id;

  if sku_brand_name is null then
    raise exception 'SINGLE_BRAND_CHECK_NOT_CONFIGURED';
  end if;

  if lower(trim(package_brand_name)) <> lower(trim(sku_brand_name)) then
    raise exception 'SINGLE_BRAND_ORDER:%:%', package_brand_name, sku_brand_name;
  end if;

  return new;
end;
$$;

drop trigger if exists commerce_order_items_single_brand on public.commerce_order_items;
create trigger commerce_order_items_single_brand
before insert or update of order_id, sku_id, item_type, package_id
on public.commerce_order_items
for each row
execute function private.validate_single_brand_order_item();

create index if not exists commerce_order_items_order_type_idx
  on public.commerce_order_items (order_id, item_type);

comment on function private.validate_single_brand_order_item() is
  'Prevents cross-brand package components, paid add-ons, and reward SKUs in one fulfillment order. Loyalty points remain global across orders.';
