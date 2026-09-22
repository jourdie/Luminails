'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';

export type AdminActionState = { ok: boolean; message: string };

async function requireAdmin(roles: string[]) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false as const, message: 'Isi env Supabase untuk menyimpan perubahan admin.' };
  }

  const supabase = await createClient();
  const { data: membership, error } = await supabase.from('admin_memberships').select('role, is_active').maybeSingle();
  if (error || !membership?.is_active || !roles.includes(membership.role)) {
    return { ok: false as const, message: 'Akun ini belum memiliki permission admin yang diperlukan.' };
  }
  return { ok: true as const, supabase };
}

export async function updateCatalogProduct(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const productId = String(formData.get('product_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const isPublished = formData.get('is_published') === 'on';
  if (!productId || !name || !category) return { ok: false, message: 'Nama dan kategori wajib diisi.' };

  const access = await requireAdmin(['owner', 'catalog_manager']);
  if (!access.ok) return access;

  const { error } = await access.supabase.from('catalog_products').update({ name, category, is_published: isPublished }).eq('id', productId);
  if (error) return { ok: false, message: 'Produk belum tersimpan. Periksa koneksi Supabase.' };
  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true, message: 'Produk berhasil diperbarui.' };
}

export async function updatePricingTier(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const tierId = String(formData.get('tier_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const minimumSpend = Number(formData.get('minimum_lifetime_spend_idr') ?? 0);
  const minimumOrders = Number(formData.get('minimum_paid_order_count') ?? 0);
  const isActive = formData.get('is_active') === 'on';

  if (!tierId || !name || !Number.isInteger(minimumSpend) || minimumSpend < 0 || !Number.isInteger(minimumOrders) || minimumOrders < 0) {
    return { ok: false, message: 'Nama, threshold belanja, dan jumlah order harus diisi dengan benar.' };
  }

  const access = await requireAdmin(['owner']);
  if (!access.ok) return access;

  const { error } = await access.supabase.from('pricing_tiers').update({
    name,
    minimum_lifetime_spend_idr: minimumSpend,
    minimum_paid_order_count: minimumOrders,
    is_active: isActive,
  }).eq('id', tierId);
  if (error) return { ok: false, message: 'Aturan pricing belum tersimpan. Periksa koneksi Supabase.' };
  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true, message: 'Aturan pricing berhasil diperbarui.' };
}

export async function markNotificationRead(notificationId: string): Promise<AdminActionState> {
  const access = await requireAdmin(['owner', 'catalog_manager', 'orders_manager', 'support']);
  if (!access.ok) return access;
  const { error } = await access.supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId);
  if (error) return { ok: false, message: 'Notifikasi belum dapat ditandai terbaca.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Notifikasi ditandai terbaca.' };
}

export async function updatePromotion(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const promotionId = String(formData.get('promotion_id') ?? '');
  const values = parsePromotionForm(formData);
  if (!promotionId) return { ok: false, message: 'Promotion ID tidak ditemukan.' };
  if (!values.ok) return { ok: false, message: values.message ?? 'Field promo tidak valid.' };

  const access = await requireAdmin(['owner', 'catalog_manager']);
  if (!access.ok) return access;

  const { error } = await access.supabase.from('commerce_promotions').update(values.data).eq('id', promotionId);
  if (error) return { ok: false, message: 'Promo belum tersimpan. Periksa field dan koneksi Supabase.' };
  const eligibilityError = await syncEligibleCustomers(access.supabase, promotionId, values.eligibleCustomerIds);
  if (eligibilityError) return { ok: false, message: eligibilityError };
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true, message: 'Promo berhasil diperbarui.' };
}

export async function createPromotion(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const values = parsePromotionForm(formData);
  if (!values.ok) return { ok: false, message: values.message ?? 'Field promo tidak valid.' };

  const access = await requireAdmin(['owner', 'catalog_manager']);
  if (!access.ok) return access;

  const { data, error } = await access.supabase.from('commerce_promotions').insert(values.data).select('id').single();
  if (error || !data) return { ok: false, message: 'Promo belum dibuat. Periksa code dan field wajib.' };
  const eligibilityError = await syncEligibleCustomers(access.supabase, data.id, values.eligibleCustomerIds);
  if (eligibilityError) return { ok: false, message: eligibilityError };
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true, message: 'Promo baru berhasil dibuat.' };
}

