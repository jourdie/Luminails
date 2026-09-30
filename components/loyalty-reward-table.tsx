'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import type { AdminDashboard, AdminReward } from '../lib/admin';
import { archiveReward, deleteReward, saveReward, type LoyaltyActionState } from '../app/admin/loyalty-actions';
import { recommendRewardPoints, rewardCostRatio } from '../lib/loyalty-engine';

const initial: LoyaltyActionState = { ok: false, message: '' };
const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(Number(value) || 0);
const points = (value: number) => new Intl.NumberFormat('id-ID').format(Number(value) || 0);

function useDebounced(value: string) { const [state, setState] = useState(value); useEffect(() => { const timer = window.setTimeout(() => setState(value.trim().toLowerCase()), 300); return () => window.clearTimeout(timer); }, [value]); return state; }
function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) { const pages = Math.max(1, Math.ceil(total / 10)); return <div className="admin-pagination"><span>Halaman {Math.min(page + 1, pages)} / {pages} - {total} data</span><div><button type="button" className="button button-outline" disabled={!page} onClick={() => onPage(page - 1)}>Sebelumnya</button><button type="button" className="button button-outline" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Berikutnya</button></div></div>; }

export function LoyaltyRewardTable({ dashboard, canEdit }: { dashboard: AdminDashboard; canEdit: boolean }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [warningFilter, setWarningFilter] = useState('all');
  const [pointMin, setPointMin] = useState('');
  const [pointMax, setPointMax] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const unit = dashboard.loyaltySettings?.point_unit_value_idr ?? 10000;
  const threshold = dashboard.loyaltySettings?.reward_cost_warning_percent ?? 3;
  const skuById = useMemo(() => new Map(dashboard.skus.map((sku) => [sku.id, sku])), [dashboard.skus]);
  const brandFor = (reward: AdminReward) => {
    const sku = skuById.get(reward.sku_id);
    return dashboard.products.find((product) => product.id === sku?.product_id)?.brand ?? '-';
  };
  const ratio = (reward: AdminReward) => Math.max(0, ...dashboard.customerTiers.filter((tier) => tier.is_active).map((tier) => rewardCostRatio(reward.points_cost, unit, reward.hpp_idr, tier.point_multiplier)));
  const inRange = (value: number, minimum: string, maximum: string) => (!minimum || value >= Number(minimum)) && (!maximum || value <= Number(maximum));
  const rows = useMemo(() => dashboard.rewards.filter((reward) => {
    const cost = ratio(reward);
    return `${reward.reward_name ?? ''} ${reward.sku_name ?? ''} ${reward.sku_id} ${brandFor(reward)}`.toLowerCase().includes(debounced)
      && (tierFilter === 'all' || reward.minimum_customer_tier_id === tierFilter)
      && (statusFilter === 'all' || (statusFilter === 'active' ? reward.is_active : !reward.is_active))
      && (stockFilter === 'all' || (stockFilter === 'available' ? reward.reward_stock > 0 : stockFilter === 'unlimited' ? reward.reward_stock === 0 : reward.reward_stock === 0))
      && (warningFilter === 'all' || (warningFilter === 'warning' ? cost > threshold : cost <= threshold))
      && inRange(reward.points_cost, pointMin, pointMax);
  }).sort((a, b) => {
    if (sort === 'points') return a.points_cost - b.points_cost;
    if (sort === 'hpp') return a.hpp_idr - b.hpp_idr;
    if (sort === 'retail') return a.normal_selling_price_idr - b.normal_selling_price_idr;
    if (sort === 'stock') return a.reward_stock - b.reward_stock;
    if (sort === 'redemptions') return b.redemption_count - a.redemption_count;
    if (sort === 'ratio') return ratio(b) - ratio(a);
    return b.id.localeCompare(a.id);
  }), [dashboard.rewards, dashboard.products, skuById, dashboard.customerTiers, debounced, tierFilter, statusFilter, stockFilter, warningFilter, pointMin, pointMax, sort, threshold, unit]);
  return <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Reward catalog</p><h3>Reward table</h3></div><span className="notification-count">{rows.length} reward</span></div>
    <div className="admin-table-controls reward-table-controls">
      <label className="admin-table-search-label">Search<input className="admin-table-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Reward, SKU, atau brand" /></label>
      <label>Minimum tier<select value={tierFilter} onChange={(event) => { setTierFilter(event.target.value); setPage(0); }}><option value="all">Semua tier</option>{dashboard.customerTiers.filter((tier) => tier.is_active).map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
      <label>Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
      <label>Stock<select value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setPage(0); }}><option value="all">Semua stock</option><option value="available">Ada stock</option><option value="unlimited">Unlimited</option></select></label>
      <label>Cost ratio<select value={warningFilter} onChange={(event) => { setWarningFilter(event.target.value); setPage(0); }}><option value="all">Semua ratio</option><option value="warning">Di atas warning</option><option value="ok">Dalam batas</option></select></label>
      <label>Point min<input inputMode="numeric" value={pointMin} onChange={(event) => { setPointMin(event.target.value.replace(/[^0-9]/g, '')); setPage(0); }} placeholder="0" /></label>
      <label>Point max<input inputMode="numeric" value={pointMax} onChange={(event) => { setPointMax(event.target.value.replace(/[^0-9]/g, '')); setPage(0); }} placeholder="∞" /></label>
      <label>Sort<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}><option value="newest">Terbaru</option><option value="points">Point cost</option><option value="hpp">HPP</option><option value="retail">Harga retail</option><option value="stock">Stock</option><option value="redemptions">Redemptions</option><option value="ratio">Reward cost %</option></select></label>
    </div>
    <div className="admin-data-table reward-table"><div className="admin-data-head"><span>Reward</span><span>SKU</span><span>Brand</span><span>HPP</span><span>Selling price</span><span>Point cost</span><span>Min tier</span><span>Stock</span><span>Redemptions</span><span>Reward cost %</span><span>Status</span><span>Actions</span></div>
      {rows.slice(page * 10, page * 10 + 10).map((reward) => <RewardEditor key={reward.id} reward={reward} dashboard={dashboard} canEdit={canEdit} ratio={ratio(reward)} warning={ratio(reward) > threshold} brandName={brandFor(reward)} />)}
    </div>
    {!rows.length && <p className="admin-empty-copy">No reward products yet. Buat reward pertama.</p>}
    <Pager page={page} total={rows.length} onPage={setPage} />
  </section>;
}

