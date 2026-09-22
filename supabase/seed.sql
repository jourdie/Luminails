-- Representative development data only. Prices and products are not production commitments.
insert into public.catalog_products (id, operations_product_id, slug, brand, name, category, short_description, is_published, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', 'demo-product-ph-bond', 'ph-bond', 'Luminails Lab', 'PH Bond', 'prep', 'Prep dasar untuk studio.', true, 10),
  ('10000000-0000-4000-8000-000000000002', 'demo-product-petal-glow', 'petal-glow', 'Bluesky', 'Color Gel â€” Petal Glow', 'gel', 'Warna coral lembut untuk koleksi spring.', true, 20),
  ('10000000-0000-4000-8000-000000000003', 'demo-product-rubber-base', 'rubber-base-milky', 'Party', 'Rubber Base â€” Milky', 'gel', 'Base gel untuk studio.', true, 30),
  ('10000000-0000-4000-8000-000000000004', 'demo-product-buffer', 'buffer-soft-touch', 'Luminails Lab', 'Buffer 100/180', 'tools', 'Buffer dua sisi untuk prep.', true, 40),
  ('10000000-0000-4000-8000-000000000005', 'demo-product-top-coat', 'no-wipe-top-coat', 'Born Pretty', 'No Wipe Top Coat â€” Glass', 'gel', 'Finishing clear untuk kilau.', true, 50),
  ('10000000-0000-4000-8000-000000000006', 'demo-product-lint-free', 'lint-free-wipes', 'Luminails Lab', 'Lint Free Wipes â€” 200 pcs', 'tools', 'Paket studio untuk repeat order.', true, 60)
on conflict (id) do update set
  name = excluded.name,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order;

insert into public.catalog_skus (id, product_id, operations_sku_id, sku, name, category_label, public_reference_price_idr, shade_code, tone, badge, is_active, sort_order)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'demo-sku-ln-phb-01', 'LN-PHB-01', 'PH Bond â€” nail prep', 'Prep', 38500, 'PH', 'tone-clear', 'Best seller', true, 10),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'demo-sku-bs-g07', 'BS-G07', 'Color Gel â€” Petal Glow', 'Color gel', 62000, '07', 'tone-coral', 'New shade', true, 20),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'demo-sku-pt-rb-02', 'PT-RB-02', 'Rubber Base â€” Milky', 'Base gel', 79000, 'RB', 'tone-lilac', 'Core studio', true, 30),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'demo-sku-ln-buf-01', 'LN-BUF-01', 'Buffer 100/180 â€” soft touch', 'Tools', 12000, '100', 'tone-sage', 'Refill', true, 40),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'demo-sku-bp-top-08', 'BP-TOP-08', 'No Wipe Top Coat â€” glass', 'Top coat', 54000, 'TOP', 'tone-clear', 'High shine', true, 50),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'demo-sku-ln-lfw-02', 'LN-LFW-02', 'Lint Free Wipes â€” 200 pcs', 'Tools', 28000, '200', 'tone-ink', 'Studio pack', true, 60)
on conflict (id) do update set
  name = excluded.name,
  public_reference_price_idr = excluded.public_reference_price_idr,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- Development pricing only. Replace thresholds and prices after business approval.
insert into public.catalog_sku_prices (id, sku_id, pricing_tier_id, unit_price_idr, effective_from, is_active)
values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 38500, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 62000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 79000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', 12000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001', 54000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000001', 28000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 33000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 52000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 68000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', 10000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000002', 47000, '2026-01-01T00:00:00Z', true),
  ('40000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000002', 24000, '2026-01-01T00:00:00Z', true)
on conflict (sku_id, pricing_tier_id, effective_from) do update set
  unit_price_idr = excluded.unit_price_idr,
  is_active = excluded.is_active;

-- Admin memberships intentionally cannot be seeded without a real auth.users id.
-- After creating a staff user, insert their UUID into public.admin_memberships.

-- Development promotions only. Replace codes, dates, values, and eligibility before production.
insert into public.commerce_promotions (id, code, name, promotion_type, audience_type, discount_type, discount_value, bundle_price_idr, minimum_order_amount_idr, minimum_item_quantity, repeat_order_min_count, voucher_code, usage_limit, usage_limit_per_customer, usage_count, starts_at, ends_at, status, is_stackable, is_active)
values
  ('50000000-0000-4000-8000-000000000001', 'WELCOME10', 'Welcome untuk user baru', 'new_user', 'new_user', 'percentage', 10, null, 250000, 0, 0, 'WELCOME10', 500, 1, 38, '2026-09-01T00:00:00Z', '2026-12-31T23:59:59Z', 'active', false, true),
  ('50000000-0000-4000-8000-000000000002', 'REPEAT5', 'Repeat order studio', 'repeat_order', 'repeat_customer', 'percentage', 5, null, 500000, 0, 2, 'REPEAT5', null, 1, 74, '2026-09-01T00:00:00Z', null, 'active', true, true),
  ('50000000-0000-4000-8000-000000000003', 'STARTERKIT', 'Studio Starter Bundle', 'bundle', 'all', 'fixed_price', 0, 399000, 0, 3, 0, null, 100, 2, 12, '2026-09-15T00:00:00Z', '2026-10-15T23:59:59Z', 'active', false, true),
  ('50000000-0000-4000-8000-000000000004', 'NINE9', '9.9 Beauty Week', 'seasonal', 'all', 'fixed_amount', 99000, null, 999000, 0, 0, 'NINE9', 999, 1, 218, '2026-09-09T00:00:00Z', '2026-09-12T23:59:59Z', 'expired', false, false),
  ('50000000-0000-4000-8000-000000000005', 'B2B-VVIP-ALYA', 'Special voucher customer eligible', 'custom_voucher', 'custom_customer', 'percentage', 12, null, 1000000, 0, 0, 'B2B-VVIP-ALYA', 1, 1, 0, '2026-09-22T00:00:00Z', '2026-10-31T23:59:59Z', 'scheduled', false, true)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());
