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

export type AdminDashboard = {
  configured: boolean;
  access: 'demo' | 'granted' | 'denied';
  role: string | null;
  products: AdminProduct[];
  orders: AdminOrder[];
  notifications: AdminNotification[];
  pricingTiers: AdminPricingTier[];
};

const demoProducts: AdminProduct[] = [
  { id: 'demo-ph-bond', name: 'PH Bond — nail prep', brand: 'Luminails Lab', category: 'Prep', is_published: true },
  { id: 'demo-petal-glow', name: 'Color Gel — Petal Glow', brand: 'Bluesky', category: 'Color gel', is_published: true },
  { id: 'demo-rubber-base', name: 'Rubber Base — Milky', brand: 'Party', category: 'Base gel', is_published: true },
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

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!configured) {
    return { configured: false, access: 'demo', role: null, products: demoProducts, orders: demoOrders, notifications: demoNotifications, pricingTiers: demoPricingTiers };
  }

  const supabase = await createClient();
  const { data: membership } = await supabase.from('admin_memberships').select('role, is_active').maybeSingle();
  if (!membership?.is_active) {
    return { configured: true, access: 'denied', role: null, products: [], orders: [], notifications: [], pricingTiers: [] };
  }

  const [productsResponse, ordersResponse, notificationsResponse, pricingTiersResponse] = await Promise.all([
    supabase.from('catalog_products').select('id, name, brand, category, is_published').order('sort_order').limit(50),
    supabase.from('commerce_orders').select('id, status, payment_status, fulfillment_status, total_idr, created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('admin_notifications').select('id, title, body, read_at, created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('pricing_tiers').select('id, code, name, minimum_lifetime_spend_idr, minimum_paid_order_count, price_visibility, is_active, sort_order').order('sort_order'),
  ]);

  return {
    configured: true,
    access: 'granted',
    role: membership.role,
    products: (productsResponse.data ?? []) as AdminProduct[],
    orders: (ordersResponse.data ?? []) as AdminOrder[],
    notifications: (notificationsResponse.data ?? []) as AdminNotification[],
    pricingTiers: (pricingTiersResponse.data ?? []) as AdminPricingTier[],
  };
}
