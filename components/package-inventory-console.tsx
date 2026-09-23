'use client';

import { useActionState } from 'react';
import {
  addPackageItem,
  createBrand,
  createInventoryStock,
  createPackage,
  deleteInventoryStock,
  deletePackageItem,
  deletePackage,
  updateInventoryStock,
  updatePackage,
  updateWhatsappSettings,
  type AdminActionState,
} from '../app/admin/actions';
import type { AdminBrand, AdminInventoryLocation, AdminInventoryStock, AdminPackage, AdminPackageItem, AdminSku, AdminWhatsappSettings } from '../lib/admin';

const initialState: AdminActionState = { ok: false, message: '' };
const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

export function AdminPackageConsole({ brands, packages, packageItems, skus, canEdit }: { brands: AdminBrand[]; packages: AdminPackage[]; packageItems: AdminPackageItem[]; skus: AdminSku[]; canEdit: boolean }) {
  const [brandState, brandAction, brandPending] = useActionState(createBrand, initialState);
  const [packageState, packageAction, packagePending] = useActionState(createPackage, initialState);

  return (
    <div className="admin-crud-stack">
      <div className="admin-page-heading"><div><p className="eyebrow">Package studio</p><h2>Packages</h2></div><span className="notification-count">{packages.length} package · {brands.length} brand</span></div>
      <div className="admin-crud-grid">
        <section className="admin-panel">
          <div className="panel-heading"><div><p className="eyebrow">Brand library</p><h3>Tambah brand</h3></div></div>
          <form className="admin-crud-form" action={brandAction}>
            <label>Nama brand<input name="name" placeholder="PARTY!" disabled={!canEdit} required /></label>
            <label>Slug<input name="slug" placeholder="party" disabled={!canEdit} required /></label>
            <label>Tagline<input name="tagline" placeholder="Colour, edited." disabled={!canEdit} /></label>
            <label>Tone<select name="visual_tone" defaultValue="clay" disabled={!canEdit}><option value="clay">Clay</option><option value="ivory">Ivory</option><option value="plum">Plum</option><option value="champagne">Champagne</option></select></label>
            <label className="admin-check"><input name="is_published" type="checkbox" disabled={!canEdit} /> Tampilkan ke customer</label>
            <ActionFoot state={brandState} pending={brandPending} label="Tambah brand" disabled={!canEdit} />
          </form>
        </section>
        <section className="admin-panel">
          <div className="panel-heading"><div><p className="eyebrow">Package catalog</p><h3>Tambah package</h3></div></div>
          {brands.length === 0 ? <p className="admin-empty-copy">Buat brand terlebih dahulu sebelum membuat package.</p> : <form className="admin-crud-form" action={packageAction}>
            <label>Brand<select name="brand_id" disabled={!canEdit} required>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <label>Judul package<input name="title" placeholder="Home Studio Starter" disabled={!canEdit} required /></label>
            <label>Slug<input name="slug" placeholder="party-home-studio-starter" disabled={!canEdit} required /></label>
            <label>Audience<select name="audience" defaultValue="home-studio" disabled={!canEdit}><option value="home-studio">Home studio</option><option value="salon">Salon</option><option value="restock">Restock</option></select></label>
            <label>Harga standard (IDR)<input name="price_idr" type="number" min="0" step="1" placeholder="1295000" disabled={!canEdit} required /></label>
            <label>Harga pembanding (IDR)<input name="compare_at_price_idr" type="number" min="0" step="1" placeholder="1510000" disabled={!canEdit} /></label>
            <label className="admin-crud-wide">Deskripsi<textarea name="description" rows={3} placeholder="Sistem lengkap untuk studio..." disabled={!canEdit} required /></label>
            <label>Status<select name="status" defaultValue="draft" disabled={!canEdit}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
            <label>Tone<select name="visual_tone" defaultValue="clay" disabled={!canEdit}><option value="clay">Clay</option><option value="ivory">Ivory</option><option value="plum">Plum</option></select></label>
            <ActionFoot state={packageState} pending={packagePending} label="Buat package" disabled={!canEdit} />
          </form>}
        </section>
      </div>
      <section className="admin-panel">
        <div className="panel-heading"><div><p className="eyebrow">Live catalog records</p><h3>Kelola package</h3></div><span className="notification-count">Harga IDR</span></div>
        {packages.length === 0 ? <p className="admin-empty-copy">Belum ada package di database. Buat package pertama di panel atas.</p> : packages.map((item) => <PackageRow key={item.id} item={item} brands={brands} packageItems={packageItems.filter((packageItem) => packageItem.package_id === item.id)} skus={skus} canEdit={canEdit} />)}
      </section>
    </div>
  );
}

