-- The add-on checkout RPC writes item_type = 'add_on'. Keep the database
-- guard aligned with all supported checkout item types.

alter table public.commerce_order_items
  drop constraint if exists commerce_order_items_type_check;

alter table public.commerce_order_items
  add constraint commerce_order_items_type_check
  check (item_type in ('package', 'component', 'add_on', 'loyalty_reward'));
