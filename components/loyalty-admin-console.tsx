'use client';

import { useEffect, useMemo, useState, useActionState } from 'react';
import type { AdminDashboard } from '../lib/admin';
import { adjustCustomerPoints, archiveCustomerTier, archiveReward, deleteReward, saveCustomerOverride, saveCustomerTier, saveLoyaltySettings, saveReward, updateRedemptionStatus, type LoyaltyActionState } from '../app/admin/loyalty-actions';
import { rewardCostRatio } from '../lib/loyalty-engine';
import { LoyaltyRewardTable } from './loyalty-reward-table';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
const points = (value: number) => new Intl.NumberFormat('id-ID').format(value);
const initial: LoyaltyActionState = { ok: false, message: '' };

export function LoyaltyAdminConsole({ dashboard, canPricing, canOrders }: { dashboard: AdminDashboard; canPricing: boolean; canOrders: boolean }) {
  const [section, setSection] = useState<'dashboard' | 'customers' | 'tiers' | 'rewards' | 'settings' | 'ledger' | 'redemptions' | 'activity'>('dashboard');
  return <div className="admin-crud-stack">
    <div className="admin-page-heading"><div><p className="eyebrow">Customer lifecycle / loyalty</p><h2>Customer & loyalty.</h2></div><span className="notification-count">{dashboard.customers.length} customer</span></div>
    <div className="admin-section-tabs" role="tablist">{[['dashboard', 'Dashboard'], ['customers', 'Customers'], ['tiers', 'Customer tiers'], ['rewards', 'Reward catalog'], ['redemptions', 'Redemptions'], ['settings', 'Loyalty settings'], ['ledger', 'Point ledger'], ['activity', 'Audit activity']].map(([value, label]) => <button key={value} type="button" className={section === value ? 'is-active' : ''} onClick={() => setSection(value as typeof section)}>{label}</button>)}</div>
    {section === 'dashboard' && <LoyaltyDashboard dashboard={dashboard} />}
    {section === 'customers' && <CustomersEnhanced dashboard={dashboard} canOrders={canOrders} canPricing={canPricing} />}
    {section === 'tiers' && <Tiers dashboard={dashboard} canEdit={canPricing} />}
    {section === 'rewards' && <RewardsEnhanced dashboard={dashboard} canEdit={canPricing} />}
    {section === 'redemptions' && <Redemptions dashboard={dashboard} canEdit={canOrders} />}
    {section === 'settings' && <Settings dashboard={dashboard} canEdit={canPricing} />}
    {section === 'ledger' && <Ledger dashboard={dashboard} />}
    {section === 'activity' && <Activity dashboard={dashboard} />}
  </div>;
}

function ActionMessage({ state }: { state: LoyaltyActionState }) { return state.message ? <p className={state.ok ? 'action-success' : 'action-error'}>{state.message}</p> : null; }

function RewardsEnhanced({ dashboard, canEdit }: { dashboard: AdminDashboard; canEdit: boolean }) {
  return <><RewardCreate dashboard={dashboard} canEdit={canEdit} /><LoyaltyRewardTable dashboard={dashboard} canEdit={canEdit} /></>;
}

function RewardCreate({ dashboard, canEdit }: { dashboard: AdminDashboard; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveReward, initial);
  return <section className={'admin-panel'}><div className={'panel-heading'}><div><p className={'eyebrow'}>Free product catalog</p><h3>Tambah reward</h3></div><span className={'notification-count'}>HPP / points ratio tervalidasi</span></div><form className={'admin-crud-form'} action={action}>
    <label>SKU reward<select name={'sku_id'} required disabled={!canEdit}>{dashboard.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku} - {sku.name}</option>)}</select></label>
    <label>Nama reward<input name={'reward_name'} placeholder={'Free Base Coat'} disabled={!canEdit} required /></label>
    <label>Deskripsi<input name={'description'} placeholder={'Produk gratis untuk tier'} disabled={!canEdit} /></label>
    <label>Point cost<input name={'points_cost'} type={'number'} min={1} required disabled={!canEdit} /></label><label>HPP<input name={'hpp_idr'} type={'number'} min={0} disabled={!canEdit} /></label><label>Harga retail<input name={'normal_selling_price_idr'} type={'number'} min={0} disabled={!canEdit} /></label>
    <label>Minimum tier<select name={'minimum_customer_tier_id'} disabled={!canEdit}><option value={''}>Semua tier</option>{dashboard.customerTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label><label>Minimum order<input name={'minimum_order_value_idr'} type={'number'} min={0} disabled={!canEdit} /></label><label>Max qty / redemption<input name={'max_redemption_quantity'} type={'number'} min={1} defaultValue={1} disabled={!canEdit} /></label><label>Stock (0 = unlimited)<input name={'reward_stock'} type={'number'} min={0} defaultValue={0} disabled={!canEdit} /></label>
    <label>Mulai<input name={'starts_at'} type={'datetime-local'} disabled={!canEdit} /></label><label>Berakhir<input name={'ends_at'} type={'datetime-local'} disabled={!canEdit} /></label><label className={'admin-check'}><input name={'is_active'} type={'checkbox'} defaultChecked disabled={!canEdit} /> Aktif</label><div className={'admin-crud-action'}><ActionMessage state={state} /><button className={'button button-dark'} disabled={!canEdit || pending}>{pending ? 'Menyimpan...' : 'Simpan reward'}</button></div>
  </form></section>;
}

function useDebounced(value: string) { const [debounced, setDebounced] = useState(value); useEffect(() => { const timer = window.setTimeout(() => setDebounced(value.trim().toLowerCase()), 300); return () => window.clearTimeout(timer); }, [value]); return debounced; }
function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) { const pages = Math.max(1, Math.ceil(total / 10)); return <div className="admin-pagination"><span>Halaman {Math.min(page + 1, pages)} / {pages} - {total} data</span><div><button type="button" className="button button-outline" disabled={page <= 0} onClick={() => onPage(Math.max(0, page - 1))}>Sebelumnya</button><button type="button" className="button button-outline" disabled={page >= pages - 1} onClick={() => onPage(Math.min(pages - 1, page + 1))}>Berikutnya</button></div></div>; }

