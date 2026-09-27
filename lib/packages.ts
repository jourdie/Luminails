export type PackageContent = {
  name: string;
  quantity: number;
  note: string;
  skuId?: string;
};

export type PackageImage = {
  id?: string;
  imageUrl: string;
  alt?: string | null;
  sortOrder?: number;
};

export type PackageSkuOption = {
  id: string;
  sku: string;
  name: string;
  categoryLabel?: string;
  series?: string;
  color?: string;
};

export type PackageTierPrice = {
  packageId: string;
  unitPriceIdr: number;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  isActive?: boolean;
};

export type PackageBenefit = { id: string; name: string; quantity: number; variantRule: 'admin_selected' | 'customer_selected'; notes?: string | null; allowedSkus?: PackageSkuOption[] };

export type BrandPackage = {
  slug: string;
  brand: string;
  brandSlug: string;
  title: string;
  audience: string;
  description: string;
  longDescription: string;
  price: number;
  priceLabel?: string;
  compareAt: number;
  badge: string;
  selectionMode: 'fixed' | 'free_pick';
  selectionCapacity: number | null;
  allowedSkus: PackageSkuOption[];
  images: PackageImage[];
  tone: 'clay' | 'ivory' | 'plum';
  delivery: string;
  contents: PackageContent[];
  highlights: string[];
  imageUrl?: string | null;
  isEligible?: boolean;
  eligibilityNote?: string | null;
  benefits?: PackageBenefit[];
  minimumQuantity?: number;
  minimumSubtotalIdr?: number;
  stackable?: boolean;
  pointsEarningMode?: 'normal' | 'reduced' | 'none';
  pointsMultiplier?: number;
  allowRewardRedemption?: boolean;
};

export function formatIDR(value: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(value);
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
}

export function selectActivePackagePrice(prices: PackageTierPrice[], packageId: string, asOf = new Date()) {
  const timestamp = asOf.getTime();
  return prices
    .filter((price) => {
      const startsAt = Date.parse(price.effectiveFrom);
      const endsAt = price.effectiveUntil ? Date.parse(price.effectiveUntil) : Number.POSITIVE_INFINITY;
      return price.packageId === packageId
        && price.isActive !== false
        && Number.isFinite(startsAt)
        && startsAt <= timestamp
        && (Number.isFinite(endsAt) ? endsAt > timestamp : true);
    })
    .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom))[0] ?? null;
}
