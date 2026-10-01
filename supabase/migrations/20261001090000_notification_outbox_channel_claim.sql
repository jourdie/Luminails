-- Allow each provider worker to claim only the channel it can deliver.
-- The existing all-channel claim function remains available for a future
-- orchestrator, while provider-specific workers use this safer boundary.

create or replace function public.claim_notification_outbox_for_channel(
  p_channel text,
  p_limit integer default 25
)
returns setof public.commerce_notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_channel not in ('whatsapp', 'email', 'discord') then
    raise exception 'INVALID_NOTIFICATION_CHANNEL';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'INVALID_BATCH_SIZE';
  end if;

  return query
  with candidates as (
    select id
      from public.commerce_notification_outbox
     where channel = p_channel
       and (
         (status in ('pending', 'failed') and available_at <= timezone('utc', now()))
         or (
           status = 'processing'
           and locked_at < timezone('utc', now()) - interval '10 minutes'
         )
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

revoke all on function public.claim_notification_outbox_for_channel(text, integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox_for_channel(text, integer) to service_role;
