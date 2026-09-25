-- Luminails B2B customer tiers, immutable points rules, reward validation and admin CRUD access.

alter table public.loyalty_accounts
  drop constraint if exists loyalty_accounts_available_credit_idr_check,
  drop constraint if exists loyalty_accounts_available_points_check;

alter table public.loyalty_redemptions
  add column if not exists quantity integer not null default 1 check (quantity > 0),
  add column if not exists points_total bigint;
alter table public.loyalty_redemptions drop constraint if exists loyalty_redemptions_status_check;
alter table public.loyalty_redemptions add constraint loyalty_redemptions_status_check check (status in ('pending', 'applied', 'confirmed', 'fulfilled', 'cancelled', 'reversed'));

grant select, insert, update, delete on public.customer_tiers, public.loyalty_point_settings to authenticated;
grant select on public.loyalty_point_lots to authenticated;
grant select, insert, update, delete on public.commerce_package_eligibility, public.commerce_package_benefits to authenticated;
grant select on public.admin_audit_logs to authenticated;
grant select, update on public.customer_profiles to authenticated;
grant update on public.loyalty_redemptions to authenticated;

drop policy if exists "admins can manage customer profiles" on public.customer_profiles;
create policy "admins can manage customer profiles" on public.customer_profiles for all to authenticated
using (public.has_admin_permission('orders')) with check (public.has_admin_permission('orders'));

drop policy if exists "admins can read all loyalty accounts" on public.loyalty_accounts;
create policy "admins can read all loyalty accounts" on public.loyalty_accounts for select to authenticated
using (public.has_admin_permission('orders') or public.has_admin_permission('pricing'));
drop policy if exists "admins can read all loyalty ledger" on public.loyalty_ledger;
create policy "admins can read all loyalty ledger" on public.loyalty_ledger for select to authenticated
using (public.has_admin_permission('orders') or public.has_admin_permission('pricing'));
drop policy if exists "admins can read all loyalty redemptions" on public.loyalty_redemptions;
create policy "admins can read all loyalty redemptions" on public.loyalty_redemptions for select to authenticated
using (public.has_admin_permission('orders') or public.has_admin_permission('pricing'));
drop policy if exists "admins can update loyalty redemptions" on public.loyalty_redemptions;
create policy "admins can update loyalty redemptions" on public.loyalty_redemptions for update to authenticated
using (public.has_admin_permission('orders')) with check (public.has_admin_permission('orders'));

-- Every ledger insert updates the balance atomically. The ledger itself is append-only.
create or replace function private.apply_loyalty_ledger_delta()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare account_row public.loyalty_accounts%rowtype;
begin
  select * into account_row from public.loyalty_accounts where customer_id = new.customer_id for update;
  if account_row.customer_id is null then
    insert into public.loyalty_accounts (customer_id, tier_code, available_points, lifetime_earned_points, lifetime_redeemed_points)
    values (new.customer_id, 'BASIC', 0, 0, 0) returning * into account_row;
  end if;
  new.balance_before := coalesce(new.balance_before, account_row.available_points);
  new.balance_after := coalesce(new.balance_after, new.balance_before + new.points_delta);
  update public.loyalty_accounts
  set available_points = new.balance_after,
      lifetime_earned_points = lifetime_earned_points + case when new.entry_type in ('earn', 'adjustment_plus') then greatest(new.points_delta, 0) else 0 end,
      lifetime_redeemed_points = lifetime_redeemed_points + case when new.entry_type in ('redeem', 'expire', 'expired', 'adjustment_minus') then greatest(-new.points_delta, 0) else 0 end,
      updated_at = timezone('utc', now())
  where customer_id = new.customer_id;
  return new;
end;
$$;

create or replace function private.create_loyalty_point_lot()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare expiry_months integer;
  lot record;
  remaining_to_consume bigint;
begin
  if new.entry_type = 'earn' and new.points_delta > 0 then
    select expiry_months into expiry_months from public.loyalty_point_settings where key = 'default';
    insert into public.loyalty_point_lots (customer_id, ledger_id, original_points, remaining_points, expires_at)
    values (new.customer_id, new.id, new.points_delta, new.points_delta, coalesce(new.expires_at, new.created_at + make_interval(months => coalesce(expiry_months, 12))));
  elsif new.entry_type in ('redeem', 'expired', 'expire') and new.points_delta < 0 then
    remaining_to_consume := -new.points_delta;
    for lot in select * from public.loyalty_point_lots where customer_id = new.customer_id and remaining_points > 0 order by expires_at, earned_at for update loop
      exit when remaining_to_consume <= 0;
      update public.loyalty_point_lots set remaining_points = remaining_points - least(remaining_points, remaining_to_consume) where id = lot.id;
      remaining_to_consume := remaining_to_consume - least(lot.remaining_points, remaining_to_consume);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists loyalty_ledger_balance_trigger on public.loyalty_ledger;
