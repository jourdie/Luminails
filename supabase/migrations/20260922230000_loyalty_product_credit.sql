-- Loyalty is a product-credit ledger, never a cash balance or order discount.

create schema if not exists private;

create table if not exists public.loyalty_program_settings (
  key text primary key check (key = 'default'),
  standard_rate_bps integer not null default 200 check (standard_rate_bps between 0 and 10000),
  premium_rate_bps integer not null default 500 check (premium_rate_bps between 0 and 10000),
  reward_type text not null default 'free_product' check (reward_type = 'free_product'),
  cash_out_allowed boolean not null default false,
  order_discount_allowed boolean not null default false,
  is_active boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.loyalty_program_settings (key, standard_rate_bps, premium_rate_bps, reward_type, cash_out_allowed, order_discount_allowed)
values ('default', 200, 500, 'free_product', false, false)
on conflict (key) do update set
  standard_rate_bps = excluded.standard_rate_bps,
  premium_rate_bps = excluded.premium_rate_bps,
  reward_type = excluded.reward_type,
  cash_out_allowed = excluded.cash_out_allowed,
  order_discount_allowed = excluded.order_discount_allowed;

create table if not exists public.loyalty_accounts (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  pricing_tier_id uuid references public.pricing_tiers(id) on delete set null,
  tier_code text not null default 'STANDARD',
  cashback_rate_bps integer not null default 200 check (cashback_rate_bps between 0 and 10000),
  available_credit_idr bigint not null default 0 check (available_credit_idr >= 0),
  lifetime_earned_idr bigint not null default 0 check (lifetime_earned_idr >= 0),
  lifetime_redeemed_idr bigint not null default 0 check (lifetime_redeemed_idr >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null unique references public.commerce_orders(id) on delete restrict,
  sku_id uuid references public.catalog_skus(id) on delete set null,
  credit_value_idr bigint not null check (credit_value_idr > 0),
  product_value_idr bigint not null check (product_value_idr > 0),
  status text not null default 'pending' check (status in ('pending', 'applied', 'reversed')),
  created_at timestamptz not null default timezone('utc', now()),
  applied_at timestamptz
);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.commerce_orders(id) on delete set null,
  redemption_id uuid references public.loyalty_redemptions(id) on delete set null,
  entry_type text not null check (entry_type in ('earn', 'redeem', 'reversal', 'adjustment', 'expire')),
  credit_amount_idr bigint not null check (credit_amount_idr <> 0),
  credit_type text not null default 'free_product' check (credit_type = 'free_product'),
  description text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, order_id, entry_type)
);

create index if not exists loyalty_ledger_customer_idx on public.loyalty_ledger (customer_id, created_at desc);
create index if not exists loyalty_redemptions_customer_idx on public.loyalty_redemptions (customer_id, created_at desc);

alter table public.loyalty_program_settings enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_redemptions enable row level security;
alter table public.loyalty_ledger enable row level security;

revoke all on public.loyalty_program_settings, public.loyalty_accounts, public.loyalty_redemptions, public.loyalty_ledger from anon, authenticated;
grant select on public.loyalty_program_settings to authenticated;
grant select on public.loyalty_accounts, public.loyalty_redemptions, public.loyalty_ledger to authenticated;

create policy "customers can read loyalty program"
  on public.loyalty_program_settings for select
  to authenticated
  using (is_active = true);

create policy "pricing admins can manage loyalty program"
  on public.loyalty_program_settings for all
  to authenticated
  using (public.has_admin_permission('pricing'))
  with check (public.has_admin_permission('pricing'));

create policy "customers can read their loyalty account"
  on public.loyalty_accounts for select
  to authenticated
  using ((select auth.uid()) = customer_id);

create policy "customers can read their loyalty redemptions"
  on public.loyalty_redemptions for select
  to authenticated
  using ((select auth.uid()) = customer_id);

create policy "customers can read their loyalty ledger"
  on public.loyalty_ledger for select
  to authenticated
  using ((select auth.uid()) = customer_id);

