import { createClient } from './supabase/server';

export type CustomerReward = {
  id: string;
  skuId: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  normalSellingPriceIdr: number;
  rewardStock: number;
  maxRedemptionQuantity: number;
  minimumOrderValueIdr: number;
  minimumTierName: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

type RewardRow = {
  id: string;
  sku_id: string;
  reward_name: string | null;
  description: string | null;
  image_url: string | null;
  points_cost: number;
  normal_selling_price_idr: number;
  reward_stock: number;
  max_redemption_quantity: number;
  minimum_order_value_idr: number;
  minimum_customer_tier_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  catalog_skus: { sku: string; name: string; image_url: string | null } | { sku: string; name: string; image_url: string | null }[] | null;
};

export async function getCustomerRewards(): Promise<CustomerReward[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return [];
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];
  const db = supabase as any;
  const [{ data: rewards, error }, { data: tiers }] = await Promise.all([
    db.from('loyalty_reward_catalog')
      .select('id, sku_id, reward_name, description, image_url, points_cost, normal_selling_price_idr, reward_stock, max_redemption_quantity, minimum_order_value_idr, minimum_customer_tier_id, starts_at, ends_at, catalog_skus(sku, name, image_url)')
      .eq('is_active', true)
      .order('points_cost')
      .limit(200),
    db.from('customer_tiers').select('id, name').eq('is_active', true),
  ]);
  if (error || !rewards) return [];
  const now = Date.now();
  const tierNames = new Map<string, string>((tiers ?? []).map((tier: { id: string; name: string }) => [tier.id, String(tier.name)] as [string, string]));
  return (rewards as RewardRow[])
    .filter((reward) => (!reward.starts_at || Date.parse(reward.starts_at) <= now) && (!reward.ends_at || Date.parse(reward.ends_at) > now))
    .map((reward) => {
      const sku = Array.isArray(reward.catalog_skus) ? reward.catalog_skus[0] : reward.catalog_skus;
      return {
        id: reward.id,
        skuId: reward.sku_id,
        sku: sku?.sku ?? reward.sku_id,
        name: reward.reward_name ?? sku?.name ?? 'Free product',
        description: reward.description,
        imageUrl: reward.image_url ?? sku?.image_url ?? null,
        pointsCost: Number(reward.points_cost),
        normalSellingPriceIdr: Number(reward.normal_selling_price_idr ?? 0),
        rewardStock: Number(reward.reward_stock ?? 0),
        maxRedemptionQuantity: Number(reward.max_redemption_quantity ?? 1),
        minimumOrderValueIdr: Number(reward.minimum_order_value_idr ?? 0),
        minimumTierName: reward.minimum_customer_tier_id ? tierNames.get(reward.minimum_customer_tier_id) ?? 'Tier tertentu' : null,
        startsAt: reward.starts_at,
        endsAt: reward.ends_at,
      };
    });
}