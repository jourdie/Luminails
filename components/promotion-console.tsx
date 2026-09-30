'use client';

import { useActionState, useState } from 'react';
import { createPromotion, updatePromotion, deletePromotion, type AdminActionState } from '../app/admin/actions';
import type { AdminPromotion } from '../lib/admin';

const typeLabels: Record<AdminPromotion['promotion_type'], string> = {
  new_user: 'New user promo',
  repeat_order: 'Recurring repeat promo',
  bundle: 'Bundling package',
  seasonal: 'Seasonal promo',
  custom_voucher: 'Custom special voucher',
};

const money = (value: number | null) => value === null ? '-' : 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
const dateInput = (value: string | null) => value ? value.slice(0, 16) : '';

export function PromotionConsole({ promotions, canEdit }: { promotions: AdminPromotion[]; canEdit: boolean }) {
  const [showCreate, setShowCreate] = useState(false);
  const activeCount = promotions.filter((promotion) => promotion.is_active && promotion.status === 'active').length;
  const customCount = promotions.filter((promotion) => promotion.promotion_type === 'custom_voucher').length;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPromotions = promotions.filter((promotion) => (status === 'all' || promotion.status === status) && (promotion.name + ' ' + promotion.code + ' ' + (promotion.voucher_code ?? '')).toLowerCase().includes(normalizedQuery)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'usage' ? b.usage_count - a.usage_count : b.starts_at.localeCompare(a.starts_at));
  const pageCount = Math.max(1, Math.ceil(filteredPromotions.length / 10));
  const visiblePromotions = filteredPromotions.slice(page * 10, page * 10 + 10);

  return <><div className="admin-page-heading"><div><p className="eyebrow">Promotion engine</p><h2>Promo yang terukur.</h2></div>{canEdit && <button className="button button-dark" onClick={() => setShowCreate((open) => !open)}>{showCreate ? 'Tutup form' : 'Buat promo'} <span>{showCreate ? '×' : '+'}</span></button>}</div><div className="promotion-summary"><div><span>Campaign aktif</span><strong>{String(activeCount).padStart(2, '0')}</strong></div><div><span>Total campaign</span><strong>{String(promotions.length).padStart(2, '0')}</strong></div><div><span>Voucher khusus</span><strong>{String(customCount).padStart(2, '0')}</strong></div></div>{showCreate && <div className="admin-panel promotion-create"><div className="panel-heading"><div><p className="eyebrow">Campaign baru</p><h3>Atur promo dan voucher</h3></div></div><PromotionForm canEdit={canEdit} /></div>}<section className="admin-panel promotion-table-panel"><div className="panel-heading"><div><p className="eyebrow">Campaign records</p><h3>Data table promo</h3></div><span className="notification-count">{filteredPromotions.length} hasil</span></div><div className="admin-table-controls"><input className="admin-table-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Cari nama, code, atau voucher" /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="all">Semua status</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="paused">Paused</option><option value="expired">Expired</option></select><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}><option value="newest">Mulai terbaru</option><option value="name">Nama A-Z</option><option value="usage">Penggunaan terbanyak</option></select></div><div className="admin-data-table promotion-table" role="table" aria-label="Daftar promo"><div className="admin-data-head promotion-table-head" role="row"><span>Campaign</span><span>Tipe</span><span>Status / usage</span><span>Nilai</span><span>Mulai</span><span>Aksi</span></div>{visiblePromotions.map((promotion) => <PromotionEditor key={promotion.id} promotion={promotion} canEdit={canEdit} />)}</div>{!filteredPromotions.length && <p className="admin-empty-copy">Belum ada promo yang cocok dengan filter.</p>}<div className="admin-pagination"><span>Menampilkan {filteredPromotions.length ? page * 10 + 1 : 0}-{Math.min(page * 10 + 10, filteredPromotions.length)} dari {filteredPromotions.length}</span><div><button type="button" className="button button-outline" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>Sebelumnya</button><strong>Halaman {Math.min(page + 1, pageCount)} / {pageCount}</strong><button type="button" className="button button-outline" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}>Berikutnya</button></div></div></section></>;
}

function PromotionEditor({ promotion, canEdit }: { promotion: AdminPromotion; canEdit: boolean }) {
  const [deleteState, deleteAction, deletePending] = useActionState(deletePromotion, { ok: false, message: '' });
  return <details className="promotion-table-record">
    <summary className="promotion-table-row">
      <span><strong>{promotion.name}</strong><small>{promotion.code}{promotion.voucher_code ? ' ? Voucher ' + promotion.voucher_code : ''}</small></span>
      <span>{typeLabels[promotion.promotion_type]}</span>
      <span>{promotion.status}<small>{promotion.usage_count}{promotion.usage_limit ? ' / ' + promotion.usage_limit : ''} penggunaan</small></span>
      <span>{money(promotion.discount_type === 'fixed_amount' ? promotion.discount_value : promotion.bundle_price_idr)}</span>
      <span>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(promotion.starts_at))}</span>
      <span className="promotion-row-action">Detail & edit <span aria-hidden="true">?</span></span>
    </summary>
    <div className="promotion-table-detail">
      <PromotionForm promotion={promotion} canEdit={canEdit} />
      <form className="promotion-delete-form" action={deleteAction} onSubmit={(event) => { if (!window.confirm('Hapus promo ' + promotion.code + '? Promo yang sudah dipakai tidak dapat dihapus.')) event.preventDefault(); }}>
        <input type="hidden" name="promotion_id" value={promotion.id} />
        <button className="text-button danger-button" type="submit" disabled={!canEdit || deletePending}>{deletePending ? 'Menghapus...' : 'Hapus promo'}</button>
        {deleteState.message && <small className={deleteState.ok ? 'action-success' : 'action-error'}>{deleteState.message}</small>}
      </form>
    </div>
  </details>;
}

