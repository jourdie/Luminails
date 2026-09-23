import { createClient } from './supabase/server';
import { identityFromUser, type AccountIdentity } from './account';

export const ADMIN_PERMISSION_KEYS = ['catalog', 'orders', 'notifications', 'pricing', 'promotions', 'packages', 'inventory', 'settings'] as const;
export type AdminPermission = typeof ADMIN_PERMISSION_KEYS[number];
export type AdminPermissions = Record<AdminPermission, boolean>;

export type AdminMembership = {
  user_id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role: 'owner' | 'catalog_manager' | 'orders_manager' | 'support';
  permissions: AdminPermissions;
  is_active: boolean;
  created_at: string;
};

export type AdminProduct = { id: string; name: string; brand: string; category: string; is_published: boolean; };
export type AdminBrand = { id: string; slug: string; name: string; tagline: string | null; description: string | null; visual_tone: 'clay' | 'ivory' | 'plum' | 'champagne'; is_published: boolean; sort_order: number; };
export type AdminPackage = { id: string; brand_id: string; brand_name: string; slug: string; title: string; audience: 'home-studio' | 'salon' | 'restock'; description: string; long_description: string | null; price_idr: number; compare_at_price_idr: number | null; badge: string | null; visual_tone: 'clay' | 'ivory' | 'plum'; delivery_note: string | null; status: 'draft' | 'published' | 'archived'; sort_order: number; };
export type AdminPackageItem = { id: string; package_id: string; sku_id: string; item_name_snapshot: string; item_note: string | null; quantity: number; sort_order: number; };
export type AdminSku = { id: string; product_id: string; sku: string; name: string; category_label: string; is_active: boolean; };
export type AdminInventoryLocation = { id: string; code: string; name: string; is_active: boolean; };
export type AdminInventoryStock = { id: string; location_id: string; location_name: string; sku_id: string; sku_name: string; sku_code: string; on_hand_quantity: number; reserved_quantity: number; reorder_point: number; updated_at: string; };
export type AdminWhatsappSettings = { phone: string; message: string; is_public: boolean; updated_at: string; };
export type AdminOrder = { id: string; status: string; payment_status: string; fulfillment_status: string; total_idr: number; created_at: string; shipment?: { provider_code: string | null; tracking_number: string | null; status: string } | null; };
export type AdminNotification = { id: string; title: string; body: string; read_at: string | null; created_at: string; };
export type AdminPricingTier = { id: string; code: string; name: string; minimum_lifetime_spend_idr: number; minimum_paid_order_count: number; price_visibility: 'standard' | 'premium_b2b'; is_active: boolean; sort_order: number; };
export type AdminPromotion = {
  id: string; code: string; name: string; promotion_type: 'new_user' | 'repeat_order' | 'bundle' | 'seasonal' | 'custom_voucher';
  audience_type: 'all' | 'new_user' | 'repeat_customer' | 'pricing_tier' | 'custom_customer';
  discount_type: 'percentage' | 'fixed_amount' | 'fixed_price' | 'free_shipping';
  discount_value: number; bundle_price_idr: number | null; minimum_order_amount_idr: number; minimum_item_quantity: number;
  repeat_order_min_count: number; voucher_code: string | null; usage_limit: number | null; usage_limit_per_customer: number | null;
  usage_count: number; starts_at: string; ends_at: string | null; status: 'draft' | 'scheduled' | 'active' | 'paused' | 'expired';
  is_stackable: boolean; is_active: boolean; created_at: string; updated_at: string;
};

