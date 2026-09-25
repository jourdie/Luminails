'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';

export type LoyaltyActionState = { ok: boolean; message: string };
const idr = (value: FormDataEntryValue | null) => Number(String(value ?? '').replace(/[^0-9-]/g, '')) || 0;

async function requireLoyaltyAdmin(permission: 'pricing' | 'orders') {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return { ok: false as const, message: 'Supabase belum dikonfigurasi.' };
  const supabase = await createClient();
  const { data: membership } = await supabase.from('admin_memberships').select('role, is_active, permissions').maybeSingle();
  const permissions = membership?.permissions && typeof membership.permissions === 'object' ? membership.permissions as Record<string, unknown> : {};
  if (!membership?.is_active || (membership.role !== 'owner' && permissions[permission] !== true)) return { ok: false as const, message: 'Akun ini tidak memiliki akses ke modul loyalty.' };
  return { ok: true as const, supabase: supabase as any };
}

export async function saveCustomerTier(_previous: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const access = await requireLoyaltyAdmin('pricing');
  if (!access.ok) return access;
  const id = String(formData.get('id') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
  const name = String(formData.get('name') ?? '').trim();
  const minimum = idr(formData.get('minimum_rolling_spend_idr'));
  const maximumRaw = String(formData.get('maximum_rolling_spend_idr') ?? '').trim();
  const maximum = maximumRaw ? idr(maximumRaw) : null;
  const multiplier = Number(formData.get('point_multiplier') ?? 1);
  if (!code || !name || minimum < 0 || (maximum !== null && maximum < minimum) || multiplier <= 0) return { ok: false, message: 'Kode, nama, batas spend, dan multiplier harus valid.' };
  const payload = { code, name, minimum_rolling_spend_idr: minimum, maximum_rolling_spend_idr: maximum, rolling_period_months: Math.max(1, Number(formData.get('rolling_period_months') ?? 6)), point_multiplier: multiplier, description: String(formData.get('description') ?? '').trim() || null, benefits_description: String(formData.get('benefits_description') ?? '').trim() || null, priority: 0, is_active: formData.get('is_active') === 'on' };
  const response = id ? await access.supabase.from('customer_tiers').update(payload).eq('id', id) : await access.supabase.from('customer_tiers').insert(payload);
  if (response.error) return { ok: false, message: response.error.code === '23505' ? 'Code tier sudah digunakan.' : 'Tier belum tersimpan. Periksa nilai input dan migrasi Supabase.' };
  revalidatePath('/admin'); revalidatePath('/account');
  return { ok: true, message: 'Customer tier berhasil disimpan.' };
}

export async function archiveCustomerTier(_previous: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const access = await requireLoyaltyAdmin('pricing');
  if (!access.ok) return access;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Tier tidak ditemukan.' };
  const { count } = await access.supabase.from('customer_profiles').select('id', { count: 'exact', head: true }).eq('customer_tier_id', id);
  if ((count ?? 0) > 0) return { ok: false, message: 'Tier masih dipakai customer. Nonaktifkan tier, jangan hapus.' };
  const { error } = await access.supabase.from('customer_tiers').update({ is_active: false }).eq('id', id);
  if (error) return { ok: false, message: 'Tier belum dapat diarsipkan.' };
  revalidatePath('/admin'); return { ok: true, message: 'Tier diarsipkan.' };
}

export async function saveLoyaltySettings(_previous: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const access = await requireLoyaltyAdmin('pricing');
  if (!access.ok) return access;
  const payload = { point_unit_value_idr: Math.max(1, idr(formData.get('point_unit_value_idr'))), expiry_months: Math.max(1, Number(formData.get('expiry_months') ?? 12)), reward_cost_warning_percent: Math.max(0, Number(formData.get('reward_cost_warning_percent') ?? 3)), tier_rolling_period_months: Math.max(1, Number(formData.get('tier_rolling_period_months') ?? 6)), automatic_tier_recalculation: formData.get('automatic_tier_recalculation') === 'on', allow_manual_point_adjustment: formData.get('allow_manual_point_adjustment') === 'on', require_adjustment_reason: formData.get('require_adjustment_reason') === 'on', updated_by: (await access.supabase.auth.getUser()).data.user?.id ?? null };
  const { error } = await access.supabase.from('loyalty_point_settings').upsert({ key: 'default', ...payload });
  if (error) return { ok: false, message: 'Pengaturan points belum tersimpan.' };
  revalidatePath('/admin'); revalidatePath('/account'); return { ok: true, message: 'Pengaturan loyalty berhasil disimpan.' };
}

export async function adjustCustomerPoints(_previous: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const access = await requireLoyaltyAdmin('pricing');
  if (!access.ok) return access;
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const points = Number(formData.get('points') ?? 0);
  const reason = String(formData.get('reason') ?? '').trim();
  if (!customerId || !Number.isInteger(points) || points === 0 || !reason) return { ok: false, message: 'Customer, points integer, dan alasan wajib diisi.' };
  const { error } = await access.supabase.rpc('adjust_loyalty_points', { p_customer_id: customerId, p_points: points, p_reason: reason, p_reference: String(formData.get('reference') ?? '').trim() || null });
  if (error) return { ok: false, message: error.message.includes('POINT_ADJUSTMENT') ? 'Adjustment points ditolak oleh aturan program.' : 'Adjustment points belum tersimpan.' };
  revalidatePath('/admin'); revalidatePath('/account'); return { ok: true, message: 'Adjustment points tercatat di ledger.' };
}

export async function saveCustomerOverride(_previous: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const access = await requireLoyaltyAdmin('orders');
  if (!access.ok) return access;
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const enabled = formData.get('manual_tier_override_enabled') === 'on';
  const tierId = String(formData.get('manual_tier_id') ?? '').trim() || null;
  const reason = String(formData.get('manual_tier_reason') ?? '').trim() || null;
  const expiresRaw = String(formData.get('manual_tier_expires_at') ?? '').trim();
  const expiresDate = expiresRaw ? new Date(expiresRaw) : null;
  if (enabled && expiresDate && Number.isNaN(expiresDate.getTime())) return { ok: false, message: 'Tanggal berakhir override tidak valid.' };
  const expiresAt = expiresDate ? expiresDate.toISOString() : null;
  if (!customerId || (enabled && (!tierId || !reason))) return { ok: false, message: 'Tier manual dan alasan wajib diisi saat override aktif.' };
  const { error } = await access.supabase.from('customer_profiles').update({ manual_tier_override_enabled: enabled, manual_tier_id: enabled ? tierId : null, manual_tier_reason: enabled ? reason : null, manual_tier_starts_at: enabled ? new Date().toISOString() : null, manual_tier_expires_at: enabled ? expiresAt : null }).eq('id', customerId);
  if (error) return { ok: false, message: 'Override tier customer belum tersimpan.' };
  const recalculated = await access.supabase.rpc('recalculate_customer_tier', { p_customer_id: customerId });
  if (recalculated.error) return { ok: false, message: 'Override tersimpan, tetapi tier efektif belum dihitung ulang.' };
  revalidatePath('/admin'); revalidatePath('/account'); return { ok: true, message: 'Tier customer berhasil diperbarui.' };
}

export async function saveReward(_previous: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const access = await requireLoyaltyAdmin('pricing');
  if (!access.ok) return access;
  const id = String(formData.get('id') ?? '').trim();
  const skuId = String(formData.get('sku_id') ?? '').trim();
  const points = Math.max(1, Number(formData.get('points_cost') ?? 0));
  if (!skuId || !Number.isInteger(points)) return { ok: false, message: 'SKU reward dan point cost wajib valid.' };
  const rewardName = String(formData.get('reward_name') ?? '').trim();
  const maxQuantity = Number(formData.get('max_redemption_quantity') ?? 1);
  const rewardStock = Number(formData.get('reward_stock') ?? 0);
  const startsAt = String(formData.get('starts_at') ?? '').trim() || null;
  const endsAt = String(formData.get('ends_at') ?? '').trim() || null;
  if (!skuId || !rewardName || !Number.isInteger(points) || !Number.isInteger(maxQuantity) || maxQuantity < 1 || !Number.isInteger(rewardStock) || rewardStock < 0) return { ok: false, message: 'Nama reward, SKU, point cost, max qty, dan stok harus valid.' };
  if (startsAt && Number.isNaN(Date.parse(startsAt))) return { ok: false, message: 'Tanggal mulai reward tidak valid.' };
  if (endsAt && Number.isNaN(Date.parse(endsAt))) return { ok: false, message: 'Tanggal berakhir reward tidak valid.' };
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return { ok: false, message: 'Tanggal berakhir harus setelah tanggal mulai.' };
  const payload = { sku_id: skuId, reward_name: rewardName, points_cost: points, hpp_idr: idr(formData.get('hpp_idr')), normal_selling_price_idr: idr(formData.get('normal_selling_price_idr')), minimum_customer_tier_id: String(formData.get('minimum_customer_tier_id') ?? '').trim() || null, minimum_order_value_idr: idr(formData.get('minimum_order_value_idr')), max_redemption_quantity: maxQuantity, reward_stock: rewardStock, starts_at: startsAt, ends_at: endsAt, description: String(formData.get('description') ?? '').trim() || null, is_active: formData.get('is_active') === 'on' };
  const response = id ? await access.supabase.from('loyalty_reward_catalog').update(payload).eq('id', id) : await access.supabase.from('loyalty_reward_catalog').insert(payload);
  if (response.error) return { ok: false, message: response.error.code === '23505' ? 'SKU ini sudah terdaftar sebagai reward.' : 'Reward belum tersimpan. Pastikan migration reward sudah dijalankan.' };
  revalidatePath('/admin'); revalidatePath('/checkout'); return { ok: true, message: 'Reward catalog berhasil disimpan.' };
}

export async function updateRedemptionStatus(_previous: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const access = await requireLoyaltyAdmin('orders');
  if (!access.ok) return access;
  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !['pending', 'applied', 'confirmed', 'fulfilled', 'cancelled', 'reversed'].includes(status)) return { ok: false, message: 'Status redemption tidak valid.' };
  const { error } = await access.supabase.from('loyalty_redemptions').update({ status }).eq('id', id);
  if (error) return { ok: false, message: 'Status redemption belum diperbarui.' };
  revalidatePath('/admin'); return { ok: true, message: 'Status redemption diperbarui.' };
}

export async function archiveReward(_previous: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const access = await requireLoyaltyAdmin('pricing');
  if (!access.ok) return access;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Reward tidak ditemukan.' };
  const { error } = await access.supabase.from('loyalty_reward_catalog').update({ is_active: false }).eq('id', id);
  if (error) return { ok: false, message: 'Reward belum dapat diarsipkan.' };
  revalidatePath('/admin'); revalidatePath('/checkout'); return { ok: true, message: 'Reward diarsipkan.' };
}

export async function deleteReward(_previous: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const access = await requireLoyaltyAdmin('pricing');
  if (!access.ok) return access;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Reward tidak ditemukan.' };
  const { count } = await access.supabase.from('loyalty_redemptions').select('id', { count: 'exact', head: true }).eq('sku_id', String(formData.get('sku_id') ?? ''));
  if ((count ?? 0) > 0) return { ok: false, message: 'Reward sudah pernah diredeem. Arsipkan reward saja agar histori tetap aman.' };
  const { error } = await access.supabase.from('loyalty_reward_catalog').delete().eq('id', id);
  if (error) return { ok: false, message: 'Reward belum dapat dihapus.' };
  revalidatePath('/admin'); revalidatePath('/checkout'); return { ok: true, message: 'Reward dihapus.' };
}
