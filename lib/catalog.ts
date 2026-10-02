import { createClient } from './supabase/server';
import { cache } from 'react';

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
  imageUrl: string | null;
  packageLinks: Array<{ slug: string; title: string }>;
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
  image_url: string | null;
  catalog_products: { id: string; brand: string; name: string; category: string } | { id: string; brand: string; name: string; category: string }[];
};

export async function getCatalogProducts(options: { withPackageLinks?: boolean } = {}): Promise<CatalogProduct[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return [];
  }

  const supabase = await createClient();
  const priceLabel = 'Harga katalog';
  const { data: rawData, error } = await supabase
    .from('catalog_skus')
    .select('id, sku, name, category_label, series, color, public_reference_price_idr, badge, image_url, catalog_products!inner(id, brand, name, category)')
    .eq('is_active', true)
    .eq('catalog_products.is_published', true)
    .order('sort_order')
    .limit(1000);

  if (error || !rawData) return [];
  const data = rawData as unknown as CatalogRow[];
  const packageIdsBySku = new Map<string, Set<string>>();
  const packageById = new Map<string, { id: string; slug: string; title: string }>();
  if (options.withPackageLinks && data.length) {
    const skuIds = data.map((item) => item.id);
    const [{ data: packageItems }, { data: allowedSkus }, { data: packageRows }] = await Promise.all([
      supabase.from('commerce_package_items').select('package_id, sku_id').in('sku_id', skuIds).limit(5000),
      supabase.from('commerce_package_allowed_skus').select('package_id, sku_id').in('sku_id', skuIds).limit(5000),
      supabase.from('commerce_packages').select('id, slug, title').eq('status', 'published').order('sort_order').limit(200),
    ]);
    for (const item of (packageRows ?? []) as Array<{ id: string; slug: string; title: string }>) packageById.set(item.id, item);
    for (const row of [...(packageItems ?? []), ...(allowedSkus ?? [])] as Array<{ package_id: string; sku_id: string }>) {
      const ids = packageIdsBySku.get(row.sku_id) ?? new Set<string>();
      ids.add(row.package_id);
      packageIdsBySku.set(row.sku_id, ids);
    }
  }
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
      priceLabel,
      imageUrl: item.image_url,
      packageLinks: Array.from(packageIdsBySku.get(item.id) ?? [])
        .map((packageId) => packageById.get(packageId))
        .filter((item): item is { id: string; slug: string; title: string } => Boolean(item))
        .map(({ slug, title }) => ({ slug, title })),
    };
  });
}

export const getCatalogProductBySku = cache(async (sku: string): Promise<CatalogProduct | null> => {
  const products = await getCatalogProducts({ withPackageLinks: true });
  const normalized = sku.trim().toLowerCase();
  return products.find((product) => product.sku.toLowerCase() === normalized) ?? null;
});
