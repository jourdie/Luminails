-- Apply the B2B Tier role requirement during automatic tier recalculation.
create or replace function private.sync_customer_loyalty(p_customer_id uuid, p_order_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_tier_code text := 'STANDARD';
  standard_rate integer;
  premium_rate integer;
  order_total bigint;
  lifetime_total bigint;
  paid_count integer;
  next_tier_id uuid;
  next_tier_code text;
  next_rate_bps integer;
  earned_points bigint;
  balance bigint;
  earned_total bigint;
  redeemed_total bigint;
  profile_role text := 'all';
begin
  select standard_rate_bps, premium_rate_bps into standard_rate, premium_rate
  from public.loyalty_program_settings where key = 'default' and is_active = true limit 1;
  standard_rate := coalesce(standard_rate, 200);
  premium_rate := coalesce(premium_rate, 500);

  select lower(replace(coalesce(nullif(profile.studio_type, ''), nullif(profile.business_type, ''), 'all'), ' ', '_'))
    into profile_role
  from public.customer_profiles profile
  where profile.id = p_customer_id;

  select coalesce(tier.code, 'STANDARD') into current_tier_code
  from public.customer_profiles profile
  left join public.pricing_tiers tier on tier.id = profile.pricing_tier_id
  where profile.id = p_customer_id;

  if p_order_id is not null then
    select total_idr into order_total from public.commerce_orders
    where id = p_order_id and customer_id = p_customer_id and payment_status = 'paid';
    if order_total is not null and not exists (
      select 1 from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn'
    ) then
      earned_points := floor(order_total * (case when current_tier_code in ('B2B_PREMIUM', 'VIP') then premium_rate else standard_rate end) / 10000.0)::bigint;
      if earned_points > 0 then
        insert into public.loyalty_ledger (customer_id, order_id, entry_type, points_delta, points_type, description)
        values (p_customer_id, p_order_id, 'earn', earned_points, 'free_product', current_tier_code || ' points earned from paid order');
      end if;
    end if;
  end if;

  select coalesce(sum(total_idr), 0), count(*)::integer into lifetime_total, paid_count
  from public.commerce_orders where customer_id = p_customer_id and payment_status = 'paid';

  select tier.id, tier.code into next_tier_id, next_tier_code
  from public.pricing_tiers tier
  where tier.is_active = true
    and tier.minimum_lifetime_spend_idr <= lifetime_total
    and tier.minimum_paid_order_count <= paid_count
    and (tier.customer_role = 'all' or lower(tier.customer_role) = profile_role)
  order by tier.minimum_lifetime_spend_idr desc, tier.minimum_paid_order_count desc, tier.sort_order desc
  limit 1;

  next_tier_code := coalesce(next_tier_code, 'STANDARD');
  next_rate_bps := case when next_tier_code in ('B2B_PREMIUM', 'VIP') then premium_rate else standard_rate end;
  update public.customer_profiles
  set pricing_tier_id = next_tier_id, lifetime_paid_amount_idr = lifetime_total, paid_order_count = paid_count, updated_at = timezone('utc', now())
  where id = p_customer_id;

  select coalesce(sum(points_delta) filter (where points_delta > 0), 0), coalesce(sum(-points_delta) filter (where points_delta < 0), 0), greatest(coalesce(sum(points_delta), 0), 0)
  into earned_total, redeemed_total, balance
  from public.loyalty_ledger where customer_id = p_customer_id;

  insert into public.loyalty_accounts (customer_id, pricing_tier_id, tier_code, cashback_rate_bps, available_points, lifetime_earned_points, lifetime_redeemed_points)
  values (p_customer_id, next_tier_id, next_tier_code, next_rate_bps, balance, earned_total, redeemed_total)
  on conflict (customer_id) do update set pricing_tier_id = excluded.pricing_tier_id, tier_code = excluded.tier_code, cashback_rate_bps = excluded.cashback_rate_bps, available_points = excluded.available_points, lifetime_earned_points = excluded.lifetime_earned_points, lifetime_redeemed_points = excluded.lifetime_redeemed_points, updated_at = timezone('utc', now());
end;
$$;

revoke all on function private.sync_customer_loyalty(uuid, uuid) from public, anon, authenticated;