function LoyaltyDashboard({ dashboard }: { dashboard: AdminDashboard }) {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthLedger = dashboard.pointTransactions.filter((row) => new Date(row.created_at) >= monthStart);
  const earned = monthLedger.filter((row) => row.entry_type === 'earn').reduce((sum, row) => sum + Math.max(0, row.points_delta), 0);
  const redeemed = monthLedger.filter((row) => row.entry_type === 'redeem').reduce((sum, row) => sum + Math.abs(row.points_delta), 0);
  const outstanding = dashboard.customers.reduce((sum, customer) => sum + customer.available_points, 0);
  const topSpend = [...dashboard.customers].sort((a, b) => b.lifetime_paid_amount_idr - a.lifetime_paid_amount_idr).slice(0, 5);
  const topPoints = [...dashboard.customers].sort((a, b) => b.available_points - a.available_points).slice(0, 5);
  const topRewards = [...dashboard.rewards].sort((a, b) => b.redemption_count - a.redemption_count).slice(0, 5);
  const expiring = [...dashboard.customers].filter((customer) => (customer.expiring_points ?? 0) > 0).sort((a, b) => new Date(a.next_expiry_at ?? '').getTime() - new Date(b.next_expiry_at ?? '').getTime()).slice(0, 5);
  return <><section className="loyalty-dashboard-grid">{[['Active loyalty customers', dashboard.customers.filter((customer) => !['suspended', 'rejected'].includes(customer.status)).length], ['Outstanding points', points(outstanding) + ' pts'], ['Points earned this month', '+' + points(earned)], ['Points redeemed this month', '-' + points(redeemed)], ['Redemption rate', dashboard.customers.length ? `${Math.round((dashboard.redemptions.length / dashboard.customers.length) * 100)}%` : '0%'], ['Reward cost this month', money(monthLedger.filter((row) => row.entry_type === 'redeem').reduce((sum, row) => sum + Number(dashboard.rewards.find((reward) => reward.sku_id === dashboard.redemptions.find((redemption) => redemption.id === row.redemption_id)?.sku_id)?.hpp_idr ?? 0), 0))]].map(([label, value]) => <div className="loyalty-dashboard-card" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</section><section className="loyalty-dashboard-columns"><DashboardList title="Top customers by spend" rows={topSpend.map((customer) => ({ key: customer.id, label: customer.business_name || customer.display_name || customer.id, value: money(customer.lifetime_paid_amount_idr) }))} /><DashboardList title="Top customers by points" rows={topPoints.map((customer) => ({ key: customer.id, label: customer.business_name || customer.display_name || customer.id, value: points(customer.available_points) + ' pts' }))} /><DashboardList title="Most redeemed rewards" rows={topRewards.map((reward) => ({ key: reward.id, label: reward.reward_name || reward.sku_name || reward.sku_id, value: points(reward.redemption_count) + 'x' }))} /></section><section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Expiry watch</p><h3>Points expiry</h3></div><span className="notification-count">Next 30 hari</span></div>{expiring.length ? expiring.map((customer) => <div className="admin-list-line" key={customer.id}><span>{customer.business_name || customer.display_name || customer.email || customer.id}<small>{customer.next_expiry_at ? new Date(customer.next_expiry_at).toLocaleDateString('id-ID') : '-'}</small></span><strong>{points(customer.expiring_points ?? 0)} pts</strong></div>) : <p className="admin-help-copy">Belum ada points yang expire dalam 30 hari.</p>}</section></>;
}

function DashboardList({ title, rows }: { title: string; rows: Array<{ key: string; label: string; value: string }> }) { return <section className="admin-panel"><div className="panel-heading"><h3>{title}</h3></div>{rows.length ? rows.map((row) => <div className="admin-list-line" key={row.key}><span>{row.label}</span><strong>{row.value}</strong></div>) : <p className="admin-empty-copy">Belum ada data.</p>}</section>; }

function Activity({ dashboard }: { dashboard: AdminDashboard }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [entity, setEntity] = useState('all');
  const [action, setAction] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const entities = useMemo(() => Array.from(new Set(dashboard.auditLogs.map((row) => row.entity_type))).sort(), [dashboard.auditLogs]);
  const actions = useMemo(() => Array.from(new Set(dashboard.auditLogs.map((row) => row.action))).sort(), [dashboard.auditLogs]);
  const rows = useMemo(() => dashboard.auditLogs.filter((row) => {
    const text = [row.action, row.entity_type, row.entity_id, row.actor_id, JSON.stringify(row.old_value), JSON.stringify(row.new_value)].filter(Boolean).join(' ').toLowerCase();
    return text.includes(debounced) && (entity === 'all' || row.entity_type === entity) && (action === 'all' || row.action === action);
  }).sort((a, b) => sort === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)), [dashboard.auditLogs, debounced, entity, action, sort]);
  return <section className={'admin-panel'}><div className={'panel-heading'}><div><p className={'eyebrow'}>Admin audit trail</p><h3>Activity</h3></div><span className={'notification-count'}>{rows.length} of {dashboard.auditLogs.length} events</span></div>
    <div className="admin-table-controls"><label className="admin-table-search-label">Search<input className={'admin-table-search'} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={'Action, entity, actor, atau perubahan'} /></label><label>Entity<select value={entity} onChange={(event) => { setEntity(event.target.value); setPage(0); }}><option value="all">Semua entity</option>{entities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Action<select value={action} onChange={(event) => { setAction(event.target.value); setPage(0); }}><option value="all">Semua action</option>{actions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Urutkan<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}><option value="newest">Terbaru</option><option value="oldest">Terlama</option></select></label></div>
    <div className="admin-data-table audit-table"><div className="admin-data-head"><span>Tanggal</span><span>Action</span><span>Entity</span><span>Actor</span><span>Perubahan lama</span><span>Perubahan baru</span></div>{rows.slice(page * 10, page * 10 + 10).map((row) => <div className="admin-data-row" key={row.id}><span>{new Date(row.created_at).toLocaleString('id-ID')}</span><span>{row.action}</span><span>{row.entity_type}<small>{row.entity_id || '-'}</small></span><span>{row.actor_id || 'System'}</span><span><code>{row.old_value ? JSON.stringify(row.old_value) : '-'}</code></span><span><code>{row.new_value ? JSON.stringify(row.new_value) : '-'}</code></span></div>)}</div>
    {!rows.length && <p className={'admin-empty-copy'}>Belum ada activity audit yang cocok.</p>}<Pager page={page} total={rows.length} onPage={setPage} /></section>;
}
function CustomersEnhanced({ dashboard, canOrders, canPricing }: { dashboard: AdminDashboard; canOrders: boolean; canPricing: boolean }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [tier, setTier] = useState('all');
  const [status, setStatus] = useState('all');
  const [override, setOverride] = useState('all');
  const [pointMin, setPointMin] = useState('');
  const [pointMax, setPointMax] = useState('');
  const [lifetimeMin, setLifetimeMin] = useState('');
  const [lifetimeMax, setLifetimeMax] = useState('');
  const [rollingMin, setRollingMin] = useState('');
  const [rollingMax, setRollingMax] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(dashboard.customers[0]?.id ?? null);
  const inRange = (value: number, minimum: string, maximum: string) => (!minimum || value >= Number(minimum)) && (!maximum || value <= Number(maximum));
  const rows = useMemo(() => dashboard.customers.filter((customer) => {
    const text = [customer.display_name, customer.business_name, customer.email, customer.phone, customer.whatsapp, customer.id].filter(Boolean).join(' ').toLowerCase();
    return text.includes(debounced)
      && (tier === 'all' || customer.customer_tier_id === tier)
      && (status === 'all' || customer.status === status)
      && (override === 'all' || (override === 'yes' ? customer.manual_tier_override_enabled : !customer.manual_tier_override_enabled))
      && inRange(customer.available_points, pointMin, pointMax)
      && inRange(customer.lifetime_paid_amount_idr, lifetimeMin, lifetimeMax)
      && inRange(customer.rolling_spend_idr ?? 0, rollingMin, rollingMax);
  }).sort((a, b) => {
    if (sort === 'name') return (a.business_name || a.display_name || '').localeCompare(b.business_name || b.display_name || '');
    if (sort === 'rolling') return (b.rolling_spend_idr ?? 0) - (a.rolling_spend_idr ?? 0);
    if (sort === 'lifetime') return b.lifetime_paid_amount_idr - a.lifetime_paid_amount_idr;
    if (sort === 'points') return b.available_points - a.available_points;
    if (sort === 'orders') return b.paid_order_count - a.paid_order_count;
    if (sort === 'last') return (b.last_order_at ?? '').localeCompare(a.last_order_at ?? '');
    if (sort === 'oldest') return a.created_at.localeCompare(b.created_at);
    return b.created_at.localeCompare(a.created_at);
  }), [dashboard.customers, debounced, tier, status, override, pointMin, pointMax, lifetimeMin, lifetimeMax, rollingMin, rollingMax, sort]);
  const selected = dashboard.customers.find((customer) => customer.id === selectedId) ?? null;
  const resetPage = () => setPage(0);
  return <><section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Customer management</p><h3>Customer table</h3></div><span className="notification-count">Search debounce 300ms</span></div>
    <div className="admin-table-controls customer-table-controls">
      <label className="admin-table-search-label">Search<input className="admin-table-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Nama, company, WhatsApp, email, atau ID" /></label>
      <label>Tier<select value={tier} onChange={(event) => { setTier(event.target.value); resetPage(); }}><option value="all">Semua tier</option>{dashboard.customerTiers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}><option value="all">Semua status</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="suspended">Suspended</option><option value="rejected">Rejected</option></select></label>
      <label>Override<select value={override} onChange={(event) => { setOverride(event.target.value); resetPage(); }}><option value="all">Override: semua</option><option value="yes">Override aktif</option><option value="no">Auto tier</option></select></label>
      <label>Points min<input inputMode="numeric" value={pointMin} onChange={(event) => { setPointMin(event.target.value); resetPage(); }} placeholder="0" /></label>
      <label>Points max<input inputMode="numeric" value={pointMax} onChange={(event) => { setPointMax(event.target.value); resetPage(); }} placeholder="∞" /></label>
      <label>Rolling min<input inputMode="numeric" value={rollingMin} onChange={(event) => { setRollingMin(event.target.value.replace(/[^0-9]/g, '')); resetPage(); }} placeholder="0" /></label>
      <label>Rolling max<input inputMode="numeric" value={rollingMax} onChange={(event) => { setRollingMax(event.target.value.replace(/[^0-9]/g, '')); resetPage(); }} placeholder="∞" /></label>
      <label>Lifetime min<input inputMode="numeric" value={lifetimeMin} onChange={(event) => { setLifetimeMin(event.target.value.replace(/[^0-9]/g, '')); resetPage(); }} placeholder="0" /></label>
      <label>Lifetime max<input inputMode="numeric" value={lifetimeMax} onChange={(event) => { setLifetimeMax(event.target.value.replace(/[^0-9]/g, '')); resetPage(); }} placeholder="∞" /></label>
      <label>Sort<select value={sort} onChange={(event) => { setSort(event.target.value); resetPage(); }}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="name">Nama</option><option value="rolling">Rolling spend</option><option value="lifetime">Lifetime spend</option><option value="points">Points</option><option value="orders">Total orders</option><option value="last">Last order</option></select></label>
    </div>
    <div className="admin-data-table customer-table"><div className="admin-data-head"><span>Customer</span><span>Company</span><span>WhatsApp</span><span>Tier</span><span>Rolling spend</span><span>Lifetime spend</span><span>Points</span><span>Orders</span><span>Last order</span><span>Status</span><span>Actions</span></div>
      {rows.slice(page * 10, page * 10 + 10).map((customer) => <button type="button" className={`admin-data-row${customer.id === selectedId ? ' is-selected' : ''}`} key={customer.id} onClick={() => setSelectedId(customer.id)}>
        <span><strong>{customer.display_name || 'Tanpa nama'}</strong><small>{customer.email || customer.id}</small></span>
        <span>{customer.business_name || '-'}</span>
        <span>{customer.whatsapp || customer.phone || '-'}</span>
        <span><strong>{dashboard.customerTiers.find((item) => item.id === customer.customer_tier_id)?.name ?? 'Basic'}</strong>{customer.manual_tier_override_enabled ? <small>Override aktif</small> : null}</span>
        <span>{money(customer.rolling_spend_idr ?? 0)}</span>
        <span>{money(customer.lifetime_paid_amount_idr)}</span>
        <span>{points(customer.available_points)} pts{customer.expiring_points ? <small>{points(customer.expiring_points)} expiring</small> : null}</span>
        <span>{customer.paid_order_count}</span>
        <span>{customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString('id-ID') : '-'}</span>
        <span>{customer.status}</span>
        <span>Detail -&gt;</span>
      </button>)}
    </div>
    {!rows.length && <p className="admin-empty-copy">Tidak ada customer yang cocok dengan filter.</p>}
    <Pager page={page} total={rows.length} onPage={setPage} />
  </section>{selected && <CustomerDetail customer={selected} tier={dashboard.customerTiers.find((item) => item.id === selected.customer_tier_id)} dashboard={dashboard} canOrders={canOrders} canPricing={canPricing} />}</>;
}
function Customers({ dashboard, canOrders, canPricing }: { dashboard: AdminDashboard; canOrders: boolean; canPricing: boolean }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(dashboard.customers[0]?.id ?? null);
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim().toLowerCase()), 300); return () => window.clearTimeout(timer); }, [query]);
  const customers = useMemo(() => dashboard.customers.filter((customer) => `${customer.display_name ?? ''} ${customer.business_name ?? ''} ${customer.phone ?? ''} ${customer.whatsapp ?? ''} ${customer.id}`.toLowerCase().includes(debounced) && (tierFilter === 'all' || customer.customer_tier_id === tierFilter) && (statusFilter === 'all' || customer.status === statusFilter)).sort((a, b) => sort === 'spend' ? b.lifetime_paid_amount_idr - a.lifetime_paid_amount_idr : sort === 'points' ? b.available_points - a.available_points : sort === 'name' ? (a.business_name || a.display_name || '').localeCompare(b.business_name || b.display_name || '') : sort === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)), [dashboard.customers, debounced, tierFilter, statusFilter, sort]);
  const selected = dashboard.customers.find((customer) => customer.id === selectedId) ?? null;
  const selectedTier = dashboard.customerTiers.find((tier) => tier.id === selected?.customer_tier_id);
  return <>
    <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Customer management</p><h3>Customer aktif</h3></div><span className="notification-count">Search debounce 300ms</span></div><input className="admin-table-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, business, atau nomor HP" /><div className="admin-data-table"><div className="admin-data-head"><span>Customer</span><span>Tier</span><span>Rolling / lifetime</span><span>Points</span><span></span></div>{customers.map((customer) => { const tier = dashboard.customerTiers.find((item) => item.id === customer.customer_tier_id); return <button type="button" className={`admin-data-row${customer.id === selectedId ? ' is-selected' : ''}`} key={customer.id} onClick={() => setSelectedId(customer.id)}><span><strong>{customer.display_name || 'Tanpa nama'}</strong><small>{customer.business_name || customer.phone || customer.id}</small></span><span>{tier?.name ?? 'Basic'}</span><span>{money(customer.lifetime_paid_amount_idr)}<small>{customer.paid_order_count} paid order</small></span><span>{points(customer.available_points)} pts</span><span>Detail →</span></button>; })}</div>{customers.length === 0 && <p className="admin-help-copy">Belum ada customer yang cocok.</p>}</section>
    {selected && <CustomerDetail customer={selected} tier={selectedTier} dashboard={dashboard} canOrders={canOrders} canPricing={canPricing} />}
  </>;
}