create trigger loyalty_ledger_balance_trigger before insert on public.loyalty_ledger
for each row execute function private.apply_loyalty_ledger_delta();
drop trigger if exists loyalty_point_lot_trigger on public.loyalty_ledger;
create trigger loyalty_point_lot_trigger after insert on public.loyalty_ledger
for each row execute function private.create_loyalty_point_lot();

create or replace function private.prevent_loyalty_ledger_mutation()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp
as $$
begin
  raise exception 'LOYALTY_LEDGER_IMMUTABLE';
end;
$$;
drop trigger if exists loyalty_ledger_immutable_trigger on public.loyalty_ledger;
create trigger loyalty_ledger_immutable_trigger before update or delete on public.loyalty_ledger
for each row execute function private.prevent_loyalty_ledger_mutation();

-- Paid spend only: floor((subtotal - discount) / Rp10.000), multiplied by effective customer tier.
create or replace function private.handle_order_loyalty()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.customer_id is not null and new.payment_status in ('paid', 'partially_refunded', 'refunded', 'failed')
     and (tg_op = 'INSERT' or old.payment_status is distinct from new.payment_status or old.total_idr is distinct from new.total_idr or old.discount_idr is distinct from new.discount_idr) then
    perform private.sync_customer_loyalty(new.customer_id, new.id);
  end if;
  if tg_op = 'UPDATE' and old.customer_id is not null and old.customer_id is distinct from new.customer_id then
    perform private.sync_customer_loyalty(old.customer_id);
  end if;
  return new;
end;
$$;