export type AdminDashboard = {
  configured: boolean;
  access: 'demo' | 'granted' | 'denied';
  role: string | null;
  permissions: AdminPermissions;
  identity: AccountIdentity | null;
  products: AdminProduct[];
  orders: AdminOrder[];
  notifications: AdminNotification[];
  pricingTiers: AdminPricingTier[];
  promotions: AdminPromotion[];
  adminMemberships: AdminMembership[];
  brands: AdminBrand[];
  packages: AdminPackage[];
  packageItems: AdminPackageItem[];
  skus: AdminSku[];
  inventoryLocations: AdminInventoryLocation[];
  inventoryStock: AdminInventoryStock[];
  whatsappSettings: AdminWhatsappSettings | null;
};
const demoProducts: AdminProduct[] = [
  { id: 'demo-ph-bond', name: 'PH Bond - nail prep', brand: 'Luminails Lab', category: 'Prep', is_published: true },
  { id: 'demo-petal-glow', name: 'Color Gel - Petal Glow', brand: 'Bluesky', category: 'Color gel', is_published: true },
  { id: 'demo-rubber-base', name: 'Rubber Base - Milky', brand: 'Party', category: 'Base gel', is_published: true },
];
const demoOrders: AdminOrder[] = [
  { id: 'LN-DEMO-2481', status: 'submitted_for_review', payment_status: 'pending', fulfillment_status: 'unallocated', total_idr: 1820000, created_at: '2026-09-22T09:12:00.000Z' },
  { id: 'LN-DEMO-2479', status: 'paid', payment_status: 'paid', fulfillment_status: 'allocated', total_idr: 4365000, created_at: '2026-09-22T08:45:00.000Z' },
];
const demoNotifications: AdminNotification[] = [
  { id: 'demo-notification-1', title: 'Order baru masuk', body: 'Order LN-DEMO-2481 menunggu review fulfillment.', read_at: null, created_at: '2026-09-22T09:12:00.000Z' },
  { id: 'demo-notification-2', title: 'Threshold premium aktif', body: 'Aturan Premium B2B siap dikonfigurasi di Pricing.', read_at: null, created_at: '2026-09-22T08:20:00.000Z' },
];
const demoPricingTiers: AdminPricingTier[] = [
  { id: 'demo-standard', code: 'STANDARD', name: 'Harga standard', minimum_lifetime_spend_idr: 0, minimum_paid_order_count: 0, price_visibility: 'standard', is_active: true, sort_order: 10 },
  { id: 'demo-premium', code: 'B2B_PREMIUM', name: 'Premium B2B', minimum_lifetime_spend_idr: 5000000, minimum_paid_order_count: 3, price_visibility: 'premium_b2b', is_active: true, sort_order: 20 },
];
const demoPromotions: AdminPromotion[] = [
  { id: 'demo-promo-new-user', code: 'WELCOME10', name: 'Welcome untuk user baru', promotion_type: 'new_user', audience_type: 'new_user', discount_type: 'percentage', discount_value: 10, bundle_price_idr: null, minimum_order_amount_idr: 250000, minimum_item_quantity: 0, repeat_order_min_count: 0, voucher_code: 'WELCOME10', usage_limit: 500, usage_limit_per_customer: 1, usage_count: 38, starts_at: '2026-09-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z', status: 'active', is_stackable: false, is_active: true, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-22T00:00:00.000Z' },
  { id: 'demo-promo-repeat', code: 'REPEAT5', name: 'Repeat order studio', promotion_type: 'repeat_order', audience_type: 'repeat_customer', discount_type: 'percentage', discount_value: 5, bundle_price_idr: null, minimum_order_amount_idr: 500000, minimum_item_quantity: 0, repeat_order_min_count: 2, voucher_code: 'REPEAT5', usage_limit: null, usage_limit_per_customer: 1, usage_count: 74, starts_at: '2026-09-01T00:00:00.000Z', ends_at: null, status: 'active', is_stackable: true, is_active: true, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-22T00:00:00.000Z' },
  { id: 'demo-promo-bundle', code: 'STARTERKIT', name: 'Studio Starter Bundle', promotion_type: 'bundle', audience_type: 'all', discount_type: 'fixed_price', discount_value: 0, bundle_price_idr: 399000, minimum_order_amount_idr: 0, minimum_item_quantity: 3, repeat_order_min_count: 0, voucher_code: null, usage_limit: 100, usage_limit_per_customer: 2, usage_count: 12, starts_at: '2026-09-15T00:00:00.000Z', ends_at: '2026-10-15T23:59:59.000Z', status: 'active', is_stackable: false, is_active: true, created_at: '2026-09-15T00:00:00.000Z', updated_at: '2026-09-22T00:00:00.000Z' },
  { id: 'demo-promo-seasonal', code: 'NINE9', name: '9.9 Beauty Week', promotion_type: 'seasonal', audience_type: 'all', discount_type: 'fixed_amount', discount_value: 99000, bundle_price_idr: null, minimum_order_amount_idr: 999000, minimum_item_quantity: 0, repeat_order_min_count: 0, voucher_code: 'NINE9', usage_limit: 999, usage_limit_per_customer: 1, usage_count: 218, starts_at: '2026-09-09T00:00:00.000Z', ends_at: '2026-09-12T23:59:59.000Z', status: 'expired', is_stackable: false, is_active: false, created_at: '2026-08-20T00:00:00.000Z', updated_at: '2026-09-12T00:00:00.000Z' },
  { id: 'demo-promo-custom', code: 'B2B-VVIP-ALYA', name: 'Special voucher Alya Studio', promotion_type: 'custom_voucher', audience_type: 'custom_customer', discount_type: 'percentage', discount_value: 12, bundle_price_idr: null, minimum_order_amount_idr: 1000000, minimum_item_quantity: 0, repeat_order_min_count: 0, voucher_code: 'B2B-VVIP-ALYA', usage_limit: 1, usage_limit_per_customer: 1, usage_count: 0, starts_at: '2026-09-22T00:00:00.000Z', ends_at: '2026-10-31T23:59:59.000Z', status: 'scheduled', is_stackable: false, is_active: true, created_at: '2026-09-22T00:00:00.000Z', updated_at: '2026-09-22T00:00:00.000Z' },
];

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const demoPermissions = { catalog: true, orders: true, notifications: true, pricing: true, promotions: true, packages: true, inventory: true, settings: true };
  if (!configured) {
    return {
      configured: false, access: 'demo', role: null, permissions: demoPermissions, identity: null,
      products: demoProducts, orders: demoOrders, notifications: demoNotifications, pricingTiers: demoPricingTiers,
      promotions: demoPromotions, adminMemberships: [], brands: [], packages: [], packageItems: [], skus: [], inventoryLocations: [],
      inventoryStock: [], whatsappSettings: { phone: '6289501086888', message: 'Halo Luminails, saya mau konsultasi package dan order.', is_public: true, updated_at: new Date().toISOString() },
    };
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const identity = authData.user ? identityFromUser(authData.user) : null;
  const { data: membership } = await supabase.from('admin_memberships').select('role, is_active, permissions').maybeSingle();
  const deniedPermissions = { catalog: false, orders: false, notifications: false, pricing: false, promotions: false, packages: false, inventory: false, settings: false };
  if (!membership?.is_active) {
    return { configured: true, access: 'denied', role: null, permissions: deniedPermissions, identity, products: [], orders: [], notifications: [], pricingTiers: [], promotions: [], adminMemberships: [], brands: [], packages: [], packageItems: [], skus: [], inventoryLocations: [], inventoryStock: [], whatsappSettings: null };
  }

  const permissions = { ...deniedPermissions, ...((membership.permissions ?? {}) as Partial<AdminPermissions>) } as AdminPermissions;
  const isOwner = membership.role === 'owner';
  const canPackages = isOwner || permissions.packages;
  const canInventory = isOwner || permissions.inventory;
  const canSettings = isOwner || permissions.settings;

  const [productsResponse, ordersResponse, shipmentsResponse, notificationsResponse, pricingTiersResponse, promotionsResponse, membershipsResponse, brandsResponse, packagesResponse, packageItemsResponse, skusResponse, locationsResponse, stockResponse, settingsResponse] = await Promise.all([
    supabase.from('catalog_products').select('id, name, brand, category, is_published').order('sort_order').limit(50),
    supabase.from('commerce_orders').select('id, status, payment_status, fulfillment_status, total_idr, created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('commerce_shipments').select('order_id, provider_code, tracking_number, status'),
    supabase.from('admin_notifications').select('id, title, body, read_at, created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('pricing_tiers').select('id, code, name, minimum_lifetime_spend_idr, minimum_paid_order_count, price_visibility, is_active, sort_order').order('sort_order'),
    supabase.from('commerce_promotions').select('id, code, name, promotion_type, audience_type, discount_type, discount_value, bundle_price_idr, minimum_order_amount_idr, minimum_item_quantity, repeat_order_min_count, voucher_code, usage_limit, usage_limit_per_customer, usage_count, starts_at, ends_at, status, is_stackable, is_active, created_at, updated_at').order('starts_at', { ascending: false }).limit(50),
    isOwner ? supabase.rpc('get_admin_memberships') : Promise.resolve({ data: [], error: null }),
    canPackages ? supabase.from('catalog_brands').select('id, slug, name, tagline, description, visual_tone, is_published, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPackages ? supabase.from('commerce_packages').select('id, brand_id, slug, title, audience, description, long_description, price_idr, compare_at_price_idr, badge, visual_tone, delivery_note, status, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPackages ? supabase.from('commerce_package_items').select('id, package_id, sku_id, item_name_snapshot, item_note, quantity, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    (canInventory || canPackages || permissions.catalog) ? supabase.from('catalog_skus').select('id, product_id, sku, name, category_label, is_active').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canInventory ? supabase.from('inventory_locations').select('id, code, name, is_active').order('code') : Promise.resolve({ data: [], error: null }),
    canInventory ? supabase.from('inventory_stock').select('id, location_id, sku_id, on_hand_quantity, reserved_quantity, reorder_point, updated_at').order('updated_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    canSettings ? supabase.from('commerce_store_settings').select('key, value, is_public, updated_at').eq('key', 'whatsapp').maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  const brands = (brandsResponse.data ?? []) as AdminBrand[];
  const brandById = new Map(brands.map((brand) => [brand.id, brand.name]));
  const skus = (skusResponse.data ?? []) as AdminSku[];
  const skuById = new Map(skus.map((sku) => [sku.id, sku]));
  const locations = (locationsResponse.data ?? []) as AdminInventoryLocation[];
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const stock = (stockResponse.data ?? []) as Array<{ id: string; location_id: string; sku_id: string; on_hand_quantity: number; reserved_quantity: number; reorder_point: number; updated_at: string }>;
  const settingsRow = settingsResponse.data as { value?: { phone?: string; message?: string }; is_public?: boolean; updated_at?: string } | null;

  return {
    configured: true, access: 'granted', role: membership.role, permissions, identity,
    products: (productsResponse.data ?? []) as AdminProduct[],
    orders: ((ordersResponse.data ?? []) as AdminOrder[]).map((order) => ({ ...order, shipment: ((shipmentsResponse.data ?? []) as Array<{ order_id: string; provider_code: string | null; tracking_number: string | null; status: string }>).find((shipment) => shipment.order_id === order.id) ?? null })),
    notifications: (notificationsResponse.data ?? []) as AdminNotification[],
    pricingTiers: (pricingTiersResponse.data ?? []) as AdminPricingTier[],
    promotions: (promotionsResponse.data ?? []) as AdminPromotion[],
    adminMemberships: (membershipsResponse.data ?? []) as AdminMembership[],
    brands,
    packages: ((packagesResponse.data ?? []) as Array<Omit<AdminPackage, 'brand_name'>>).map((item) => ({ ...item, brand_name: brandById.get(item.brand_id) ?? 'Unassigned' })),
    packageItems: (packageItemsResponse.data ?? []) as AdminPackageItem[],
    skus,
    inventoryLocations: locations,
    inventoryStock: stock.map((item) => ({ ...item, location_name: locationById.get(item.location_id)?.name ?? 'Unknown location', sku_name: skuById.get(item.sku_id)?.name ?? 'Unknown SKU', sku_code: skuById.get(item.sku_id)?.sku ?? item.sku_id })),
    whatsappSettings: settingsRow ? { phone: settingsRow.value?.phone ?? '', message: settingsRow.value?.message ?? '', is_public: settingsRow.is_public ?? true, updated_at: settingsRow.updated_at ?? new Date().toISOString() } : null,
  };
}
