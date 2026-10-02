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
  const { error } = await (supabase as any).rpc('save_customer_address', {
    p_id: id || null,
    p_label: label,
    p_recipient_name: recipientName,
    p_phone: phone,
    p_address_line: addressLine,
    p_city: city,
    p_province: province,
    p_postal_code: postalCode,
    p_notes: notes,
    p_is_default: isDefault,
  });
  if (error) {
    const message = error.message.includes('ADDRESS_NOT_FOUND')
      ? 'Alamat tidak ditemukan atau bukan milik akun ini.'
      : error.message.includes('ADDRESS_AUTH_REQUIRED')
        ? 'Sesi login sudah berakhir.'
        : `Alamat belum tersimpan: ${error.message}`;
    return { ok: false, message };
  }
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