create or replace function private.sync_customer_loyalty(p_customer_id uuid, p_order_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_tier_code text := 'STANDARD';
  current_rate_bps integer;
  standard_rate integer;
  premium_rate integer;
  order_total bigint;
  lifetime_total bigint;
  paid_count integer;
  next_tier_id uuid;
  next_tier_code text;
  next_rate_bps integer;
  earned_amount bigint;
  balance bigint;
  earned_total bigint;
  redeemed_total bigint;
begin
  select standard_rate_bps, premium_rate_bps
  into standard_rate, premium_rate
  from public.loyalty_program_settings
  where key = 'default' and is_active = true
  limit 1;

  standard_rate := coalesce(standard_rate, 200);
  premium_rate := coalesce(premium_rate, 500);

  select coalesce(tier.code, 'STANDARD')
  into current_tier_code
  from public.customer_profiles profile
  left join public.pricing_tiers tier on tier.id = profile.pricing_tier_id
  where profile.id = p_customer_id;

  current_rate_bps := case when current_tier_code = 'B2B_PREMIUM' then premium_rate else standard_rate end;

  if p_order_id is not null then
    select total_idr into order_total
    from public.commerce_orders
    where id = p_order_id and customer_id = p_customer_id and payment_status = 'paid';

    if order_total is not null and not exists (
      select 1 from public.loyalty_ledger
      where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn'
    ) then
      earned_amount := floor(order_total * current_rate_bps / 10000.0)::bigint;
      if earned_amount > 0 then
        insert into public.loyalty_ledger (customer_id, order_id, entry_type, credit_amount_idr, credit_type, description)
        values (p_customer_id, p_order_id, 'earn', earned_amount, 'free_product', current_tier_code || ' loyalty credit for paid order');
      end if;
    end if;
  end if;

  select coalesce(sum(total_idr), 0), count(*)::integer
  into lifetime_total, paid_count
  from public.commerce_orders
  where customer_id = p_customer_id and payment_status = 'paid';

  select tier.id, tier.code
  into next_tier_id, next_tier_code
  from public.pricing_tiers tier
  where tier.is_active = true
    and tier.minimum_lifetime_spend_idr <= lifetime_total
    and tier.minimum_paid_order_count <= paid_count
  order by tier.minimum_lifetime_spend_idr desc, tier.minimum_paid_order_count desc, tier.sort_order desc
  limit 1;

  next_tier_code := coalesce(next_tier_code, 'STANDARD');
  next_rate_bps := case when next_tier_code = 'B2B_PREMIUM' then premium_rate else standard_rate end;

  update public.customer_profiles
  set pricing_tier_id = next_tier_id,
      lifetime_paid_amount_idr = lifetime_total,
      paid_order_count = paid_count,
      updated_at = timezone('utc', now())
  where id = p_customer_id;

  select coalesce(sum(credit_amount_idr) filter (where credit_amount_idr > 0), 0),
         coalesce(sum(-credit_amount_idr) filter (where credit_amount_idr < 0), 0),
         greatest(coalesce(sum(credit_amount_idr), 0), 0)
  into earned_total, redeemed_total, balance
  from public.loyalty_ledger
  where customer_id = p_customer_id;

  insert into public.loyalty_accounts (customer_id, pricing_tier_id, tier_code, cashback_rate_bps, available_credit_idr, lifetime_earned_idr, lifetime_redeemed_idr)
  values (p_customer_id, next_tier_id, next_tier_code, next_rate_bps, balance, earned_total, redeemed_total)
  on conflict (customer_id) do update set
    pricing_tier_id = excluded.pricing_tier_id,
    tier_code = excluded.tier_code,
    cashback_rate_bps = excluded.cashback_rate_bps,
    available_credit_idr = excluded.available_credit_idr,
    lifetime_earned_idr = excluded.lifetime_earned_idr,
    lifetime_redeemed_idr = excluded.lifetime_redeemed_idr,
    updated_at = timezone('utc', now());
end;
$$;

revoke all on function private.sync_customer_loyalty(uuid, uuid) from public, anon, authenticated;

create or replace function private.handle_order_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.customer_id is not null and new.payment_status = 'paid'
     and (tg_op = 'INSERT' or old.payment_status is distinct from new.payment_status or old.total_idr is distinct from new.total_idr) then
    perform private.sync_customer_loyalty(new.customer_id, new.id);
  end if;

  if tg_op = 'UPDATE' and old.customer_id is not null and old.customer_id is distinct from new.customer_id then
    perform private.sync_customer_loyalty(old.customer_id);
  end if;

  return new;
end;
$$;

revoke all on function private.handle_order_loyalty() from public, anon, authenticated;

drop trigger if exists commerce_orders_loyalty_trigger on public.commerce_orders;
create trigger commerce_orders_loyalty_trigger
after insert or update of customer_id, payment_status, total_idr on public.commerce_orders
for each row execute function private.handle_order_loyalty();

do $$
declare
  paid_order record;
begin
  for paid_order in
    select id, customer_id from public.commerce_orders
    where customer_id is not null and payment_status = 'paid'
  loop
    perform private.sync_customer_loyalty(paid_order.customer_id, paid_order.id);
  end loop;
end;
$$;
