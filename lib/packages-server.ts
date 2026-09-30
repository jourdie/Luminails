import { createClient } from './supabase/server';
import { type BrandPackage, type PackageSkuOption, type PackageAddOn, type PackageBenefit, type PackageRecommendation } from './packages';
import { isPackageEligible, type PackageEligibilityRule } from './package-eligibility';
import { catalogBrandsMatch } from './brand-matching';

type PackageRow = { id: string; brand_id: string; slug: string; title: string; audience: string; description: string; long_description: string | null; price_idr: number; compare_at_price_idr: number | null; badge: string | null; visual_tone: 'clay' | 'ivory' | 'plum'; delivery_note: string | null; selection_mode: 'fixed' | 'free_pick'; selection_capacity: number | null; selection_minimum: number | null; selection_maximum: number | null; pricing_model: 'tier' | 'quantity_range'; status: string; sort_order: number; starts_at: string | null; ends_at: string | null; minimum_quantity: number | null; minimum_subtotal_idr: number | null; stackable: boolean | null; points_earning_mode: 'normal' | 'reduced' | 'none' | null; points_multiplier: number | null; allow_reward_redemption: boolean | null };
type PackageItemRow = { package_id: string; sku_id: string; item_name_snapshot: string | null; item_note: string | null; quantity: number; sort_order: number };
type AllowedSkuRow = { package_id: string; sku_id: string; sort_order: number };
type PackageImageRow = { id: string; package_id: string; image_url: string; alt_text: string | null; sort_order: number };
type BrandRow = { id: string; name: string; slug: string };
type SkuRow = { id: string; name: string; sku: string; category_label: string | null; series: string | null; color: string | null; public_reference_price_idr?: number | null; image_url?: string | null };
type PackageQuantityPriceRow = { package_id: string; minimum_quantity: number; maximum_quantity: number | null; unit_price_idr: number; is_active: boolean };

export type PublicBrand = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  visualTone: 'clay' | 'ivory' | 'plum' | 'champagne';
  imageUrl: string | null;
};
function toPackageSkuOption(sku: SkuRow | undefined): PackageSkuOption | null {
  return sku ? { id: sku.id, sku: sku.sku, name: sku.name, price: sku.public_reference_price_idr == null ? null : Number(sku.public_reference_price_idr), imageUrl: sku.image_url ?? null, categoryLabel: sku.category_label ?? '', series: sku.series ?? '', color: sku.color ?? '' } : null;
}