function CustomerDetail({ customer, tier, dashboard, canOrders, canPricing }: { customer: AdminDashboard['customers'][number]; tier: AdminDashboard['customerTiers'][number] | undefined; dashboard: AdminDashboard; canOrders: boolean; canPricing: boolean }) {
  const [overrideState, overrideAction, overridePending] = useActionState(saveCustomerOverride, initial);
  const [adjustState, adjustAction, adjustPending] = useActionState(adjustCustomerPoints, initial);
  const [detailTab, setDetailTab] = useState<'overview' | 'orders' | 'points' | 'redemptions' | 'packages' | 'activity'>('overview');
  const customerLedger = dashboard.pointTransactions.filter((row) => row.customer_id === customer.id);
  const customerOrders = dashboard.orders.filter((row) => row.customer_id === customer.id);
  const customerRedemptions = dashboard.redemptions.filter((row) => row.customer_id === customer.id);
  const customerAudit = dashboard.auditLogs.filter((row) => row.entity_id === customer.id);
  const next = dashboard.customerTiers.filter((item) => item.is_active && item.minimum_rolling_spend_idr > (customer.rolling_spend_idr ?? 0)).sort((a, b) => a.minimum_rolling_spend_idr - b.minimum_rolling_spend_idr)[0];
  const now = Date.now();
  const eligiblePackages = dashboard.packages.filter((item) => {
    if (item.status !== 'published' || (item.starts_at && new Date(item.starts_at).getTime() > now) || (item.ends_at && new Date(item.ends_at).getTime() <= now)) return false;
    const rules = dashboard.packageEligibility.filter((rule) => rule.package_id === item.id);
    return rules.length === 0 || rules.some((rule) => (!rule.customer_id || rule.customer_id === customer.id) && (!rule.customer_tier_id || rule.customer_tier_id === customer.customer_tier_id));
  });
  const tabs = [
    ['overview', 'Overview'],
    ['orders', 'Orders'],
    ['points', 'Loyalty points'],
    ['redemptions', 'Redemptions'],
    ['packages', 'Eligible packages'],
    ['activity', 'Activity'],
  ] as const;
  return <section className="admin-panel customer-detail-panel">
    <div className="panel-heading"><div><p className="eyebrow">Customer detail</p><h3>{customer.business_name || customer.display_name || 'Customer'}</h3><small>{customer.email || customer.whatsapp || customer.phone || customer.id}</small></div><span className="status-pill status-live">{tier?.name ?? 'Basic'}</span></div>
    <div className="customer-detail-tabs" role="tablist" aria-label="Customer detail sections">{tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={detailTab === value} className={detailTab === value ? 'is-active' : ''} onClick={() => setDetailTab(value)}>{label}{value === 'orders' ? ' (' + customerOrders.length + ')' : value === 'points' ? ' (' + points(customer.available_points) + ' pts)' : value === 'redemptions' ? ' (' + customerRedemptions.length + ')' : ''}</button>)}</div>
    {detailTab === 'overview' && <><div className="customer-detail-grid"><div><strong>Tier efektif</strong><b>{tier?.name ?? 'Basic'}</b><small>{next ? money(Math.max(0, next.minimum_rolling_spend_idr - (customer.rolling_spend_idr ?? 0))) + ' lagi ke ' + next.name : 'Tier tertinggi'}</small></div><div><strong>Rolling spend</strong><b>{money(customer.rolling_spend_idr ?? 0)}</b><small>Lifetime {money(customer.lifetime_paid_amount_idr)} &middot; AOV {money(customer.average_order_value_idr ?? 0)}</small></div><div><strong>Points</strong><b>{points(customer.available_points)}</b><small>Earned {points(customer.lifetime_earned_points)} &middot; Redeemed {points(customer.lifetime_redeemed_points)} &middot; Expiring {points(customer.expiring_points ?? 0)}{customer.next_expiry_at ? ' &middot; ' + new Date(customer.next_expiry_at).toLocaleDateString('id-ID') : ''}</small></div><div><strong>Last redemption</strong><b>{customer.last_redemption_at ? new Date(customer.last_redemption_at).toLocaleDateString('id-ID') : '-'}</b><small>{customer.address || 'Alamat belum diisi'}</small></div></div>{canOrders && <form className="admin-inline-form" action={overrideAction}><input type="hidden" name="customer_id" value={customer.id} /><label>Manual tier override<select name="manual_tier_id" defaultValue={customer.customer_tier_id ?? ''}>{dashboard.customerTiers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="admin-check"><input type="checkbox" name="manual_tier_override_enabled" defaultChecked={customer.manual_tier_override_enabled} /> Aktif</label><label>Alasan<input name="manual_tier_reason" required={customer.manual_tier_override_enabled} defaultValue={customer.manual_tier_reason ?? ''} placeholder="Alasan override" /></label><label>Berlaku sampai<input name="manual_tier_expires_at" type="datetime-local" defaultValue={customer.manual_tier_expires_at ? new Date(customer.manual_tier_expires_at).toISOString().slice(0, 16) : ''} /></label><button className="button button-outline" disabled={overridePending}>Simpan tier</button><ActionMessage state={overrideState} /></form>}{canPricing && <form className="admin-inline-form" action={adjustAction}><input type="hidden" name="customer_id" value={customer.id} /><label>Adjustment points<input name="points" type="number" placeholder="+100 / -50" /></label><label>Alasan<input name="reason" required placeholder="Kompensasi order" /></label><label>Referensi<input name="reference" placeholder="Order / tiket" /></label><button className="button button-dark" disabled={adjustPending}>Catat adjustment</button><ActionMessage state={adjustState} /></form>}</>}
    {detailTab === 'orders' && <div className="customer-detail-table-wrap">{customerOrders.length ? <div className="admin-data-table customer-detail-table"><div className="admin-data-head"><span>Order</span><span>Status</span><span>Pembayaran</span><span>Total</span><span>Tanggal</span></div>{customerOrders.map((row) => <div className="admin-data-row" key={row.id}><span><strong>{row.id}</strong><small>{row.contact_phone || '-'}</small></span><span>{row.status}</span><span>{row.payment_status}</span><span>{money(row.total_idr)}</span><span>{new Date(row.created_at).toLocaleDateString('id-ID')}</span></div>)}</div> : <p className="admin-empty-copy">Customer belum memiliki order.</p>}</div>}
    {detailTab === 'points' && <div className="customer-detail-table-wrap">{customerLedger.length ? <div className="admin-data-table customer-detail-table"><div className="admin-data-head"><span>Tanggal</span><span>Type</span><span>Reference</span><span>Points</span><span>Balance</span></div>{customerLedger.map((row) => <div className="admin-data-row" key={row.id}><span>{new Date(row.created_at).toLocaleDateString('id-ID')}</span><span>{row.entry_type}</span><span><strong>{row.order_id || row.redemption_id || '-'}</strong><small>{row.description}</small></span><span className={row.points_delta >= 0 ? 'action-success' : 'action-error'}>{row.points_delta >= 0 ? '+' : ''}{points(row.points_delta)} pts</span><span>{row.balance_after ?? '-'}</span></div>)}</div> : <p className="admin-empty-copy">Belum ada transaksi points.</p>}</div>}
    {detailTab === 'redemptions' && <div className="customer-detail-table-wrap">{customerRedemptions.length ? <div className="admin-data-table customer-detail-table"><div className="admin-data-head"><span>Tanggal</span><span>Reward SKU</span><span>Qty</span><span>Points</span><span>Status</span></div>{customerRedemptions.map((row) => <div className="admin-data-row" key={row.id}><span>{new Date(row.created_at).toLocaleDateString('id-ID')}</span><span>{row.sku_id || '-'}</span><span>{row.quantity}</span><span>{points(row.points_total ?? row.points_redeemed)} pts</span><span>{row.status}</span></div>)}</div> : <p className="admin-empty-copy">Belum ada redemption.</p>}</div>}
    {detailTab === 'packages' && <div className="customer-detail-table-wrap">{eligiblePackages.length ? <div className="admin-data-table customer-detail-table"><div className="admin-data-head"><span>Package</span><span>Mode</span><span>Kapasitas</span><span>Status</span><span>Catatan</span></div>{eligiblePackages.map((row) => <div className="admin-data-row" key={row.id}><span><strong>{row.title}</strong><small>{row.slug}</small></span><span>{row.selection_mode === 'free_pick' ? 'Free pick' : 'Fixed'}</span><span>{row.selection_capacity ?? '-'}</span><span>Eligible</span><span>Quantity dan minimum order dicek saat checkout.</span></div>)}</div> : <p className="admin-empty-copy">Tidak ada package eligible untuk customer ini.</p>}</div>}
    {detailTab === 'activity' && <div className="customer-detail-table-wrap">{customerAudit.length ? <div className="admin-data-table customer-detail-table"><div className="admin-data-head"><span>Tanggal</span><span>Action</span><span>Entity</span><span>Actor</span><span>Change</span></div>{customerAudit.map((row) => <div className="admin-data-row" key={row.id}><span>{new Date(row.created_at).toLocaleDateString('id-ID')}</span><span>{row.action}</span><span>{row.entity_type}</span><span>{row.actor_id || 'System'}</span><span>{row.new_value ? 'Updated' : 'Created'}</span></div>)}</div> : <p className="admin-empty-copy">Belum ada activity untuk customer ini.</p>}</div>}
  </section>;
}
function Tiers({ dashboard, canEdit }: { dashboard: AdminDashboard; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveCustomerTier, initial);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('minimum');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => dashboard.customerTiers.filter((tier) =>
    `${tier.code} ${tier.name} ${tier.description ?? ''}`.toLowerCase().includes(debounced)
      && (status === 'all' || (status === 'active' ? tier.is_active : !tier.is_active))
  ).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'priority' ? b.priority - a.priority : sort === 'customers' ? dashboard.customers.filter((customer) => customer.customer_tier_id === b.id).length - dashboard.customers.filter((customer) => customer.customer_tier_id === a.id).length : a.minimum_rolling_spend_idr - b.minimum_rolling_spend_idr), [dashboard.customerTiers, dashboard.customers, debounced, status, sort]);
  return <><section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Customer tier rules</p><h3>Buat customer tier</h3></div><span className="notification-count">Rolling spend configurable</span></div><form className="admin-crud-form" action={action}><label>Code<input name="code" required placeholder="VIP_1" disabled={!canEdit} /></label><label>Nama tier<input name="name" required placeholder="VIP 1" disabled={!canEdit} /></label><label>Minimum rolling spend<input name="minimum_rolling_spend_idr" type="number" min="0" required placeholder="2000000" disabled={!canEdit} /></label><label>Maksimum rolling spend<input name="maximum_rolling_spend_idr" type="number" min="0" placeholder="4999999" disabled={!canEdit} /></label><label>Periode bulan<input name="rolling_period_months" type="number" min="1" defaultValue="6" disabled={!canEdit} /></label><label>Point multiplier<input name="point_multiplier" type="number" min="0.01" step="0.01" defaultValue="1" disabled={!canEdit} /></label><label>Prioritas<input name="priority" type="number" min="0" step="1" defaultValue="0" disabled={!canEdit} /><small className="field-help">Jika threshold overlap, angka lebih besar menang.</small></label><label>Deskripsi<input name="description" placeholder="Syarat tier" disabled={!canEdit} /></label><label>Benefit<input name="benefits_description" placeholder="Benefit tier" disabled={!canEdit} /></label><label className="admin-check"><input name="is_active" type="checkbox" defaultChecked disabled={!canEdit} /> Aktif</label><div className="admin-crud-action"><ActionMessage state={state} /><button className="button button-dark" disabled={!canEdit || pending}>Tambah tier</button></div></form></section>
    <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Eligibility rules</p><h3>Tier customer</h3></div><span className="notification-count">{rows.length} tier</span></div>
      <div className="admin-table-controls"><label className="admin-table-search-label">Search<input className="admin-table-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Code, nama, atau deskripsi" /></label><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label><label>Sort<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}><option value="minimum">Minimum spend</option><option value="priority">Prioritas</option><option value="customers">Jumlah customer</option><option value="name">Nama A-Z</option></select></label></div>
      <div className="admin-data-table tier-table"><div className="admin-data-head"><span>Tier</span><span>Min spend</span><span>Max spend</span><span>Multiplier</span><span>Customers</span><span>Status</span><span>Actions</span></div>
        {rows.slice(page * 10, page * 10 + 10).map((tier) => <TierRow key={tier.id} tier={tier} customerCount={dashboard.customers.filter((customer) => customer.customer_tier_id === tier.id).length} canEdit={canEdit} />)}
      </div>
      {!rows.length && <p className="admin-empty-copy">Belum ada tier yang cocok.</p>}
      <Pager page={page} total={rows.length} onPage={setPage} />
    </section></>;
}

