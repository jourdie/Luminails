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
