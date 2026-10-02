-- Keep the customer address book consistent under concurrent saves.

-- Clean up historical duplicates before enforcing one default address per customer.
with ranked_defaults as (
  select
    id,
    row_number() over (
      partition by customer_id
      order by is_default desc, created_at desc, id desc
    ) as row_number
  from public.customer_addresses
  where is_default = true
)
update public.customer_addresses as addresses
set is_default = false,
    updated_at = timezone('utc', now())
from ranked_defaults
where addresses.id = ranked_defaults.id
  and ranked_defaults.row_number > 1;

create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (customer_id)
  where is_default = true;

create or replace function public.save_customer_address(
  p_id uuid default null,
  p_label text default null,
  p_recipient_name text default null,
  p_phone text default null,
  p_address_line text default null,
  p_city text default null,
  p_province text default null,
  p_postal_code text default null,
  p_notes text default null,
  p_is_default boolean default false
)
returns public.customer_addresses
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  address_row public.customer_addresses;
  should_be_default boolean := coalesce(p_is_default, false);
begin
  if actor_id is null then
    raise exception 'ADDRESS_AUTH_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_label, '')), '') is null
     or nullif(trim(coalesce(p_recipient_name, '')), '') is null
     or nullif(trim(coalesce(p_phone, '')), '') is null
     or nullif(trim(coalesce(p_address_line, '')), '') is null
     or nullif(trim(coalesce(p_city, '')), '') is null then
    raise exception 'ADDRESS_REQUIRED_FIELDS';
  end if;

  -- Serialize saves for one customer so the partial unique index cannot turn a
  -- normal concurrent save into an avoidable duplicate-default failure.
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));

  if p_id is not null then
    select * into address_row
      from public.customer_addresses
     where id = p_id
       and customer_id = actor_id
     for update;

    if not found then
      raise exception 'ADDRESS_NOT_FOUND';
    end if;
  elsif not exists (
    select 1
      from public.customer_addresses
     where customer_id = actor_id
       and is_default = true
  ) then
    should_be_default := true;
  end if;

  if should_be_default then
    update public.customer_addresses
       set is_default = false,
           updated_at = timezone('utc', now())
     where customer_id = actor_id
       and (p_id is null or id <> p_id)
       and is_default = true;
  end if;

  if p_id is null then
    insert into public.customer_addresses (
      customer_id, label, recipient_name, phone, address_line, city,
      province, postal_code, notes, is_default
    ) values (
      actor_id, trim(p_label), trim(p_recipient_name), trim(p_phone),
      trim(p_address_line), trim(p_city), nullif(trim(coalesce(p_province, '')), ''),
      nullif(trim(coalesce(p_postal_code, '')), ''), nullif(trim(coalesce(p_notes, '')), ''),
      should_be_default
    ) returning * into address_row;
  else
    update public.customer_addresses
       set label = trim(p_label),
           recipient_name = trim(p_recipient_name),
           phone = trim(p_phone),
           address_line = trim(p_address_line),
           city = trim(p_city),
           province = nullif(trim(coalesce(p_province, '')), ''),
           postal_code = nullif(trim(coalesce(p_postal_code, '')), ''),
           notes = nullif(trim(coalesce(p_notes, '')), ''),
           is_default = should_be_default,
           updated_at = timezone('utc', now())
     where id = p_id
       and customer_id = actor_id
     returning * into address_row;
  end if;

  return address_row;
end;
$$;

revoke all on function public.save_customer_address(uuid, text, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.save_customer_address(uuid, text, text, text, text, text, text, text, text, boolean) to authenticated;
