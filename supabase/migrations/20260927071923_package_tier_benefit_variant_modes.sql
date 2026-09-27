-- A B2B tier benefit can either be fixed by admin or selected by the customer.
-- Existing rows remain customer-selected for backwards compatibility.
alter table public.commerce_package_tier_benefits
  add column if not exists variant_rule text not null default 'customer_selected';

alter table public.commerce_package_tier_benefits
  add column if not exists fixed_sku_id uuid references public.catalog_skus(id) on delete restrict;

alter table public.commerce_package_tier_benefits
  drop constraint if exists commerce_package_tier_benefits_variant_rule_check;

alter table public.commerce_package_tier_benefits
  add constraint commerce_package_tier_benefits_variant_rule_check
  check (variant_rule in ('admin_selected', 'customer_selected'));

alter table public.commerce_package_tier_benefits
  drop constraint if exists commerce_package_tier_benefits_fixed_sku_check;

alter table public.commerce_package_tier_benefits
  add constraint commerce_package_tier_benefits_fixed_sku_check
  check (variant_rule = 'customer_selected' or fixed_sku_id is not null);

-- The existing implementation already validates and reserves customer-selected
-- benefits. Keep it as the internal implementation and wrap it with a small
-- normalizer that supplies the fixed admin choices automatically.
do $$
begin
  if to_regprocedure('private.apply_selected_package_benefits(uuid,uuid,integer,jsonb)') is not null
     and to_regprocedure('private.apply_selected_package_benefits_customer_only(uuid,uuid,integer,jsonb)') is null then
    alter function private.apply_selected_package_benefits(uuid, uuid, integer, jsonb)
      rename to apply_selected_package_benefits_customer_only;
  end if;
end;
$$;

-- Make fixed choices pass through the existing whitelist validator while
-- keeping them hidden from the customer-facing picker.
insert into public.commerce_package_tier_benefit_skus (benefit_id, sku_id, sort_order)
select id, fixed_sku_id, 0
from public.commerce_package_tier_benefits
where variant_rule = 'admin_selected'
  and fixed_sku_id is not null
on conflict (benefit_id, sku_id) do nothing;

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
  expanded_selection jsonb := coalesce(p_selected_benefits, '[]'::jsonb);
  benefit record;
begin
  if jsonb_typeof(expanded_selection) <> 'array' then
    raise exception 'INVALID_PACKAGE_BENEFIT_SELECTION';
  end if;

  for benefit in
    select id, quantity, fixed_sku_id
    from public.commerce_package_tier_benefits
    where package_id = p_package_id
      and variant_rule = 'admin_selected'
  loop
    if benefit.fixed_sku_id is null then
      raise exception 'PACKAGE_BENEFIT_SELECTION_REQUIRED';
    end if;
    if exists (
      select 1
      from jsonb_to_recordset(expanded_selection) as picked(benefit_id uuid, sku_id uuid, quantity integer)
      where picked.benefit_id = benefit.id
        and (picked.sku_id <> benefit.fixed_sku_id or picked.quantity <> benefit.quantity)
    ) then
      raise exception 'INVALID_PACKAGE_BENEFIT_SELECTION';
    end if;
    if not exists (
      select 1
      from jsonb_to_recordset(expanded_selection) as picked(benefit_id uuid, sku_id uuid, quantity integer)
      where picked.benefit_id = benefit.id
    ) then
      expanded_selection := expanded_selection || jsonb_build_array(jsonb_build_object(
        'benefit_id', benefit.id,
        'sku_id', benefit.fixed_sku_id,
        'quantity', benefit.quantity
      ));
    end if;
  end loop;

  perform private.apply_selected_package_benefits_customer_only(
    p_order_id,
    p_package_id,
    p_package_quantity,
    expanded_selection
  );
end;
$$;

revoke all on function private.apply_selected_package_benefits(uuid, uuid, integer, jsonb) from public, anon;
