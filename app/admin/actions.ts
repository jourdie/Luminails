'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';

export type AdminActionState = { ok: boolean; message: string };

const ADMIN_PERMISSION_KEYS = ['catalog', 'orders', 'notifications', 'pricing', 'promotions', 'packages', 'inventory', 'settings'] as const;
export type AdminPermission = typeof ADMIN_PERMISSION_KEYS[number];

function permissionsFromForm(formData: FormData) {
  return Object.fromEntries(ADMIN_PERMISSION_KEYS.map((permission) => [permission, formData.get('permission_' + permission) === 'on']));
}
async function requireAdmin(requiredPermission: AdminPermission) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false as const, message: 'Isi env Supabase untuk menyimpan perubahan admin.' };
  }
  const supabase = await createClient();
  const { data: membership, error } = await supabase.from('admin_memberships').select('role, is_active, permissions').maybeSingle();
  const permissions = membership?.permissions && typeof membership.permissions === 'object' ? membership.permissions as Record<string, unknown> : {};
  const allowed = membership?.role === 'owner' || permissions[requiredPermission] === true;
  if (error || !membership?.is_active || !allowed) return { ok: false as const, message: 'Akun ini belum memiliki permission admin yang diperlukan.' };
  return { ok: true as const, supabase };
}
export async function upsertAdminMembership(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'support');
  if (!email || !email.includes('@')) return { ok: false, message: 'Masukkan email Google yang sudah terdaftar di Supabase Auth.' };
  if (!['catalog_manager', 'orders_manager', 'support'].includes(role)) return { ok: false, message: 'Role admin tidak valid.' };
  const access = await requireOwner();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc('upsert_admin_membership_by_email', { p_email: email, p_role: role, p_permissions: permissionsFromForm(formData) });
  if (error) return { ok: false, message: error.message.includes('No Supabase') ? 'Email belum pernah login dengan Google di aplikasi.' : 'Admin belum tersimpan. Periksa email dan koneksi Supabase.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Akses admin berhasil disimpan.' };
}

export async function setAdminMembershipStatus(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const userId = String(formData.get('user_id') ?? '');
  const isActive = formData.get('is_active') === 'true';
  if (!userId) return { ok: false, message: 'Admin tidak ditemukan.' };
  const access = await requireOwner();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc('set_admin_membership_status', { p_user_id: userId, p_is_active: isActive });
  if (error) return { ok: false, message: 'Status admin belum dapat diperbarui.' };
  revalidatePath('/admin');
  return { ok: true, message: isActive ? 'Akses admin diaktifkan.' : 'Akses admin dinonaktifkan.' };
}
export async function updateCatalogProduct(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const productId = String(formData.get('product_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const isPublished = formData.get('is_published') === 'on';
  if (!productId || !name || !category) return { ok: false, message: 'Nama dan kategori wajib diisi.' };

  const access = await requireAdmin('catalog');
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

  const access = await requireAdmin('pricing');
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
  const access = await requireAdmin('notifications');
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

  const access = await requireAdmin('promotions');
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

  const access = await requireAdmin('promotions');
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
}async function requireOwner() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false as const, message: 'Isi env Supabase untuk menyimpan perubahan admin.' };
  }
  const supabase = await createClient();
  const { data: membership, error } = await supabase.from('admin_memberships').select('role, is_active').maybeSingle();
  if (error || !membership?.is_active || membership.role !== 'owner') return { ok: false as const, message: 'Hanya super admin/owner yang dapat mengatur akses admin.' };
  return { ok: true as const, supabase };
}
export async function createBrand(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const visualTone = String(formData.get('visual_tone') ?? 'clay');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !name || !['clay', 'ivory', 'plum', 'champagne'].includes(visualTone)) return { ok: false, message: 'Slug, nama, dan tone brand wajib valid.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('catalog_brands').insert({ slug, name, tagline: String(formData.get('tagline') ?? '').trim() || null, description: String(formData.get('description') ?? '').trim() || null, visual_tone: visualTone, is_published: formData.get('is_published') === 'on', sort_order: integerOrZero(formData.get('sort_order')) });
  if (error) return { ok: false, message: 'Brand belum dibuat. Pastikan slug belum dipakai.' };
  revalidatePath('/admin'); revalidatePath('/brands'); revalidatePath('/packages');
  return { ok: true, message: 'Brand berhasil dibuat.' };
}

