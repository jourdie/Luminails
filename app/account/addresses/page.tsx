import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteNavigation } from '../../../components/site-navigation';
import { AddressForm } from '../../../components/address-form';
import { createClient } from '../../../lib/supabase/server';
import { deleteAddress } from './actions';

export const dynamic = 'force-dynamic';
export default async function AddressesPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect('/auth?next=/account/addresses');
  const { data: addresses } = await (supabase.from('customer_addresses' as never) as any).select('id, label, recipient_name, phone, address_line, city, province, postal_code, notes, is_default').order('is_default', { ascending: false }).order('created_at', { ascending: false });
  return <><SiteNavigation /><main className="account-page"><div className="account-shell addresses-shell"><div className="account-heading"><div><p className="eyebrow">Luminails / delivery book</p><h1>Alamat<br /><em>multi cabang.</em></h1><p>Simpan beberapa alamat studio atau cabang. Checkout akan memakai alamat yang dipilih, bukan mengubah data profil utama.</p></div><Link className="button button-outline" href="/account">Kembali ke account</Link></div><section className="address-layout"><div className="account-panel"><p className="eyebrow">Alamat tersimpan</p>{addresses?.length ? <div className="address-list">{addresses.map((address: any) => <article className="address-card" key={address.id}><div><span>{address.label}{address.is_default ? ' · utama' : ''}</span><strong>{address.recipient_name}</strong><p>{address.phone}<br />{address.address_line}<br />{address.city}{address.province ? `, ${address.province}` : ''} {address.postal_code ?? ''}</p></div><form action={deleteAddress}><input type="hidden" name="id" value={address.id} /><button className="button button-quiet" type="submit">Hapus</button></form></article>)}</div> : <p className="empty-copy">Belum ada alamat cabang.</p>}</div><div className="account-panel"><p className="eyebrow">Tambah alamat</p><h2>Siapkan titik kirim berikutnya.</h2><AddressForm /></div></section></div></main></>;
}
