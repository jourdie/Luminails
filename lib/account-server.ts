import { createClient } from './supabase/server';
import { identityFromUser, needsCustomerProfile, type AccountIdentity, type CustomerLoyalty, type CustomerProfile } from './account';
import { summarizeExpiringPointLots } from './loyalty-engine';

export type AccountTierSummary = {
  code: string;
  name: string;
  lifetimeSpend: number;
  paidOrders: number;
  rollingSpend: number;
  multiplier: number;
  availablePoints: number;
  pendingPoints: number;
  expiringPoints: number;
  nextExpiryAt: string | null;
  pointUnitValueIdr: number;
  next: { code: string; name: string; minimumSpend: number; minimumOrders: number } | null;
};

export type AccountContext = {
  identity: AccountIdentity | null;
  profile: CustomerProfile | null;
  needsProfile: boolean;
  loyalty: CustomerLoyalty | null;
  tierSummary: AccountTierSummary | null;
};

export async function getAccountContext(): Promise<AccountContext> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { identity: null, profile: null, needsProfile: false, loyalty: null, tierSummary: null };
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { identity: null, profile: null, needsProfile: false, loyalty: null, tierSummary: null };

  const db = supabase as any;
  const [profileResponse, loyaltyResponse, tiersResponse, pricingTiersResponse, ordersResponse, pointLotsResponse, pointSettingsResponse] = await Promise.all([
    db.from('customer_profiles').select('id, display_name, business_name, business_type, whatsapp, phone, address, studio_type, additional_info, avatar_url, status, pricing_tier_id, customer_tier_id, auto_customer_tier_id, manual_tier_override_enabled, lifetime_paid_amount_idr, paid_order_count').eq('id', authData.user.id).maybeSingle(),
    db.from('loyalty_accounts').select('customer_id, pricing_tier_id, customer_tier_id, tier_code, cashback_rate_bps, available_points, lifetime_earned_points, lifetime_redeemed_points, updated_at').eq('customer_id', authData.user.id).maybeSingle(),
    db.from('customer_tiers').select('id, code, name, minimum_rolling_spend_idr, maximum_rolling_spend_idr, rolling_period_months, point_multiplier').eq('is_active', true).order('minimum_rolling_spend_idr', { ascending: true }),
    db.from('pricing_tiers').select('id, code, name, minimum_lifetime_spend_idr, minimum_paid_order_count, is_active, sort_order').eq('is_active', true).order('sort_order', { ascending: true }),
    db.from('commerce_orders').select('subtotal_idr, total_idr, discount_idr, created_at, payment_status').eq('customer_id', authData.user.id).in('payment_status', ['paid', 'partially_refunded', 'pending']).order('created_at', { ascending: false }).limit(500),
    db.from('loyalty_point_lots').select('remaining_points, expires_at').eq('customer_id', authData.user.id).gt('remaining_points', 0).order('expires_at'),
    db.from('loyalty_point_settings').select('point_unit_value_idr').eq('key', 'default').maybeSingle(),
  ]);
  const profile = profileResponse.data;
  const loyalty = loyaltyResponse.data as CustomerLoyalty | null;
  const lifetimeSpend = Number(profile?.lifetime_paid_amount_idr ?? 0);
  const paidOrders = Number(profile?.paid_order_count ?? 0);
  const tiers = (tiersResponse.data ?? []) as Array<{ id: string; code: string; name: string; minimum_rolling_spend_idr: number; maximum_rolling_spend_idr: number | null; rolling_period_months: number; point_multiplier: number }>;
  const pricingTiers = (pricingTiersResponse.data ?? []) as Array<{ id: string; code: string; name: string; minimum_lifetime_spend_idr: number; minimum_paid_order_count: number; is_active: boolean; sort_order: number }>;
  const rollingMonths = Math.max(...tiers.map((tier) => Number(tier.rolling_period_months) || 6), 6);
  const rollingCutoffDate = new Date();
  rollingCutoffDate.setMonth(rollingCutoffDate.getMonth() - rollingMonths);
  const rollingCutoff = rollingCutoffDate.getTime();
  const customerOrders = (ordersResponse.data ?? []) as Array<{ subtotal_idr?: number; total_idr?: number; discount_idr?: number; created_at: string; payment_status?: string }>;
  const eligible = (order: { subtotal_idr?: number; total_idr?: number; discount_idr?: number }) => Math.max(0, Number(order.subtotal_idr ?? order.total_idr ?? 0) - Number(order.discount_idr ?? 0));
  const rollingSpend = customerOrders.filter((order) => new Date(order.created_at).getTime() >= rollingCutoff && ['paid', 'partially_refunded'].includes(order.payment_status ?? '')).reduce((sum, order) => sum + eligible(order), 0);
  const pointUnitValue = Math.max(1, Number((pointSettingsResponse.data as { point_unit_value_idr?: number } | null)?.point_unit_value_idr ?? 10000));
  const expirySummary = summarizeExpiringPointLots(((pointLotsResponse.data ?? []) as Array<{ remaining_points?: number; expires_at: string }>).map((lot) => ({ remainingPoints: Number(lot.remaining_points ?? 0), expiresAt: lot.expires_at })));
  const expiringPoints = expirySummary.points;
  const nextExpiryAt = expirySummary.nextExpiryAt;
  const currentTier = tiers.find((tier) => tier.id === profile?.customer_tier_id || tier.id === loyalty?.customer_tier_id) ?? tiers.find((tier) => tier.code === loyalty?.tier_code) ?? tiers[0];
  const pendingPoints = customerOrders.filter((order) => order.payment_status === 'pending').reduce((sum, order) => sum + Math.floor(eligible(order) / pointUnitValue * Number(currentTier?.point_multiplier ?? 1)), 0);
  const nextPricingTier = pricingTiers.filter((tier) => tier.is_active && (Number(tier.minimum_lifetime_spend_idr) > lifetimeSpend || Number(tier.minimum_paid_order_count) > paidOrders)).sort((a, b) => a.sort_order - b.sort_order || Number(a.minimum_lifetime_spend_idr) - Number(b.minimum_lifetime_spend_idr))[0] ?? null;
  const accountTier = pricingTiers.find((tier) => tier.id === profile?.pricing_tier_id) ?? currentTier;
  const tierSummary = accountTier ? { code: accountTier.code, name: accountTier.name, lifetimeSpend, rollingSpend, paidOrders, multiplier: Number(currentTier?.point_multiplier ?? 1), availablePoints: Number(loyalty?.available_points ?? 0), pendingPoints, expiringPoints, nextExpiryAt, pointUnitValueIdr: pointUnitValue, next: nextPricingTier ? { code: nextPricingTier.code, name: nextPricingTier.name, minimumSpend: Number(nextPricingTier.minimum_lifetime_spend_idr), minimumOrders: Number(nextPricingTier.minimum_paid_order_count) } : null } : null;

  return {
    identity: identityFromUser(authData.user),
    profile: (profile as CustomerProfile | null) ?? null,
    needsProfile: needsCustomerProfile(profile as Partial<CustomerProfile> | null),
    loyalty,
    tierSummary,
  };
}
