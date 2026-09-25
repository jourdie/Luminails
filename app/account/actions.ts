'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';

export type ProfileActionState = { ok: boolean; message: string };

export async function saveCustomerProfile(_previous: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, message: 'Sesi login sudah berakhir. Silakan masuk kembali.' };

  const displayName = String(formData.get('display_name') ?? '').trim();
  const businessName = String(formData.get('business_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const studioType = String(formData.get('studio_type') ?? '').trim();
  const additionalInfo = String(formData.get('additional_info') ?? '').trim();

  if (!displayName || !businessName || !phone || !address || !studioType) {
    return { ok: false, message: 'Lengkapi nama, nama studio, nomor HP, alamat, dan tipe studio.' };
  }

  const metadata = authData.user.user_metadata ?? {};
  const avatarUrl = typeof (metadata.avatar_url ?? metadata.picture) === 'string' ? String(metadata.avatar_url ?? metadata.picture) : null;
  const { error } = await supabase.from('customer_profiles').upsert({
    id: authData.user.id,
    email: authData.user.email ?? null,
    display_name: displayName,
    business_name: businessName,
    business_type: studioType,
    phone,
    whatsapp: phone,
    address,
    studio_type: studioType,
    additional_info: additionalInfo || null,
    avatar_url: avatarUrl,
    status: 'approved',
  }, { onConflict: 'id' });

  if (error) return { ok: false, message: `Profil belum tersimpan: ${error.message}` };

  const addressTable = supabase.from('customer_addresses' as never) as any;
  const { count } = await addressTable.select('id', { count: 'exact', head: true }).eq('customer_id', authData.user.id);
  if (!count) {
    await addressTable.insert({ customer_id: authData.user.id, label: 'Alamat utama', recipient_name: displayName, phone, address_line: address, city: address.slice(0, 80), is_default: true });
  }

  revalidatePath('/');
  revalidatePath('/account/profile');
  return { ok: true, message: 'Profil tersimpan. Data ini akan menjadi isian awal saat checkout.' };
}
