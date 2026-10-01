-- Production transaction foundation.
-- This migration does not connect any third-party provider. It creates the
-- durable records and guarded transitions needed before payment/notification
-- adapters are enabled.

alter table public.commerce_orders
  add column if not exists payment_expires_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_failure_reason text,
  add column if not exists cancelled_at timestamptz;

alter table public.commerce_orders
  drop constraint if exists commerce_orders_payment_status_check;

alter table public.commerce_orders
  add constraint commerce_orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded'));

create unique index if not exists commerce_orders_provider_reference_idx
  on public.commerce_orders (payment_provider, payment_reference)
  where payment_provider is not null and payment_reference is not null;

create index if not exists commerce_orders_payment_expiry_idx
  on public.commerce_orders (payment_expires_at, payment_status)
  where payment_status = 'pending' and payment_expires_at is not null;

create table if not exists public.commerce_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(trim(provider)) > 0),
  provider_event_id text not null check (length(trim(provider_event_id)) > 0),
  order_id uuid references public.commerce_orders(id) on delete set null,
  payment_status text not null check (payment_status in ('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded')),
  payment_reference text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commerce_payment_events_provider_event_key unique (provider, provider_event_id)
);

create index if not exists commerce_payment_events_order_idx
  on public.commerce_payment_events (order_id, created_at desc);

alter table public.commerce_payment_events enable row level security;
revoke all on public.commerce_payment_events from anon, authenticated;

create table if not exists public.commerce_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.commerce_orders(id) on delete cascade,
  event_key text not null,
  event_type text not null check (event_type in (
    'order_created',
    'payment_paid',
    'payment_failed',
    'payment_expired',
    'order_cancelled',
    'fulfillment_updated',
    'system_error'
  )),
  channel text not null check (channel in ('whatsapp', 'email', 'discord')),
  recipient_key text not null check (length(trim(recipient_key)) > 0),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commerce_notification_outbox_target_key unique (event_key, channel, recipient_key)
);

create index if not exists commerce_notification_outbox_claim_idx
  on public.commerce_notification_outbox (status, available_at, created_at);
create index if not exists commerce_notification_outbox_order_idx
  on public.commerce_notification_outbox (order_id, created_at desc);

alter table public.commerce_notification_outbox enable row level security;
revoke all on public.commerce_notification_outbox from anon, authenticated;
grant select on public.commerce_notification_outbox to authenticated;

create policy "admins can read notification outbox"
  on public.commerce_notification_outbox for select to authenticated
  using (public.has_admin_permission('notifications'));

create or replace function private.validate_commerce_order_transition()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.status is distinct from new.status and not (
    (old.status = 'submitted_for_review' and new.status in ('awaiting_payment', 'paid', 'cancelled'))
    or (old.status = 'awaiting_payment' and new.status in ('paid', 'cancelled'))
    or (old.status = 'paid' and new.status in ('fulfilling', 'completed'))
    or (old.status = 'fulfilling' and new.status = 'completed')
  ) then
    raise exception 'INVALID_ORDER_STATUS_TRANSITION:%:%', old.status, new.status;
  end if;

  if old.payment_status is distinct from new.payment_status and not (
    (old.payment_status = 'pending' and new.payment_status in ('paid', 'failed', 'expired'))
    or (old.payment_status = 'failed' and new.payment_status in ('pending', 'paid', 'expired'))
    or (old.payment_status = 'expired' and new.payment_status in ('pending', 'paid', 'failed'))
    or (old.payment_status = 'paid' and new.payment_status in ('partially_refunded', 'refunded'))
    or (old.payment_status = 'partially_refunded' and new.payment_status = 'refunded')
  ) then
    raise exception 'INVALID_PAYMENT_STATUS_TRANSITION:%:%', old.payment_status, new.payment_status;
  end if;

  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    new.paid_at := coalesce(new.paid_at, timezone('utc', now()));
    new.payment_failure_reason := null;
  elsif new.payment_status in ('failed', 'expired') and old.payment_status is distinct from new.payment_status then
    new.paid_at := null;
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, timezone('utc', now()));
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function private.validate_commerce_order_transition() from public, anon, authenticated;

drop trigger if exists commerce_orders_validate_transition on public.commerce_orders;
create trigger commerce_orders_validate_transition
before update of status, payment_status, paid_at, payment_failure_reason, cancelled_at
on public.commerce_orders
for each row execute function private.validate_commerce_order_transition();

create or replace function private.enqueue_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  event_name text;
  event_key_value text;
  payload_value jsonb;