function PackageRow({ item, brands, packageItems, skus, canEdit }: { item: AdminPackage; brands: AdminBrand[]; packageItems: AdminPackageItem[]; skus: AdminSku[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updatePackage, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePackage, initialState);
  return (
    <div className="admin-crud-record">
      <form className="admin-crud-form admin-crud-row-form" action={action}>
        <input type="hidden" name="package_id" value={item.id} />
        <label>Brand<select name="brand_id" defaultValue={item.brand_id} disabled={!canEdit}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
        <label>Judul<input name="title" defaultValue={item.title} disabled={!canEdit} /></label>
        <label>Slug<input name="slug" defaultValue={item.slug} disabled={!canEdit} /></label>
        <label>Audience<select name="audience" defaultValue={item.audience} disabled={!canEdit}><option value="home-studio">Home studio</option><option value="salon">Salon</option><option value="restock">Restock</option></select></label>
        <label>Harga<input name="price_idr" type="number" min="0" defaultValue={item.price_idr} disabled={!canEdit} /></label>
        <label>Status<select name="status" defaultValue={item.status} disabled={!canEdit}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        <label className="admin-crud-wide">Deskripsi<textarea name="description" rows={2} defaultValue={item.description} disabled={!canEdit} /></label>
        <input type="hidden" name="compare_at_price_idr" value={item.compare_at_price_idr ?? ''} />
        <input type="hidden" name="long_description" value={item.long_description ?? ''} />
        <input type="hidden" name="badge" value={item.badge ?? ''} />
        <input type="hidden" name="delivery_note" value={item.delivery_note ?? ''} />
        <input type="hidden" name="sort_order" value={item.sort_order} />
        <input type="hidden" name="visual_tone" value={item.visual_tone} />
        <div className="admin-crud-record-foot"><small>{item.brand_name} · {money(item.price_idr)} · {item.status}</small><span>{state.message || deleteState.message}</span><button className="button button-dark" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Simpan'}</button></div>
      </form>
      <form action={deleteAction} className="admin-crud-delete"><input type="hidden" name="package_id" value={item.id} /><button className="text-button" type="submit" disabled={!canEdit || deletePending}>{deletePending ? '...' : 'Hapus package'}</button></form>
      <PackageItemsEditor packageId={item.id} packageItems={packageItems} skus={skus} canEdit={canEdit} />
    </div>
  );
}

function PackageItemsEditor({ packageId, packageItems, skus, canEdit }: { packageId: string; packageItems: AdminPackageItem[]; skus: AdminSku[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(addPackageItem, initialState);
  return (
    <div className="package-items-editor">
      <div className="package-items-heading"><span>Isi package</span><small>{packageItems.length} item</small></div>
      {packageItems.map((item) => <PackageItemRow key={item.id} item={item} canEdit={canEdit} />)}
      {skus.length === 0 ? <small className="admin-empty-copy">Belum ada SKU aktif untuk dipilih.</small> : <form className="admin-crud-inline-form package-item-form" action={action}>
        <input type="hidden" name="package_id" value={packageId} />
        <label>SKU<select name="sku_id" disabled={!canEdit}>{skus.filter((sku) => sku.is_active).map((sku) => <option key={sku.id} value={sku.id}>{sku.sku} · {sku.name}</option>)}</select></label>
        <label>Qty<input name="quantity" type="number" min="1" step="1" defaultValue="1" disabled={!canEdit} /></label>
        <label>Catatan<input name="item_note" placeholder="Prep dan adhesion support" disabled={!canEdit} /></label>
        <div className="admin-crud-record-foot"><span>{state.message || 'Tambahkan item ke package.'}</span><button className="button button-outline" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Tambah item'}</button></div>
      </form>}
    </div>
  );
}

function PackageItemRow({ item, canEdit }: { item: AdminPackageItem; canEdit: boolean }) {
  const [state, action, pending] = useActionState(deletePackageItem, initialState);
  return <div className="package-item-row"><div><strong>{item.item_name_snapshot}</strong><small>{item.item_note || 'Tanpa catatan'}</small></div><span>{item.quantity} pcs</span><form action={action}><input type="hidden" name="package_item_id" value={item.id} /><button className="text-button" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Hapus'}</button></form>{state.message && <small className={state.ok ? 'action-success' : 'action-error'}>{state.message}</small>}</div>;
}

export function AdminInventoryConsole({ locations, skus, stock, canEdit }: { locations: AdminInventoryLocation[]; skus: AdminSku[]; stock: AdminInventoryStock[]; canEdit: boolean }) {
  const [createState, createAction, createPending] = useActionState(createInventoryStock, initialState);
  return (
    <div className="admin-crud-stack">
      <div className="admin-page-heading"><div><p className="eyebrow">Operations / stock</p><h2>Inventory</h2></div><span className="notification-count">{stock.length} stock record</span></div>
      <section className="admin-panel">
        <div className="panel-heading"><div><p className="eyebrow">Stock ledger</p><h3>Tambah stock location</h3></div></div>
        {locations.length === 0 || skus.length === 0 ? <p className="admin-empty-copy">Inventory membutuhkan minimal satu lokasi dan satu SKU dari catalog.</p> : <form className="admin-crud-form admin-crud-inline-form" action={createAction}>
          <label>Lokasi<select name="location_id" disabled={!canEdit}>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}</select></label>
          <label>SKU<select name="sku_id" disabled={!canEdit}>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku} · {sku.name}</option>)}</select></label>
          <label>On hand<input name="on_hand_quantity" type="number" min="0" step="1" defaultValue="0" disabled={!canEdit} /></label>
          <label>Reserved<input name="reserved_quantity" type="number" min="0" step="1" defaultValue="0" disabled={!canEdit} /></label>
          <label>Reorder point<input name="reorder_point" type="number" min="0" step="1" defaultValue="0" disabled={!canEdit} /></label>
          <ActionFoot state={createState} pending={createPending} label="Tambah stock" disabled={!canEdit} />
        </form>}
      </section>
      <section className="admin-panel">
        <div className="panel-heading"><div><p className="eyebrow">Current stock</p><h3>Stock & adjustment</h3></div><span className="notification-count">Movement tercatat otomatis</span></div>
        {stock.length === 0 ? <p className="admin-empty-copy">Belum ada stock record.</p> : stock.map((item) => <StockRow key={item.id} item={item} canEdit={canEdit} />)}
      </section>
    </div>
  );
}

