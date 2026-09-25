import { createClient } from './supabase/server';

export type CustomerOrder = {
  id: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  total_idr: number;
  subtotal_idr: number;
  discount_idr: number;
  shipping_fee_idr: number;
  promotion_code: string | null;
  shipping_method: string;
  shipping_provider: string | null;
  created_at: string;
  items: Array<{ id: string; sku_id: string | null; product_name_snapshot: string; sku_snapshot: string; quantity: number; unit_price_idr: number; item_type: string; metadata: Record<string, unknown> | null }>;
  shipment: { provider_code: string | null; service_level: string | null; tracking_number: string | null; tracking_url: string | null; status: string } | null;
};

export async function getCustomerOrders(): Promise<CustomerOrder[]> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];
  const { data: orders } = await (supabase.from('commerce_orders') as any)
    .select('id, status, payment_status, fulfillment_status, total_idr, subtotal_idr, discount_idr, shipping_fee_idr, promotion_code, shipping_method, shipping_provider, created_at')
    .eq('customer_id', authData.user.id)
    .order('created_at', { ascending: false });
  const orderIds = (orders ?? []).map((order: { id: string }) => order.id);
  if (!orderIds.length) return [];
  const [{ data: items }, { data: shipments }] = await Promise.all([
    (supabase.from('commerce_order_items') as any).select('id, order_id, sku_id, product_name_snapshot, sku_snapshot, quantity, unit_price_idr, item_type, metadata').in('order_id', orderIds),
    (supabase.from('commerce_shipments') as any).select('order_id, provider_code, service_level, tracking_number, tracking_url, status').in('order_id', orderIds),
  ]);
  const itemsByOrder = new Map<string, CustomerOrder['items']>();
  for (const item of items ?? []) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  const shipmentByOrder = new Map((shipments ?? []).map((shipment: { order_id: string }) => [shipment.order_id, shipment]));
  return (orders ?? []).map((order: any) => ({ ...order, items: itemsByOrder.get(order.id) ?? [], shipment: shipmentByOrder.get(order.id) ?? null }));
}

export function buildRepeatOrderHref(order: CustomerOrder) {
  const packageItem = order.items.find((item) => item.item_type === 'package' && item.sku_snapshot.startsWith('PACKAGE:'));
  if (!packageItem) return null;
  const slug = packageItem.sku_snapshot.slice('PACKAGE:'.length).trim();
  if (!slug) return null;
  const params = new URLSearchParams({ package: slug, quantity: String(packageItem.quantity) });
  const selected = packageItem.metadata && Array.isArray(packageItem.metadata.selected_skus) ? packageItem.metadata.selected_skus.filter((row): row is { sku_id: string; quantity: number } => typeof row === 'object' && row !== null && typeof (row as { sku_id?: unknown }).sku_id === 'string' && Number.isInteger((row as { quantity?: unknown }).quantity) && Number((row as { quantity: number }).quantity) > 0).map((row) => ({ skuId: row.sku_id, quantity: row.quantity })) : [];
  if (selected.length) params.set('selection', JSON.stringify(selected));
  return '/checkout?' + params.toString();
}
