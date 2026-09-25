import { createClient } from './supabase/server';

export type StorefrontPromotion = {
  code: string;
  name: string;
  description: string | null;
  promotion_type: 'new_user' | 'repeat_order' | 'bundle' | 'seasonal' | 'custom_voucher';
  discount_type: 'percentage' | 'fixed_amount' | 'fixed_price' | 'free_shipping';
  discount_value: number;
  bundle_price_idr: number | null;
  starts_at: string;
  ends_at: string | null;
};

export async function getPublicPromotions(): Promise<StorefrontPromotion[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('commerce_promotions')
    .select('code, name, description, promotion_type, discount_type, discount_value, bundle_price_idr, starts_at, ends_at')
    .in('status', ['scheduled', 'active'])
    .eq('is_active', true)
    .in('audience_type', ['all', 'new_user', 'repeat_customer'])
    .order('starts_at', { ascending: false })
    .limit(6);
  if (error) return [];
  const now = Date.now();
  return ((data ?? []) as StorefrontPromotion[]).filter((promotion) => {
    const starts = Date.parse(promotion.starts_at);
    const ends = promotion.ends_at ? Date.parse(promotion.ends_at) : Number.POSITIVE_INFINITY;
    return starts <= now && ends > now;
  });
}
