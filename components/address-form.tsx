'use client';

import { useActionState } from 'react';
import { saveAddress, type AddressActionState } from '../app/account/addresses/actions';

const initialState: AddressActionState = { ok: false, message: '' };
export function AddressForm() {
  const [state, formAction, pending] = useActionState(saveAddress, initialState);
  return <form className="address-form" action={formAction}><div className="address-form-grid"><label>Label cabang<input name="label" placeholder="Studio utama / Cabang Bandung" required /></label><label>Nama penerima<input name="recipient_name" autoComplete="name" required /></label><label>Nomor HP<input name="phone" type="tel" autoComplete="tel" required /></label><label>Kota<input name="city" required /></label><label>Provinsi<input name="province" /></label><label>Kode pos<input name="postal_code" inputMode="numeric" /></label><label className="address-form-wide">Alamat lengkap<textarea name="address_line" autoComplete="street-address" required /></label><label className="address-form-wide">Catatan<textarea name="notes" placeholder="Patokan, jam penerimaan, atau instruksi cabang." /></label><label className="address-checkbox address-form-wide"><input type="checkbox" name="is_default" /> Jadikan alamat utama</label></div>{state.message && <p className={state.ok ? 'profile-message profile-message-success' : 'profile-message profile-message-error'} role="status">{state.message}</p>}<button className="button button-dark" disabled={pending}>{pending ? 'Menyimpan...' : 'Simpan alamat'} <span>→</span></button></form>;
}
