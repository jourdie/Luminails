-- Align the admin workflow with the commercial model:
-- Brand Register -> SKU -> Package -> tier-specific package prices.

alter table public.pricing_tiers
  add column if not exists customer_role text not null default 'all';

alter table public.pricing_tiers
  drop constraint if exists pricing_tiers_customer_role_check;

alter table public.pricing_tiers
  add constraint pricing_tiers_customer_role_check
  check (customer_role in ('all', 'home_studio', 'salon', 'distributor', 'vip'));

insert into public.pricing_tiers (id, code, name, minimum_lifetime_spend_idr, minimum_paid_order_count, price_visibility, customer_role, is_active, sort_order)
values
  ('30000000-0000-4000-8000-000000000003', 'VIP', 'VIP', 15000000, 10, 'premium_b2b', 'vip', true, 30)
on conflict (id) do update set
  name = excluded.name,
  minimum_lifetime_spend_idr = excluded.minimum_lifetime_spend_idr,
  minimum_paid_order_count = excluded.minimum_paid_order_count,
  customer_role = excluded.customer_role,
  price_visibility = excluded.price_visibility,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

update public.pricing_tiers
set customer_role = case
  when code = 'STANDARD' then 'all'
  when code = 'B2B_PREMIUM' then 'all'
  else customer_role
end
where customer_role is null or customer_role = '';

create index if not exists pricing_tiers_eligibility_idx
  on public.pricing_tiers (is_active, customer_role, minimum_lifetime_spend_idr, minimum_paid_order_count, sort_order desc);

comment on column public.pricing_tiers.customer_role is 'Optional customer business role required for this tier. Matches customer_profiles.business_type or studio_type.';

-- Preserve price history while making the active price per package/tier easy to query.
create index if not exists commerce_package_prices_active_tier_idx
  on public.commerce_package_prices (package_id, pricing_tier_id, is_active, effective_from desc);
