import { createClient } from './supabase/server';
import type { BrandPackage } from './packages';
import { isPackageEligible, type PackageEligibilityRule } from './package-eligibility';

type PackageRow = { id: string; brand_id: string; slug: string; title: string; audience: string; description: string; long_description: string | null; price_idr: number; compare_at_price_idr: number | null; badge: string | null; visual_tone: 'clay' | 'ivory' | 'plum'; delivery_note: string | null; selection_mode: 'fixed' | 'free_pick'; selection_capacity: number | null; status: string; sort_order: number; starts_at: string | null; ends_at: string | null; minimum_quantity: number | null; minimum_subtotal_idr: number | null; stackable: boolean | null; points_earning_mode: 'normal' | 'reduced' | 'none' | null; points_multiplier: number | null; allow_reward_redemption: boolean | null };
type PackageItemRow = { package_id: string; sku_id: string; item_name_snapshot: string | null; item_note: string | null; quantity: number; sort_order: number };
type AllowedSkuRow = { package_id: string; sku_id: string; sort_order: number };
type PackageImageRow = { id: string; package_id: string; image_url: string; alt_text: string | null; sort_order: number };
type BrandRow = { id: string; name: string; slug: string };
type SkuRow = { id: string; name: string; sku: string };
type PackagePriceRow = { package_id: string; pricing_tier_id: string; unit_price_idr: number; effective_from: string };
type BenefitAllowedSkuRow = { benefit_id: string; sku_id: string; sort_order: number };

