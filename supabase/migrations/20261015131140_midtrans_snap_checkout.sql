-- Keep the Snap attempt reusable when a customer returns to an unpaid order.
-- The token stays attached to the customer's own order and is not payment truth.
-- Midtrans notifications remain the source of truth.
alter table public.commerce_orders
  add column if not exists payment_token text,
  add column if not exists payment_redirect_url text,
  add column if not exists payment_started_at timestamptz;

create index if not exists commerce_orders_midtrans_attempt_idx
  on public.commerce_orders (payment_provider, payment_status, payment_started_at desc)
  where payment_provider = 'midtrans' and payment_status = 'pending';
