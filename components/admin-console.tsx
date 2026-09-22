'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { markNotificationRead, updateCatalogProduct, updatePricingTier, type AdminActionState } from '../app/admin/actions';
import type { AdminDashboard } from '../lib/admin';
import { PromotionConsole } from './promotion-console';

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function AdminConsole({ dashboard }: { dashboard: AdminDashboard }) {
  const [tab, setTab] = useState<'overview' | 'products' | 'orders' | 'pricing' | 'promotions'>('overview');
  const unread = dashboard.notifications.filter((notification) => !notification.read_at).length;

  if (dashboard.access === 'denied') {
    return <main className="admin-shell"><AdminHeader /><section className="admin-denied"><span className="admin-symbol">Ã—</span><h1>Akses admin belum diberikan.</h1><p>Akun Anda sudah login, tetapi belum ada baris aktif di <code>admin_memberships</code>.</p><Link className="button button-dark" href="/auth?next=/admin">Masuk sebagai staff</Link></section></main>;
  }

  const canEditPricing = dashboard.access === 'granted' && dashboard.role === 'owner';
  const canEditPromotions = dashboard.access === 'granted' && ['owner', 'catalog_manager'].includes(dashboard.role ?? '');
  return <main className="admin-shell"><AdminHeader demo={!dashboard.configured} role={dashboard.role} /><div className="admin-layout"><aside className="admin-sidebar"><p className="eyebrow">Workspace</p>{[['overview', 'Ringkasan'], ['products', 'Produk'], ['orders', 'Transaksi'], ['promotions', 'Promosi'], ['pricing', 'Pricing B2B']].map(([value, label]) => <button key={value} className={`admin-nav-item${tab === value ? ' is-active' : ''}`} onClick={() => setTab(value as typeof tab)}>{label}{value === 'orders' && unread > 0 && <b>{unread}</b>}</button>)}<div className="admin-sidebar-foot"><Link href="/">â† Storefront</Link><span>Role: {dashboard.role ?? 'demo owner'}</span></div></aside><section className="admin-content">{dashboard.access === 'demo' && <div className="demo-banner">Mode preview aktif â€” data di bawah adalah demo. Isi Supabase + login admin untuk menyimpan perubahan nyata.</div>}{tab === 'overview' && <Overview dashboard={dashboard} unread={unread} onNotifications={() => setTab('orders')} />}{tab === 'products' && <Products products={dashboard.products} />}{tab === 'orders' && <Orders orders={dashboard.orders} notifications={dashboard.notifications} />}{tab === 'pricing' && <Pricing tiers={dashboard.pricingTiers} canEdit={canEditPricing} />}{tab === 'promotions' && <PromotionConsole promotions={dashboard.promotions} canEdit={canEditPromotions} />}</section></div></main>;
}

function AdminHeader({ demo, role }: { demo?: boolean; role?: string | null }) {
  return <header className="admin-header"><div><p className="eyebrow">Luminails Operations / Commerce</p><h1>Admin workspace</h1></div><div className="admin-header-actions">{demo && <span className="admin-mode">Preview mode</span>}<span className="admin-user">{role ?? 'staff'} <i></i></span></div></header>;
}

function Overview({ dashboard, unread, onNotifications }: { dashboard: AdminDashboard; unread: number; onNotifications: () => void }) {
  return <><div className="admin-page-heading"><div><p className="eyebrow">Selasa, 22 September 2026</p><h2>Halo, team.</h2></div><button className="button button-dark" onClick={onNotifications}>Buka notifikasi {unread > 0 && `(${unread})`} <span>â†—</span></button></div><div className="admin-stat-grid"><Stat label="Order baru" value={String(dashboard.orders.filter((order) => order.status === 'submitted_for_review').length).padStart(2, '0')} note="menunggu review" tone="coral" /><Stat label="Transaksi masuk" value={money(dashboard.orders.reduce((sum, order) => sum + order.total_idr, 0))} note="data periode ini" tone="lilac" /><Stat label="Produk live" value={String(dashboard.products.filter((product) => product.is_published).length).padStart(2, '0')} note="siap dilihat user" tone="sage" /></div><div className="admin-panels"><div className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Order queue</p><h3>Yang perlu dilihat</h3></div><button className="underlined-link" onClick={onNotifications}>Lihat semua <span>â†—</span></button></div>{dashboard.orders.slice(0, 4).map((order) => <OrderRow key={order.id} order={order} />)}</div><div className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Inbox</p><h3>Notifikasi</h3></div><span className="notification-count">{unread} belum dibaca</span></div>{dashboard.notifications.slice(0, 4).map((notification) => <div className={`notification-row${notification.read_at ? '' : ' is-unread'}`} key={notification.id}><span className="notification-dot"></span><div><b>{notification.title}</b><p>{notification.body}</p></div><small>{date(notification.created_at)}</small></div>)}</div></div></>;
}

function Products({ products }: { products: AdminDashboard['products'] }) {
  return <><div className="admin-page-heading"><div><p className="eyebrow">Catalog manager</p><h2>Update barang.</h2></div><button className="button button-dark" disabled>Tambah produk <span>+</span></button></div><div className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Storefront catalog</p><h3>Produk yang terbit</h3></div><span className="notification-count">{products.length} produk</span></div>{products.map((product) => <ProductEditor key={product.id} product={product} />)}</div></>;
}