create or replace function private.sync_customer_loyalty(p_customer_id uuid, p_order_id uuid default null)
returns void language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  order_row public.commerce_orders%rowtype;
  settings_row public.loyalty_point_settings%rowtype;
  tier_id uuid;
  tier_multiplier numeric := 1;
  eligible_spend bigint;
  earned_points bigint;
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
      select coalesce(point_multiplier, 1) into tier_multiplier from public.customer_tiers where id = tier_id;
      eligible_spend := greatest(0, coalesce(order_row.subtotal_idr, order_row.total_idr, 0) - coalesce(order_row.discount_idr, 0));
      earned_points := floor((eligible_spend / greatest(1, coalesce(settings_row.point_unit_value_idr, 10000))) * coalesce(tier_multiplier, 1))::bigint;
      select package.* into package_row from public.commerce_order_items member join public.commerce_packages package on package.id = member.package_id where member.order_id = p_order_id and member.item_type = 'package' limit 1;
      if package_row.id is not null then
        if package_row.points_earning_mode = 'none' then earned_points := 0;
        elsif package_row.points_earning_mode = 'reduced' then earned_points := floor(earned_points * least(1, package_row.points_multiplier) / 2)::bigint;
        else earned_points := floor(earned_points * package_row.points_multiplier)::bigint;
        end if;
      end if;
      if earned_points > 0 then
        insert into public.loyalty_ledger (customer_id, order_id, entry_type, points_delta, points_type, description, expires_at, reference_text)
        values (p_customer_id, p_order_id, 'earn', earned_points, 'free_product', 'Points dari order paid: ' || p_order_id::text, timezone('utc', now()) + make_interval(months => coalesce(settings_row.expiry_months, 12)), 'eligible spend ' || eligible_spend::text);
      end if;
    end if;
  elsif order_row.payment_status in ('refunded', 'failed') then
    if exists (select 1 from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn') and not exists (select 1 from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'reversal') then
      insert into public.loyalty_ledger (customer_id, order_id, entry_type, points_delta, points_type, description, reference_text)
      select p_customer_id, p_order_id, 'reversal', -points_delta, 'free_product', 'Reversal points karena order refund/cancel', 'reversal of ' || id::text from public.loyalty_ledger where customer_id = p_customer_id and order_id = p_order_id and entry_type = 'earn' limit 1;
    end if;
  end if;
end;
$$;

drop trigger if exists commerce_orders_loyalty_trigger on public.commerce_orders;
create trigger commerce_orders_loyalty_trigger after insert or update of customer_id, payment_status, total_idr, subtotal_idr, discount_idr on public.commerce_orders
for each row execute function private.handle_order_loyalty();

create or replace function private.validate_loyalty_redemption()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare reward_row public.loyalty_reward_catalog%rowtype; order_row public.commerce_orders%rowtype; profile_tier uuid; account_points bigint;
begin
  select * into reward_row from public.loyalty_reward_catalog where sku_id = new.sku_id and is_active = true for update;
  if reward_row.id is null then raise exception 'REWARD_NOT_AVAILABLE'; end if;
  if reward_row.starts_at is not null and reward_row.starts_at > timezone('utc', now()) then raise exception 'REWARD_NOT_STARTED'; end if;
  if reward_row.ends_at is not null and reward_row.ends_at <= timezone('utc', now()) then raise exception 'REWARD_EXPIRED'; end if;
  if new.points_redeemed <> reward_row.points_cost then raise exception 'REWARD_POINTS_MISMATCH'; end if;
  if reward_row.reward_stock > 0 and reward_row.reward_stock < new.quantity then raise exception 'REWARD_OUT_OF_STOCK'; end if;
  select * into order_row from public.commerce_orders where id = new.order_id and customer_id = new.customer_id;
  if order_row.id is null then raise exception 'REDEMPTION_ORDER_NOT_FOUND'; end if;
  if greatest(0, coalesce(order_row.subtotal_idr, order_row.total_idr, 0) - coalesce(order_row.discount_idr, 0)) < reward_row.minimum_order_value_idr then raise exception 'REWARD_MINIMUM_ORDER_NOT_REACHED'; end if;
  select customer_tier_id into profile_tier from public.customer_profiles where id = new.customer_id;
  if reward_row.minimum_customer_tier_id is not null and not exists (select 1 from public.customer_tiers required join public.customer_tiers actual on actual.id = profile_tier where required.id = reward_row.minimum_customer_tier_id and actual.minimum_rolling_spend_idr >= required.minimum_rolling_spend_idr) then raise exception 'REWARD_TIER_NOT_ELIGIBLE'; end if;
  select available_points into account_points from public.loyalty_accounts where customer_id = new.customer_id for update;
  if coalesce(account_points, 0) < new.points_redeemed then raise exception 'INSUFFICIENT_POINTS'; end if;
  new.points_total := new.points_redeemed * new.quantity;
  return new;
end;
$$;

create or replace function private.complete_loyalty_redemption()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp
as $$
begin
  update public.loyalty_reward_catalog set reward_stock = case when reward_stock > 0 then reward_stock - new.quantity else reward_stock end, redemption_count = redemption_count + new.quantity, updated_at = timezone('utc', now()) where sku_id = new.sku_id;
  return new;
end;
$$;

drop trigger if exists loyalty_redemption_validation_trigger on public.loyalty_redemptions;
create trigger loyalty_redemption_validation_trigger before insert on public.loyalty_redemptions for each row execute function private.validate_loyalty_redemption();
drop trigger if exists loyalty_redemption_stock_trigger on public.loyalty_redemptions;
create trigger loyalty_redemption_stock_trigger after insert on public.loyalty_redemptions for each row execute function private.complete_loyalty_redemption();

create or replace function public.expire_loyalty_points(p_as_of timestamptz default timezone('utc', now()))
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare lot record; expired_total integer := 0;
begin
  for lot in select * from public.loyalty_point_lots where remaining_points > 0 and expires_at <= p_as_of order by expires_at, earned_at for update loop
    insert into public.loyalty_ledger (customer_id, entry_type, points_delta, points_type, description, reference_text) values (lot.customer_id, 'expired', -lot.remaining_points, 'free_product', 'Points expired FIFO', lot.id::text);
    update public.loyalty_point_lots set remaining_points = 0 where id = lot.id;
    expired_total := expired_total + 1;
  end loop;
  return expired_total;
end;
$$;

grant execute on function public.expire_loyalty_points(timestamptz) to authenticated;

-- The previous adjustment function updated the account and then inserted a ledger row.
-- With the immutable-ledger trigger the ledger is now the single balance mutation.
create or replace function public.adjust_loyalty_points(p_customer_id uuid, p_points bigint, p_reason text, p_reference text default null)
returns public.loyalty_accounts language plpgsql security definer
set search_path = public, pg_temp
as $$
declare account_row public.loyalty_accounts%rowtype; actor uuid := auth.uid();
begin
  if not public.has_admin_permission('pricing') then raise exception 'POINT_ADJUSTMENT_PERMISSION_REQUIRED'; end if;
  if p_points = 0 or nullif(trim(p_reason), '') is null then raise exception 'POINT_ADJUSTMENT_INVALID'; end if;
  select * into account_row from public.loyalty_accounts where customer_id = p_customer_id for update;
  if account_row.customer_id is null then insert into public.loyalty_accounts (customer_id, tier_code) values (p_customer_id, 'BASIC'); end if;
  insert into public.loyalty_ledger (customer_id, entry_type, points_delta, points_type, description, created_by, reference_text)
  values (p_customer_id, case when p_points > 0 then 'adjustment_plus' else 'adjustment_minus' end, p_points, 'free_product', p_reason, actor, p_reference);
  select * into account_row from public.loyalty_accounts where customer_id = p_customer_id;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, new_value) values (actor, 'point_adjustment', 'customer', p_customer_id, jsonb_build_object('points', p_points, 'reason', p_reason, 'reference', p_reference));
  return account_row;
end;
$$;