function StockRow({ item, canEdit }: { item: AdminInventoryStock; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateInventoryStock, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteInventoryStock, initialState);
  return (
    <div className="admin-crud-record">
      <form className="admin-crud-form admin-crud-inline-form" action={action}>
        <input type="hidden" name="stock_id" value={item.id} />
        <div className="admin-record-title"><strong>{item.sku_name}</strong><small>{item.sku_code} · {item.location_name}</small></div>
        <label>On hand<input name="on_hand_quantity" type="number" min="0" defaultValue={item.on_hand_quantity} disabled={!canEdit} /></label>
        <label>Reserved<input name="reserved_quantity" type="number" min="0" defaultValue={item.reserved_quantity} disabled={!canEdit} /></label>
        <label>Reorder point<input name="reorder_point" type="number" min="0" defaultValue={item.reorder_point} disabled={!canEdit} /></label>
        <label className="admin-crud-wide">Alasan adjustment<input name="reason" placeholder="Receiving batch September" disabled={!canEdit} required /></label>
        <div className="admin-crud-record-foot"><span>{state.message || deleteState.message}</span><button className="button button-dark" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Simpan adjustment'}</button></div>
      </form>
      <form action={deleteAction} className="admin-crud-delete"><input type="hidden" name="stock_id" value={item.id} /><button className="text-button" type="submit" disabled={!canEdit || deletePending}>{deletePending ? '...' : 'Hapus stock row'}</button></form>
    </div>
  );
}

export function AdminWhatsappSettings({ settings, canEdit }: { settings: AdminWhatsappSettings | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateWhatsappSettings, initialState);
  return (
    <div className="admin-crud-stack">
      <div className="admin-page-heading"><div><p className="eyebrow">Protected channel</p><h2>WhatsApp</h2></div><span className="notification-count">Permission settings</span></div>
      <section className="admin-panel admin-settings-panel">
        <div className="panel-heading"><div><p className="eyebrow">Customer contact</p><h3>Floating bubble setting</h3></div></div>
        <p className="admin-help-copy">Nomor ini dipakai oleh floating bubble di storefront. Perubahan hanya tersedia untuk admin yang diberi akses WhatsApp setting.</p>
        <form className="admin-crud-form" action={action}>
          <label>Nomor WhatsApp<input name="phone" inputMode="tel" defaultValue={settings?.phone ?? '6289501086888'} disabled={!canEdit} /></label>
          <label className="admin-crud-wide">Pesan awal<textarea name="message" rows={3} defaultValue={settings?.message ?? 'Halo Luminails, saya mau konsultasi package dan order.'} disabled={!canEdit} /></label>
          <label className="admin-check"><input type="checkbox" checked readOnly /> Tampil di storefront</label>
          <ActionFoot state={state} pending={pending} label="Simpan WhatsApp setting" disabled={!canEdit} />
        </form>
      </section>
    </div>
  );
}

function ActionFoot({ state, pending, label, disabled }: { state: AdminActionState; pending: boolean; label: string; disabled: boolean }) {
  return <div className="admin-crud-action"><span className={state.message ? (state.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{state.message || 'Perubahan disimpan melalui server.'}</span><button className="button button-dark" type="submit" disabled={disabled || pending}>{pending ? 'Menyimpan...' : label}</button></div>;
}
