create table public.pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  minimum_lifetime_spend_idr bigint not null default 0 check (minimum_lifetime_spend_idr >= 0),
  minimum_paid_order_count integer not null default 0 check (minimum_paid_order_count >= 0),
  price_visibility text not null default 'standard' check (price_visibility in ('standard', 'premium_b2b')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.pricing_tiers is 'Configurable customer pricing eligibility. Seed values are development defaults and require business approval.';

insert into public.pricing_tiers (id, code, name, minimum_lifetime_spend_idr, minimum_paid_order_count, price_visibility, sort_order)
values
  ('30000000-0000-4000-8000-000000000001', 'STANDARD', 'Harga standard', 0, 0, 'standard', 10),
  ('30000000-0000-4000-8000-000000000002', 'B2B_PREMIUM', 'Premium B2B', 5000000, 3, 'premium_b2b', 20)
on conflict (id) do update set
  name = excluded.name,
  minimum_lifetime_spend_idr = excluded.minimum_lifetime_spend_idr,
  minimum_paid_order_count = excluded.minimum_paid_order_count,
  price_visibility = excluded.price_visibility,
  sort_order = excluded.sort_order;

alter table public.customer_profiles
  add column if not exists pricing_tier_id uuid references public.pricing_tiers(id),
  add column if not exists lifetime_paid_amount_idr bigint not null default 0 check (lifetime_paid_amount_idr >= 0),
  add column if not exists paid_order_count integer not null default 0 check (paid_order_count >= 0);

alter table public.b2b_accounts
  add column if not exists pricing_tier_id uuid references public.pricing_tiers(id),
  add column if not exists lifetime_paid_amount_idr bigint not null default 0 check (lifetime_paid_amount_idr >= 0),
  add column if not exists paid_order_count integer not null default 0 check (paid_order_count >= 0);

create table public.catalog_sku_prices (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.catalog_skus(id) on delete cascade,
  pricing_tier_id uuid not null references public.pricing_tiers(id) on delete cascade,
  unit_price_idr integer not null check (unit_price_idr >= 0),
  effective_from timestamptz not null default timezone('utc', now()),
  effective_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  check (effective_until is null or effective_until > effective_from),
  unique (sku_id, pricing_tier_id, effective_from)
);

create index catalog_sku_prices_lookup_idx on public.catalog_sku_prices (sku_id, pricing_tier_id, is_active, effective_from desc);

create table public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'catalog_manager' check (role in ('owner', 'catalog_manager', 'orders_manager', 'support')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  account_id uuid references public.b2b_accounts(id) on delete set null,
  source_channel text not null default 'web' check (source_channel in ('web', 'manual', 'import')),
  status text not null default 'submitted_for_review' check (status in ('submitted_for_review', 'awaiting_payment', 'paid', 'fulfilling', 'completed', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  fulfillment_status text not null default 'unallocated' check (fulfillment_status in ('unallocated', 'allocated', 'partially_shipped', 'shipped', 'completed')),
  total_idr bigint not null default 0 check (total_idr >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index commerce_orders_admin_queue_idx on public.commerce_orders (created_at desc, status, payment_status);
create index commerce_orders_customer_idx on public.commerce_orders (customer_id, created_at desc);

create table public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete cascade,
  sku_id uuid references public.catalog_skus(id) on delete set null,
  sku_snapshot text not null,
  product_name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_idr integer not null check (unit_price_idr >= 0),
  line_total_idr bigint generated always as (quantity * unit_price_idr) stored,
  created_at timestamptz not null default timezone('utc', now())
);

create index commerce_order_items_order_idx on public.commerce_order_items (order_id);

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null check (notification_type in ('new_order', 'payment', 'customer', 'system')),
  title text not null,
  body text not null,
  order_id uuid references public.commerce_orders(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index admin_notifications_inbox_idx on public.admin_notifications (read_at, created_at desc);

alter table public.pricing_tiers enable row level security;
alter table public.catalog_sku_prices enable row level security;
alter table public.admin_memberships enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_order_items enable row level security;
alter table public.admin_notifications enable row level security;

create policy "users can read their own admin membership"
  on public.admin_memberships for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "admins can read pricing configuration"
  on public.pricing_tiers for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy "owners can manage pricing configuration"
  on public.pricing_tiers for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role = 'owner'
    )
  );

create policy "customers can read their active pricing tier"
  on public.pricing_tiers for select
  to authenticated
  using (
    exists (
      select 1 from public.customer_profiles profile
      where profile.id = (select auth.uid())
        and profile.pricing_tier_id = pricing_tiers.id
    )
  );

create policy "customers can create their own profile"
  on public.customer_profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "customers can read their active tier prices"
  on public.catalog_sku_prices for select
  to authenticated
  using (
    is_active = true
    and effective_from <= timezone('utc', now())
    and (effective_until is null or effective_until > timezone('utc', now()))
    and exists (
      select 1
      from public.customer_profiles profile
      where profile.id = (select auth.uid())
        and profile.pricing_tier_id = catalog_sku_prices.pricing_tier_id
    )
  );

create policy "admins can manage product listings"
  on public.catalog_products for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'catalog_manager')
    )
  )
  with check (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'catalog_manager')
    )
  );