function TierRow({ tier, customerCount, canEdit }: { tier: AdminDashboard['customerTiers'][number]; customerCount: number; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveCustomerTier, initial);
  const [archiveState, archiveAction, archivePending] = useActionState(archiveCustomerTier, initial);
  const [editing, setEditing] = useState(false);
  return <div className="tier-editor-record">
    <div className="admin-data-row tier-summary-row"><span><strong>{tier.name}</strong><small>{tier.code} · priority {tier.priority}</small></span><span>{money(tier.minimum_rolling_spend_idr)}</span><span>{tier.maximum_rolling_spend_idr === null ? '∞' : money(tier.maximum_rolling_spend_idr)}</span><span>{tier.point_multiplier}x</span><span>{customerCount}</span><span>{tier.is_active ? 'Aktif' : 'Nonaktif'}</span><span><button className="button button-outline" type="button" onClick={() => setEditing((value) => !value)}>{editing ? 'Tutup' : 'Edit'}</button></span></div>
    {editing && <div className="tier-editor-detail"><form className="admin-crud-form admin-tier-editor-form" action={action}><input type="hidden" name="id" value={tier.id} /><label>Code<input name="code" defaultValue={tier.code} disabled={!canEdit} /></label><label>Nama tier<input name="name" defaultValue={tier.name} disabled={!canEdit} /></label><label>Minimum spend<input name="minimum_rolling_spend_idr" type="number" min="0" defaultValue={tier.minimum_rolling_spend_idr} disabled={!canEdit} /></label><label>Maksimum spend<input name="maximum_rolling_spend_idr" type="number" min="0" defaultValue={tier.maximum_rolling_spend_idr ?? ''} disabled={!canEdit} /></label><label>Periode bulan<input name="rolling_period_months" type="number" min="1" defaultValue={tier.rolling_period_months} disabled={!canEdit} /></label><label>Multiplier<input name="point_multiplier" type="number" min="0.01" step="0.01" defaultValue={tier.point_multiplier} disabled={!canEdit} /></label><label>Prioritas<input name="priority" type="number" min="0" defaultValue={tier.priority} disabled={!canEdit} /></label><label>Deskripsi<input name="description" defaultValue={tier.description ?? ''} disabled={!canEdit} /></label><label>Benefit<input name="benefits_description" defaultValue={tier.benefits_description ?? ''} disabled={!canEdit} /></label><label className="admin-check"><input name="is_active" type="checkbox" defaultChecked={tier.is_active} disabled={!canEdit} /> Aktif</label><div className="admin-crud-record-foot"><ActionMessage state={state} /><button className="button button-outline" disabled={!canEdit || pending}>{pending ? 'Menyimpan...' : 'Simpan tier'}</button></div></form><form action={archiveAction} onSubmit={(event) => { if (!window.confirm('Arsipkan tier ' + tier.name + '?')) event.preventDefault(); }}><input type="hidden" name="id" value={tier.id} /><button className="text-button danger-button" disabled={!canEdit || archivePending}>{archivePending ? '...' : 'Arsipkan'}</button>{archiveState.message && <small className={archiveState.ok ? 'action-success' : 'action-error'}>{archiveState.message}</small>}</form></div>}
  </div>;
}
function Rewards({ dashboard, canEdit }: { dashboard: AdminDashboard; canEdit: boolean }) { const [state, action, pending] = useActionState(saveReward, initial); return <><section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Free product catalog</p><h3>Tambah reward</h3></div><span className="notification-count">Reward bukan diskon checkout</span></div><form className="admin-crud-form" action={action}><label>SKU reward<select name="sku_id" required>{dashboard.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku} · {sku.name}</option>)}</select></label><label>Nama reward<input name="reward_name" placeholder="Free Base Coat" /></label><label>Point cost<input name="points_cost" type="number" min="1" required /></label><label>HPP<input name="hpp_idr" type="number" min="0" /></label><label>Harga retail<input name="normal_selling_price_idr" type="number" min="0" /></label><label>Minimum tier<select name="minimum_customer_tier_id"><option value="">Semua tier</option>{dashboard.customerTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label><label>Minimum order<input name="minimum_order_value_idr" type="number" min="0" /></label><label>Max qty / redemption<input name="max_redemption_quantity" type="number" min="1" defaultValue="1" /></label><label>Stock (0 = unlimited)<input name="reward_stock" type="number" min="0" defaultValue="0" /></label><label className="admin-check"><input name="is_active" type="checkbox" defaultChecked /> Aktif</label><div className="admin-crud-action"><ActionMessage state={state} /><button className="button button-dark" disabled={!canEdit || pending}>Simpan reward</button></div></form></section><section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Reward catalog</p><h3>Reward tersimpan</h3></div><span className="notification-count">{dashboard.rewards.length} reward</span></div>{dashboard.rewards.map((reward) => <RewardRow key={reward.id} reward={reward} dashboard={dashboard} canEdit={canEdit} />)}</section></>; }