function PromotionForm({ promotion, canEdit }: { promotion?: AdminPromotion; canEdit: boolean }) {
  const initialState: AdminActionState = { ok: false, message: '' };
  const action = promotion ? updatePromotion : createPromotion;
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form className="promotion-form" action={formAction}><input type="hidden" name="promotion_id" value={promotion?.id ?? ''} /><div className="promotion-fields"><label>Code campaign<input name="code" defaultValue={promotion?.code ?? ''} placeholder="WELCOME10" disabled={!canEdit} required /></label><label>Nama promo<input name="name" defaultValue={promotion?.name ?? ''} placeholder="Welcome untuk user baru" disabled={!canEdit} required /></label><label>Tipe promo<select name="promotion_type" defaultValue={promotion?.promotion_type ?? 'new_user'} disabled={!canEdit}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Audience<select name="audience_type" defaultValue={promotion?.audience_type ?? 'all'} disabled={!canEdit}><option value="all">Semua customer</option><option value="new_user">User baru</option><option value="repeat_customer">Repeat customer</option><option value="pricing_tier">Pricing tier</option><option value="custom_customer">Customer tertentu</option></select></label><label>Tipe diskon<select name="discount_type" defaultValue={promotion?.discount_type ?? 'percentage'} disabled={!canEdit}><option value="percentage">Persentase (%)</option><option value="fixed_amount">Potongan nominal</option><option value="fixed_price">Harga paket/fixed</option><option value="free_shipping">Gratis ongkir</option></select></label><label>Nilai diskon<input name="discount_value" type="number" min="0" step="0.01" defaultValue={promotion?.discount_value ?? 0} disabled={!canEdit} /></label><label>Harga bundling (IDR)<input name="bundle_price_idr" type="number" min="0" defaultValue={promotion?.bundle_price_idr ?? ''} placeholder="Wajib untuk bundle" disabled={!canEdit} /></label><label>Minimum belanja (IDR)<input name="minimum_order_amount_idr" type="number" min="0" defaultValue={promotion?.minimum_order_amount_idr ?? 0} disabled={!canEdit} /></label><label>Minimum item<input name="minimum_item_quantity" type="number" min="0" defaultValue={promotion?.minimum_item_quantity ?? 0} disabled={!canEdit} /></label><label>Minimum repeat order<input name="repeat_order_min_count" type="number" min="0" defaultValue={promotion?.repeat_order_min_count ?? 0} disabled={!canEdit} /></label><label>Voucher code<input name="voucher_code" defaultValue={promotion?.voucher_code ?? ''} placeholder="Opsional" disabled={!canEdit} /></label><label>Status<select name="status" defaultValue={promotion?.status ?? 'draft'} disabled={!canEdit}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="paused">Paused</option><option value="expired">Expired</option></select></label><label>Mulai tampil (opsional)<input name="starts_at" type="datetime-local" defaultValue={dateInput(promotion?.starts_at ?? null)} disabled={!canEdit} /><small className="field-help">Kosongkan untuk mulai sekarang.</small></label><label>Berakhir<input name="ends_at" type="datetime-local" defaultValue={dateInput(promotion?.ends_at ?? null)} disabled={!canEdit} /></label><label>Usage limit<input name="usage_limit" type="number" min="1" defaultValue={promotion?.usage_limit ?? ''} placeholder="Tanpa batas" disabled={!canEdit} /></label><label>Limit per customer<input name="usage_limit_per_customer" type="number" min="1" defaultValue={promotion?.usage_limit_per_customer ?? ''} placeholder="Tanpa batas" disabled={!canEdit} /></label><label className="promotion-check"><input name="is_stackable" type="checkbox" defaultChecked={promotion?.is_stackable ?? false} disabled={!canEdit} /> Bisa digabung promo lain</label><label className="promotion-check"><input name="is_active" type="checkbox" defaultChecked={promotion?.is_active ?? false} disabled={!canEdit} /> Aktif di storefront</label><label className="promotion-eligible">Eligible customer IDs <input name="eligible_customer_ids" defaultValue="" placeholder="UUID Supabase, pisahkan dengan koma" disabled={!canEdit} /><small>Dipakai untuk custom voucher; isi UUID dari customer_profiles.</small></label></div><div className="promotion-form-foot">{state.message && <small className={state.ok ? 'action-success' : 'action-error'}>{state.message}</small>}{canEdit && <button className="button button-dark" type="submit" disabled={pending}>{pending ? 'Menyimpan…' : promotion ? 'Simpan promo' : 'Buat promo'} <span>↗</span></button>}</div></form>;
}