export async function createPackage(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const values = parsePackageForm(formData);
  if (!values.ok) return values;
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('commerce_packages').insert(values.data);
  if (error) return { ok: false, message: 'Package belum dibuat. Pastikan brand dan slug benar.' };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Package berhasil dibuat.' };
}

export async function updatePackage(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('package_id') ?? '');
  const values = parsePackageForm(formData);
  if (!id) return { ok: false, message: 'Package ID tidak ditemukan.' };
  if (!values.ok) return values;
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('commerce_packages').update(values.data).eq('id', id);
  if (error) return { ok: false, message: 'Package belum diperbarui.' };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Package berhasil diperbarui.' };
}

export async function deletePackage(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('package_id') ?? '');
  if (!id) return { ok: false, message: 'Package ID tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('commerce_packages').delete().eq('id', id);
  if (error) return { ok: false, message: 'Package belum dihapus. Hapus isi package dan harga tier terlebih dahulu.' };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Package berhasil dihapus.' };
}

export async function createInventoryStock(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const locationId = String(formData.get('location_id') ?? '');
  const skuId = String(formData.get('sku_id') ?? '');
  const onHand = integerOrZero(formData.get('on_hand_quantity'));
  const reserved = integerOrZero(formData.get('reserved_quantity'));
  const reorder = integerOrZero(formData.get('reorder_point'));
  if (!locationId || !skuId || onHand < 0 || reserved < 0 || reorder < 0 || reserved > onHand) return { ok: false, message: 'Lokasi, SKU, dan quantity inventory wajib valid.' };
  const access = await requireAdmin('inventory');
  if (!access.ok) return access;
  const { data, error } = await access.supabase.from('inventory_stock').insert({ location_id: locationId, sku_id: skuId, on_hand_quantity: onHand, reserved_quantity: reserved, reorder_point: reorder }).select('id').single();
  if (error || !data) return { ok: false, message: 'Stock belum dibuat. Pastikan lokasi dan SKU belum memiliki baris stock.' };
  if (onHand > 0) {
    const { data: authData } = await access.supabase.auth.getUser();
    await access.supabase.from('inventory_movements').insert({ location_id: locationId, sku_id: skuId, movement_type: 'receiving', quantity_delta: onHand, reason: 'Initial stock', created_by: authData.user?.id ?? null });
  }
  revalidatePath('/admin');
  return { ok: true, message: 'Stock berhasil ditambahkan.' };
}

export async function updateInventoryStock(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('stock_id') ?? '');
  const onHand = integerOrZero(formData.get('on_hand_quantity'));
  const reserved = integerOrZero(formData.get('reserved_quantity'));
  const reorder = integerOrZero(formData.get('reorder_point'));
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id || onHand < 0 || reserved < 0 || reorder < 0 || reserved > onHand || !reason) return { ok: false, message: 'Quantity dan alasan adjustment wajib diisi.' };
  const access = await requireAdmin('inventory');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).rpc('adjust_inventory_stock', { p_stock_id: id, p_on_hand_quantity: onHand, p_reserved_quantity: reserved, p_reorder_point: reorder, p_reason: reason });
  if (error) return { ok: false, message: error.message.includes('Invalid') ? 'Quantity inventory tidak valid.' : 'Stock belum diperbarui.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Stock berhasil diperbarui dan movement tercatat.' };
}

export async function deleteInventoryStock(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('stock_id') ?? '');
  if (!id) return { ok: false, message: 'Stock ID tidak ditemukan.' };
  const access = await requireAdmin('inventory');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('inventory_stock').delete().eq('id', id);
  if (error) return { ok: false, message: 'Stock belum dihapus. Pastikan belum dipakai pada movement atau order.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Stock berhasil dihapus.' };
}