function RewardRow({ reward, dashboard, canEdit }: { reward: AdminDashboard['rewards'][number]; dashboard: AdminDashboard; canEdit: boolean }) { const [state, action, pending] = useActionState(saveReward, initial); const [archiveState, archiveAction, archivePending] = useActionState(archiveReward, initial); const [deleteState, deleteAction, deletePending] = useActionState(deleteReward, initial); return <div className="admin-data-row admin-data-row-form"><form action={action}><input type="hidden" name="id" value={reward.id} /><select name="sku_id" defaultValue={reward.sku_id} disabled={!canEdit}>{dashboard.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku}</option>)}</select><input name="reward_name" defaultValue={reward.reward_name ?? ''} disabled={!canEdit} /><input name="points_cost" type="number" min="1" defaultValue={reward.points_cost} disabled={!canEdit} /><input name="hpp_idr" type="number" min="0" defaultValue={reward.hpp_idr} disabled={!canEdit} /><input name="normal_selling_price_idr" type="number" min="0" defaultValue={reward.normal_selling_price_idr} disabled={!canEdit} /><input name="minimum_order_value_idr" type="number" min="0" defaultValue={reward.minimum_order_value_idr} disabled={!canEdit} /><input name="max_redemption_quantity" type="number" min="1" defaultValue={reward.max_redemption_quantity} disabled={!canEdit} /><input name="reward_stock" type="number" min="0" defaultValue={reward.reward_stock} disabled={!canEdit} /><select name="minimum_customer_tier_id" defaultValue={reward.minimum_customer_tier_id ?? ''} disabled={!canEdit}><option value="">Semua tier</option>{dashboard.customerTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select><input type="hidden" name="is_active" value={reward.is_active ? 'on' : ''} /><button className="button button-outline" disabled={!canEdit || pending}>Simpan</button>{state.message && <small>{state.message}</small>}</form><form action={archiveAction}><input type="hidden" name="id" value={reward.id} /><button className="text-button" disabled={!canEdit || archivePending}>Arsipkan</button>{archiveState.message && <small>{archiveState.message}</small>}</form><form action={deleteAction}><input type="hidden" name="id" value={reward.id} /><input type="hidden" name="sku_id" value={reward.sku_id} /><button className="text-button danger-button" disabled={!canEdit || deletePending}>Hapus</button>{deleteState.message && <small>{deleteState.message}</small>}</form></div>; }