export async function getBrandPackagesFromDatabase(): Promise<BrandPackage[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return [];

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const db = supabase as any;
  const { data: packages, error } = await ((supabase as any)
    .from('commerce_packages')
    .select('id, brand_id, slug, title, audience, description, long_description, price_idr, compare_at_price_idr, badge, visual_tone, delivery_note, selection_mode, selection_capacity, selection_minimum, selection_maximum, pricing_model, status, sort_order, starts_at, ends_at, minimum_quantity, minimum_subtotal_idr, stackable, points_earning_mode, points_multiplier, allow_reward_redemption')
    .eq('status', 'published')
    .order('sort_order') as { data: PackageRow[] | null; error: unknown });

  if (error || !packages?.length) return [];
  const now = Date.now();
  const visiblePackages = packages.filter((item) => (!item.starts_at || new Date(item.starts_at).getTime() <= now) && (!item.ends_at || new Date(item.ends_at).getTime() > now));
  if (!visiblePackages.length) return [];

  const brandIds = [...new Set(visiblePackages.map((item: PackageRow) => item.brand_id))];
  const packageIds = visiblePackages.map((item: PackageRow) => item.id);
  const eligibilityStatusResponse = authData.user
    ? await db.rpc('get_customer_package_eligibility', { p_package_ids: packageIds })
    : { data: [], error: null };
  const eligibilityStatusByPackage = new Map<string, boolean>((eligibilityStatusResponse.data ?? []).map((row: { package_id: string; is_eligible: boolean }) => [row.package_id, Boolean(row.is_eligible)]));
  const packageItemResponse = await (supabase as any)
    .from('commerce_package_items')
    .select('package_id, sku_id, item_name_snapshot, item_note, quantity, sort_order')
    .in('package_id', packageIds)
    .order('sort_order');
  const allowedSkuResponse = await (supabase as any)
    .from('commerce_package_allowed_skus')
    .select('package_id, sku_id, sort_order')
    .in('package_id', packageIds)
    .order('sort_order');
  const packageImageResponse = await (supabase as any).from('commerce_package_images').select('id, package_id, image_url, alt_text, sort_order').in('package_id', packageIds).order('sort_order');
  const eligibilityResponse = await db.from('commerce_package_eligibility').select('package_id, customer_tier_id, customer_id, brand_id, sku_id, minimum_quantity, minimum_order_value_idr').in('package_id', packageIds);  const allSkuIds = [...new Set([...(packageItemResponse.data ?? []).map((item: PackageItemRow) => item.sku_id), ...(allowedSkuResponse.data ?? []).map((item: AllowedSkuRow) => item.sku_id)])] as string[];
  const [{ data: brands }, { data: skus }, { data: packageQuantityPrices }] = await Promise.all([
    supabase.from('catalog_brands').select('id, name, slug').in('id', brandIds as string[]),
    allSkuIds.length ? (supabase as any).from('catalog_skus').select('id, name, sku, category_label, series, color, public_reference_price_idr, image_url').in('id', allSkuIds) : Promise.resolve({ data: [] }),
    (supabase as any).from('commerce_package_quantity_prices').select('package_id, minimum_quantity, maximum_quantity, unit_price_idr, is_active').in('package_id', packageIds).eq('is_active', true).order('minimum_quantity'),
  ]);

  const brandById = new Map((brands ?? []).map((brand: BrandRow) => [brand.id, brand]));
  const skuById = new Map(((skus ?? []) as unknown as SkuRow[]).map((sku) => [sku.id, sku]));
  const quantityPricesByPackage = new Map<string, Array<{ packageId: string; minimumQuantity: number; maximumQuantity: number | null; unitPriceIdr: number }>>();
  for (const row of ((packageQuantityPrices ?? []) as PackageQuantityPriceRow[])) {
    const existing = quantityPricesByPackage.get(row.package_id) ?? [];
    existing.push({ packageId: row.package_id, minimumQuantity: Number(row.minimum_quantity), maximumQuantity: row.maximum_quantity === null ? null : Number(row.maximum_quantity), unitPriceIdr: Number(row.unit_price_idr) });
    quantityPricesByPackage.set(row.package_id, existing);
  }
  const itemsByPackage = new Map<string, PackageItemRow[]>();
  for (const item of (packageItemResponse.data ?? []) as PackageItemRow[]) {
    const existing = itemsByPackage.get(item.package_id) ?? [];
    existing.push(item);
    itemsByPackage.set(item.package_id, existing);
  }

  const imagesByPackage = new Map<string, PackageImageRow[]>();
  for (const image of (packageImageResponse.data ?? []) as PackageImageRow[]) {
    const existing = imagesByPackage.get(image.package_id) ?? [];
    existing.push(image);
    imagesByPackage.set(image.package_id, existing);
  }

  const allowedByPackage = new Map<string, AllowedSkuRow[]>();
  for (const allowed of (allowedSkuResponse.data ?? []) as AllowedSkuRow[]) {
    const existing = allowedByPackage.get(allowed.package_id) ?? [];
    existing.push(allowed);
    allowedByPackage.set(allowed.package_id, existing);
  }

  const eligibilityByPackage = new Map<string, PackageEligibilityRule[]>();
  for (const rule of (eligibilityResponse.data ?? []) as Array<{ package_id: string; customer_tier_id: string | null; customer_id: string | null; brand_id: string | null; sku_id: string | null; minimum_quantity: number; minimum_order_value_idr: number }>) {
    const existing = eligibilityByPackage.get(rule.package_id) ?? [];
    existing.push({ customerTierId: rule.customer_tier_id, customerId: rule.customer_id, brandId: rule.brand_id, skuId: rule.sku_id, minimumQuantity: Number(rule.minimum_quantity), minimumOrderValueIdr: Number(rule.minimum_order_value_idr) });
    eligibilityByPackage.set(rule.package_id, existing);
  }
  return visiblePackages.filter((item: PackageRow) => brandById.has(item.brand_id)).map((item: PackageRow) => {
    const brand = brandById.get(item.brand_id);
    const packageItems = itemsByPackage.get(item.id) ?? [];
    const allowedItems = allowedByPackage.get(item.id) ?? [];
    const packageImages = (imagesByPackage.get(item.id) ?? []).map((image: PackageImageRow) => ({ id: image.id, imageUrl: image.image_url, alt: image.alt_text, sortOrder: image.sort_order }));
    const imageUrl = packageImages[0]?.imageUrl ?? null;
    const contents = packageItems.map((content: PackageItemRow) => ({
      name: content.item_name_snapshot || skuById.get(content.sku_id)?.name || 'Catalog item',
      quantity: content.quantity,
      note: content.item_note || 'Curated package item',
      skuId: content.sku_id,
    }));
    const packageRules = eligibilityByPackage.get(item.id) ?? [];
    const packageSkuIds = [...packageItems.map((content: PackageItemRow) => content.sku_id), ...allowedItems.map((allowed: AllowedSkuRow) => allowed.sku_id)];
    const isEligible = authData.user ? (eligibilityStatusByPackage.get(item.id) ?? true) : isPackageEligible(packageRules, { customerId: null, customerTierId: null, brandId: item.brand_id, selectedSkuIds: packageSkuIds });
    const packageBenefits: PackageBenefit[] = [];
    return {
      id: item.id,
      slug: item.slug,
      brand: brand?.name ?? 'Luminails',
      brandSlug: brand?.slug ?? 'luminails',
      title: item.title,
      audience: item.audience,
      description: item.description,
      longDescription: item.long_description || item.description,
      price: item.price_idr,
      priceLabel: 'Harga package',
      compareAt: item.compare_at_price_idr ?? item.price_idr,
      badge: item.badge || 'Salon package',
      tone: item.visual_tone,
      imageUrl,
      isEligible,
      eligibilityNote: packageRules.length && !isEligible ? 'Package ini memiliki syarat tier/customer yang belum terpenuhi.' : null,
      benefits: packageBenefits,
      minimumQuantity: item.minimum_quantity ?? 1,
      minimumSubtotalIdr: item.minimum_subtotal_idr ?? 0,
      selectionMinimum: item.selection_minimum ?? null,
      selectionMaximum: item.selection_maximum ?? null,
      pricingModel: item.pricing_model ?? 'tier',
      quantityPrices: quantityPricesByPackage.get(item.id) ?? [],
      stackable: item.stackable ?? false,
      pointsEarningMode: item.points_earning_mode ?? 'normal',
      pointsMultiplier: Number(item.points_multiplier ?? 1),
      allowRewardRedemption: item.allow_reward_redemption ?? true,
      images: packageImages,
      delivery: item.delivery_note || 'Dispatch in 1-2 business days',
      selectionMode: item.selection_mode ?? 'fixed',
      selectionCapacity: item.selection_capacity ?? null,
      allowedSkus: allowedItems.map((allowed: AllowedSkuRow) => {
        return toPackageSkuOption(skuById.get(allowed.sku_id));
      }).filter((sku): sku is PackageSkuOption => sku !== null),
      contents,
      highlights: contents.length ? [contents.reduce((total: number, content: { quantity: number }) => total + content.quantity, 0) + ' curated items', 'Built for working studios'] : ['Curated for working studios', 'Package contents can be edited in back office'],
    };
  });
}