export async function getBrandPackagesFromDatabase(): Promise<BrandPackage[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return [];

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const db = supabase as any;
  const [{ data: profile }, { data: standardTier }] = await Promise.all([authData.user ? db.from('customer_profiles').select('pricing_tier_id, customer_tier_id').eq('id', authData.user.id).maybeSingle() : Promise.resolve({ data: null }), supabase.from('pricing_tiers').select('id').eq('code', 'STANDARD').eq('is_active', true).maybeSingle()]);
  const activeTierId = profile?.pricing_tier_id ?? standardTier?.id ?? null;
  const { data: packages, error } = await ((supabase as any)
    .from('commerce_packages')
    .select('id, brand_id, slug, title, audience, description, long_description, price_idr, compare_at_price_idr, badge, visual_tone, delivery_note, selection_mode, selection_capacity, status, sort_order, starts_at, ends_at, minimum_quantity, minimum_subtotal_idr, stackable, points_earning_mode, points_multiplier, allow_reward_redemption')
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
  const [eligibilityResponse, benefitsResponse, benefitAllowedSkuResponse] = await Promise.all([
    db.from('commerce_package_eligibility').select('package_id, customer_tier_id, customer_id, brand_id, sku_id, minimum_quantity, minimum_order_value_idr').in('package_id', packageIds),
    db.from('commerce_package_benefits').select('id, package_id, customer_tier_id, reward_sku_id, quantity, variant_rule, notes').in('package_id', packageIds),
    db.from('commerce_package_benefit_allowed_skus').select('benefit_id, sku_id, sort_order').order('sort_order'),
  ]);
  const allSkuIds = [...new Set([...(packageItemResponse.data ?? []).map((item: PackageItemRow) => item.sku_id), ...(allowedSkuResponse.data ?? []).map((item: AllowedSkuRow) => item.sku_id), ...(benefitsResponse.data ?? []).map((item: { reward_sku_id: string }) => item.reward_sku_id), ...(benefitAllowedSkuResponse.data ?? []).map((item: BenefitAllowedSkuRow) => item.sku_id)])] as string[];
  const [{ data: brands }, { data: skus }, { data: packagePrices }] = await Promise.all([
    supabase.from('catalog_brands').select('id, name, slug').in('id', brandIds as string[]),
    allSkuIds.length ? supabase.from('catalog_skus').select('id, name, sku').in('id', allSkuIds) : Promise.resolve({ data: [] }),
    activeTierId ? supabase.from('commerce_package_prices').select('package_id, pricing_tier_id, unit_price_idr, effective_from').in('package_id', packageIds).eq('pricing_tier_id', activeTierId).eq('is_active', true).order('effective_from', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  const brandById = new Map((brands ?? []).map((brand: BrandRow) => [brand.id, brand]));
  const skuById = new Map((skus ?? []).map((sku: SkuRow) => [sku.id, sku]));
  const packagePriceById = new Map<string, number>();
  for (const price of (packagePrices ?? []) as PackagePriceRow[]) if (!packagePriceById.has(price.package_id)) packagePriceById.set(price.package_id, price.unit_price_idr);
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
  const allowedByBenefit = new Map<string, BenefitAllowedSkuRow[]>();
  for (const allowed of (benefitAllowedSkuResponse.data ?? []) as BenefitAllowedSkuRow[]) {
    const existing = allowedByBenefit.get(allowed.benefit_id) ?? [];
    existing.push(allowed);
    allowedByBenefit.set(allowed.benefit_id, existing);
  }
  const benefitsByPackage = new Map<string, Array<{ id: string; customer_tier_id: string | null; reward_sku_id: string; quantity: number; variant_rule: 'admin_selected' | 'customer_selected'; notes: string | null }>>();
  for (const benefit of (benefitsResponse.data ?? []) as Array<{ id: string; package_id: string; customer_tier_id: string | null; reward_sku_id: string; quantity: number; variant_rule: 'admin_selected' | 'customer_selected'; notes: string | null }>) {
    const existing = benefitsByPackage.get(benefit.package_id) ?? [];
    existing.push(benefit);
    benefitsByPackage.set(benefit.package_id, existing);
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
    const packageBenefits = (benefitsByPackage.get(item.id) ?? []).filter((benefit) => !benefit.customer_tier_id || benefit.customer_tier_id === profile?.customer_tier_id).map((benefit) => ({
      id: benefit.id,
      name: skuById.get(benefit.reward_sku_id)?.name ?? 'Free item',
      quantity: Number(benefit.quantity),
      variantRule: benefit.variant_rule,
      notes: benefit.notes,
      allowedSkus: (allowedByBenefit.get(benefit.id) ?? []).sort((a, b) => a.sort_order - b.sort_order).map((allowed) => {
        const sku = skuById.get(allowed.sku_id);
        return sku ? { id: sku.id, sku: sku.sku, name: sku.name } : null;
      }).filter((sku): sku is { id: string; sku: string; name: string } => Boolean(sku)),
    }));
    return {
      slug: item.slug,
      brand: brand?.name ?? 'Luminails',
      brandSlug: brand?.slug ?? 'luminails',
      title: item.title,
      audience: item.audience,
      description: item.description,
      longDescription: item.long_description || item.description,
      price: packagePriceById.get(item.id) ?? item.price_idr,
      priceLabel: activeTierId && packagePriceById.has(item.id) ? 'Harga tier Anda' : 'Harga bundling standard',
      compareAt: item.compare_at_price_idr ?? item.price_idr,
      badge: item.badge || 'B2B package',
      tone: item.visual_tone,
      imageUrl,
      isEligible,
      eligibilityNote: packageRules.length && !isEligible ? 'Package ini memiliki syarat tier/customer yang belum terpenuhi.' : null,
      benefits: packageBenefits,
      minimumQuantity: item.minimum_quantity ?? 1,
      minimumSubtotalIdr: item.minimum_subtotal_idr ?? 0,
      stackable: item.stackable ?? false,
      pointsEarningMode: item.points_earning_mode ?? 'normal',
      pointsMultiplier: Number(item.points_multiplier ?? 1),
      allowRewardRedemption: item.allow_reward_redemption ?? true,
      images: packageImages,
      delivery: item.delivery_note || 'Dispatch in 1-2 business days',
      selectionMode: item.selection_mode ?? 'fixed',
      selectionCapacity: item.selection_capacity ?? null,
      allowedSkus: allowedItems.map((allowed: AllowedSkuRow) => {
        const sku = skuById.get(allowed.sku_id);
        return sku ? { id: sku.id, sku: sku.sku, name: sku.name } : null;
      }).filter((sku): sku is { id: string; sku: string; name: string } => Boolean(sku)),
      contents,
      highlights: contents.length ? [contents.reduce((total: number, content: { quantity: number }) => total + content.quantity, 0) + ' curated items', 'Built for working studios'] : ['Curated for working studios', 'Package contents can be edited in back office'],
    };
  });
}

export async function getPackageBySlugFromDatabase(slug: string) {
  const packages = await getBrandPackagesFromDatabase();
  return packages.find((item) => item.slug === slug);
}