function Redemptions({ dashboard, canEdit }: { dashboard: AdminDashboard; canEdit: boolean }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const customerNames = useMemo(() => new Map(dashboard.customers.map((customer) => [customer.id, customer.business_name || customer.display_name || customer.email || customer.id])), [dashboard.customers]);
  const rows = useMemo(() => dashboard.redemptions.filter((row) => {
    const customerName = customerNames.get(row.customer_id) || '';
    const rewardName = dashboard.rewards.find((reward) => reward.sku_id === row.sku_id)?.reward_name || row.sku_id || '';
    return `${customerName} ${row.customer_id} ${row.order_id} ${rewardName} ${row.sku_id ?? ''} ${row.status}`.toLowerCase().includes(debounced)
      && (status === 'all' || row.status === status);
  }).sort((a, b) => sort === 'points'
    ? Number(b.points_total ?? b.points_redeemed) - Number(a.points_total ?? a.points_redeemed)
    : sort === 'quantity' ? b.quantity - a.quantity
    : sort === 'oldest' ? a.created_at.localeCompare(b.created_at)
    : b.created_at.localeCompare(a.created_at)), [dashboard.redemptions, dashboard.customers, dashboard.rewards, customerNames, debounced, status, sort]);
  return <section className={'admin-panel'}><div className={'panel-heading'}><div><p className={'eyebrow'}>Reward fulfillment</p><h3>Redemptions</h3></div><span className={'notification-count'}>{rows.length} of {dashboard.redemptions.length} redemption</span></div>
    <div className={'admin-table-controls'}><label className="admin-table-search-label">Search<input className={'admin-table-search'} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={'Customer, reward, order, SKU, atau status'} /></label><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value={'all'}>Semua status</option><option value={'pending'}>Pending</option><option value={'applied'}>Applied</option><option value={'confirmed'}>Confirmed</option><option value={'fulfilled'}>Fulfilled</option><option value={'cancelled'}>Cancelled</option><option value={'reversed'}>Reversed</option></select></label><label>Urutkan<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}><option value={'newest'}>Terbaru</option><option value={'oldest'}>Terlama</option><option value={'points'}>Points terbesar</option><option value={'quantity'}>Qty terbesar</option></select></label></div>
    <div className="admin-data-table redemption-table"><div className="admin-data-head"><span>Tanggal</span><span>Customer</span><span>Reward / SKU</span><span>Qty</span><span>Points used</span><span>Order</span><span>Tier</span><span>Status</span><span>Aksi</span></div>
      {rows.slice(page * 10, page * 10 + 10).map((redemption) => <RedemptionRow key={redemption.id} redemption={redemption} canEdit={canEdit} customerName={customerNames.get(redemption.customer_id) || redemption.customer_id} rewardName={dashboard.rewards.find((reward) => reward.sku_id === redemption.sku_id)?.reward_name || redemption.sku_id || '-'} tierName={dashboard.customerTiers.find((tier) => tier.id === dashboard.customers.find((customer) => customer.id === redemption.customer_id)?.customer_tier_id)?.name || 'Basic'} />)}
    </div>
    {!rows.length && <p className={'admin-empty-copy'}>Belum ada redemption yang cocok.</p>}<Pager page={page} total={rows.length} onPage={setPage} />
  </section>;
}