begin
  if tg_op = 'INSERT' then
    event_name := 'order_created';
  elsif new.status = 'cancelled' and old.status is distinct from new.status then
    event_name := 'order_cancelled';
  elsif old.payment_status is distinct from new.payment_status then
    event_name := case new.payment_status
      when 'paid' then 'payment_paid'
      when 'failed' then 'payment_failed'
      when 'expired' then 'payment_expired'
      else null
    end;
  elsif old.fulfillment_status is distinct from new.fulfillment_status then
    event_name := 'fulfillment_updated';
  end if;

  if event_name is null then
    return new;
  end if;

  event_key_value := 'order:' || new.id::text || ':' || event_name;
  payload_value := jsonb_build_object(
    'event_type', event_name,
    'order_id', new.id,
    'customer_id', new.customer_id,
    'status', new.status,
    'payment_status', new.payment_status,
    'fulfillment_status', new.fulfillment_status,
    'total_idr', new.total_idr,
    'contact_phone', new.contact_phone,
    'created_at', new.created_at,
    'updated_at', new.updated_at
  );

  insert into public.commerce_notification_outbox
    (order_id, event_key, event_type, channel, recipient_key, payload)
  select new.id, event_key_value, event_name, recipients.channel, recipients.recipient_key, payload_value
    from (values
      ('whatsapp'::text, 'admin'::text),
      ('email'::text, 'admin'::text),
      ('discord'::text, 'admin'::text),
      ('whatsapp'::text, 'customer'::text),
      ('email'::text, 'customer'::text)
    ) as recipients(channel, recipient_key)
   where recipients.recipient_key = 'admin'
      or (
        new.customer_id is not null
        and (
          recipients.channel = 'email'
          or nullif(trim(new.contact_phone), '') is not null
        )
      )
  on conflict (event_key, channel, recipient_key) do nothing;

  return new;
end;
$$;

revoke all on function private.enqueue_order_notification() from public, anon, authenticated;

drop trigger if exists commerce_orders_notification_outbox on public.commerce_orders;
create trigger commerce_orders_notification_outbox
after insert or update of status, payment_status, fulfillment_status
on public.commerce_orders
for each row execute function private.enqueue_order_notification();

create or replace function public.claim_notification_outbox(p_limit integer default 25)
returns setof public.commerce_notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'INVALID_BATCH_SIZE';
  end if;

  return query
  with candidates as (
    select id
      from public.commerce_notification_outbox
     where (
       status in ('pending', 'failed')
       and available_at <= timezone('utc', now())
     )
     or (
       status = 'processing'
       and locked_at < timezone('utc', now()) - interval '10 minutes'
     )
     order by created_at
     for update skip locked
     limit p_limit
  )
  update public.commerce_notification_outbox outbox
     set status = 'processing',
         attempt_count = outbox.attempt_count + 1,
         locked_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
    from candidates
   where outbox.id = candidates.id
  returning outbox.*;
end;
$$;

create or replace function public.complete_notification_outbox(p_id uuid, p_provider_message_id text default null)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  update public.commerce_notification_outbox
     set status = 'sent',
         sent_at = timezone('utc', now()),
         provider_message_id = nullif(trim(p_provider_message_id), ''),
         locked_at = null,
         last_error = null,
         updated_at = timezone('utc', now())
   where id = p_id and status = 'processing';
  return found;
end;
$$;

create or replace function public.fail_notification_outbox(p_id uuid, p_error text, p_retry_after_seconds integer default 300)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_status text;
begin
  if current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_retry_after_seconds < 0 or p_retry_after_seconds > 86400 then
    raise exception 'INVALID_RETRY_DELAY';
  end if;

  update public.commerce_notification_outbox
     set status = case when attempt_count >= 8 then 'failed' else 'pending' end,
         available_at = timezone('utc', now()) + make_interval(secs => case when attempt_count >= 8 then 0 else p_retry_after_seconds end),
         locked_at = null,
         last_error = left(coalesce(p_error, 'Notification provider error'), 2000),
         updated_at = timezone('utc', now())
   where id = p_id and status = 'processing';
  return found;
end;
$$;

create or replace function public.record_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_order_id uuid,
  p_payment_status text,
  p_payment_reference text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_payment_status not in ('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded') then
    raise exception 'INVALID_PAYMENT_STATUS';
  end if;

  insert into public.commerce_payment_events
    (provider, provider_event_id, order_id, payment_status, payment_reference, payload)
  values
    (trim(p_provider), trim(p_provider_event_id), p_order_id, p_payment_status, nullif(trim(p_payment_reference), ''), coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, provider_event_id) do nothing
  returning id into event_id;

  if event_id is null then
    select id into event_id
      from public.commerce_payment_events
     where provider = trim(p_provider)
       and provider_event_id = trim(p_provider_event_id);
    return jsonb_build_object('duplicate', true, 'event_id', event_id);
  end if;

  return jsonb_build_object('duplicate', false, 'event_id', event_id);
end;
$$;

revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
revoke all on function public.complete_notification_outbox(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_notification_outbox(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.record_payment_event(text, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;
grant execute on function public.complete_notification_outbox(uuid, text) to service_role;
grant execute on function public.fail_notification_outbox(uuid, text, integer) to service_role;
grant execute on function public.record_payment_event(text, text, uuid, text, text, jsonb) to service_role;

comment on table public.commerce_payment_events is
  'Immutable provider event inbox used for payment webhook idempotency.';
comment on table public.commerce_notification_outbox is
  'Durable notification queue. Provider adapters claim, send, complete, or retry these rows.';
