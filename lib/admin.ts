import { createClient } from './supabase/server';

export type AdminProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  is_published: boolean;
};

export type AdminOrder = {
  id: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  total_idr: number;
  created_at: string;
};

export type AdminNotification = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type AdminPricingTier = {
  id: string;
  code: string;
  name: string;
  minimum_lifetime_spend_idr: number;
  minimum_paid_order_count: number;
  price_visibility: 'standard' | 'premium_b2b';
  is_active: boolean;
  sort_order: number;
};

export type AdminPromotion = {
  id: string;
  code: string;
  name: string;
  promotion_type: 'new_user' | 'repeat_order' | 'bundle' | 'seasonal' | 'custom_voucher';
  audience_type: 'all' | 'new_user' | 'repeat_customer' | 'pricing_tier' | 'custom_customer';
  discount_type: 'percentage' | 'fixed_amount' | 'fixed_price' | 'free_shipping';
  discount_value: number;
  bundle_price_idr: number | null;
  minimum_order_amount_idr: number;
  minimum_item_quantity: number;
  repeat_order_min_count: number;
  voucher_code: string | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  usage_count: number;
  starts_at: string;
  ends_at: string | null;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'expired';
  is_stackable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminDashboard = {
  configured: boolean;
  access: 'demo' | 'granted' | 'denied';
  role: string | null;
  products: AdminProduct[];
  orders: AdminOrder[];
  notifications: AdminNotification[];
  pricingTiers: AdminPricingTier[];
  promotions: AdminPromotion[];
};

const demoProducts: AdminProduct[] = [
  { id: 'demo-ph-bond', name: 'PH Bond ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â nail prep', brand: 'Luminails Lab', category: 'Prep', is_published: true },
  { id: 'demo-petal-glow', name: 'Color Gel ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Petal Glow', brand: 'Bluesky', category: 'Color gel', is_published: true },
  { id: 'demo-rubber-base', name: 'Rubber Base ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Milky', brand: 'Party', category: 'Base gel', is_published: true },
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
  if (!configured) {
    return { configured: false, access: 'demo', role: null, products: demoProducts, orders: demoOrders, notifications: demoNotifications, pricingTiers: demoPricingTiers, promotions: demoPromotions };
  }

  const supabase = await createClient();
  const { data: membership } = await supabase.from('admin_memberships').select('role, is_active').maybeSingle();
  if (!membership?.is_active) {
    return { configured: true, access: 'denied', role: null, products: [], orders: [], notifications: [], pricingTiers: [], promotions: [] };
  }

  const [productsResponse, ordersResponse, notificationsResponse, pricingTiersResponse, promotionsResponse] = await Promise.all([
    supabase.from('catalog_products').select('id, name, brand, category, is_published').order('sort_order').limit(50),
    supabase.from('commerce_orders').select('id, status, payment_status, fulfillment_status, total_idr, created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('admin_notifications').select('id, title, body, read_at, created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('pricing_tiers').select('id, code, name, minimum_lifetime_spend_idr, minimum_paid_order_count, price_visibility, is_active, sort_order').order('sort_order'),
    supabase.from('commerce_promotions').select('id, code, name, promotion_type, audience_type, discount_type, discount_value, bundle_price_idr, minimum_order_amount_idr, minimum_item_quantity, repeat_order_min_count, voucher_code, usage_limit, usage_limit_per_customer, usage_count, starts_at, ends_at, status, is_stackable, is_active, created_at, updated_at').order('starts_at', { ascending: false }).limit(50),
  ]);

  return {
    configured: true,
    access: 'granted',
    role: membership.role,
    products: (productsResponse.data ?? []) as AdminProduct[],
    orders: (ordersResponse.data ?? []) as AdminOrder[],
    notifications: (notificationsResponse.data ?? []) as AdminNotification[],
    pricingTiers: (pricingTiersResponse.data ?? []) as AdminPricingTier[],
    promotions: (promotionsResponse.data ?? []) as AdminPromotion[],
  };
}