function RedemptionRow({ redemption, canEdit, customerName, rewardName, tierName }: { redemption: AdminDashboard['redemptions'][number]; canEdit: boolean; customerName: string; rewardName: string; tierName: string }) {
  const [state, action, pending] = useActionState(updateRedemptionStatus, initial);
  return <form className="admin-data-row" action={action}>
    <input type="hidden" name="id" value={redemption.id} />
    <span>{new Date(redemption.created_at).toLocaleDateString('id-ID')}</span>
    <span><strong>{customerName}</strong><small>{redemption.customer_id}</small></span>
    <span><strong>{rewardName}</strong><small>{redemption.sku_id || '-'}</small></span>
    <span>{redemption.quantity}</span>
    <span>{points(redemption.points_total ?? redemption.points_redeemed)} pts</span>
    <span>{redemption.order_id}</span>
    <span>{tierName}</span>
    <span><select name="status" defaultValue={redemption.status}><option value="pending">Pending</option><option value="applied">Applied</option><option value="confirmed">Confirmed</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option><option value="reversed">Reversed</option></select></span>
    <span><button className="button button-outline" disabled={!canEdit || pending}>{pending ? '...' : 'Simpan'}</button>{state.message && <small className={state.ok ? 'action-success' : 'action-error'}>{state.message}</small>}</span>
  </form>;
}
function Settings({ dashboard, canEdit }: { dashboard: AdminDashboard; canEdit: boolean }) { const [state, action, pending] = useActionState(saveLoyaltySettings, initial); const settings = dashboard.loyaltySettings; return <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Program configuration</p><h3>Aturan Luminails Points</h3></div><span className="notification-count">Audit wajib</span></div><form className="admin-crud-form" action={action}><label>Rp per 1 point<input name="point_unit_value_idr" type="number" min="1" defaultValue={settings?.point_unit_value_idr ?? 10000} /></label><label>Expiry bulan<input name="expiry_months" type="number" min="1" defaultValue={settings?.expiry_months ?? 12} /></label><label>Warning reward cost %<input name="reward_cost_warning_percent" type="number" min="0" step="0.01" defaultValue={settings?.reward_cost_warning_percent ?? 3} /></label><label>Rolling tier bulan<input name="tier_rolling_period_months" type="number" min="1" defaultValue={settings?.tier_rolling_period_months ?? 6} /></label><label className="admin-check"><input name="automatic_tier_recalculation" type="checkbox" defaultChecked={settings?.automatic_tier_recalculation ?? true} /> Recalculate otomatis</label><label className="admin-check"><input name="allow_manual_point_adjustment" type="checkbox" defaultChecked={settings?.allow_manual_point_adjustment ?? true} /> Allow adjustment</label><label className="admin-check"><input name="require_adjustment_reason" type="checkbox" defaultChecked={settings?.require_adjustment_reason ?? true} /> Wajib alasan</label><div className="admin-crud-action"><ActionMessage state={state} /><button className="button button-dark" disabled={!canEdit || pending}>Simpan settings</button></div></form></section>; }

