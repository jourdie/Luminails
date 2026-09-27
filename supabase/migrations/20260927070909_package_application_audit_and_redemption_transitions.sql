-- Record the package selected at checkout as a customer-facing order event.
-- This intentionally does not use the admin-only audit permission gate because
-- the order is created by an authenticated customer.
create or replace function private.audit_package_application()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.item_type = 'package' and new.package_id is not null and auth.uid() is not null then
    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, new_value)
    values (
      auth.uid(),
      'package_application',
      'commerce_order',
      new.order_id,
      jsonb_build_object('package_id', new.package_id, 'quantity', new.quantity)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists commerce_order_package_application_audit_trigger on public.commerce_order_items;
create trigger commerce_order_package_application_audit_trigger
after insert on public.commerce_order_items
for each row execute function private.audit_package_application();

-- Keep redemption fulfillment state monotonic. Cancellation/reversal can be
-- entered from any non-terminal state, but a terminal record cannot go back.
create or replace function private.validate_loyalty_redemption_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.status = new.status then return new; end if;
  if old.status in ('cancelled', 'reversed') then
    raise exception 'INVALID_REDEMPTION_STATUS_TRANSITION';
  end if;
  if new.status in ('cancelled', 'reversed') then return new; end if;
  if old.status = 'pending' and new.status in ('applied', 'confirmed', 'fulfilled') then return new; end if;
  if old.status = 'applied' and new.status in ('confirmed', 'fulfilled') then return new; end if;
  if old.status = 'confirmed' and new.status = 'fulfilled' then return new; end if;
  raise exception 'INVALID_REDEMPTION_STATUS_TRANSITION';
end;
$$;

drop trigger if exists loyalty_redemption_status_transition_guard on public.loyalty_redemptions;
create trigger loyalty_redemption_status_transition_guard
before update of status on public.loyalty_redemptions
for each row execute function private.validate_loyalty_redemption_status_transition();
