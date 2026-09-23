'use client';

import { useActionState } from 'react';
import { saveCustomerProfile, type ProfileActionState } from '../app/account/actions';
import type { AccountIdentity, CustomerProfile } from '../lib/account';
import { AccountIdentity as AccountIdentityBadge } from './account-identity';

const initialState: ProfileActionState = { ok: false, message: '' };

export function ProfileForm({ identity, profile }: { identity: AccountIdentity; profile: CustomerProfile | null }) {
  const [state, formAction, pending] = useActionState(saveCustomerProfile, initialState);
  return (
    <main className="profile-shell">
      <div className="profile-card">
        <div className="profile-topline"><a className="brand" href="/">luminails<span className="brand-dot">.</span></a><AccountIdentityBadge identity={identity} /></div>
        <p className="eyebrow profile-eyebrow">Luminails / customer profile</p>
        <h1>Kenali studio<br /><em>yang kamu bangun.</em></h1>
        <p className="profile-copy">Lengkapi data sekali. Nanti alamat dan detail studio akan muncul otomatis saat kamu menyiapkan order, dan tetap bisa diedit kapan saja.</p>
        <form className="profile-form" action={formAction}>
          <div className="profile-grid">
            <label>Nama lengkap<input name="display_name" defaultValue={profile?.display_name ?? identity.name} autoComplete="name" required /></label>
            <label>Email Google<input value={identity.email} readOnly aria-readonly="true" /></label>
            <label>Nama studio / bisnis<input name="business_name" defaultValue={profile?.business_name ?? ''} autoComplete="organization" required /></label>
            <label>Nomor HP / WhatsApp<input name="phone" defaultValue={profile?.phone ?? profile?.whatsapp ?? ''} type="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" required /></label>
            <label className="profile-wide">Alamat / domisili<textarea name="address" defaultValue={profile?.address ?? ''} autoComplete="street-address" placeholder="Alamat studio atau alamat pengiriman" required /></label>
            <label>Tipe studio<select name="studio_type" defaultValue={profile?.studio_type ?? profile?.business_type ?? ''} required><option value="" disabled>Pilih tipe studio</option><option value="offline_salon">Salon offline</option><option value="home_studio">Home studio</option><option value="freelance">Nail artist freelance</option><option value="reseller">Reseller</option><option value="other">Lainnya</option></select></label>
            <label>Informasi lainnya<textarea name="additional_info" defaultValue={profile?.additional_info ?? ''} placeholder="Jam operasional, kebutuhan khusus, atau catatan untuk Luminails" /></label>
          </div>
          {state.message && <p className={state.ok ? 'profile-message profile-message-success' : 'profile-message profile-message-error'} role="status">{state.message}</p>}
          <div className="profile-actions"><a className="button button-quiet" href="/">Kembali ke katalog</a><button className="button button-dark" type="submit" disabled={pending}>{pending ? 'Menyimpan...' : 'Simpan profil'} <span>→</span></button></div>
        </form>
      </div>
    </main>
  );
}
