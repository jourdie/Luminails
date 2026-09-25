import { createClient } from './supabase/server';

export type CatalogProduct = {
  id: string;
  brand: string;
  name: string;
  category: string;
  categoryLabel: string;
  series: string;
  color: string;
  price: number;
  sku: string;
  badge: string;
  priceLabel: string;
};

type CatalogRow = {
  id: string;
  sku: string;
  name: string;
  category_label: string;
  series: string | null;
  color: string | null;
  public_reference_price_idr: number | null;
  badge: string | null;
  catalog_products: { id: string; brand: string; name: string; category: string } | { id: string; brand: string; name: string; category: string }[];
};

export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return [];
  }

  const supabase = await createClient();
  let priceMap = new Map<string, number>();
  let priceLabel = 'Harga standard';
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    const { data: profile } = await supabase.from('customer_profiles').select('pricing_tier_id').eq('id', authData.user.id).maybeSingle();
    if (profile?.pricing_tier_id) {
      const { data: tier } = await supabase.from('pricing_tiers').select('code').eq('id', profile.pricing_tier_id).maybeSingle();
      const now = new Date().toISOString();
      const { data: priceRows } = await supabase
        .from('catalog_sku_prices')
        .select('sku_id, unit_price_idr, effective_from, effective_until')
        .eq('pricing_tier_id', profile.pricing_tier_id)
        .eq('is_active', true)
        .lte('effective_from', now)
        .order('effective_from', { ascending: false });
      for (const row of priceRows ?? []) {
        if (!row.effective_until || row.effective_until > now) priceMap.set(row.sku_id, row.unit_price_idr);
      }
      if (priceMap.size > 0) priceLabel = tier?.code === 'B2B_PREMIUM' ? 'Harga Premium B2B' : 'Harga standard';
    }
  }
  const { data: rawData, error } = await supabase
    .from('catalog_skus')
    .select('id, sku, name, category_label, series, color, public_reference_price_idr, badge, catalog_products!inner(id, brand, name, category)')
    .eq('is_active', true)
    .eq('catalog_products.is_published', true)
    .order('sort_order');

  if (error || !rawData) return [];
  const data = rawData as unknown as CatalogRow[];

  return data.map((item) => {
    const product = Array.isArray(item.catalog_products) ? item.catalog_products[0] : item.catalog_products;
    return {
      id: item.id,
      brand: product.brand,
      name: item.name || product.name,
      category: product.category,
      categoryLabel: item.category_label,
      series: item.series ?? '',
      color: item.color ?? '',
      price: item.public_reference_price_idr ?? 0,
      sku: item.sku,
      badge: item.badge ?? 'Pilihan studio',
      priceLabel: priceMap.has(item.id) ? priceLabel : 'Harga standard',
    };
  });
}
