export type AccountIdentity = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type CustomerProfile = {
  id: string;
  display_name: string | null;
  business_name: string | null;
  business_type: string | null;
  whatsapp: string | null;
  phone: string | null;
  address: string | null;
  studio_type: string | null;
  additional_info: string | null;
  avatar_url: string | null;
  status: string;
  pricing_tier_id?: string | null;
  lifetime_paid_amount_idr?: number;
  paid_order_count?: number;
  customer_tier_id?: string | null;
  auto_customer_tier_id?: string | null;
  manual_tier_override_enabled?: boolean;
};


export type CustomerLoyalty = { customer_id: string; pricing_tier_id: string | null; customer_tier_id?: string | null; tier_code: string; cashback_rate_bps: number; available_points: number; lifetime_earned_points: number; lifetime_redeemed_points: number; updated_at: string; };
export function identityFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): AccountIdentity {
  const metadata = user.user_metadata ?? {};
  const email = user.email ?? '';
  const metadataName = metadata.full_name ?? metadata.name ?? metadata.display_name;
  const metadataAvatar = metadata.avatar_url ?? metadata.picture;

  return {
    name: typeof metadataName === 'string' && metadataName.trim() ? metadataName : email.split('@')[0] || 'Account',
    email,
    avatarUrl: typeof metadataAvatar === 'string' && metadataAvatar.trim() ? metadataAvatar : null,
  };
}

export function needsCustomerProfile(profile: Partial<CustomerProfile> | null | undefined) {
  return !profile?.display_name?.trim() || !profile?.business_name?.trim() || !profile?.phone?.trim() || !profile?.address?.trim() || !profile?.studio_type?.trim();
}
