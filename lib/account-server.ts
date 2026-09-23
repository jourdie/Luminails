import { createClient } from './supabase/server';
import { identityFromUser, needsCustomerProfile, type AccountIdentity, type CustomerLoyalty, type CustomerProfile } from './account';

export type AccountContext = {
  identity: AccountIdentity | null;
  profile: CustomerProfile | null;
  needsProfile: boolean;
  loyalty: CustomerLoyalty | null;
};

export async function getAccountContext(): Promise<AccountContext> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { identity: null, profile: null, needsProfile: false, loyalty: null };
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { identity: null, profile: null, needsProfile: false, loyalty: null };

  const [profileResponse, loyaltyResponse] = await Promise.all([
    supabase.from('customer_profiles').select('id, display_name, business_name, business_type, whatsapp, phone, address, studio_type, additional_info, avatar_url, status, pricing_tier_id, lifetime_paid_amount_idr, paid_order_count').eq('id', authData.user.id).maybeSingle(),
    supabase.from('loyalty_accounts').select('customer_id, pricing_tier_id, tier_code, cashback_rate_bps, available_points, lifetime_earned_points, lifetime_redeemed_points, updated_at').eq('customer_id', authData.user.id).maybeSingle(),
  ]);
  const profile = profileResponse.data;

  return {
    identity: identityFromUser(authData.user),
    profile: (profile as CustomerProfile | null) ?? null,
    needsProfile: needsCustomerProfile(profile as Partial<CustomerProfile> | null),
    loyalty: (loyaltyResponse.data as CustomerLoyalty | null) ?? null,
  };
}
