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
export type AdminPackage = { id: string; brand_id: string; brand_name: string; package_type_id?: string | null; slug: string; title: string; audience: string; description: string; long_description: string | null; price_idr: number; compare_at_price_idr: number | null; badge: string | null; visual_tone: 'clay' | 'ivory' | 'plum'; delivery_note: string | null; selection_mode: 'fixed' | 'free_pick'; selection_capacity: number | null; status: 'draft' | 'published' | 'archived'; sort_order: number; starts_at?: string | null; ends_at?: string | null; minimum_quantity?: number; minimum_subtotal_idr?: number; stackable?: boolean; points_earning_mode?: 'normal' | 'reduced' | 'none'; points_multiplier?: number; allow_reward_redemption?: boolean; };
export type AdminPackageType = { id: string; slug: string; name: string; description: string | null; is_active: boolean; sort_order: number; };
export type AdminPackageItem = { id: string; package_id: string; sku_id: string; item_name_snapshot: string; item_note: string | null; quantity: number; sort_order: number; };
export type AdminPackageAllowedSku = { package_id: string; sku_id: string; sort_order: number; };
export type AdminPackageEligibility = { id: string; package_id: string; customer_tier_id: string | null; customer_id: string | null; brand_id: string | null; sku_id: string | null; minimum_quantity: number; minimum_order_value_idr: number; };
export type AdminPackageBenefit = { id: string; package_id: string; customer_tier_id: string | null; reward_sku_id: string; quantity: number; variant_rule: 'admin_selected' | 'customer_selected'; notes: string | null; allowed_sku_ids?: string[]; };
export type AdminPackageBenefitAllowedSku = { benefit_id: string; sku_id: string; sort_order: number; };
export type AdminPackageImage = { id: string; package_id: string; image_url: string; alt_text: string | null; sort_order: number; };
export type AdminSku = { id: string; product_id: string; sku: string; name: string; category_label: string; public_reference_price_idr: number | null; badge: string | null; is_active: boolean; sort_order: number; };
export type AdminInventoryLocation = { id: string; code: string; name: string; is_active: boolean; };
export type AdminInventoryStock = { id: string; location_id: string; location_name: string; sku_id: string; sku_name: string; sku_code: string; on_hand_quantity: number; reserved_quantity: number; reorder_point: number; updated_at: string; };
export type AdminWhatsappSettings = { phone: string; message: string; is_public: boolean; updated_at: string; };
export type AdminOrder = { id: string; customer_id?: string | null; status: string; payment_status: string; fulfillment_status: string; total_idr: number; subtotal_idr?: number; discount_idr?: number; customer_notes?: string | null; contact_phone?: string | null; created_at: string; shipment?: { provider_code: string | null; tracking_number: string | null; status: string } | null; };
export type AdminNotification = { id: string; title: string; body: string; read_at: string | null; created_at: string; };
export type AdminPricingTier = { id: string; code: string; name: string; minimum_lifetime_spend_idr: number; minimum_paid_order_count: number; price_visibility: 'standard' | 'premium_b2b'; customer_role: 'all' | 'home_studio' | 'salon' | 'distributor' | 'vip'; is_active: boolean; sort_order: number; };
export type AdminPackagePrice = { id: string; package_id: string; pricing_tier_id: string; unit_price_idr: number; effective_from: string; effective_until: string | null; is_active: boolean; };
export type AdminCustomerTier = { id: string; code: string; name: string; minimum_rolling_spend_idr: number; maximum_rolling_spend_idr: number | null; rolling_period_months: number; point_multiplier: number; description: string | null; benefits_description: string | null; is_active: boolean; priority: number; };
export type AdminCustomer = { id: string; email?: string | null; display_name: string | null; business_name: string | null; phone: string | null; whatsapp: string | null; address?: string | null; studio_type?: string | null; additional_info?: string | null; status: string; customer_tier_id: string | null; auto_customer_tier_id: string | null; manual_tier_override_enabled: boolean; manual_tier_reason?: string | null; manual_tier_starts_at?: string | null; manual_tier_expires_at?: string | null; lifetime_paid_amount_idr: number; paid_order_count: number; rolling_spend_idr?: number; average_order_value_idr?: number; last_order_at?: string | null; last_redemption_at?: string | null; expiring_points?: number; next_expiry_at?: string | null; available_points: number; lifetime_earned_points: number; lifetime_redeemed_points: number; created_at: string; };
export type AdminReward = { id: string; sku_id: string; reward_name: string | null; sku_name: string | null; points_cost: number; hpp_idr: number; normal_selling_price_idr: number; minimum_customer_tier_id: string | null; minimum_order_value_idr: number; max_redemption_quantity: number; reward_stock: number; starts_at: string | null; ends_at: string | null; description?: string | null; is_active: boolean; redemption_count: number; };
export type AdminPointTransaction = { id: string; customer_id: string; order_id: string | null; redemption_id?: string | null; entry_type: string; points_delta: number; balance_before: number | null; balance_after: number | null; description: string; reference_text?: string | null; expires_at?: string | null; created_by?: string | null; created_at: string; };
export type AdminRedemption = { id: string; customer_id: string; order_id: string; sku_id: string | null; points_redeemed: number; points_total: number | null; quantity: number; status: string; created_at: string; };
export type AdminLoyaltySettings = { key: string; point_unit_value_idr: number; expiry_months: number; reward_cost_warning_percent: number; tier_rolling_period_months: number; automatic_tier_recalculation: boolean; allow_manual_point_adjustment: boolean; require_adjustment_reason: boolean; };
export type AdminAuditLog = { id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null; created_at: string; };
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
  packageAllowedSkus: AdminPackageAllowedSku[];
  packageImages: AdminPackageImage[];
  packagePrices: AdminPackagePrice[];
  skus: AdminSku[];
  inventoryLocations: AdminInventoryLocation[];
  inventoryStock: AdminInventoryStock[];
  whatsappSettings: AdminWhatsappSettings | null;
  customerTiers: AdminCustomerTier[];
  customers: AdminCustomer[];
  rewards: AdminReward[];
  pointTransactions: AdminPointTransaction[];
  redemptions: AdminRedemption[];
  loyaltySettings: AdminLoyaltySettings | null;
  packageTypes: AdminPackageType[];
  packageEligibility: AdminPackageEligibility[];
  packageBenefits: AdminPackageBenefit[];
  packageBenefitAllowedSkus: AdminPackageBenefitAllowedSku[];
  auditLogs: AdminAuditLog[];
};
const demoProducts: AdminProduct[] = [
  { id: 'demo-ph-bond', name: 'PH Bond - nail prep', brand: 'Luminails Lab', category: 'Prep', is_published: true },
  { id: 'demo-petal-glow', name: 'Color Gel - Petal Glow', brand: 'Bluesky', category: 'Color gel', is_published: true },
  { id: 'demo-rubber-base', name: 'Rubber Base - Milky', brand: 'Party', category: 'Base gel', is_published: true },
];
const demoBrands: AdminBrand[] = [
  { id: 'demo-brand-bluesky', slug: 'bluesky', name: 'Bluesky', tagline: 'Colour, edited.', description: 'Demo brand untuk preview admin.', visual_tone: 'ivory', is_published: true, sort_order: 10 },
];
const demoSkus: AdminSku[] = [
  { id: 'demo-sku-starter-001', product_id: 'demo-petal-glow', sku: 'BS-STARTER-001', name: 'Starter nude 01', category_label: 'Color gel', public_reference_price_idr: 100000, badge: null, is_active: true, sort_order: 10 },
  { id: 'demo-sku-rubber-base-001', product_id: 'demo-rubber-base', sku: 'RB-MILKY-001', name: 'Rubber Base Milky', category_label: 'Base gel', public_reference_price_idr: 140000, badge: null, is_active: true, sort_order: 20 },
  { id: 'demo-sku-ph-bond-001', product_id: 'demo-ph-bond', sku: 'LN-PHBOND-001', name: 'PH Bond', category_label: 'Prep', public_reference_price_idr: 90000, badge: null, is_active: true, sort_order: 30 },
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
  { id: 'demo-standard', code: 'STANDARD', name: 'Harga standard', minimum_lifetime_spend_idr: 0, minimum_paid_order_count: 0, price_visibility: 'standard', customer_role: 'all', is_active: true, sort_order: 10 },
  { id: 'demo-premium', code: 'B2B_PREMIUM', name: 'Premium B2B', minimum_lifetime_spend_idr: 5000000, minimum_paid_order_count: 3, price_visibility: 'premium_b2b', customer_role: 'all', is_active: true, sort_order: 20 },
  { id: 'demo-vip', code: 'VIP', name: 'VIP', minimum_lifetime_spend_idr: 15000000, minimum_paid_order_count: 10, price_visibility: 'premium_b2b', customer_role: 'vip', is_active: true, sort_order: 30 },
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
      promotions: demoPromotions, adminMemberships: [], brands: demoBrands, packages: [], packageItems: [], packageAllowedSkus: [], packageImages: [], packagePrices: [], skus: demoSkus, inventoryLocations: [],
      inventoryStock: [], whatsappSettings: { phone: '6289501086888', message: 'Halo Luminails, saya mau konsultasi package dan order.', is_public: true, updated_at: new Date().toISOString() }, customerTiers: [], customers: [], rewards: [], pointTransactions: [], redemptions: [], loyaltySettings: null, packageTypes: [{ id: 'demo-type-home', slug: 'home-studio', name: 'Home studio', description: null, is_active: true, sort_order: 10 }, { id: 'demo-type-salon', slug: 'salon', name: 'Salon', description: null, is_active: true, sort_order: 20 }, { id: 'demo-type-restock', slug: 'restock', name: 'Restock', description: null, is_active: true, sort_order: 30 }], packageEligibility: [], packageBenefits: [], packageBenefitAllowedSkus: [], auditLogs: [],
    };
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const identity = authData.user ? identityFromUser(authData.user) : null;
  const { data: membership } = await supabase.from('admin_memberships').select('role, is_active, permissions').maybeSingle();
  const deniedPermissions = { catalog: false, orders: false, notifications: false, pricing: false, promotions: false, packages: false, inventory: false, settings: false };
  if (!membership?.is_active) {
    return { configured: true, access: 'denied', role: null, permissions: deniedPermissions, identity, products: [], orders: [], notifications: [], pricingTiers: [], promotions: [], adminMemberships: [], brands: [], packages: [], packageItems: [], packageAllowedSkus: [], packageImages: [], packagePrices: [], skus: [], inventoryLocations: [], inventoryStock: [], whatsappSettings: null, customerTiers: [], customers: [], rewards: [], pointTransactions: [], redemptions: [], loyaltySettings: null, packageTypes: [], packageEligibility: [], packageBenefits: [], packageBenefitAllowedSkus: [], auditLogs: [] };
  }

  const permissions = { ...deniedPermissions, ...((membership.permissions ?? {}) as Partial<AdminPermissions>) } as AdminPermissions;
  const isOwner = membership.role === 'owner';
  const canCatalog = isOwner || permissions.catalog;
  const canOrders = isOwner || permissions.orders;
  const canNotifications = isOwner || permissions.notifications;
  const canPricing = isOwner || permissions.pricing;
  const canPromotions = isOwner || permissions.promotions;
  const canPackages = isOwner || permissions.packages;
  const canInventory = isOwner || permissions.inventory;
  const canSettings = isOwner || permissions.settings;
  const adminDb = supabase as any;

  const [productsResponse, ordersResponse, shipmentsResponse, notificationsResponse, pricingTiersResponse, promotionsResponse, membershipsResponse, brandsResponse, packagesResponse, packageItemsResponse, packageAllowedSkusResponse, packageImagesResponse, packagePricesResponse, skusResponse, locationsResponse, stockResponse, settingsResponse, customerTiersResponse, customersResponse, accountsResponse, rewardsResponse, ledgerResponse, redemptionsResponse, loyaltySettingsResponse, packageTypesResponse, packageEligibilityResponse, packageBenefitsResponse, packageBenefitAllowedSkusResponse, auditLogsResponse] = await Promise.all([
    (canCatalog || canPackages) ? supabase.from('catalog_products').select('id, name, brand, category, is_published').order('sort_order').limit(50) : Promise.resolve({ data: [], error: null }),
    canOrders ? (supabase as any).from('commerce_orders').select('id, customer_id, status, payment_status, fulfillment_status, total_idr, subtotal_idr, discount_idr, customer_notes, contact_phone, created_at').order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canOrders ? supabase.from('commerce_shipments').select('order_id, provider_code, tracking_number, status') : Promise.resolve({ data: [], error: null }),
    (canOrders || canNotifications) ? supabase.from('admin_notifications').select('id, title, body, read_at, created_at').order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
    canPricing ? supabase.from('pricing_tiers').select('id, code, name, minimum_lifetime_spend_idr, minimum_paid_order_count, price_visibility, customer_role, is_active, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPromotions ? supabase.from('commerce_promotions').select('id, code, name, promotion_type, audience_type, discount_type, discount_value, bundle_price_idr, minimum_order_amount_idr, minimum_item_quantity, repeat_order_min_count, voucher_code, usage_limit, usage_limit_per_customer, usage_count, starts_at, ends_at, status, is_stackable, is_active, created_at, updated_at').order('starts_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    isOwner ? supabase.rpc('get_admin_memberships') : Promise.resolve({ data: [], error: null }),
    canPackages ? supabase.from('catalog_brands').select('id, slug, name, tagline, description, visual_tone, is_published, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPackages ? (supabase as any).from('commerce_packages').select('id, brand_id, package_type_id, slug, title, audience, description, long_description, price_idr, compare_at_price_idr, badge, visual_tone, delivery_note, selection_mode, selection_capacity, status, sort_order, starts_at, ends_at, minimum_quantity, minimum_subtotal_idr, stackable, points_earning_mode, points_multiplier, allow_reward_redemption').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPackages ? supabase.from('commerce_package_items').select('id, package_id, sku_id, item_name_snapshot, item_note, quantity, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPackages ? supabase.from('commerce_package_allowed_skus').select('package_id, sku_id, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPackages ? supabase.from('commerce_package_images').select('id, package_id, image_url, alt_text, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPackages ? supabase.from('commerce_package_prices').select('id, package_id, pricing_tier_id, unit_price_idr, effective_from, effective_until, is_active').eq('is_active', true).order('effective_from', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    (canInventory || canPackages || permissions.catalog) ? supabase.from('catalog_skus').select('id, product_id, sku, name, category_label, public_reference_price_idr, badge, is_active, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canInventory ? supabase.from('inventory_locations').select('id, code, name, is_active').order('code') : Promise.resolve({ data: [], error: null }),
    canInventory ? supabase.from('inventory_stock').select('id, location_id, sku_id, on_hand_quantity, reserved_quantity, reorder_point, updated_at').order('updated_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    canSettings ? supabase.from('commerce_store_settings').select('key, value, is_public, updated_at').eq('key', 'whatsapp').maybeSingle() : Promise.resolve({ data: null, error: null }),
    canPricing || canOrders ? adminDb.from('customer_tiers').select('id, code, name, minimum_rolling_spend_idr, maximum_rolling_spend_idr, rolling_period_months, point_multiplier, description, benefits_description, is_active, priority').order('minimum_rolling_spend_idr', { ascending: true }) : Promise.resolve({ data: [], error: null }),
    canOrders ? adminDb.from('customer_profiles').select('id, email, display_name, business_name, phone, whatsapp, address, studio_type, additional_info, status, customer_tier_id, auto_customer_tier_id, manual_tier_override_enabled, manual_tier_reason, manual_tier_starts_at, manual_tier_expires_at, lifetime_paid_amount_idr, paid_order_count, created_at').order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canOrders ? adminDb.from('loyalty_accounts').select('customer_id, available_points, lifetime_earned_points, lifetime_redeemed_points') : Promise.resolve({ data: [], error: null }),
    canPricing ? adminDb.from('loyalty_reward_catalog').select('id, sku_id, reward_name, description, points_cost, hpp_idr, normal_selling_price_idr, minimum_customer_tier_id, minimum_order_value_idr, max_redemption_quantity, reward_stock, starts_at, ends_at, is_active, redemption_count').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    canPricing || canOrders ? adminDb.from('loyalty_ledger').select('id, customer_id, order_id, redemption_id, entry_type, points_delta, balance_before, balance_after, description, reference_text, expires_at, created_by, created_at').order('created_at', { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
    canOrders ? adminDb.from('loyalty_redemptions').select('id, customer_id, order_id, sku_id, points_redeemed, points_total, quantity, status, created_at').order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canPricing ? adminDb.from('loyalty_point_settings').select('key, point_unit_value_idr, expiry_months, reward_cost_warning_percent, tier_rolling_period_months, automatic_tier_recalculation, allow_manual_point_adjustment, require_adjustment_reason').eq('key', 'default').maybeSingle() : Promise.resolve({ data: null, error: null }),
    canPackages ? adminDb.from('commerce_package_types').select('id, slug, name, description, is_active, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPackages ? adminDb.from('commerce_package_eligibility').select('id, package_id, customer_tier_id, customer_id, brand_id, sku_id, minimum_quantity, minimum_order_value_idr').order('created_at') : Promise.resolve({ data: [], error: null }),
    canPackages ? adminDb.from('commerce_package_benefits').select('id, package_id, customer_tier_id, reward_sku_id, quantity, variant_rule, notes').order('created_at') : Promise.resolve({ data: [], error: null }),
    canPackages ? adminDb.from('commerce_package_benefit_allowed_skus').select('benefit_id, sku_id, sort_order').order('sort_order') : Promise.resolve({ data: [], error: null }),
    canPricing || canOrders || canPackages ? adminDb.from('admin_audit_logs').select('id, actor_id, action, entity_type, entity_id, old_value, new_value, created_at').order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
  ]);

  const pointLotsResponse = canOrders
    ? await adminDb.from('loyalty_point_lots').select('customer_id, remaining_points, expires_at').gt('remaining_points', 0).order('expires_at')
    : { data: [], error: null };

  const brands = (brandsResponse.data ?? []) as AdminBrand[];
  const brandById = new Map(brands.map((brand) => [brand.id, brand.name]));
  const skus = (skusResponse.data ?? []) as AdminSku[];
  const skuById = new Map(skus.map((sku) => [sku.id, sku]));
  const locations = (locationsResponse.data ?? []) as AdminInventoryLocation[];
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const stock = (stockResponse.data ?? []) as Array<{ id: string; location_id: string; sku_id: string; on_hand_quantity: number; reserved_quantity: number; reorder_point: number; updated_at: string }>;
  const settingsRow = settingsResponse.data as { value?: { phone?: string; message?: string }; is_public?: boolean; updated_at?: string } | null;
  const customerTiers = (customerTiersResponse.data ?? []) as AdminCustomerTier[];
  const accountByCustomer = new Map(((accountsResponse.data ?? []) as Array<{ customer_id: string; available_points?: number; lifetime_earned_points?: number; lifetime_redeemed_points?: number }>).map((account) => [account.customer_id, account]));
  const now = Date.now();
  const rollingCutoff = now - 6 * 30 * 24 * 60 * 60 * 1000;
  const customerMetrics = new Map<string, { rolling: number; orders: number; average: number; last: string | null }>();
  for (const order of (ordersResponse.data ?? []) as Array<{ customer_id?: string | null; subtotal_idr?: number; total_idr?: number; discount_idr?: number; payment_status: string; created_at: string }>) {
    if (!order.customer_id || !['paid', 'partially_refunded'].includes(order.payment_status)) continue;
    const existing = customerMetrics.get(order.customer_id) ?? { rolling: 0, orders: 0, average: 0, last: null };
    const eligible = Math.max(0, Number(order.subtotal_idr ?? order.total_idr ?? 0) - Number(order.discount_idr ?? 0));
    existing.orders += 1;
    existing.average += eligible;
    if (new Date(order.created_at).getTime() >= rollingCutoff) existing.rolling += eligible;
    if (!existing.last || new Date(order.created_at).getTime() > new Date(existing.last).getTime()) existing.last = order.created_at;
    customerMetrics.set(order.customer_id, existing);
  }
  const expiryMetrics = new Map<string, { points: number; next: string | null }>();
  const expiryCutoff = now + 30 * 24 * 60 * 60 * 1000;
  for (const lot of (pointLotsResponse.data ?? []) as Array<{ customer_id: string; remaining_points: number; expires_at: string }>) {
    const expiryTime = new Date(lot.expires_at).getTime();
    if (!Number.isFinite(expiryTime) || expiryTime > expiryCutoff) continue;
    const existing = expiryMetrics.get(lot.customer_id) ?? { points: 0, next: null };
    existing.points += Number(lot.remaining_points ?? 0);
    if (!existing.next || expiryTime < new Date(existing.next).getTime()) existing.next = lot.expires_at;
    expiryMetrics.set(lot.customer_id, existing);
  }
  const lastRedemptionByCustomer = new Map<string, string>();
  for (const redemption of (redemptionsResponse.data ?? []) as Array<{ customer_id: string; created_at: string }>) {
    if (!lastRedemptionByCustomer.has(redemption.customer_id)) lastRedemptionByCustomer.set(redemption.customer_id, redemption.created_at);
  }

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
    packageAllowedSkus: (packageAllowedSkusResponse.data ?? []) as AdminPackageAllowedSku[],
    packageImages: (packageImagesResponse.data ?? []) as AdminPackageImage[],
    packagePrices: (packagePricesResponse.data ?? []) as AdminPackagePrice[],
    skus,
    inventoryLocations: locations,
    inventoryStock: stock.map((item) => ({ ...item, location_name: locationById.get(item.location_id)?.name ?? 'Unknown location', sku_name: skuById.get(item.sku_id)?.name ?? 'Unknown SKU', sku_code: skuById.get(item.sku_id)?.sku ?? item.sku_id })),
    whatsappSettings: settingsRow ? { phone: settingsRow.value?.phone ?? '', message: settingsRow.value?.message ?? '', is_public: settingsRow.is_public ?? true, updated_at: settingsRow.updated_at ?? new Date().toISOString() } : null,
    customerTiers,
    customers: ((customersResponse.data ?? []) as Array<Omit<AdminCustomer, 'available_points' | 'lifetime_earned_points' | 'lifetime_redeemed_points'>>).map((customer) => { const metric = customerMetrics.get(customer.id); const expiry = expiryMetrics.get(customer.id); return { ...customer, rolling_spend_idr: metric?.rolling ?? 0, average_order_value_idr: metric?.orders ? Math.round(metric.average / metric.orders) : 0, last_order_at: metric?.last ?? null, last_redemption_at: lastRedemptionByCustomer.get(customer.id) ?? null, expiring_points: expiry?.points ?? 0, next_expiry_at: expiry?.next ?? null, available_points: Number(accountByCustomer.get(customer.id)?.available_points ?? 0), lifetime_earned_points: Number(accountByCustomer.get(customer.id)?.lifetime_earned_points ?? 0), lifetime_redeemed_points: Number(accountByCustomer.get(customer.id)?.lifetime_redeemed_points ?? 0) }; }),
    rewards: ((rewardsResponse.data ?? []) as Array<Omit<AdminReward, 'sku_name'>>).map((reward) => ({ ...reward, sku_name: skuById.get(reward.sku_id)?.name ?? reward.sku_id })),
    pointTransactions: (ledgerResponse.data ?? []) as AdminPointTransaction[],
    redemptions: (redemptionsResponse.data ?? []) as AdminRedemption[],
    loyaltySettings: (loyaltySettingsResponse.data ?? null) as AdminLoyaltySettings | null,
    packageTypes: (packageTypesResponse.data ?? []) as AdminPackageType[],
    packageEligibility: (packageEligibilityResponse.data ?? []) as AdminPackageEligibility[],
    packageBenefits: ((packageBenefitsResponse.data ?? []) as AdminPackageBenefit[]).map((benefit) => ({ ...benefit, allowed_sku_ids: (packageBenefitAllowedSkusResponse.data ?? []).filter((allowed: AdminPackageBenefitAllowedSku) => allowed.benefit_id === benefit.id).sort((a: AdminPackageBenefitAllowedSku, b: AdminPackageBenefitAllowedSku) => a.sort_order - b.sort_order).map((allowed: AdminPackageBenefitAllowedSku) => allowed.sku_id) })),
    packageBenefitAllowedSkus: (packageBenefitAllowedSkusResponse.data ?? []) as AdminPackageBenefitAllowedSku[],
    auditLogs: (auditLogsResponse.data ?? []) as AdminAuditLog[],
  };
}