create policy "admins can manage sku listings"
  on public.catalog_skus for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'catalog_manager')
    )
  )
  with check (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'catalog_manager')
    )
  );

create policy "admins can manage sku prices"
  on public.catalog_sku_prices for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'catalog_manager')
    )
  )
  with check (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'catalog_manager')
    )
  );

create policy "customers can read their orders"
  on public.commerce_orders for select
  to authenticated
  using ((select auth.uid()) = customer_id);

create policy "admins can read orders"
  on public.commerce_orders for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'orders_manager', 'support')
    )
  );

create policy "customers can read their order items"
  on public.commerce_order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.commerce_orders order_row
      where order_row.id = commerce_order_items.order_id
        and order_row.customer_id = (select auth.uid())
    )
  );

create policy "admins can read order items"
  on public.commerce_order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.role in ('owner', 'orders_manager', 'support')
    )
  );

create policy "admins can read notifications"
  on public.admin_notifications for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy "admins can mark notifications read"
  on public.admin_notifications for update
  to authenticated
  using (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.admin_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

grant select, insert, update, delete on public.pricing_tiers to authenticated;
grant select on public.catalog_sku_prices to authenticated;
grant select on public.admin_memberships to authenticated;
grant select on public.commerce_orders to authenticated;
grant select on public.commerce_order_items to authenticated;
grant select, update on public.admin_notifications to authenticated;

create or replace function public.create_admin_order_notification()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.admin_notifications (notification_type, title, body, order_id)
  values ('new_order', 'Order baru masuk', 'Order ' || left(new.id::text, 8) || ' menunggu review fulfillment.', new.id);
  return new;
end;
$$;

create trigger commerce_orders_admin_notification
  after insert on public.commerce_orders
  for each row execute function public.create_admin_order_notification();

create or replace function public.recalculate_b2b_tier(p_account_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  paid_total bigint;
  paid_count integer;
  selected_tier uuid;
begin
  select coalesce(sum(total_idr), 0), count(*)::integer
    into paid_total, paid_count
  from public.commerce_orders
  where account_id = p_account_id
    and payment_status = 'paid';

  select id into selected_tier
  from public.pricing_tiers
  where is_active = true
    and minimum_lifetime_spend_idr <= paid_total
    and minimum_paid_order_count <= paid_count
  order by sort_order desc
  limit 1;

  update public.b2b_accounts
  set pricing_tier_id = selected_tier,
      lifetime_paid_amount_idr = paid_total,
      paid_order_count = paid_count,
      updated_at = timezone('utc', now())
  where id = p_account_id;

  update public.customer_profiles profile
  set pricing_tier_id = selected_tier,
      lifetime_paid_amount_idr = paid_total,
      paid_order_count = paid_count,
      updated_at = timezone('utc', now())
  where exists (
    select 1
    from public.b2b_memberships membership
    where membership.account_id = p_account_id
      and membership.user_id = profile.id
  );
end;
$$;

create or replace function public.refresh_b2b_tier_after_payment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.account_id is not null and new.payment_status = 'paid' then
    if tg_op = 'INSERT' or old.payment_status is distinct from 'paid' then
      perform public.recalculate_b2b_tier(new.account_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger commerce_orders_refresh_b2b_tier
  after insert or update of payment_status on public.commerce_orders
  for each row execute function public.refresh_b2b_tier_after_payment();

revoke execute on function public.recalculate_b2b_tier(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_b2b_tier(uuid) to service_role;
