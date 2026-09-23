-- Keep fulfillment tracking admin-only without broad table write grants.
create or replace function public.set_order_tracking(p_order_id uuid, p_provider text, p_tracking_number text, p_tracking_url text default null, p_status text default 'in_transit')
returns public.commerce_shipments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result_row public.commerce_shipments;
begin
  if auth.uid() is null or not public.has_admin_permission('orders') then raise exception 'ORDER_PERMISSION_REQUIRED'; end if;
  if p_status not in ('ready', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled') then raise exception 'INVALID_SHIPMENT_STATUS'; end if;
  update public.commerce_shipments
  set provider_code = nullif(trim(p_provider), ''),
      tracking_number = nullif(trim(p_tracking_number), ''),
      tracking_url = nullif(trim(p_tracking_url), ''),
      status = p_status,
      shipped_at = case when p_status in ('picked_up', 'in_transit', 'delivered') then coalesce(shipped_at, timezone('utc', now())) else shipped_at end,
      delivered_at = case when p_status = 'delivered' then timezone('utc', now()) else delivered_at end,
      updated_at = timezone('utc', now())
  where order_id = p_order_id
  returning * into result_row;
  if result_row.id is null then raise exception 'SHIPMENT_NOT_FOUND'; end if;
  update public.commerce_orders
  set fulfillment_status = case when p_status = 'delivered' then 'completed' when p_status in ('picked_up', 'in_transit') then 'shipped' else fulfillment_status end,
      updated_at = timezone('utc', now())
  where id = p_order_id;
  insert into public.commerce_order_events (order_id, event_type, status, message, metadata, created_by)
  values (p_order_id, 'tracking', p_status, 'Tracking order diperbarui.', jsonb_build_object('provider', p_provider, 'tracking_number', p_tracking_number), auth.uid());
  return result_row;
end;
$$;
revoke all on function public.set_order_tracking(uuid, text, text, text, text) from public, anon;
grant execute on function public.set_order_tracking(uuid, text, text, text, text) to authenticated;
