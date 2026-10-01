-- SECURITY DEFINER functions run as their owner, so current_user is not a
-- reliable way to detect the caller. Access is restricted by the explicit
-- REVOKE/GRANT below; the function bodies must not reject service_role calls.

create or replace function public.claim_notification_outbox(p_limit integer default 25)
returns setof public.commerce_notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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
begin
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
