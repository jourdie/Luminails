export type PackageContent = {
  name: string;
  quantity: number;
  note: string;
};

export type BrandPackage = {
  slug: string;
  brand: string;
  brandSlug: string;
  title: string;
  audience: 'home-studio' | 'salon' | 'restock';
  description: string;
  longDescription: string;
  price: number;
  compareAt: number;
  badge: string;
  tone: 'clay' | 'ivory' | 'plum';
  delivery: string;
  contents: PackageContent[];
  highlights: string[];
};

const packageCatalog: BrandPackage[] = [
  {
    slug: 'party-home-studio-starter',
    brand: 'PARTY!',
    brandSlug: 'party',
    title: 'Home Studio Starter',
    audience: 'home-studio',
    description: 'A complete gel foundation for a calm, capable home studio.',
    longDescription: 'A considered first shelf for artists building a reliable home setup. Every item has a clear role from prep to finish, so your first order feels edited, not overwhelming.',
    price: 1295000,
    compareAt: 1510000,
    badge: 'For new studios',
    tone: 'clay',
    delivery: 'Ready to dispatch in 1-2 business days',
    contents: [
      { name: 'PH Bond', quantity: 2, note: 'Prep and adhesion support' },
      { name: 'Rubber Base Milky', quantity: 2, note: 'Flexible base system' },
      { name: 'Color Gel Core Set', quantity: 6, note: 'Curated everyday shades' },
      { name: 'No Wipe Top Coat', quantity: 2, note: 'Glass finish' },
      { name: 'Lint Free Wipes', quantity: 2, note: '200 pcs per pack' },
    ],
    highlights: ['12 working bottles', 'Core prep to finish system', 'Starter-friendly shade edit'],
  },
  {
    slug: 'bluesky-salon-color-edit',
    brand: 'Bluesky',
    brandSlug: 'bluesky',
    title: 'Salon Color Edit / 24',
    audience: 'salon',
    description: 'A studio-scale color wardrobe built for repeat services.',
    longDescription: 'A professional shade edit with enough range for everyday requests, clean neutrals, and a little seasonal lift. Designed to make the salon shelf look intentional and work harder.',
    price: 2890000,
    compareAt: 3520000,
    badge: 'Most reordered',
    tone: 'ivory',
    delivery: 'Dispatch in 2-3 business days',
    contents: [
      { name: 'Bluesky Color Gel', quantity: 24, note: 'Neutral, sheer, and statement shades' },
      { name: 'Rubber Base', quantity: 3, note: 'Flexible base options' },
      { name: 'No Wipe Top Coat', quantity: 3, note: 'High-shine salon finish' },
    ],
    highlights: ['24 curated shades', 'Built for high service volume', 'Salon price applied at checkout'],
  },
  {
    slug: 'luminails-core-restock',
    brand: 'Luminails Lab',
    brandSlug: 'luminails-lab',
    title: 'Core Prep Restock / 12',
    audience: 'restock',
    description: 'The quiet essentials your team reaches for every day.',
    longDescription: 'A practical restock for the products that keep every set consistent. Keep one on the shelf and one in reserve, then reorder from the same saved package.',
    price: 995000,
    compareAt: 1180000,
    badge: 'Core essentials',
    tone: 'plum',
    delivery: 'Ready to dispatch in 1-2 business days',
    contents: [
      { name: 'PH Bond', quantity: 4, note: 'Prep and adhesion support' },
      { name: 'Rubber Base', quantity: 4, note: 'Daily base system' },
      { name: 'No Wipe Top Coat', quantity: 4, note: 'Reliable finishing step' },
    ],
    highlights: ['12 high-rotation bottles', 'Easy monthly reorder', 'For working artists and teams'],
  },
  {
    slug: 'party-salon-foundation',
    brand: 'PARTY!',
    brandSlug: 'party',
    title: 'Salon Foundation / 24',
    audience: 'salon',
    description: 'A complete base, color, and finish shelf for a growing salon.',
    longDescription: 'A larger system for salons ready to make their core service experience more consistent. The selection balances repeatable essentials with enough color to keep the menu feeling alive.',
    price: 3190000,
    compareAt: 3890000,
    badge: 'Salon scale',
    tone: 'plum',
    delivery: 'Dispatch in 2-3 business days',
    contents: [
      { name: 'PH Bond', quantity: 4, note: 'Prep and adhesion support' },
      { name: 'Rubber Base Milky', quantity: 4, note: 'Flexible base system' },
      { name: 'Color Gel Core Set', quantity: 12, note: 'Everyday salon shades' },
      { name: 'No Wipe Top Coat', quantity: 4, note: 'Glass finish' },
    ],
    highlights: ['24 working bottles', 'Balanced for salon services', 'Lower cost per service'],
  },
];

export function getBrandPackages() {
  return packageCatalog;
}

export function getPackageBySlug(slug: string) {
  return packageCatalog.find((item) => item.slug === slug);
}

export function formatIDR(value: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
}
