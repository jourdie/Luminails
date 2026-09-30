'use client';

import { useActionState, useState } from 'react';
import { createRecommendation, deleteRecommendation, updateRecommendation, type AdminActionState } from '../app/admin/actions';
import type { AdminDashboard, AdminRecommendation } from '../lib/admin';

const initialState: AdminActionState = { ok: false, message: '' };
const inputDate = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : '';

export function RecommendationConsole({ recommendations, packages, skus, canEdit }: { recommendations: AdminRecommendation[]; packages: AdminDashboard['packages']; skus: AdminDashboard['skus']; canEdit: boolean }) {
  const [targetType, setTargetType] = useState<'package' | 'sku'>('package');
  const [state, action, pending] = useActionState(createRecommendation, initialState);
  return <div className="admin-crud-stack recommendation-console">
    <div className="admin-page-heading"><div><p className="eyebrow">Recommendation Page</p><h2>You Might Also Like..</h2></div><span className="notification-count">{recommendations.length} item</span></div>
    <section className="admin-panel">
      <div className="panel-heading"><div><p className="eyebrow">Customer merchandising</p><h3>Tambah rekomendasi</h3></div><span className="notification-count">Priority kecil tampil lebih dulu</span></div>
      <div className="recommendation-flow"><div><span>01</span><strong>Target SKU</strong><small>pilih item yang ingin di-cross-sell</small></div><div><span>02</span><strong>Placement package detail</strong><small>muncul di halaman package</small></div><div><span>03</span><strong>Checkout tetap package</strong><small>klik SKU membuka package induknya</small></div></div><p className="admin-empty-copy">SKU recommendation tetap mengarahkan customer ke package yang memiliki SKU tersebut. SKU tidak dapat checkout langsung tanpa package.</p>
      <form className="admin-crud-form recommendation-form" action={action}>
        <label>Target type<select name="target_type" value={targetType} onChange={(event) => setTargetType(event.target.value as 'package' | 'sku')} disabled={!canEdit}><option value="package">Package</option><option value="sku">SKU / tools</option></select></label>
        <label>{targetType === 'package' ? 'Package' : 'SKU'}{targetType === 'package' ? <select name="package_id" required disabled={!canEdit}><option value="">Pilih package</option>{packages.filter((item) => item.status === 'published').map((item) => <option key={item.id} value={item.id}>{item.brand_name} / {item.title}</option>)}</select> : <select name="sku_id" required disabled={!canEdit}><option value="">Pilih SKU</option>{skus.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.sku} / {item.name}</option>)}</select>}</label>
        <label>Placement<select name="placement" defaultValue="package_detail" disabled={!canEdit}><option value="package_detail">Package detail</option><option value="home">Home</option><option value="packages">Packages</option></select></label>
        <label>Priority<input name="priority" type="number" min="0" defaultValue="100" disabled={!canEdit} /></label>
        <label>Mulai tampil (opsional)<input name="starts_at" type="datetime-local" disabled={!canEdit} /><small className="field-help">Kosongkan = langsung aktif.</small></label>
        <label>Berakhir tampil<input name="ends_at" type="datetime-local" disabled={!canEdit} /></label>
        <label className="admin-check"><input name="is_active" type="checkbox" defaultChecked disabled={!canEdit} /> Aktif</label>
        <div className="admin-crud-action"><span className={state.message ? (state.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{state.message || 'Rekomendasi aktif hanya muncul pada placement dan tanggal yang sesuai.'}</span><button className="button button-dark" disabled={!canEdit || pending}>{pending ? '...' : 'Simpan rekomendasi'}</button></div>
      </form>
    </section>
    <section className="admin-panel">
      <div className="panel-heading"><div><p className="eyebrow">Saved records</p><h3>Daftar rekomendasi</h3></div><span className="notification-count">CRUD aktif</span></div>
      {recommendations.length === 0 ? <p className="admin-empty-copy">Belum ada rekomendasi. Tambahkan package atau tools yang ingin dibagikan kepada customer.</p> : recommendations.map((item) => <RecommendationRow key={item.id} item={item} packages={packages} skus={skus} canEdit={canEdit} />)}
    </section>
  </div>;
}

function RecommendationRow({ item, packages, skus, canEdit }: { item: AdminRecommendation; packages: AdminDashboard['packages']; skus: AdminDashboard['skus']; canEdit: boolean }) {
  const [targetType, setTargetType] = useState<'package' | 'sku'>(item.package_id ? 'package' : 'sku');
  const [state, action, pending] = useActionState(updateRecommendation, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteRecommendation, initialState);
  const targetLabel = item.package_id ? packages.find((row) => row.id === item.package_id)?.title ?? item.package_id : skus.find((row) => row.id === item.sku_id)?.name ?? item.sku_id ?? 'Target';
  return <div className="recommendation-row">
    <form className="recommendation-edit-form" action={action}>
      <input type="hidden" name="id" value={item.id} />
      <label>Target<select name="target_type" value={targetType} onChange={(event) => setTargetType(event.target.value as 'package' | 'sku')} disabled={!canEdit}><option value="package">Package</option><option value="sku">SKU / tools</option></select></label>
      <label>Item{targetType === 'package' ? <select name="package_id" defaultValue={item.package_id ?? ''} required disabled={!canEdit}>{packages.filter((row) => row.status === 'published').map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select> : <select name="sku_id" defaultValue={item.sku_id ?? ''} required disabled={!canEdit}>{skus.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.sku} / {row.name}</option>)}</select>}</label>
      <label>Placement<select name="placement" defaultValue={item.placement} disabled={!canEdit}><option value="package_detail">Package detail</option><option value="home">Home</option><option value="packages">Packages</option></select></label>
      <label>Priority<input name="priority" type="number" min="0" defaultValue={item.priority} disabled={!canEdit} /></label>
      <label>Mulai tampil (opsional)<input name="starts_at" type="datetime-local" defaultValue={inputDate(item.starts_at)} disabled={!canEdit} /><small className="field-help">Kosongkan = langsung aktif.</small></label>
      <label>Berakhir tampil (opsional)<input name="ends_at" type="datetime-local" defaultValue={inputDate(item.ends_at)} disabled={!canEdit} /></label>
      <label className="admin-check"><input name="is_active" type="checkbox" defaultChecked={item.is_active} disabled={!canEdit} /> Aktif</label>
      <div className="recommendation-row-actions"><span className={state.message ? (state.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{state.message || targetLabel}</span><button className="button button-outline" disabled={!canEdit || pending}>{pending ? '...' : 'Simpan'}</button></div>
    </form>
    <form action={deleteAction} className="recommendation-delete-form"><input type="hidden" name="id" value={item.id} /><button className="text-button danger-button" disabled={!canEdit || deletePending}>{deletePending ? '...' : 'Hapus'}</button>{deleteState.message && <small>{deleteState.message}</small>}</form>
  </div>;
}
