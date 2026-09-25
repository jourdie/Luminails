-- B2B customer tier, points ledger, rewards and package eligibility domain.
-- This migration extends the existing commerce model; it does not duplicate customers or orders.

create table if not exists public.customer_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  minimum_rolling_spend_idr bigint not null default 0 check (minimum_rolling_spend_idr >= 0),
  maximum_rolling_spend_idr bigint check (maximum_rolling_spend_idr is null or maximum_rolling_spend_idr >= minimum_rolling_spend_idr),
  rolling_period_months integer not null default 6 check (rolling_period_months > 0),
  point_multiplier numeric(6,2) not null default 1.00 check (point_multiplier > 0),
  description text,
  benefits_description text,
  is_active boolean not null default true,
  priority integer not null default 0 check (priority >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.customer_tiers (code, name, minimum_rolling_spend_idr, maximum_rolling_spend_idr, rolling_period_months, point_multiplier, description, benefits_description, priority)
values
  ('BASIC', 'Basic', 0, 1999999, 6, 1.00, 'Tier awal untuk customer baru.', 'Earn points 1.0x.', 10),
  ('VIP_1', 'VIP 1', 2000000, 4999999, 6, 1.20, 'Untuk customer dengan rolling spend minimal Rp2.000.000.', 'Earn points 1.2x.', 20),
  ('VIP_2', 'VIP 2', 5000000, null, 6, 1.50, 'Untuk customer dengan rolling spend minimal Rp5.000.000.', 'Earn points 1.5x dan benefit package terbaik.', 30)
on conflict (code) do update set
  name = excluded.name,
  minimum_rolling_spend_idr = excluded.minimum_rolling_spend_idr,
  maximum_rolling_spend_idr = excluded.maximum_rolling_spend_idr,
  rolling_period_months = excluded.rolling_period_months,
  point_multiplier = excluded.point_multiplier,
  description = excluded.description,
  benefits_description = excluded.benefits_description,
  updated_at = timezone('utc', now());

alter table public.customer_profiles
  add column if not exists auto_customer_tier_id uuid references public.customer_tiers(id) on delete set null,
  add column if not exists customer_tier_id uuid references public.customer_tiers(id) on delete set null,
  add column if not exists manual_tier_override_enabled boolean not null default false,
  add column if not exists manual_tier_id uuid references public.customer_tiers(id) on delete set null,
  add column if not exists manual_tier_reason text,
  add column if not exists manual_tier_starts_at timestamptz,
  add column if not exists manual_tier_expires_at timestamptz;

create table if not exists public.loyalty_point_settings (
  key text primary key check (key = 'default'),
  point_unit_value_idr bigint not null default 10000 check (point_unit_value_idr > 0),
  expiry_months integer not null default 12 check (expiry_months > 0),
  reward_cost_warning_percent numeric(6,2) not null default 3.00 check (reward_cost_warning_percent >= 0),
  tier_rolling_period_months integer not null default 6 check (tier_rolling_period_months > 0),
  automatic_tier_recalculation boolean not null default true,
  allow_manual_point_adjustment boolean not null default true,
  require_adjustment_reason boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.loyalty_point_settings (key)
values ('default')
on conflict (key) do nothing;

alter table public.loyalty_accounts
  drop constraint if exists loyalty_accounts_available_credit_idr_check,
  add column if not exists customer_tier_id uuid references public.customer_tiers(id) on delete set null,
  add column if not exists last_redemption_at timestamptz;

alter table public.loyalty_ledger
  add column if not exists balance_before bigint,
  add column if not exists balance_after bigint,
  add column if not exists expires_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists reference_text text;

alter table public.loyalty_ledger drop constraint if exists loyalty_ledger_entry_type_check;
alter table public.loyalty_ledger add constraint loyalty_ledger_entry_type_check check (entry_type in ('earn', 'redeem', 'reversal', 'adjustment', 'adjustment_plus', 'adjustment_minus', 'expire', 'expired'));

create table if not exists public.loyalty_point_lots (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  ledger_id uuid not null references public.loyalty_ledger(id) on delete restrict,
  original_points bigint not null check (original_points > 0),
  remaining_points bigint not null check (remaining_points >= 0 and remaining_points <= original_points),
  earned_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists loyalty_point_lots_fifo_idx on public.loyalty_point_lots (customer_id, expires_at, earned_at) where remaining_points > 0;

alter table public.loyalty_reward_catalog
  add column if not exists reward_name text,
  add column if not exists brand_id uuid references public.catalog_brands(id) on delete set null,
  add column if not exists hpp_idr bigint not null default 0 check (hpp_idr >= 0),
  add column if not exists normal_selling_price_idr bigint not null default 0 check (normal_selling_price_idr >= 0),
  add column if not exists minimum_customer_tier_id uuid references public.customer_tiers(id) on delete set null,
  add column if not exists minimum_order_value_idr bigint not null default 0 check (minimum_order_value_idr >= 0),
  add column if not exists max_redemption_quantity integer not null default 1 check (max_redemption_quantity > 0),
  add column if not exists reward_stock integer not null default 0 check (reward_stock >= 0),
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists redemption_count integer not null default 0 check (redemption_count >= 0);

create index if not exists loyalty_reward_catalog_active_idx on public.loyalty_reward_catalog (is_active, starts_at, ends_at, points_cost);

alter table public.commerce_packages
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists minimum_quantity integer not null default 1 check (minimum_quantity > 0),
  add column if not exists minimum_subtotal_idr bigint not null default 0 check (minimum_subtotal_idr >= 0),
  add column if not exists stackable boolean not null default false,
  add column if not exists points_earning_mode text not null default 'normal' check (points_earning_mode in ('normal', 'reduced', 'none')),
  add column if not exists points_multiplier numeric(6,2) not null default 1.00 check (points_multiplier > 0),
  add column if not exists allow_reward_redemption boolean not null default true,
  add column if not exists usage_count integer not null default 0 check (usage_count >= 0);

create table if not exists public.commerce_package_eligibility (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.commerce_packages(id) on delete cascade,
  customer_tier_id uuid references public.customer_tiers(id) on delete cascade,
  customer_id uuid references auth.users(id) on delete cascade,
  brand_id uuid references public.catalog_brands(id) on delete cascade,
  sku_id uuid references public.catalog_skus(id) on delete cascade,
  minimum_quantity integer not null default 1 check (minimum_quantity > 0),
  minimum_order_value_idr bigint not null default 0 check (minimum_order_value_idr >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  check (customer_tier_id is not null or customer_id is not null or brand_id is not null or sku_id is not null)
);

create index if not exists commerce_package_eligibility_lookup_idx on public.commerce_package_eligibility (package_id, customer_tier_id, customer_id, brand_id, sku_id);

create table if not exists public.commerce_package_benefits (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.commerce_packages(id) on delete cascade,
  customer_tier_id uuid references public.customer_tiers(id) on delete cascade,
  reward_sku_id uuid not null references public.catalog_skus(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  variant_rule text not null default 'admin_selected' check (variant_rule in ('admin_selected', 'customer_selected')),
  max_free_quantity integer check (max_free_quantity is null or max_free_quantity > 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists commerce_package_benefits_lookup_idx on public.commerce_package_benefits (package_id, customer_tier_id);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs (entity_type, entity_id, created_at desc);

alter table public.customer_tiers enable row level security;
alter table public.loyalty_point_settings enable row level security;
alter table public.loyalty_point_lots enable row level security;
alter table public.commerce_package_eligibility enable row level security;
alter table public.commerce_package_benefits enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on public.customer_tiers, public.loyalty_point_settings, public.loyalty_point_lots, public.commerce_package_eligibility, public.commerce_package_benefits, public.admin_audit_logs from anon, authenticated;
grant select on public.customer_tiers, public.loyalty_point_settings to authenticated;
grant select on public.loyalty_point_lots to authenticated;
grant select on public.commerce_package_eligibility, public.commerce_package_benefits to authenticated;
grant select on public.admin_audit_logs to authenticated;

drop policy if exists "authenticated customers can read active customer tiers" on public.customer_tiers;
create policy "authenticated customers can read active customer tiers" on public.customer_tiers for select to authenticated using (is_active = true or public.has_admin_permission('pricing'));

drop policy if exists "pricing admins can manage customer tiers" on public.customer_tiers;
create policy "pricing admins can manage customer tiers" on public.customer_tiers for all to authenticated using (public.has_admin_permission('pricing')) with check (public.has_admin_permission('pricing'));

drop policy if exists "customers can read active loyalty point settings" on public.loyalty_point_settings;
create policy "customers can read active loyalty point settings" on public.loyalty_point_settings for select to authenticated using (key = 'default');

drop policy if exists "pricing admins can manage loyalty point settings" on public.loyalty_point_settings;
create policy "pricing admins can manage loyalty point settings" on public.loyalty_point_settings for all to authenticated using (public.has_admin_permission('pricing')) with check (public.has_admin_permission('pricing'));

drop policy if exists "customers can read own point lots" on public.loyalty_point_lots;
create policy "customers can read own point lots" on public.loyalty_point_lots for select to authenticated using (customer_id = (select auth.uid()) or public.has_admin_permission('pricing'));

drop policy if exists "admins can manage package eligibility" on public.commerce_package_eligibility;
create policy "admins can manage package eligibility" on public.commerce_package_eligibility for all to authenticated using (public.has_admin_permission('packages')) with check (public.has_admin_permission('packages'));

drop policy if exists "admins can manage package benefits" on public.commerce_package_benefits;
create policy "admins can manage package benefits" on public.commerce_package_benefits for all to authenticated using (public.has_admin_permission('packages')) with check (public.has_admin_permission('packages'));

drop policy if exists "admins can read audit logs" on public.admin_audit_logs;
create policy "admins can read audit logs" on public.admin_audit_logs for select to authenticated using (public.has_admin_permission('orders') or public.has_admin_permission('pricing') or public.has_admin_permission('packages'));

create or replace function public.calculate_customer_tier(p_customer_id uuid, p_as_of timestamptz default timezone('utc', now()))
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_id uuid;
  rolling_spend bigint;
  months integer;
begin
  select coalesce(max(tier.rolling_period_months), 6) into months from public.customer_tiers tier where tier.is_active = true;
  select coalesce(sum(coalesce(order_row.subtotal_idr, order_row.total_idr) - coalesce(order_row.discount_idr, 0)), 0)::bigint
  into rolling_spend
  from public.commerce_orders order_row
  where order_row.customer_id = p_customer_id
    and order_row.payment_status in ('paid', 'partially_refunded')
    and order_row.created_at >= p_as_of - make_interval(months => months)
    and order_row.created_at <= p_as_of;
  select tier.id into selected_id
  from public.customer_tiers tier
  where tier.is_active = true
    and tier.minimum_rolling_spend_idr <= rolling_spend
    and (tier.maximum_rolling_spend_idr is null or rolling_spend <= tier.maximum_rolling_spend_idr)
  order by tier.priority desc, tier.minimum_rolling_spend_idr desc
  limit 1;
  return selected_id;
end;
$$;

create or replace function public.recalculate_customer_tier(p_customer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  auto_id uuid;
  effective_id uuid;
begin
  auto_id := public.calculate_customer_tier(p_customer_id);
  select case when manual_tier_override_enabled and manual_tier_id is not null and (manual_tier_expires_at is null or manual_tier_expires_at > timezone('utc', now())) then manual_tier_id else auto_id end into effective_id from public.customer_profiles where id = p_customer_id;
  update public.customer_profiles set auto_customer_tier_id = auto_id, customer_tier_id = effective_id, updated_at = timezone('utc', now()) where id = p_customer_id;
  update public.loyalty_accounts set customer_tier_id = effective_id, tier_code = coalesce((select code from public.customer_tiers where id = effective_id), tier_code), updated_at = timezone('utc', now()) where customer_id = p_customer_id;
  return effective_id;
end;
$$;

create or replace function public.adjust_loyalty_points(p_customer_id uuid, p_points bigint, p_reason text, p_reference text default null)
returns public.loyalty_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account public.loyalty_accounts;
  before_balance bigint;
  after_balance bigint;
  actor uuid := auth.uid();
begin
  if not public.has_admin_permission('pricing') then raise exception 'POINT_ADJUSTMENT_PERMISSION_REQUIRED'; end if;
  if p_points = 0 or nullif(trim(p_reason), '') is null then raise exception 'POINT_ADJUSTMENT_INVALID'; end if;
  select * into account from public.loyalty_accounts where customer_id = p_customer_id for update;
  if account.customer_id is null then insert into public.loyalty_accounts (customer_id, tier_code) values (p_customer_id, 'BASIC') returning * into account; end if;
  before_balance := account.available_points;
  after_balance := before_balance + p_points;
  update public.loyalty_accounts set available_points = after_balance, lifetime_earned_points = lifetime_earned_points + greatest(p_points, 0), lifetime_redeemed_points = lifetime_redeemed_points + greatest(-p_points, 0), updated_at = timezone('utc', now()) where customer_id = p_customer_id returning * into account;
  insert into public.loyalty_ledger (customer_id, entry_type, points_delta, points_type, description, balance_before, balance_after, created_by, reference_text) values (p_customer_id, case when p_points > 0 then 'adjustment_plus' else 'adjustment_minus' end, p_points, 'free_product', p_reason, before_balance, after_balance, actor, p_reference);
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, new_value) values (actor, 'point_adjustment', 'customer', p_customer_id, jsonb_build_object('points', p_points, 'reason', p_reason, 'reference', p_reference));
  return account;
end;
$$;

revoke execute on function public.calculate_customer_tier(uuid, timestamptz) from public, anon;
revoke execute on function public.recalculate_customer_tier(uuid) from public, anon;
revoke execute on function public.adjust_loyalty_points(uuid, bigint, text, text) from public, anon;
grant execute on function public.calculate_customer_tier(uuid, timestamptz) to authenticated;
grant execute on function public.recalculate_customer_tier(uuid) to authenticated;
grant execute on function public.adjust_loyalty_points(uuid, bigint, text, text) to authenticated;

-- Existing paid-order trigger remains the source of order events. The application
-- service will call the tier/points functions after the payment reaches eligible status.
