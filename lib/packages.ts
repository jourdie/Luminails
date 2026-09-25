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
