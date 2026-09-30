'use client';

import { useActionState } from 'react';
import { createTrustedLogo, deleteTrustedLogo, updateTrustedLogo, type AdminActionState } from '../app/admin/actions';
import type { AdminTrustedLogo } from '../lib/admin';

const initialState: AdminActionState = { ok: false, message: '' };

export function TrustedLogoConsole({ logos, canEdit }: { logos: AdminTrustedLogo[]; canEdit: boolean }) {
  const [createState, createAction, createPending] = useActionState(createTrustedLogo, initialState);
  return <div className="admin-crud-stack">
    <div className="admin-page-heading"><div><p className="eyebrow">Home / social proof</p><h2>Trusted by.</h2><p className="admin-help-copy">Upload logo customer salon atau studio, atur urutan, lalu tampilkan di home page.</p></div><span className="notification-count">{logos.length} logo tersimpan</span></div>
    <section className="admin-panel">
      <div className="panel-heading"><div><p className="eyebrow">Tambah logo</p><h3>Customer logo</h3></div><span className="notification-count">JPG, PNG, atau WEBP</span></div>
      <form className="admin-crud-form trusted-logo-create-form" action={createAction} encType="multipart/form-data">
        <label>Nama customer<input name="name" placeholder="Alya Studio" disabled={!canEdit} required /></label>
        <label>Logo<input name="image_file" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canEdit} /><small className="field-help">Ukuran maksimal 6 MB. URL logo juga bisa dipakai jika file sudah ada di Storage.</small></label>
        <label>URL logo (opsional)<input name="image_url" type="url" placeholder="https://..." disabled={!canEdit} /></label>
        <label>Alt text<input name="alt_text" placeholder="Logo Alya Studio" disabled={!canEdit} /></label>
        <label>Urutan<input name="sort_order" type="number" min="0" defaultValue="0" disabled={!canEdit} /></label>
        <div className="admin-crud-action"><span className={createState.message ? (createState.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{createState.message || 'Logo aktif akan tampil di section Trusted by.'}</span><button className="button button-dark" type="submit" disabled={!canEdit || createPending}>{createPending ? 'Mengupload...' : 'Tambah logo'}</button></div>
      </form>
    </section>
    <section className="admin-panel">
      <div className="panel-heading"><div><p className="eyebrow">Saved records</p><h3>Logo yang tampil</h3></div></div>
      {logos.length ? <div className="trusted-logo-admin-list">{logos.map((logo) => <TrustedLogoRow key={logo.id} logo={logo} canEdit={canEdit} />)}</div> : <div className="admin-empty-module"><strong>Belum ada logo customer</strong><p>Tambahkan logo customer pertama untuk mengisi section Trusted by.</p></div>}
    </section>
  </div>;
}

function TrustedLogoRow({ logo, canEdit }: { logo: AdminTrustedLogo; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateTrustedLogo, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTrustedLogo, initialState);
  return <div className="trusted-logo-admin-row">
    <img src={logo.image_url} alt="" />
    <form action={action} encType="multipart/form-data"><input type="hidden" name="logo_id" value={logo.id} /><input type="hidden" name="current_image_url" value={logo.image_url} /><label>Nama<input name="name" defaultValue={logo.name} disabled={!canEdit} /></label><label>Ganti logo<input name="image_file" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canEdit} /></label><label>Alt text<input name="alt_text" defaultValue={logo.alt_text ?? ''} disabled={!canEdit} /></label><label>Urutan<input name="sort_order" type="number" min="0" defaultValue={logo.sort_order} disabled={!canEdit} /></label><label className="switch-label"><input name="is_active" type="checkbox" defaultChecked={logo.is_active} disabled={!canEdit} /> Tampil</label><button className="button button-outline" type="submit" disabled={!canEdit || pending}>{pending ? 'Menyimpan...' : 'Simpan'}</button>{state.message && <small className={state.ok ? 'action-success' : 'action-error'}>{state.message}</small>}</form>
    <form action={deleteAction} onSubmit={(event) => { if (!window.confirm('Hapus logo ' + logo.name + '?')) event.preventDefault(); }}><input type="hidden" name="logo_id" value={logo.id} /><button className="text-button danger-button" type="submit" disabled={!canEdit || deletePending}>{deletePending ? 'Menghapus...' : 'Hapus'}</button>{deleteState.message && <small>{deleteState.message}</small>}</form>
  </div>;
}