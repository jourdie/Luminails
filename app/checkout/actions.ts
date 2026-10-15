'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';

export type CheckoutActionState = { ok: boolean; message: string };

const errorMessages: Record<string, string> = {
  LOGIN_REQUIRED: 'Silakan login terlebih dahulu.',
  PROFILE_REQUIRED: 'Lengkapi profil studio sebelum checkout.',
  ADDRESS_REQUIRED: 'Pilih alamat pengiriman.',
  CONTACT_PHONE_REQUIRED: 'Masukkan nomor HP untuk update order.',
  PACKAGE_NOT_FOUND: 'Paket tidak tersedia atau sudah tidak dipublikasikan.',
  INVALID_QUANTITY: 'Jumlah paket tidak valid.',
  PROMOTION_NOT_ELIGIBLE: 'Promo ini belum tersedia untuk akun atau paket Anda.',
  PROMOTION_LIMIT_REACHED: 'Batas penggunaan promo ini sudah tercapai.',
  PROMOTION_MINIMUM_NOT_MET: 'Minimum order promo belum terpenuhi.',
  INSUFFICIENT_STOCK: 'Stok paket belum mencukupi. Silakan hubungi Luminails.',
  INSUFFICIENT_REWARD_STOCK: 'Stok produk gratis sedang tidak tersedia.',
  INSUFFICIENT_POINTS: 'Poin Anda belum cukup untuk reward tersebut.',
  INVALID_REWARD: 'Pilihan reward tidak valid.',
  REWARD_POINTS_MISMATCH: 'Nilai poin reward berubah. Silakan muat ulang checkout.',
  INVALID_REWARD_QUANTITY: 'Jumlah reward tidak valid.',
  REWARD_MAX_QUANTITY_REACHED: 'Jumlah reward melebihi batas per order.',
  REWARD_NOT_AVAILABLE: 'Reward sudah tidak tersedia.',
  REWARD_OUT_OF_STOCK: 'Stok reward sedang habis.',
  REWARD_NOT_STARTED: 'Periode reward belum dimulai.',
  REWARD_EXPIRED: 'Periode reward sudah berakhir.',
  REWARD_MINIMUM_ORDER_NOT_REACHED: 'Minimum order untuk reward belum tercapai.',
  REWARD_TIER_NOT_ELIGIBLE: 'Tier customer belum memenuhi syarat reward.',
  REWARD_NOT_ALLOWED_FOR_PACKAGE: 'Paket ini belum dapat digabung dengan penukaran reward.',
  INVENTORY_LOCATION_NOT_CONFIGURED: 'Pengaturan pengiriman belum siap. Silakan hubungi Luminails.',
  PACKAGE_SELECTION_REQUIRED: 'Pilih isi paket terlebih dahulu.',
  PACKAGE_SELECTION_CAPACITY: 'Jumlah pilihan produk belum sesuai kapasitas paket.',
  SKU_NOT_ALLOWED: 'Ada produk yang tidak tersedia dalam paket ini.',
  INVALID_PACKAGE_SELECTION: 'Pilihan isi paket tidak valid.',
  INVALID_PACKAGE_BENEFIT_SELECTION: 'Pilihan produk gratis tidak valid.',
  PACKAGE_BENEFIT_SELECTION_REQUIRED: 'Pilih semua produk gratis terlebih dahulu.',
  PACKAGE_BENEFIT_QUANTITY: 'Jumlah produk gratis belum sesuai.',
  PACKAGE_BENEFIT_SKU_NOT_ALLOWED: 'Ada produk gratis yang tidak tersedia untuk benefit paket ini.',
  INVALID_ADD_ON_SELECTION: 'Pilihan add-on tidak valid.',
  ADD_ON_NOT_ALLOWED: 'Tambahan hanya boleh berupa tools atau aksesori yang aktif.',
  ADD_ON_PRICE_NOT_CONFIGURED: 'Harga tambahan belum tersedia.',
  INSUFFICIENT_ADD_ON_STOCK: 'Stok add-on tidak mencukupi.' ,
  SINGLE_BRAND_ORDER: 'Satu checkout hanya dapat berisi paket, tambahan, dan reward dari brand yang sama.',
  SINGLE_BRAND_CHECK_NOT_CONFIGURED: 'Produk belum dapat diproses. Silakan hubungi Luminails.',
};

function readableError(error: { message?: string } | null) {
  const code = error?.message?.split(':')[0] ?? '';
  return errorMessages[code] ?? `Order belum dibuat: ${error?.message ?? 'terjadi kesalahan server.'}`;
}

export async function cancelCheckoutOrder(_previous: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, message: errorMessages.LOGIN_REQUIRED };
  const orderId = String(formData.get('order_id') ?? '').trim();
  if (!orderId) return { ok: false, message: 'Order tidak ditemukan.' };
  const { error } = await (supabase as any).rpc('cancel_checkout_order', { p_order_id: orderId });
  if (error) return { ok: false, message: `Order belum dapat dibatalkan: ${error.message ?? 'terjadi kesalahan server.'}` };
  revalidatePath('/account/orders');
  revalidatePath('/account');
  return { ok: true, message: 'Order berhasil dibatalkan.' };
}

