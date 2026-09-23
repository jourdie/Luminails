'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../../lib/supabase/server';

export type AddressActionState = { ok: boolean; message: string };

export async function saveAddress(_previous: AddressActionState, formData: FormData): Promise<AddressActionState> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, message: 'Sesi login sudah berakhir.' };
  const id = String(formData.get('id') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const recipientName = String(formData.get('recipient_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const addressLine = String(formData.get('address_line') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const province = String(formData.get('province') ?? '').trim() || null;
  const postalCode = String(formData.get('postal_code') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const isDefault = formData.get('is_default') === 'on';
  if (!label || !recipientName || !phone || !addressLine || !city) return { ok: false, message: 'Lengkapi label, penerima, nomor HP, alamat, dan kota.' };
  const table = supabase.from('customer_addresses' as never) as any;
  if (isDefault) await table.update({ is_default: false }).eq('customer_id', authData.user.id);
  const payload = { customer_id: authData.user.id, label, recipient_name: recipientName, phone, address_line: addressLine, city, province, postal_code: postalCode, notes, is_default: isDefault };
  const response = id ? await table.update(payload).eq('id', id).eq('customer_id', authData.user.id) : await table.insert(payload);
  if (response.error) return { ok: false, message: `Alamat belum tersimpan: ${response.error.message}` };
  revalidatePath('/account/addresses');
  revalidatePath('/checkout');
  return { ok: true, message: 'Alamat tersimpan.' };
}

export async function deleteAddress(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;
  await (supabase.from('customer_addresses' as never) as any).delete().eq('id', String(formData.get('id') ?? '')).eq('customer_id', authData.user.id);
  revalidatePath('/account/addresses');
}
