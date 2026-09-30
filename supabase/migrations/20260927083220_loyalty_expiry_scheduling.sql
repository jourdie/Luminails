-- Keep loyalty points and temporary manual tier overrides correct without
-- waiting for the next customer order or account page visit.

create extension if not exists pg_cron with schema extensions;

create or replace function public.expire_customer_tier_overrides(
  p_as_of timestamptz default timezone('utc', now())
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  customer_row record;
  expired_total integer := 0;
begin
  for customer_row in
    select id
    from public.customer_profiles
    where manual_tier_override_enabled = true
      and manual_tier_expires_at is not null
      and manual_tier_expires_at <= p_as_of
    for update
  loop
    update public.customer_profiles
    set manual_tier_override_enabled = false,
        updated_at = timezone('utc', now())
    where id = customer_row.id;

    perform public.recalculate_customer_tier(customer_row.id);
    expired_total := expired_total + 1;
  end loop;

  return expired_total;
end;
$$;

revoke all on function public.expire_customer_tier_overrides(timestamptz) from public, anon, authenticated;
grant execute on function public.expire_customer_tier_overrides(timestamptz) to service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'luminails-expire-loyalty-points') then
    perform cron.schedule(
      'luminails-expire-loyalty-points',
      '5 0 * * *',
      $job$select public.expire_loyalty_points();$job$
    );
  end if;

  if not exists (select 1 from cron.job where jobname = 'luminails-expire-tier-overrides') then
    perform cron.schedule(
      'luminails-expire-tier-overrides',
      '10 0 * * *',
      $job$select public.expire_customer_tier_overrides();$job$
    );
  end if;
end;
$$;