function Ledger({ dashboard }: { dashboard: AdminDashboard }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [entryType, setEntryType] = useState('all');
  const [customerId, setCustomerId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const customerNames = useMemo(() => new Map(dashboard.customers.map((customer) => [customer.id, customer.business_name || customer.display_name || customer.email || customer.id])), [dashboard.customers]);
  const rows = useMemo(() => dashboard.pointTransactions.filter((row) => {
    const customerName = customerNames.get(row.customer_id) || '';
    const haystack = [customerName, row.customer_id, row.order_id, row.redemption_id, row.entry_type, row.description, row.reference_text].filter(Boolean).join(' ').toLowerCase();
    const rowDate = new Date(row.created_at).getTime();
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : -Infinity;
    const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
    const typeMatch = entryType === 'all' || (entryType === 'adjustment' ? row.entry_type.startsWith('adjustment') : row.entry_type === entryType);
    return haystack.includes(debounced) && typeMatch && (customerId === 'all' || row.customer_id === customerId) && rowDate >= from && rowDate <= to;
  }).sort((a, b) => sort === 'oldest' ? a.created_at.localeCompare(b.created_at) : sort === 'points' ? Math.abs(b.points_delta) - Math.abs(a.points_delta) : sort === 'expiry' ? (a.expires_at || '9999').localeCompare(b.expires_at || '9999') : b.created_at.localeCompare(a.created_at)), [dashboard.pointTransactions, customerNames, debounced, entryType, customerId, dateFrom, dateTo, sort]);
  return <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Immutable audit trail</p><h3>Point ledger</h3></div><span className="notification-count">{rows.length} of {dashboard.pointTransactions.length} entries</span></div><div className="admin-table-controls ledger-controls"><label className="admin-table-search-label">Search<input className="admin-table-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Customer, order, reference, atau deskripsi" /></label><label>Type<select value={entryType} onChange={(event) => { setEntryType(event.target.value); setPage(0); }}><option value="all">Semua type</option><option value="earn">Earn</option><option value="redeem">Redeem</option><option value="reversal">Reversal</option><option value="expired">Expired</option><option value="adjustment">Adjustment</option></select></label><label>Customer<select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setPage(0); }}><option value="all">Semua customer</option>{dashboard.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.business_name || customer.display_name || customer.id}</option>)}</select></label><label>Dari<input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(0); }} /></label><label>Sampai<input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(0); }} /></label><label>Urutkan<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="points">Point terbesar</option><option value="expiry">Expiry terdekat</option></select></label></div><div className="admin-data-table ledger-table"><div className="admin-data-head"><span>Date</span><span>Customer</span><span>Type</span><span>Reference</span><span>Points</span><span>Balance after</span><span>Expiry</span><span>Created by</span></div>{rows.slice(page * 10, page * 10 + 10).map((row) => <div className="admin-data-row" key={row.id}><span>{new Date(row.created_at).toLocaleDateString('id-ID')}</span><span>{customerNames.get(row.customer_id) || row.customer_id}</span><span>{row.entry_type}</span><span><strong>{row.order_id || row.redemption_id || row.reference_text || '-'}</strong><small>{row.description}</small></span><span className={row.points_delta >= 0 ? 'action-success' : 'action-error'}>{row.points_delta >= 0 ? '+' : ''}{points(row.points_delta)} pts</span><span>{row.balance_after ?? '-'}</span><span>{row.expires_at ? new Date(row.expires_at).toLocaleDateString('id-ID') : '-'}</span><span>{row.created_by || 'System'}</span></div>)}</div>{!rows.length && <p className="admin-empty-copy">Tidak ada transaksi points yang cocok.</p>}<Pager page={page} total={rows.length} onPage={setPage} /></section>;
}
