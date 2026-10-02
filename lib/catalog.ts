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

type CatalogPackageLink = { id: string; slug: string; title: string };

async function getPackageLinksBySkuIds(supabase: any, skuIds: string[]) {
  const packageIdsBySku = new Map<string, Set<string>>();
  const packageById = new Map<string, CatalogPackageLink>();
  if (!skuIds.length) return { packageIdsBySku, packageById };

  const [{ data: packageItems }, { data: allowedSkus }] = await Promise.all([
    supabase.from('commerce_package_items').select('package_id, sku_id').in('sku_id', skuIds).limit(5000),
    supabase.from('commerce_package_allowed_skus').select('package_id, sku_id').in('sku_id', skuIds).limit(5000),
  ]);
  const packageIds = [...new Set(
    [...(packageItems ?? []), ...(allowedSkus ?? [])]
      .map((row) => row.package_id)
      .filter((id): id is string => Boolean(id)),
  )];
  if (!packageIds.length) return { packageIdsBySku, packageById };

  const { data: packageRows } = await supabase
    .from('commerce_packages')
    .select('id, slug, title')
    .in('id', packageIds)
    .eq('status', 'published');
  for (const item of (packageRows ?? []) as CatalogPackageLink[]) packageById.set(item.id, item);
  for (const row of [...(packageItems ?? []), ...(allowedSkus ?? [])] as Array<{ package_id: string; sku_id: string }>) {
    const ids = packageIdsBySku.get(row.sku_id) ?? new Set<string>();
    if (packageById.has(row.package_id)) ids.add(row.package_id);
    packageIdsBySku.set(row.sku_id, ids);
  }
  return { packageIdsBySku, packageById };
}

function mapCatalogRow(item: CatalogRow, packageIdsBySku: Map<string, Set<string>>, packageById: Map<string, CatalogPackageLink>): CatalogProduct {
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
    priceLabel: 'Harga katalog',
    imageUrl: item.image_url,
    packageLinks: Array.from(packageIdsBySku.get(item.id) ?? [])
      .map((packageId) => packageById.get(packageId))
      .filter((link): link is CatalogPackageLink => Boolean(link))
      .map(({ slug, title }) => ({ slug, title })),
  };
}

export async function getCatalogProducts(options: { withPackageLinks?: boolean } = {}): Promise<CatalogProduct[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return [];
  }

  const supabase = await createClient();
  const { data: rawData, error } = await supabase
    .from('catalog_skus')
    .select('id, sku, name, category_label, series, color, public_reference_price_idr, badge, image_url, catalog_products!inner(id, brand, name, category)')
    .eq('is_active', true)
    .eq('catalog_products.is_published', true)
    .order('sort_order')
    .limit(1000);

  if (error || !rawData) return [];
  const data = rawData as unknown as CatalogRow[];
  const { packageIdsBySku, packageById } = options.withPackageLinks
    ? await getPackageLinksBySkuIds(supabase, data.map((item) => item.id))
    : { packageIdsBySku: new Map<string, Set<string>>(), packageById: new Map<string, CatalogPackageLink>() };
  return data.map((item) => mapCatalogRow(item, packageIdsBySku, packageById));
}

export const getCatalogProductBySku = cache(async (sku: string): Promise<CatalogProduct | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  const normalized = sku.trim();
  if (!normalized) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_skus')
    .select('id, sku, name, category_label, series, color, public_reference_price_idr, badge, image_url, catalog_products!inner(id, brand, name, category)')
    .eq('sku', normalized)
    .eq('is_active', true)
    .eq('catalog_products.is_published', true)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as CatalogRow;
  const { packageIdsBySku, packageById } = await getPackageLinksBySkuIds(supabase, [row.id]);
  return mapCatalogRow(row, packageIdsBySku, packageById);
});
