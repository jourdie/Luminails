import { createClient } from './supabase/server';
import { identityFromUser, needsCustomerProfile, type AccountIdentity, type CustomerLoyalty, type CustomerProfile } from './account';

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
  const [profileResponse, loyaltyResponse, tiersResponse, ordersResponse, pointLotsResponse] = await Promise.all([
    db.from('customer_profiles').select('id, display_name, business_name, business_type, whatsapp, phone, address, studio_type, additional_info, avatar_url, status, pricing_tier_id, customer_tier_id, auto_customer_tier_id, manual_tier_override_enabled, lifetime_paid_amount_idr, paid_order_count').eq('id', authData.user.id).maybeSingle(),
    db.from('loyalty_accounts').select('customer_id, pricing_tier_id, customer_tier_id, tier_code, cashback_rate_bps, available_points, lifetime_earned_points, lifetime_redeemed_points, updated_at').eq('customer_id', authData.user.id).maybeSingle(),
    db.from('customer_tiers').select('id, code, name, minimum_rolling_spend_idr, maximum_rolling_spend_idr, rolling_period_months, point_multiplier').eq('is_active', true).order('minimum_rolling_spend_idr', { ascending: true }),
    db.from('commerce_orders').select('subtotal_idr, total_idr, discount_idr, created_at, payment_status').eq('customer_id', authData.user.id).in('payment_status', ['paid', 'partially_refunded', 'pending']).order('created_at', { ascending: false }).limit(500),
    db.from('loyalty_point_lots').select('remaining_points, expires_at').eq('customer_id', authData.user.id).gt('remaining_points', 0).order('expires_at'),
  ]);
  const profile = profileResponse.data;
  const loyalty = loyaltyResponse.data as CustomerLoyalty | null;
  const lifetimeSpend = Number(profile?.lifetime_paid_amount_idr ?? 0);
  const paidOrders = Number(profile?.paid_order_count ?? 0);
  const tiers = (tiersResponse.data ?? []) as Array<{ id: string; code: string; name: string; minimum_rolling_spend_idr: number; maximum_rolling_spend_idr: number | null; rolling_period_months: number; point_multiplier: number }>;
  const rollingMonths = Math.max(...tiers.map((tier) => Number(tier.rolling_period_months) || 6), 6);
  const rollingCutoff = Date.now() - rollingMonths * 30 * 24 * 60 * 60 * 1000;
  const customerOrders = (ordersResponse.data ?? []) as Array<{ subtotal_idr?: number; total_idr?: number; discount_idr?: number; created_at: string; payment_status?: string }>;
  const eligible = (order: { subtotal_idr?: number; total_idr?: number; discount_idr?: number }) => Math.max(0, Number(order.subtotal_idr ?? order.total_idr ?? 0) - Number(order.discount_idr ?? 0));
  const rollingSpend = customerOrders.filter((order) => new Date(order.created_at).getTime() >= rollingCutoff && ['paid', 'partially_refunded'].includes(order.payment_status ?? '')).reduce((sum, order) => sum + eligible(order), 0);
  const pointUnitValue = 10000;
  const expiryCutoff = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const expiringLots = ((pointLotsResponse.data ?? []) as Array<{ remaining_points?: number; expires_at: string }>).filter((lot) => {
    const expires = new Date(lot.expires_at).getTime();
    return Number.isFinite(expires) && expires <= expiryCutoff;
  });
  const expiringPoints = expiringLots.reduce((sum, lot) => sum + Number(lot.remaining_points ?? 0), 0);
  const nextExpiryAt = expiringLots[0]?.expires_at ?? null;
  const currentTier = tiers.find((tier) => tier.id === profile?.customer_tier_id || tier.id === loyalty?.customer_tier_id) ?? tiers.find((tier) => tier.code === loyalty?.tier_code) ?? tiers[0];
  const pendingPoints = customerOrders.filter((order) => order.payment_status === 'pending').reduce((sum, order) => sum + Math.floor(eligible(order) / pointUnitValue * Number(currentTier?.point_multiplier ?? 1)), 0);
  const nextTier = currentTier ? tiers.filter((tier) => tier.minimum_rolling_spend_idr > rollingSpend).sort((a, b) => a.minimum_rolling_spend_idr - b.minimum_rolling_spend_idr)[0] ?? null : null;
  const tierSummary = currentTier ? { code: currentTier.code, name: currentTier.name, lifetimeSpend, rollingSpend, paidOrders, multiplier: Number(currentTier.point_multiplier), availablePoints: Number(loyalty?.available_points ?? 0), pendingPoints, expiringPoints, nextExpiryAt, next: nextTier ? { code: nextTier.code, name: nextTier.name, minimumSpend: Number(nextTier.minimum_rolling_spend_idr), minimumOrders: 0 } : null } : null;

  return {
    identity: identityFromUser(authData.user),
    profile: (profile as CustomerProfile | null) ?? null,
    needsProfile: needsCustomerProfile(profile as Partial<CustomerProfile> | null),
    loyalty,
    tierSummary,
  };
}