export async function getPackageBySlugFromDatabase(slug: string) {
  const packages = await getBrandPackagesFromDatabase();
  return packages.find((item) => item.slug === slug);
}

export async function getPublicBrandsFromDatabase(): Promise<PublicBrand[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_brands')
    .select('id, name, slug, tagline, description, visual_tone')
    .eq('is_published', true)
    .order('sort_order')
    .order('name');
  if (error || !data) return [];
  return (data as Array<{ id: string; name: string; slug: string; tagline: string | null; description: string | null; visual_tone: PublicBrand['visualTone'] }>).map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    tagline: brand.tagline,
    description: brand.description,
    visualTone: brand.visual_tone,
    imageUrl: null,
  }));
}
export async function getPackageAddOnsFromDatabase(packageBrand?: string): Promise<PackageAddOn[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return [];
  const supabase = await createClient();
  const db = supabase as any;
  const { data } = await db
    .from('catalog_skus')
    .select('id, sku, name, category_label, product_type, public_reference_price_idr, stock_status, stock_quantity, catalog_products!inner(brand, is_published)')
    .eq('is_active', true)
    .in('product_type', ['TOOL', 'ACCESSORY'])
    .order('sort_order');
  return ((data ?? []) as Array<{ id: string; sku: string; name: string; category_label: string | null; product_type: 'TOOL' | 'ACCESSORY'; public_reference_price_idr: number | null; stock_status: string; stock_quantity: number; catalog_products: { brand: string; is_published: boolean } | { brand: string; is_published: boolean }[] }>).filter((item) => {
    const product = Array.isArray(item.catalog_products) ? item.catalog_products[0] : item.catalog_products;
    return item.public_reference_price_idr !== null && product?.is_published !== false && (!packageBrand || catalogBrandsMatch(product?.brand, packageBrand));
  }).map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    categoryLabel: item.category_label ?? '',
    productType: item.product_type,
    price: Number(item.public_reference_price_idr),
    stockStatus: item.stock_status,
    stockQuantity: Number(item.stock_quantity ?? 0),
  }));
}

