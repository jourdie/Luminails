import { createClient } from './supabase/server';

export type CatalogProduct = {
  id: string;
  brand: string;
  name: string;
  category: string;
  categoryLabel: string;
  price: number;
  shade: string;
  tone: string;
  sku: string;
  badge: string;
  priceLabel: string;
};

type CatalogRow = {
  id: string;
  sku: string;
  name: string;
  category_label: string;
  public_reference_price_idr: number | null;
  shade_code: string | null;
  tone: string;
  badge: string | null;
  catalog_products: { id: string; brand: string; name: string; category: string } | { id: string; brand: string; name: string; category: string }[];
};

const fallbackProducts: CatalogProduct[] = [
  { id: 'ph-bond', brand: 'Luminails Lab', name: 'PH Bond — nail prep', category: 'prep', categoryLabel: 'Prep', price: 38500, shade: 'PH', tone: 'tone-clear', sku: 'LN-PHB-01', badge: 'Best seller', priceLabel: 'Harga contoh B2B' },
  { id: 'gel-petal', brand: 'Bluesky', name: 'Color Gel — Petal Glow', category: 'gel', categoryLabel: 'Color gel', price: 62000, shade: '07', tone: 'tone-coral', sku: 'BS-G07', badge: 'New shade', priceLabel: 'Harga contoh B2B' },
  { id: 'rubber-base', brand: 'Party', name: 'Rubber Base — Milky', category: 'gel', categoryLabel: 'Base gel', price: 79000, shade: 'RB', tone: 'tone-lilac', sku: 'PT-RB-02', badge: 'Core studio', priceLabel: 'Harga contoh B2B' },
  { id: 'buffer', brand: 'Luminails Lab', name: 'Buffer 100/180 — soft touch', category: 'tools', categoryLabel: 'Tools', price: 12000, shade: '100', tone: 'tone-sage', sku: 'LN-BUF-01', badge: 'Refill', priceLabel: 'Harga contoh B2B' },
  { id: 'top-coat', brand: 'Born Pretty', name: 'No Wipe Top Coat — glass', category: 'gel', categoryLabel: 'Top coat', price: 54000, shade: 'TOP', tone: 'tone-clear', sku: 'BP-TOP-08', badge: 'High shine', priceLabel: 'Harga contoh B2B' },
  { id: 'lint-free', brand: 'Luminails Lab', name: 'Lint Free Wipes — 200 pcs', category: 'tools', categoryLabel: 'Tools', price: 28000, shade: '200', tone: 'tone-ink', sku: 'LN-LFW-02', badge: 'Studio pack', priceLabel: 'Harga contoh B2B' },
];

export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return fallbackProducts;
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
    .select('id, sku, name, category_label, public_reference_price_idr, shade_code, tone, badge, catalog_products!inner(id, brand, name, category)')
    .eq('is_active', true)
    .eq('catalog_products.is_published', true)
    .order('sort_order');

  if (error || !rawData) return fallbackProducts;
  const data = rawData as unknown as CatalogRow[];

  return data.map((item) => {
    const product = Array.isArray(item.catalog_products) ? item.catalog_products[0] : item.catalog_products;
    return {
      id: item.id,
      brand: product.brand,
      name: item.name || product.name,
      category: product.category,
      categoryLabel: item.category_label,
      price: item.public_reference_price_idr ?? 0,
      shade: item.shade_code ?? '—',
      tone: item.tone,
      sku: item.sku,
      badge: item.badge ?? 'Pilihan studio',
      priceLabel: priceMap.has(item.id) ? priceLabel : 'Harga standard',
    };
  });
}
