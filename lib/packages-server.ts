import { createClient } from './supabase/server';
import { getBrandPackages, type BrandPackage } from './packages';

export async function getBrandPackagesFromDatabase(): Promise<BrandPackage[]> {
  const fallback = getBrandPackages();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return fallback;

  const supabase = await createClient();
  const { data: packages, error } = await supabase
    .from('commerce_packages')
    .select('id, brand_id, slug, title, audience, description, long_description, price_idr, compare_at_price_idr, badge, visual_tone, delivery_note, status, sort_order')
    .eq('status', 'published')
    .order('sort_order');

  if (error || !packages?.length) return fallback;

  const brandIds = [...new Set(packages.map((item) => item.brand_id))];
  const packageIds = packages.map((item) => item.id);
  const packageItemResponse = await supabase
    .from('commerce_package_items')
    .select('package_id, sku_id, item_name_snapshot, item_note, quantity, sort_order')
    .in('package_id', packageIds)
    .order('sort_order');
  const [{ data: brands }, { data: skus }] = await Promise.all([
    supabase.from('catalog_brands').select('id, name, slug').in('id', brandIds),
    supabase.from('catalog_skus').select('id, name, sku').in('id', [...new Set((packageItemResponse.data ?? []).map((item) => item.sku_id))]),
  ]);

  const brandById = new Map((brands ?? []).map((brand) => [brand.id, brand]));
  const skuById = new Map((skus ?? []).map((sku) => [sku.id, sku]));
  const itemsByPackage = new Map<string, typeof packageItemResponse.data>();
  for (const item of packageItemResponse.data ?? []) {
    const existing = itemsByPackage.get(item.package_id) ?? [];
    existing.push(item);
    itemsByPackage.set(item.package_id, existing);
  }

  return packages.map((item) => {
    const brand = brandById.get(item.brand_id);
    const contents = (itemsByPackage.get(item.id) ?? []).map((content) => ({
      name: content.item_name_snapshot || skuById.get(content.sku_id)?.name || 'Catalog item',
      quantity: content.quantity,
      note: content.item_note || 'Curated package item',
    }));
    return {
      slug: item.slug,
      brand: brand?.name ?? 'Luminails',
      brandSlug: brand?.slug ?? 'luminails',
      title: item.title,
      audience: item.audience,
      description: item.description,
      longDescription: item.long_description || item.description,
      price: item.price_idr,
      compareAt: item.compare_at_price_idr ?? item.price_idr,
      badge: item.badge || 'B2B package',
      tone: item.visual_tone,
      delivery: item.delivery_note || 'Dispatch in 1-2 business days',
      contents,
      highlights: contents.length ? [contents.reduce((total, content) => total + content.quantity, 0) + ' curated items', 'Built for working studios'] : ['Curated for working studios', 'Package contents can be edited in back office'],
    };
  });
}

export async function getPackageBySlugFromDatabase(slug: string) {
  const packages = await getBrandPackagesFromDatabase();
  return packages.find((item) => item.slug === slug);
}