export async function updateWhatsappSettings(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const phone = String(formData.get('phone') ?? '').replace(/\D/g, '');
  const message = String(formData.get('message') ?? '').trim();
  if (!/^\d{8,15}$/.test(phone) || message.length < 5 || message.length > 240) return { ok: false, message: 'Nomor WhatsApp atau pesan belum valid.' };
  const access = await requireAdmin('settings');
  if (!access.ok) return access;
  const { data: authData } = await access.supabase.auth.getUser();
  const { error } = await access.supabase.from('commerce_store_settings').upsert({ key: 'whatsapp', value: { phone, message }, is_public: true, updated_by: authData.user?.id ?? null, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: 'Pengaturan WhatsApp belum tersimpan.' };
  revalidatePath('/admin'); revalidatePath('/');
  return { ok: true, message: 'Pengaturan WhatsApp berhasil diperbarui.' };
}

function parsePackageForm(formData: FormData) {
  const brandId = String(formData.get('brand_id') ?? '');
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const audience = String(formData.get('audience') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const price = integerOrZero(formData.get('price_idr'));
  const compareAtValue = String(formData.get('compare_at_price_idr') ?? '').trim();
  const compareAt = compareAtValue ? integerOrZero(formData.get('compare_at_price_idr')) : null;
  const visualTone = String(formData.get('visual_tone') ?? 'clay');
  const status = String(formData.get('status') ?? 'draft');
  if (!brandId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !title || !['home-studio', 'salon', 'restock'].includes(audience) || !description || price < 0 || (compareAt !== null && compareAt < price) || !['clay', 'ivory', 'plum'].includes(visualTone) || !['draft', 'published', 'archived'].includes(status)) return { ok: false as const, message: 'Brand, slug, judul, audience, harga, dan status package wajib valid.' };
  return { ok: true as const, data: { brand_id: brandId, slug, title, audience, description, long_description: String(formData.get('long_description') ?? '').trim() || null, price_idr: price, compare_at_price_idr: compareAt, badge: String(formData.get('badge') ?? '').trim() || null, visual_tone: visualTone, delivery_note: String(formData.get('delivery_note') ?? '').trim() || null, status, sort_order: integerOrZero(formData.get('sort_order')) } };
}
export async function addPackageItem(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const packageId = String(formData.get('package_id') ?? '');
  const skuId = String(formData.get('sku_id') ?? '');
  const quantity = integerOrZero(formData.get('quantity'));
  if (!packageId || !skuId || quantity < 1) return { ok: false, message: 'SKU dan quantity item wajib valid.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { data: sku } = await access.supabase.from('catalog_skus').select('name').eq('id', skuId).maybeSingle();
  if (!sku) return { ok: false, message: 'SKU tidak ditemukan.' };
  const { error } = await access.supabase.from('commerce_package_items').insert({ package_id: packageId, sku_id: skuId, item_name_snapshot: sku.name, item_note: String(formData.get('item_note') ?? '').trim() || null, quantity, sort_order: integerOrZero(formData.get('sort_order')) });
  if (error) return { ok: false, message: 'Item belum ditambahkan. SKU mungkin sudah ada di package.' };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Item package berhasil ditambahkan.' };
}

export async function deletePackageItem(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('package_item_id') ?? '');
  if (!id) return { ok: false, message: 'Package item ID tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('commerce_package_items').delete().eq('id', id);
  if (error) return { ok: false, message: 'Item package belum dapat dihapus.' };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Item package berhasil dihapus.' };
}

export async function updateOrderTracking(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const orderId = String(formData.get('order_id') ?? '').trim();
  const provider = String(formData.get('provider') ?? '').trim();
  const trackingNumber = String(formData.get('tracking_number') ?? '').trim();
  const trackingUrl = String(formData.get('tracking_url') ?? '').trim() || null;
  const status = String(formData.get('shipment_status') ?? 'in_transit');
  if (!orderId || !provider || !trackingNumber) return { ok: false, message: 'Provider dan nomor tracking wajib diisi.' };
  const access = await requireAdmin('orders');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).rpc('set_order_tracking', { p_order_id: orderId, p_provider: provider, p_tracking_number: trackingNumber, p_tracking_url: trackingUrl, p_status: status });
  if (error) return { ok: false, message: 'Tracking belum tersimpan. Pastikan shipment order sudah dibuat.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Tracking order berhasil diperbarui.' };
}
