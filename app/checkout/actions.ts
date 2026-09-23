'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';
import { sendWhatsAppText } from '../../lib/whatsapp';

export type CheckoutActionState = { ok: boolean; message: string };

const errorMessages: Record<string, string> = {
  LOGIN_REQUIRED: 'Silakan login terlebih dahulu.',
  PROFILE_REQUIRED: 'Lengkapi profil studio sebelum checkout.',
  ADDRESS_REQUIRED: 'Pilih alamat pengiriman.',
  PACKAGE_NOT_FOUND: 'Package tidak tersedia atau sudah tidak dipublikasikan.',
  INVALID_QUANTITY: 'Jumlah package tidak valid.',
  PROMOTION_NOT_ELIGIBLE: 'Promo ini belum eligible untuk akun atau package Anda.',
  PROMOTION_LIMIT_REACHED: 'Batas penggunaan promo ini sudah tercapai.',
  PROMOTION_MINIMUM_NOT_MET: 'Minimum order promo belum terpenuhi.',
  INSUFFICIENT_STOCK: 'Stok package belum mencukupi. Silakan hubungi Luminails.',
  INSUFFICIENT_REWARD_STOCK: 'Stok free product sedang tidak tersedia.',
  INSUFFICIENT_POINTS: 'Poin Anda belum cukup untuk reward tersebut.',
  INVALID_REWARD: 'Reward points tidak valid.',
  INVENTORY_LOCATION_NOT_CONFIGURED: 'Lokasi inventory belum disiapkan admin.',
};

function readableError(error: { message?: string } | null) {
  const code = error?.message?.split(':')[0] ?? '';
  return errorMessages[code] ?? `Order belum dibuat: ${error?.message ?? 'terjadi kesalahan server.'}`;
}

export async function cancelCheckoutOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;
  await (supabase as any).rpc('cancel_checkout_order', { p_order_id: String(formData.get('order_id') ?? '') });
  revalidatePath('/account/orders');
  revalidatePath('/account');
}

export async function submitCheckoutOrder(_previous: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, message: errorMessages.LOGIN_REQUIRED };

  const packageSlug = String(formData.get('package_slug') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 1);
  const addressId = String(formData.get('address_id') ?? '').trim();
  const promotionCode = String(formData.get('promotion_code') ?? '').trim() || null;
  const shippingMethod = String(formData.get('shipping_method') ?? 'paxel_factory');
  const shippingProvider = String(formData.get('shipping_provider') ?? 'paxel');
  const notes = String(formData.get('customer_notes') ?? '').trim() || null;
  const rewardSkuId = String(formData.get('reward_sku_id') ?? '').trim() || null;
  const rewardPoints = Number(formData.get('reward_points') ?? 0) || 0;
  const idempotencyKey = String(formData.get('idempotency_key') ?? '').trim() || crypto.randomUUID();

  const { data, error } = await supabase.rpc('create_checkout_order', {
    p_package_slug: packageSlug,
    p_quantity: quantity,
    p_address_id: addressId,
    p_customer_notes: notes,
    p_promotion_code: promotionCode,
    p_shipping_method: shippingMethod,
    p_shipping_provider: shippingProvider,
    p_reward_sku_id: rewardSkuId,
    p_reward_points: rewardPoints,
    p_idempotency_key: idempotencyKey,
  });
  if (error) return { ok: false, message: readableError(error) };

  const order = data as unknown as { order_id?: string; total_idr?: number; discount_idr?: number; promotion_code?: string | null } | null;
  if (!order?.order_id) return { ok: false, message: 'Order belum mengembalikan nomor referensi.' };

  await sendWhatsAppText(`Order baru Luminails ${order.order_id}\nTotal: Rp${new Intl.NumberFormat('id-ID').format(Number(order.total_idr ?? 0))}\nStatus: menunggu review\nPromo: ${order.promotion_code ?? '-'}\nCustomer: ${authData.user.email ?? '-'}`);
  revalidatePath('/account');
  revalidatePath('/account/orders');
  redirect(`/account/orders?created=${encodeURIComponent(order.order_id)}`);
}
