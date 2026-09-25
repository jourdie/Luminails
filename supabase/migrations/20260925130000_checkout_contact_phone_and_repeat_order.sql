-- Checkout contact phone is intentionally independent from the account profile phone.
-- It is also stored with the order so operations can contact the branch that placed it.

alter table public.commerce_orders
  add column if not exists contact_phone text;

create index if not exists commerce_orders_customer_created_idx
  on public.commerce_orders (customer_id, created_at desc);

drop function if exists public.create_checkout_order_with_contact_phone(
  text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb, jsonb, text
);

create or replace function public.create_checkout_order_with_contact_phone(
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
  p_selected_benefits jsonb default null,
  p_contact_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result jsonb;
  v_order_id uuid;
  normalized_phone text;
begin
  if actor_id is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  normalized_phone := regexp_replace(coalesce(trim(p_contact_phone), ''), '[^0-9]', '', 'g');
  if length(normalized_phone) < 8 or length(normalized_phone) > 15 then
    raise exception 'CONTACT_PHONE_REQUIRED';
  end if;

  result := public.create_checkout_order_with_reward_quantity(
    p_package_slug => p_package_slug,
    p_quantity => p_quantity,
    p_address_id => p_address_id,
    p_customer_notes => p_customer_notes,
    p_promotion_code => p_promotion_code,
    p_shipping_method => p_shipping_method,
    p_shipping_provider => p_shipping_provider,
    p_reward_sku_id => p_reward_sku_id,
    p_reward_points => p_reward_points,
    p_reward_quantity => p_reward_quantity,
    p_idempotency_key => p_idempotency_key,
    p_selected_skus => p_selected_skus,
    p_selected_benefits => p_selected_benefits
  );

  v_order_id := (result->>'order_id')::uuid;
  if v_order_id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  update public.commerce_orders
    set contact_phone = normalized_phone
    where id = v_order_id and customer_id = actor_id;

  update public.commerce_order_items
    set metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'selection_mode', case when p_selected_skus is null then 'fixed' else 'free_pick' end,
        'selected_skus', coalesce(p_selected_skus, '[]'::jsonb)
      )
    where order_id = v_order_id and item_type = 'package';

  return result;
end;
$$;

revoke all on function public.create_checkout_order_with_contact_phone(
  text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb, jsonb, text
) from public, anon;

grant execute on function public.create_checkout_order_with_contact_phone(
  text, integer, uuid, text, text, text, text, uuid, bigint, integer, text, jsonb, jsonb, text
) to authenticated;