function parsePromotionForm(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  const promotionType = String(formData.get('promotion_type') ?? '');
  const audienceType = String(formData.get('audience_type') ?? 'all');
  const discountType = String(formData.get('discount_type') ?? 'percentage');
  const discountValue = Number(formData.get('discount_value') ?? 0);
  const bundlePrice = optionalInteger(formData.get('bundle_price_idr'));
  const minimumOrder = integerOrZero(formData.get('minimum_order_amount_idr'));
  const minimumQuantity = integerOrZero(formData.get('minimum_item_quantity'));
  const repeatOrderCount = integerOrZero(formData.get('repeat_order_min_count'));
  const usageLimit = optionalInteger(formData.get('usage_limit'));
  const usagePerCustomer = optionalInteger(formData.get('usage_limit_per_customer'));
  const startsAt = parseDateTime(String(formData.get('starts_at') ?? ''));
  const endsAt = parseDateTime(String(formData.get('ends_at') ?? ''));
  const eligibleCustomerIds = String(formData.get('eligible_customer_ids') ?? '').split(',').map((value) => value.trim()).filter(Boolean);

  const validTypes = ['new_user', 'repeat_order', 'bundle', 'seasonal', 'custom_voucher'];
  const validAudiences = ['all', 'new_user', 'repeat_customer', 'pricing_tier', 'custom_customer'];
  const validDiscounts = ['percentage', 'fixed_amount', 'fixed_price', 'free_shipping'];
  if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !name || !validTypes.includes(promotionType) || !validAudiences.includes(audienceType) || !validDiscounts.includes(discountType)) return { ok: false as const, message: 'Code, nama, tipe promo, audience, dan tipe diskon wajib valid.' };
  if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === 'percentage' && discountValue > 100)) return { ok: false as const, message: 'Nilai diskon tidak valid.' };
  if (promotionType === 'bundle' && bundlePrice === null) return { ok: false as const, message: 'Bundle wajib memiliki harga paket.' };
  if (endsAt && startsAt && endsAt <= startsAt) return { ok: false as const, message: 'Tanggal berakhir harus setelah tanggal mulai.' };
  if (eligibleCustomerIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) return { ok: false as const, message: 'Eligible customer harus berupa UUID Supabase, dipisahkan dengan koma.' };

  return {
    ok: true as const,
    data: {
      code,
      name,
      promotion_type: promotionType,
      audience_type: audienceType,
      discount_type: discountType,
      discount_value: discountValue,
      bundle_price_idr: bundlePrice,
      minimum_order_amount_idr: minimumOrder,
      minimum_item_quantity: minimumQuantity,
      repeat_order_min_count: repeatOrderCount,
      voucher_code: String(formData.get('voucher_code') ?? '').trim().toUpperCase() || null,
      usage_limit: usageLimit,
      usage_limit_per_customer: usagePerCustomer,
      starts_at: startsAt ?? new Date().toISOString(),
      ends_at: endsAt,
      status: String(formData.get('status') ?? 'draft'),
      is_stackable: formData.get('is_stackable') === 'on',
      is_active: formData.get('is_active') === 'on',
    },
    eligibleCustomerIds,
  };
}

function integerOrZero(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function optionalInteger(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseDateTime(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

async function syncEligibleCustomers(supabase: Awaited<ReturnType<typeof createClient>>, promotionId: string, customerIds: string[]) {
  const { error: deleteError } = await supabase.from('promotion_eligible_customers').delete().eq('promotion_id', promotionId);
  if (deleteError) return 'Eligible customer belum tersimpan.';
  if (customerIds.length === 0) return null;
  const { error: insertError } = await supabase.from('promotion_eligible_customers').insert(customerIds.map((customerId) => ({ promotion_id: promotionId, customer_id: customerId })));
  return insertError ? 'Sebagian eligible customer belum tersimpan.' : null;
}