export async function getPackageRecommendationsFromDatabase(currentPackageId?: string): Promise<PackageRecommendation[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return [];
  const supabase = await createClient();
  const db = supabase as any;
  const { data: rows, error } = await db.from('commerce_recommendations').select('id, package_id, sku_id, priority, starts_at, ends_at').eq('placement', 'package_detail').eq('is_active', true).order('priority').limit(24);
  if (error || !rows?.length) return [];
  const now = Date.now();
  const visibleRows = (rows as Array<{ id: string; package_id: string | null; sku_id: string | null; starts_at: string | null; ends_at: string | null }>).filter((row) => (!row.starts_at || Date.parse(row.starts_at) <= now) && (!row.ends_at || Date.parse(row.ends_at) > now));
  if (!visibleRows.length) return [];
  const packages = (await getBrandPackagesFromDatabase()).filter((item) => item.isEligible !== false);
  const packageById = new Map(packages.map((item) => [item.id, item]));
  const skuIds = Array.from(new Set(visibleRows.map((row) => row.sku_id).filter((id): id is string => Boolean(id))));
  const { data: skuRows } = skuIds.length ? await db.from('catalog_skus').select('id, sku, name, category_label, public_reference_price_idr, image_url').in('id', skuIds).eq('is_active', true) : { data: [] };
  const skuById = new Map(((skuRows ?? []) as Array<{ id: string; sku: string; name: string; category_label: string | null; public_reference_price_idr: number | null; image_url: string | null }>).map((sku) => [sku.id, sku]));
  const result: PackageRecommendation[] = [];
  for (const row of visibleRows) {
    if (row.package_id) {
      const item = packageById.get(row.package_id);
      if (item && item.id !== currentPackageId) result.push({ id: row.id, kind: 'package', title: item.title, subtitle: item.brand + ' package', description: item.description, href: '/packages/' + item.slug, imageUrl: item.imageUrl ?? null, price: item.price });
      continue;
    }
    if (row.sku_id) {
      const sku = skuById.get(row.sku_id);
      const parent = packages.find((item) => item.id !== currentPackageId && (item.contents.some((content) => content.skuId === row.sku_id) || item.allowedSkus.some((allowed) => allowed.id === row.sku_id)));
      if (sku && parent) result.push({ id: row.id, kind: 'sku', title: sku.name, subtitle: sku.sku + (sku.category_label ? ' / ' + sku.category_label : ''), description: 'SKU reference yang tetap checkout melalui ' + parent.title + '.', href: '/packages/' + parent.slug, imageUrl: sku.image_url, price: sku.public_reference_price_idr == null ? null : Number(sku.public_reference_price_idr) });
    }
  }
  return result;
}
