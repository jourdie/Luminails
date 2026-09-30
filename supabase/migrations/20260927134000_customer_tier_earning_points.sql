-- Use the earning points configured on the effective customer tier.
-- Qualification thresholds and earning rate are intentionally independent.
create or replace function private.sync_customer_loyalty(p_customer_id uuid, p_order_id uuid default null)
returns void language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  order_row public.commerce_orders%rowtype;
  settings_row public.loyalty_point_settings%rowtype;
  tier_id uuid;
  points_per_10000 numeric := 1;
  eligible_spend bigint;
  earned_points bigint;
  issued_points bigint;
  refunded_eligible bigint;
  target_reversal bigint;
  existing_reversal bigint;
  package_row public.commerce_packages%rowtype;
begin
  perform public.recalculate_customer_tier(p_customer_id);
  if p_order_id is null then return; end if;
  select * into order_row from public.commerce_orders where id = p_order_id and customer_id = p_customer_id;
  if order_row.id is null then return; end if;

  if order_row.payment_status in ('paid', 'partially_refunded') then
    if not exists (select 1 from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn') then
      select * into settings_row from public.loyalty_point_settings where key = 'default';
      select customer_tier_id into tier_id from public.customer_profiles where id = p_customer_id;
      select coalesce(points_per_10000_idr, 1) into points_per_10000 from public.customer_tiers where id = tier_id;
      eligible_spend := greatest(0, coalesce(order_row.subtotal_idr, order_row.total_idr, 0) - coalesce(order_row.discount_idr, 0));
      earned_points := floor((eligible_spend / 10000.0) * coalesce(points_per_10000, 1))::bigint;
      select package.* into package_row from public.commerce_order_items member join public.commerce_packages package on package.id = member.package_id where member.order_id = p_order_id and member.item_type = 'package' limit 1;
      if package_row.id is not null then
        if package_row.points_earning_mode = 'none' then earned_points := 0;
        elsif package_row.points_earning_mode = 'reduced' then earned_points := floor(earned_points * least(1, package_row.points_multiplier))::bigint;
        else earned_points := floor(earned_points * package_row.points_multiplier)::bigint;
        end if;
      end if;
      if earned_points > 0 then
        insert into public.loyalty_ledger (customer_id, order_id, entry_type, points_delta, points_type, description, expires_at, reference_text)
        values (p_customer_id, p_order_id, 'earn', earned_points, 'free_product', 'Points dari order paid: ' || p_order_id::text, timezone('utc', now()) + make_interval(months => coalesce(settings_row.expiry_months, 12)), 'eligible spend ' || eligible_spend::text);
      end if;
    end if;
  end if;

  if order_row.payment_status in ('partially_refunded', 'refunded', 'failed') then
    select coalesce(points_delta, 0) into issued_points from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn' order by created_at limit 1;
    if coalesce(issued_points, 0) > 0 then
      eligible_spend := greatest(0, coalesce(order_row.subtotal_idr, order_row.total_idr, 0) - coalesce(order_row.discount_idr, 0));
      refunded_eligible := case when order_row.payment_status in ('refunded', 'failed') then eligible_spend else least(eligible_spend, greatest(0, order_row.refunded_amount_idr)) end;
      target_reversal := case when eligible_spend > 0 then floor(issued_points * refunded_eligible / eligible_spend)::bigint else 0 end;
      existing_reversal := coalesce((select sum(-points_delta) from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'reversal' and redemption_id is null), 0);
      if target_reversal > existing_reversal then
        insert into public.loyalty_ledger (customer_id, order_id, entry_type, points_delta, points_type, description, reference_text)
        values (p_customer_id, p_order_id, 'reversal', -(target_reversal - existing_reversal), 'free_product', 'Reversal points karena refund/cancel', 'refund amount ' || coalesce(order_row.refunded_amount_idr, eligible_spend)::text);
      end if;
    end if;
  end if;
end;
$$;