function RewardEditor({ reward, dashboard, canEdit, ratio, warning, brandName }: { reward: AdminReward; dashboard: AdminDashboard; canEdit: boolean; ratio: number; warning: boolean; brandName: string }) {
  const [state, action, pending] = useActionState(saveReward, initial);
  const [archiveState, archiveAction, archivePending] = useActionState(archiveReward, initial);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteReward, initial);
  const [editing, setEditing] = useState(false);
  const dateInput = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : '';
  const minimumTier = dashboard.customerTiers.find((tier) => tier.id === reward.minimum_customer_tier_id)?.name ?? 'Semua tier';
  const tierRatios = dashboard.customerTiers.filter((tier) => tier.is_active).map((tier) => `${tier.name}: ${rewardCostRatio(reward.points_cost, dashboard.loyaltySettings?.point_unit_value_idr ?? 10000, reward.hpp_idr, tier.point_multiplier).toFixed(2)}%`).join(' · ');
  const maxMultiplier = Math.max(1, ...dashboard.customerTiers.filter((tier) => tier.is_active).map((tier) => Number(tier.point_multiplier) || 1));
  const recommendedPoints = recommendRewardPoints(reward.hpp_idr, dashboard.loyaltySettings?.point_unit_value_idr ?? 10000, dashboard.loyaltySettings?.reward_cost_warning_percent ?? 3, maxMultiplier);
  return <div className="reward-editor-record">
    <div className="admin-data-row reward-summary-row">
      <span><strong>{reward.reward_name ?? reward.sku_name ?? 'Reward'}</strong><small>{reward.description ?? '-'}</small></span>
      <span>{reward.sku_name ?? reward.sku_id}<small>{reward.sku_id}</small></span>
      <span>{brandName}</span>
      <span>{money(reward.hpp_idr)}</span>
      <span>{money(reward.normal_selling_price_idr)}</span>
      <span>{points(reward.points_cost)} pts</span>
      <span>{minimumTier}</span>
      <span>{reward.reward_stock > 0 ? reward.reward_stock : 'Unlimited'}</span>
      <span>{reward.redemption_count}</span>
      <span className={warning ? 'reward-cost-warning' : 'reward-cost-ok'}>{ratio.toFixed(2)}%<small>{warning ? 'Warning' : 'OK'}</small></span>
      <span>{reward.is_active ? 'Aktif' : 'Nonaktif'}</span>
      <span><button className="button button-outline" type="button" onClick={() => setEditing((value) => !value)}>{editing ? 'Tutup' : 'Edit'}</button></span>
    </div>
    {editing && <div className="reward-editor-detail">
      <form className="admin-crud-form admin-crud-row-form" action={action}>
        <input type="hidden" name="id" value={reward.id} />
        <label>Reward<input name="reward_name" defaultValue={reward.reward_name ?? reward.sku_name ?? ''} required disabled={!canEdit} /></label>
        <label>SKU<select name="sku_id" defaultValue={reward.sku_id} disabled={!canEdit}>{dashboard.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku} - {sku.name}</option>)}</select></label>
        <label>HPP<input name="hpp_idr" type="number" min="0" defaultValue={reward.hpp_idr} disabled={!canEdit} /></label>
        <label>Harga retail<input name="normal_selling_price_idr" type="number" min="0" defaultValue={reward.normal_selling_price_idr} disabled={!canEdit} /></label>
        <label>Point cost<input name="points_cost" type="number" min="1" step="1" defaultValue={reward.points_cost} disabled={!canEdit} /><small className="field-help">Saran sistem: {recommendedPoints} pts. Tetap bisa di-adjust.</small></label>
        <label>Minimum order<input name="minimum_order_value_idr" type="number" min="0" defaultValue={reward.minimum_order_value_idr} disabled={!canEdit} /></label>
        <label>Max qty<input name="max_redemption_quantity" type="number" min="1" defaultValue={reward.max_redemption_quantity} disabled={!canEdit} /></label>
        <label>Stock (0 = unlimited)<input name="reward_stock" type="number" min="0" defaultValue={reward.reward_stock} disabled={!canEdit} /></label>
        <label>Minimum tier<select name="minimum_customer_tier_id" defaultValue={reward.minimum_customer_tier_id ?? ''} disabled={!canEdit}><option value="">Semua tier</option>{dashboard.customerTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
        <label>Mulai<input name="starts_at" type="datetime-local" defaultValue={dateInput(reward.starts_at)} disabled={!canEdit} /></label>
        <label>Berakhir<input name="ends_at" type="datetime-local" defaultValue={dateInput(reward.ends_at)} disabled={!canEdit} /></label>
        <label className="admin-crud-wide">Deskripsi<textarea name="description" rows={2} defaultValue={reward.description ?? ''} disabled={!canEdit} /></label>
        <label className="admin-check"><input name="is_active" type="checkbox" defaultChecked={reward.is_active} disabled={!canEdit} /> Aktif</label>
        <div className="admin-crud-record-foot"><span className={warning ? 'reward-cost-warning' : 'reward-cost-ok'}>{tierRatios || `${money(reward.hpp_idr)} HPP - ${points(reward.points_cost)} pts - ${ratio.toFixed(2)}%`} {warning ? '· warning' : '· OK'}</span><button className="button button-outline" type="submit" disabled={!canEdit || pending}>{pending ? 'Menyimpan...' : 'Simpan reward'}</button>{state.message && <small className={state.ok ? 'action-success' : 'action-error'}>{state.message}</small>}</div>
      </form>
      <div className="admin-crud-record-actions"><form action={archiveAction} onSubmit={(event) => { if (!window.confirm('Arsipkan reward ini?')) event.preventDefault(); }}><input type="hidden" name="id" value={reward.id} /><button className="text-button" type="submit" disabled={!canEdit || archivePending}>{archivePending ? 'Mengarsipkan...' : 'Arsipkan'}</button>{archiveState.message && <small className={archiveState.ok ? 'action-success' : 'action-error'}>{archiveState.message}</small>}</form><form action={deleteAction} onSubmit={(event) => { if (!window.confirm('Hapus reward ini? Histori redemption akan dicek.')) event.preventDefault(); }}><input type="hidden" name="id" value={reward.id} /><input type="hidden" name="sku_id" value={reward.sku_id} /><button className="text-button danger-button" type="submit" disabled={!canEdit || deletePending}>{deletePending ? 'Menghapus...' : 'Hapus'}</button>{deleteState.message && <small className={deleteState.ok ? 'action-success' : 'action-error'}>{deleteState.message}</small>}</form></div>
    </div>}
  </div>;
}
