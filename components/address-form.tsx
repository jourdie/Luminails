'use client';

import { useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAddress, type AddressActionState } from '../app/account/addresses/actions';

export type AddressFormValue = {
  id?: string;
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  address_line?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  is_default?: boolean;
};

const initialState: AddressActionState = { ok: false, message: '' };

export function AddressForm({ address }: { address?: AddressFormValue }) {
  const [state, formAction, pending] = useActionState(saveAddress, initialState);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);
  const editing = Boolean(address?.id);
  return <form className='address-form' action={formAction}>
    {address?.id && <input type='hidden' name='id' value={address.id} />}
    <div className='address-form-grid'>
      <label>Label cabang<input name='label' defaultValue={address?.label ?? ''} placeholder='Studio utama / Cabang Bandung' required /></label>
      <label>Nama penerima<input name='recipient_name' defaultValue={address?.recipient_name ?? ''} autoComplete='name' required /></label>
      <label>Nomor HP<input name='phone' defaultValue={address?.phone ?? ''} type='tel' autoComplete='tel' required /></label>
      <label>Kota<input name='city' defaultValue={address?.city ?? ''} required /></label>
      <label>Provinsi<input name='province' defaultValue={address?.province ?? ''} /></label>
      <label>Kode pos<input name='postal_code' defaultValue={address?.postal_code ?? ''} inputMode='numeric' /></label>
      <label className='address-form-wide'>Alamat lengkap<textarea name='address_line' defaultValue={address?.address_line ?? ''} autoComplete='street-address' required /></label>
      <label className='address-form-wide'>Catatan<textarea name='notes' defaultValue={address?.notes ?? ''} placeholder='Patokan, jam penerimaan, atau instruksi cabang.' /></label>
      <label className='address-checkbox address-form-wide'><input type='checkbox' name='is_default' defaultChecked={address?.is_default ?? false} /> Jadikan alamat utama</label>
    </div>
    {state.message && <p className={state.ok ? 'profile-message profile-message-success' : 'profile-message profile-message-error'} role='status'>{state.message}</p>}
    <button className='button button-dark' disabled={pending}>{pending ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Simpan alamat'} <span>-&gt;</span></button>
  </form>;
}