export async function submitCheckoutOrder(_previous: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, message: errorMessages.LOGIN_REQUIRED };

  const packageSlug = String(formData.get('package_slug') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 1);
  const addressId = String(formData.get('address_id') ?? '').trim();
  const contactPhone = String(formData.get('contact_phone') ?? '').trim();
  if (!/^[0-9+()\-\s]{8,30}$/.test(contactPhone) || contactPhone.replace(/\D/g, '').length < 8) return { ok: false, message: errorMessages.CONTACT_PHONE_REQUIRED };
  const promotionCode = String(formData.get('promotion_code') ?? '').trim() || null;
  const shippingMethod = String(formData.get('shipping_method') ?? 'paxel_factory');
  const shippingProvider = String(formData.get('shipping_provider') ?? 'paxel');
  const notes = String(formData.get('customer_notes') ?? '').trim() || null;
  const rewardSkuId = String(formData.get('reward_sku_id') ?? '').trim() || null;
  const rewardPoints = Number(formData.get('reward_points') ?? 0) || 0;
  const rewardQuantity = Number(formData.get('reward_quantity') ?? 1);
  if (!Number.isInteger(rewardQuantity) || rewardQuantity < 1 || rewardQuantity > 100) return { ok: false, message: errorMessages.INVALID_REWARD_QUANTITY };
  const idempotencyKey = String(formData.get('idempotency_key') ?? '').trim() || crypto.randomUUID();
  let selectedSkus: Array<{ sku_id: string; quantity: number }> = [];
  try {
    const parsed = JSON.parse(String(formData.get('selected_skus') ?? '[]'));
    if (Array.isArray(parsed)) selectedSkus = parsed.filter((row): row is { skuId: string; quantity: number } => typeof row?.skuId === 'string' && Number.isInteger(row?.quantity) && row.quantity > 0).map((row) => ({ sku_id: row.skuId, quantity: row.quantity }));
  } catch {
    return { ok: false, message: errorMessages.INVALID_PACKAGE_SELECTION };
  }
  let selectedAddOns: Array<{ sku_id: string; quantity: number }> = [];
  try {
    const parsed = JSON.parse(String(formData.get('add_on_skus') ?? '[]'));
    if (Array.isArray(parsed)) selectedAddOns = parsed.filter((row): row is { skuId: string; quantity: number } => typeof row?.skuId === 'string' && Number.isInteger(row?.quantity) && row.quantity > 0).map((row) => ({ sku_id: row.skuId, quantity: row.quantity }));
  } catch {
    return { ok: false, message: errorMessages.INVALID_ADD_ON_SELECTION };
  }
  let selectedBenefits: Array<{ benefit_id: string; sku_id: string; quantity: number }> = [];
  try {
    const parsed = JSON.parse(String(formData.get('selected_benefits') ?? '[]'));
    if (Array.isArray(parsed)) selectedBenefits = parsed.filter((row): row is { benefitId: string; skuId: string; quantity: number } => typeof row?.benefitId === 'string' && typeof row?.skuId === 'string' && Number.isInteger(row?.quantity) && row.quantity > 0).map((row) => ({ benefit_id: row.benefitId, sku_id: row.skuId, quantity: row.quantity }));
  } catch {
    return { ok: false, message: errorMessages.INVALID_PACKAGE_BENEFIT_SELECTION };
  }

  const { data, error } = await (supabase as any).rpc('create_checkout_order_with_addons', {
    p_package_slug: packageSlug,
    p_quantity: quantity,
    p_address_id: addressId,
    p_customer_notes: notes,
    p_promotion_code: promotionCode,
    p_shipping_method: shippingMethod,
    p_shipping_provider: shippingProvider,
    p_reward_sku_id: rewardSkuId,
    p_reward_points: rewardPoints,
    p_reward_quantity: rewardQuantity,
    p_idempotency_key: idempotencyKey,
    p_selected_skus: selectedSkus.length ? selectedSkus : null,
    p_selected_benefits: selectedBenefits.length ? selectedBenefits : null,
    p_contact_phone: contactPhone,
    p_add_on_skus: selectedAddOns.length ? selectedAddOns : null,
  } as never);
  if (error) return { ok: false, message: readableError(error) };

  const order = data as unknown as { order_id?: string; total_idr?: number; discount_idr?: number; promotion_code?: string | null } | null;
  if (!order?.order_id) return { ok: false, message: 'Order belum mengembalikan nomor referensi.' };

  revalidatePath('/account');
  revalidatePath('/account/orders');
  redirect(`/payment/${encodeURIComponent(order.order_id)}`);
}
