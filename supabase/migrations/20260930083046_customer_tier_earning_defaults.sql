-- Default customer tiers for a clear earning program.
-- Earning is calculated as floor(eligible paid spend / 10,000 * points_per_10000_idr).
-- Minimum spend is evaluated over each tier's rolling period; there is no maximum tier boundary.

insert into public.customer_tiers (
  code, name, minimum_rolling_spend_idr, maximum_rolling_spend_idr,
  rolling_period_months, point_multiplier, points_per_10000_idr,
  description, benefits_description, priority, is_active
)
values
  ('BASIC', 'Basic', 0, null, 6, 1.00, 1.00,
    'Tier awal untuk customer baru.',
    '1 point setiap Rp10.000 belanja eligible.', 10, true),
  ('PREMIUM', 'Premium', 2000000, null, 6, 1.25, 1.25,
    'Aktif setelah rolling spend mencapai Rp2.000.000.',
    '1,25 points setiap Rp10.000 belanja eligible.', 20, true),
  ('VIP', 'VIP', 5000000, null, 6, 1.50, 1.50,
    'Aktif setelah rolling spend mencapai Rp5.000.000.',
    '1,5 points setiap Rp10.000 belanja eligible.', 30, true)
on conflict (code) do nothing;

comment on column public.customer_tiers.points_per_10000_idr is
  'Points earned per Rp10.000 eligible paid spend. Tier attainment thresholds remain separate.';