function ProductEditor({ product }: { product: AdminDashboard['products'][number] }) {
  const initialState: AdminActionState = { ok: false, message: '' };
  const [state, formAction, pending] = useActionState(updateCatalogProduct, initialState);
  return <form className="product-editor" action={formAction}><input type="hidden" name="product_id" value={product.id} /><div className="product-editor-art"><span>{product.category.slice(0, 2).toUpperCase()}</span></div><div className="product-editor-fields"><label>Nama produk<input name="name" defaultValue={product.name} /></label><label>Kategori<input name="category" defaultValue={product.category} /></label><label className="switch-label"><input name="is_published" type="checkbox" defaultChecked={product.is_published} /> Tampil di storefront</label>{state.message && <small className={state.ok ? 'action-success' : 'action-error'}>{state.message}</small>}</div><button className="icon-button" type="submit" disabled={pending} aria-label={`Simpan ${product.name}`}>{pending ? 'â€¦' : 'â†—'}</button></form>;
}

function Orders({ orders, notifications }: { orders: AdminDashboard['orders']; notifications: AdminDashboard['notifications'] }) {
  return <><div className="admin-page-heading"><div><p className="eyebrow">Commerce queue</p><h2>Transaksi masuk.</h2></div><span className="admin-live-pill"><i></i> Inbox aktif</span></div><div className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Order terbaru</p><h3>Review sebelum fulfillment</h3></div></div>{orders.map((order) => <OrderRow key={order.id} order={order} expanded />)}</div><div className="admin-panel notifications-panel"><div className="panel-heading"><div><p className="eyebrow">Admin inbox</p><h3>Notifikasi masuk</h3></div></div>{notifications.map((notification) => <NotificationAction key={notification.id} notification={notification} />)}</div></>;
}

function NotificationAction({ notification }: { notification: AdminDashboard['notifications'][number] }) {
  const [pending, setPending] = useState(false);
  async function markRead() { setPending(true); await markNotificationRead(notification.id); setPending(false); }
  return <div className={`notification-row${notification.read_at ? '' : ' is-unread'}`}><span className="notification-dot"></span><div><b>{notification.title}</b><p>{notification.body}</p></div><div className="notification-action"><small>{date(notification.created_at)}</small>{!notification.read_at && <button onClick={markRead} disabled={pending}>Tandai terbaca</button>}</div></div>;
}

function OrderRow({ order, expanded }: { order: AdminDashboard['orders'][number]; expanded?: boolean }) {
  return <div className={`order-row${expanded ? ' order-row-expanded' : ''}`}><div><b>{order.id.slice(0, 14)}</b><small>{date(order.created_at)}</small></div><span className={`status-pill status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span><span className="payment-copy">{order.payment_status === 'paid' ? 'Sudah dibayar' : 'Belum dibayar'}</span><strong>{money(order.total_idr)}</strong>{expanded && <button className="underlined-link">Buka detail <span>â†—</span></button>}</div>;
}

function Pricing({ tiers, canEdit }: { tiers: AdminDashboard['pricingTiers']; canEdit: boolean }) {
  const premiumTier = tiers.find((tier) => tier.price_visibility === 'premium_b2b');
  return <><div className="admin-page-heading"><div><p className="eyebrow">Pricing rules</p><h2>Harga yang bertumbuh.</h2></div><span className="admin-live-pill">Configurable</span></div><div className="pricing-callout"><div><span className="pricing-icon">âœ¦</span><h3>User biasa â†’ Premium B2B</h3><p>Tier premium dihitung dari paid order yang sudah settle, bukan dari klaim user. Owner dapat mengubah threshold di bawah.</p></div>{premiumTier && <div className="threshold-box"><small>{premiumTier.is_active ? 'Threshold aktif' : 'Tier nonaktif'}</small><strong>{money(premiumTier.minimum_lifetime_spend_idr)}</strong><span>+ {premiumTier.minimum_paid_order_count} order sukses</span></div>}</div><div className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Eligibility</p><h3>Aturan tier saat ini</h3></div><span className="notification-count">{canEdit ? 'Owner editable' : 'Read only'}</span></div>{tiers.map((tier) => <PricingTierEditor key={tier.id} tier={tier} canEdit={canEdit} />)}</div></>;
}

function PricingTierEditor({ tier, canEdit }: { tier: AdminDashboard['pricingTiers'][number]; canEdit: boolean }) {
  const initialState: AdminActionState = { ok: false, message: '' };
  const [state, formAction, pending] = useActionState(updatePricingTier, initialState);
  return <form className={`tier-row${tier.price_visibility === 'premium_b2b' ? ' tier-premium' : ''}`} action={formAction}><input type="hidden" name="tier_id" value={tier.id} /><div className="tier-identity"><b>{tier.code}</b><span>{tier.price_visibility === 'premium_b2b' ? 'Setelah threshold tercapai' : 'Semua user baru'}</span></div><label>Nama tier<input name="name" defaultValue={tier.name} disabled={!canEdit} /></label><label>Minimum belanja (IDR)<input name="minimum_lifetime_spend_idr" type="number" min="0" step="1" defaultValue={tier.minimum_lifetime_spend_idr} disabled={!canEdit} /></label><label>Minimum order paid<input name="minimum_paid_order_count" type="number" min="0" step="1" defaultValue={tier.minimum_paid_order_count} disabled={!canEdit} /></label><label className="switch-label"><input name="is_active" type="checkbox" defaultChecked={tier.is_active} disabled={!canEdit} /> Aktif</label><div className="tier-action">{state.message && <small className={state.ok ? 'action-success' : 'action-error'}>{state.message}</small>}{canEdit && <button className="icon-button" type="submit" disabled={pending} aria-label={`Simpan ${tier.code}`}>{pending ? 'â€¦' : 'â†—'}</button>}</div></form>;
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) { return <div className={`admin-stat admin-stat-${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
