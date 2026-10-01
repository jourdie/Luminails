-- Database integration tests for production transaction foundations.
-- Run with: supabase test db

select plan(26);

select ok(to_regclass('public.commerce_payment_events') is not null, 'payment event inbox exists');
select ok(to_regclass('public.commerce_notification_outbox') is not null, 'notification outbox exists');
select ok(to_regprocedure('public.claim_notification_outbox(integer)') is not null, 'outbox claim function exists');
select ok(to_regprocedure('public.claim_notification_outbox_for_channel(text,integer)') is not null, 'channel-specific outbox claim function exists');
select ok(to_regprocedure('public.complete_notification_outbox(uuid,text)') is not null, 'outbox complete function exists');
select ok(to_regprocedure('public.fail_notification_outbox(uuid,text,integer)') is not null, 'outbox retry function exists');
select ok(to_regprocedure('public.record_payment_event(text,text,uuid,text,text,jsonb)') is not null, 'payment event idempotency function exists');
select ok(to_regprocedure('public.apply_payment_event(text,text,uuid,text,text,bigint,text,jsonb)') is not null, 'atomic payment application function exists');
select ok(has_function_privilege('service_role', 'public.claim_notification_outbox(integer)', 'execute'), 'service role can claim outbox');
select ok(not has_function_privilege('authenticated', 'public.claim_notification_outbox(integer)', 'execute'), 'authenticated cannot claim outbox');
select ok(has_function_privilege('service_role', 'public.claim_notification_outbox_for_channel(text,integer)', 'execute'), 'service role can claim one outbox channel');
select ok(not has_function_privilege('authenticated', 'public.claim_notification_outbox_for_channel(text,integer)', 'execute'), 'authenticated cannot claim one outbox channel');
select ok(has_function_privilege('service_role', 'public.apply_payment_event(text,text,uuid,text,text,bigint,text,jsonb)', 'execute'), 'service role can apply payment events');
select ok(not has_function_privilege('authenticated', 'public.apply_payment_event(text,text,uuid,text,text,bigint,text,jsonb)', 'execute'), 'authenticated cannot apply payment events');
select ok(to_regprocedure('private.release_checkout_reservations(uuid,text)') is not null, 'checkout reservation rollback function exists');

create temporary table transaction_test_context (order_id uuid not null);

with created as (
  insert into public.commerce_orders
    (customer_id, source_channel, status, payment_status, fulfillment_status, total_idr)
  values
    (null, 'manual', 'submitted_for_review', 'pending', 'unallocated', 1200000)
  returning id
)
insert into transaction_test_context (order_id)
select id from created;

select is(
  (select count(*)::bigint from public.commerce_notification_outbox where order_id = (select order_id from transaction_test_context)),
  3::bigint,
  'manual order creates only deliverable admin outbox rows'
);

select is(
  (select count(distinct event_key)::bigint from public.commerce_notification_outbox where order_id = (select order_id from transaction_test_context)),
  1::bigint,
  'new order notification rows share one idempotent event key'
);

update public.commerce_orders
   set status = 'awaiting_payment'
 where id = (select order_id from transaction_test_context);

select is(
  (select status from public.commerce_orders where id = (select order_id from transaction_test_context)),
  'awaiting_payment',
  'submitted order can move to awaiting payment'
);

select throws_ok(
  $$update public.commerce_orders set status = 'completed' where id = (select order_id from transaction_test_context)$$,
  'P0001',
  'INVALID_ORDER_STATUS_TRANSITION:awaiting_payment:completed',
  'invalid order status transition is rejected'
);

update public.commerce_orders
   set payment_status = 'expired'
 where id = (select order_id from transaction_test_context);

select is(
  (select count(*)::bigint from public.commerce_notification_outbox where order_id = (select order_id from transaction_test_context) and event_type = 'payment_expired'),
  3::bigint,
  'payment expiry creates a deduplicated notification fan-out'
);

update public.commerce_orders
   set payment_status = 'paid'
 where id = (select order_id from transaction_test_context);

select ok(
  (select paid_at is not null from public.commerce_orders where id = (select order_id from transaction_test_context)),
  'paid transition records paid_at'
);

select throws_ok(
  $$update public.commerce_orders set payment_status = 'failed' where id = (select order_id from transaction_test_context)$$,
  'P0001',
  'INVALID_PAYMENT_STATUS_TRANSITION:paid:failed',
  'invalid payment status transition is rejected'
);

insert into public.commerce_order_items
  (order_id, sku_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type)
values
  ((select order_id from transaction_test_context), null, 'ADDON-TEST', 'Add-on test', 1, 0, 'add_on');

select is(
  (select item_type from public.commerce_order_items where order_id = (select order_id from transaction_test_context) and sku_snapshot = 'ADDON-TEST'),
  'add_on',
  'add-on order item type is accepted'
);

select throws_ok(
  $$insert into public.commerce_order_items (order_id, sku_snapshot, product_name_snapshot, quantity, unit_price_idr, item_type) values ((select order_id from transaction_test_context), 'INVALID', 'Invalid item', 1, 0, 'invalid')$$,
  '23514',
  null,
  'unsupported order item type is rejected'
);

select ok(
  has_function_privilege('service_role', 'public.record_payment_event(text,text,uuid,text,text,jsonb)', 'execute'),
  'service role can record payment events'
);

select ok(
  not has_function_privilege('authenticated', 'public.record_payment_event(text,text,uuid,text,text,jsonb)', 'execute'),
  'authenticated cannot record payment events'
);

select is(
  (select count(*)::bigint from public.commerce_notification_outbox where order_id = (select order_id from transaction_test_context) and status = 'pending'),
  9::bigint,
  'all order and payment events remain durable until a worker claims them'
);

delete from public.commerce_orders where id = (select order_id from transaction_test_context);

select * from finish();
