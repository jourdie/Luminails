import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type WhatsAppConfig = {
  apiVersion: string;
  accessToken: string;
  phoneNumberId: string;
  adminTo: string | null;
};

export type OrderWebhookRecord = {
  id: string;
  customer_id?: string | null;
  account_id?: string | null;
  source_channel?: string | null;
  status?: string | null;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  total_idr?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type OrderItemRecord = {
  sku_snapshot: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price_idr: number;
  line_total_idr: number;
};

function getConfig(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  const adminTo = process.env.WHATSAPP_ADMIN_TO;
  if (!accessToken || !phoneNumberId) return null;
  return { apiVersion: process.env.WHATSAPP_CLOUD_API_VERSION || 'v23.0', accessToken, phoneNumberId, adminTo: adminTo ? adminTo.replace(/\D/g, '') : null };
}

function formatMoney(value: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
}

async function getOrderItems(orderId: string): Promise<OrderItemRecord[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return [];
  const supabase = createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await supabase.from('commerce_order_items').select('sku_snapshot, product_name_snapshot, quantity, unit_price_idr, line_total_idr').eq('order_id', orderId).order('created_at');
  return (data ?? []) as OrderItemRecord[];
}

export function formatOrderNotification(order: OrderWebhookRecord, items: OrderItemRecord[] = []) {
  const lines = [
    '🔔 ORDER BARU — LUMINAILS',
    `Order: ${order.id}`,
    `Channel: ${order.source_channel ?? 'web'}`,
    `Customer ID: ${order.customer_id ?? '-'}`,
    `Account ID: ${order.account_id ?? '-'}`,
    `Total: ${formatMoney(Number(order.total_idr ?? 0))}`,
    `Status: ${order.status ?? 'submitted_for_review'}`,
    `Pembayaran: ${order.payment_status ?? 'pending'}`,
    `Fulfillment: ${order.fulfillment_status ?? 'unallocated'}`,
    `Dibuat: ${order.created_at ?? '-'}`,
  ];
  if (items.length > 0) {
    lines.push('', 'ITEM:');
    items.forEach((item, index) => lines.push(`${index + 1}. ${item.product_name_snapshot} (${item.sku_snapshot}) × ${item.quantity} — ${formatMoney(item.line_total_idr)}`));
  }
  lines.push('', 'Buka admin workspace untuk review dan allocation.');
  return lines.join('\n');
}

export async function sendOrderNotification(order: OrderWebhookRecord) {
  const items = await getOrderItems(order.id);
  return sendWhatsAppText(formatOrderNotification(order, items));
}

export function formatCustomerOrderCreatedNotification(orderId: string, totalIdr: number, promotionCode?: string | null) {
  return ['Order Luminails berhasil dibuat.', 'Nomor order: ' + orderId, 'Total: ' + formatMoney(totalIdr), 'Status: menunggu review', 'Promo: ' + (promotionCode ?? '-'), '', 'Update pembayaran dan pengiriman akan dikirim ke nomor WhatsApp ini.'].join('\n');
}

export function formatOrderStatusNotification(order: OrderWebhookRecord, shipment?: { provider_code?: string | null; tracking_number?: string | null; tracking_url?: string | null; status?: string | null }) {
  return ['Update order Luminails', 'Nomor order: ' + order.id, 'Status order: ' + (order.status ?? '-'), 'Pembayaran: ' + (order.payment_status ?? '-'), 'Fulfillment: ' + (order.fulfillment_status ?? '-'), 'Kurir: ' + (shipment?.provider_code ?? '-'), 'Nomor resi: ' + (shipment?.tracking_number ?? '-'), shipment?.tracking_url ? 'Tracking: ' + shipment.tracking_url : 'Tracking URL: menyusul'].join('\n');
}

export async function sendWhatsAppTextTo(recipient: string, body: string) {
  const config = getConfig();
  if (!config) return { ok: false as const, skipped: true, message: 'WhatsApp Cloud API belum dikonfigurasi.' };
  const to = recipient.replace(/\D/g, '');
  if (to.length < 8 || to.length > 15) return { ok: false as const, skipped: true, message: 'Nomor WhatsApp customer belum valid.' };
  const response = await fetch('https://graph.facebook.com/' + config.apiVersion + '/' + config.phoneNumberId + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + config.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
  });
  if (!response.ok) { console.error('WhatsApp Cloud API error', response.status, await response.text()); return { ok: false as const, skipped: false, message: 'WhatsApp notification gagal dikirim.' }; }
  return { ok: true as const, skipped: false, message: 'WhatsApp notification terkirim.' };
}

export async function sendWhatsAppText(body: string) {
  const config = getConfig();
  if (!config) return { ok: false as const, skipped: true, message: 'WhatsApp Cloud API belum dikonfigurasi.' };
  if (!config.adminTo) return { ok: false as const, skipped: true, message: 'WHATSAPP_ADMIN_TO belum valid.' };
  return sendWhatsAppTextTo(config.adminTo, body);
}
