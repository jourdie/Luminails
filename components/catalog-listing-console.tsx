'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { archiveCatalogCategory, createCatalogCategory, createCatalogSku, deleteCatalogSku, updateCatalogSku, type AdminActionState } from '../app/admin/actions';
import type { AdminDashboard, AdminSku, CatalogProductType, CatalogStockStatus } from '../lib/admin';

const productTypes: Array<{ value: CatalogProductType; label: string }> = [
  { value: 'GEL_POLISH', label: 'Gel polish' },
  { value: 'PREP', label: 'Prep' },
  { value: 'TOOL', label: 'Tool' },
  { value: 'ACCESSORY', label: 'Accessory' },
  { value: 'LAMP', label: 'Lamp' },
  { value: 'OTHER', label: 'Other' },
];

const stockStatuses: Array<{ value: CatalogStockStatus; label: string }> = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'preorder', label: 'Pre-order' },
];

const money = (value: number | null) => value == null ? '...' : 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
const typeLabel = (value: CatalogProductType) => productTypes.find((item) => item.value === value)?.label ?? value;
const stockLabel = (value: CatalogStockStatus) => stockStatuses.find((item) => item.value === value)?.label ?? value;
const MAX_CATALOG_IMAGE_BYTES = 6 * 1024 * 1024;

function validateCatalogImage(event: React.FormEvent<HTMLFormElement>) {
  const fileInput = event.currentTarget.elements.namedItem('image_file');
  if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) return true;
  if (fileInput.files[0].size > MAX_CATALOG_IMAGE_BYTES) {
    fileInput.setCustomValidity('Ukuran foto maksimal 6 MB.');
    fileInput.reportValidity();
    return false;
  }
  fileInput.setCustomValidity('');
  return true;
}

export function CatalogListingConsole({ products, categories, brands, skus, canEdit }: { products: AdminDashboard['products']; categories: AdminDashboard['categories']; brands: AdminDashboard['brands']; skus: AdminSku[]; canEdit: boolean }) {
  const router = useRouter();
  const [categoryState, createCategoryAction, categoryPending] = useActionState(createCatalogCategory, { ok: false, message: '' });
  const [archiveState, archiveCategoryAction, archivePending] = useActionState(archiveCatalogCategory, { ok: false, message: '' });
  const [createState, createAction, createPending] = useActionState(createCatalogSku, { ok: false, message: '' });
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | CatalogProductType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'name' | 'sku' | 'price-low' | 'price-high' | 'stock'>('name');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    if (categoryState.ok || archiveState.ok) router.refresh();
  }, [archiveState.ok, categoryState.ok, router]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const brandNames = Array.from(new Set(products.map((product) => product.brand))).sort();
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = skus.filter((sku) => {
    const product = productById.get(sku.product_id);
    const haystack = `${sku.sku} ${sku.name} ${sku.category_label} ${sku.series ?? ''} ${sku.color ?? ''} ${product?.brand ?? ''}`.toLowerCase();
    return (!normalizedQuery || haystack.includes(normalizedQuery))
      && (brandFilter === 'all' || product?.brand === brandFilter)
      && (typeFilter === 'all' || sku.product_type === typeFilter)
      && (statusFilter === 'all' || (statusFilter === 'active' ? sku.is_active : !sku.is_active));
  }).sort((a, b) => sort === 'sku' ? a.sku.localeCompare(b.sku) : sort === 'price-low' ? (a.public_reference_price_idr ?? 0) - (b.public_reference_price_idr ?? 0) : sort === 'price-high' ? (b.public_reference_price_idr ?? 0) - (a.public_reference_price_idr ?? 0) : sort === 'stock' ? b.stock_quantity - a.stock_quantity : a.name.localeCompare(b.name));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const resetPage = () => setPage(1);

  return <div className="admin-crud-stack catalog-listing-module">
    <div className="admin-page-heading">
      <div><p className="eyebrow">Catalog / product master</p><h2>Products &amp; SKU.</h2><p className="admin-help-copy">Satu source of truth untuk produk B2B, SKU, kategori, stok, dan status publikasi.</p></div>
      <span className="notification-count">{skus.length} SKU tersimpan</span>
    </div>

    <div className="catalog-listing-summary">
      <div><strong>{skus.filter((sku) => sku.is_active).length}</strong><span>Aktif</span></div>
      <div><strong>{categories.filter((category) => category.is_active).length}</strong><span>Kategori aktif</span></div>
      <div><strong>{skus.filter((sku) => sku.stock_status === 'low_stock' || sku.stock_status === 'out_of_stock').length}</strong><span>Perlu perhatian stok</span></div>
    </div>

    <section className="admin-panel catalog-category-panel">
      <div className="panel-heading"><div><p className="eyebrow">Category master</p><h3>Kategori catalog</h3></div><span className="notification-count">1 SKU = 1 kategori</span></div>
      <div className="catalog-category-grid">
        <form className="admin-crud-inline-form" action={createCategoryAction}>
          <label>Nama kategori<input name="name" placeholder="Consumables" disabled={!canEdit} required /></label>
          <label>Slug<input name="slug" placeholder="consumables" disabled={!canEdit} /></label>
          <label>Urutan<input name="sort_order" type="number" min="0" defaultValue="50" disabled={!canEdit} /></label>
          <button className="button button-outline" type="submit" disabled={!canEdit || categoryPending}>{categoryPending ? 'Menyimpan...' : 'Tambah kategori'}</button>
          {categoryState.message && <small className={categoryState.ok ? 'action-success' : 'action-error'} role="status" aria-live="polite">{categoryState.message}</small>}
        </form>
        <div className="catalog-category-list">
          <div className="catalog-category-head" role="row"><span>Kategori</span><span>Status</span><span>Aksi</span></div>
          {categories.map((category) => <div className="catalog-category-row" key={category.id}><span><strong>{category.name}</strong><small>{category.slug}  /  posisi {category.sort_order}</small></span><span>{category.is_active ? 'Aktif' : 'Diarsipkan'}</span>{category.is_active && <form action={archiveCategoryAction}><input type="hidden" name="category_id" value={category.id} /><button className="text-button danger-button" type="submit" disabled={!canEdit || archivePending}>Arsipkan</button></form>}</div>)}
          {archiveState.message && <small className={archiveState.ok ? 'action-success' : 'action-error'} role="status" aria-live="polite">{archiveState.message}</small>}
        </div>
      </div>
    </section>
    <section className="admin-panel">
      <div className="panel-heading"><div><p className="eyebrow">Create</p><h3>Tambah produk / SKU</h3></div><span className="notification-count">Brand + kategori wajib dipilih</span></div>
      <form className="admin-crud-form catalog-create-form" action={createAction} encType="multipart/form-data" onSubmit={validateCatalogImage}>
        <label>Brand<select name="brand_id" required disabled={!canEdit}><option value="">Pilih brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><small className="field-help">Product induk dibuat otomatis berdasarkan brand + kategori.</small></label>

        <label>Kategori<select name="category_id" required disabled={!canEdit}><option value="">Pilih kategori</option>{categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small className="field-help">Satu SKU hanya memiliki satu kategori.</small></label>
        <label>SKU code<input name="sku" placeholder="PARTY-A01" required disabled={!canEdit} /></label>
        <label>Nama SKU<input name="name" placeholder="Party Red Wine" required disabled={!canEdit} /></label>
        <label>Series<input name="series" placeholder="Party Collection" disabled={!canEdit} /></label>
        <label>Color / shade<input name="color" placeholder="Red wine" disabled={!canEdit} /></label>
        <label>Harga referensi (IDR)<input name="public_reference_price_idr" inputMode="numeric" type="number" min="0" placeholder="120000" disabled={!canEdit} /></label>
        <label>Stock qty<input name="stock_quantity" type="number" min="0" defaultValue="0" disabled={!canEdit} /></label>
        <label>Status stok<select name="stock_status" defaultValue="in_stock" disabled={!canEdit}>{stockStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="catalog-image-field">Foto SKU<input name="image_file" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canEdit} /><small className="field-help">JPG, PNG, atau WEBP  /  maksimal 6 MB.</small></label>
        <div className="admin-crud-action"><span className={createState.message ? (createState.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{createState.message || 'Minimum pembelian ditentukan oleh package quantity, bukan checkbox SKU.'}</span><button className="button button-dark" type="submit" disabled={!canEdit || createPending}>{createPending ? 'Menyimpan...' : 'Buat SKU'}</button></div>
      </form>
    </section>

    <section className="admin-panel">
      <div className="panel-heading"><div><p className="eyebrow">Read / update / archive</p><h3>Daftar produk terstruktur</h3></div><span className="notification-count">{filtered.length} hasil</span></div>
      <div className="catalog-listing-controls">
        <label className="catalog-search">Cari SKU, nama, warna, brand<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Contoh: A01 atau Party" /></label>
        <label>Brand<select value={brandFilter} onChange={(event) => { setBrandFilter(event.target.value); resetPage(); }}><option value="all">Semua brand</option>{brandNames.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label>
        <label>Tipe<select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as typeof typeFilter); resetPage(); }}><option value="all">Semua tipe</option>{productTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); resetPage(); }}><option value="all">Semua status</option><option value="active">Active</option><option value="inactive">Archived / inactive</option></select></label>
        <label>Urutkan<select value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); resetPage(); }}><option value="name">Nama A-Z</option><option value="sku">SKU A-Z</option><option value="price-low">Harga terendah</option><option value="price-high">Harga tertinggi</option><option value="stock">Stok terbanyak</option></select></label>
        <label>Tampilkan<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage(); }}><option value={10}>10 entries</option><option value={25}>25 entries</option><option value={50}>50 entries</option></select></label>
      </div>
      {filtered.length === 0 ? <div className="catalog-empty">Tidak ada data yang cocok. Coba ubah filter atau buat SKU baru.</div> : <>
        <div className="catalog-listing-scroll"><div className="catalog-listing-table" role="table" aria-label="Product and SKU listing">
          <div className="catalog-listing-head" role="row"><span>Produk</span><span>SKU / detail</span><span>Brand &amp; kategori</span><span>Tipe</span><span>Harga referensi</span><span>Stok</span><span>Status</span><span>Aksi</span></div>
          {visible.map((sku) => <CatalogListingRow key={sku.id} sku={sku} product={productById.get(sku.product_id)} categories={categories} canEdit={canEdit} />)}
        </div></div>
        <div className="catalog-pagination"><span>Showing {filtered.length ? (safePage - 1) * pageSize + 1 : 0} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries</span><div><button type="button" className="button button-outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1}>Previous</button><strong>{safePage} / {pageCount}</strong><button type="button" className="button button-outline" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount}>Next</button></div></div>
      </>}
    </section>
  </div>;
}

function CatalogListingRow({ sku, product, categories, canEdit }: { sku: AdminSku; product?: AdminDashboard['products'][number]; categories: AdminDashboard['categories']; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(updateCatalogSku, { ok: false, message: '' } satisfies AdminActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCatalogSku, { ok: false, message: '' } satisfies AdminActionState);
  return <div className={`catalog-listing-row${sku.is_active ? '' : ' is-archived'}`} role="row">
    <span className="catalog-product-cell"><span className="catalog-product-image">{sku.image_url ? <img src={sku.image_url} alt="" /> : <b>LN</b>}</span><strong>{sku.name}</strong><small>{sku.color || sku.series || 'No shade metadata'}</small></span>
    <span><strong className="catalog-code">{sku.sku}</strong><small>{sku.badge || 'No badge'}</small></span>
    <span><strong>{product?.brand || 'Unassigned'}</strong><small>{categories.find((category) => category.id === sku.category_id)?.name || sku.category_label}</small></span>
    <span><span className="catalog-type-pill">{typeLabel(sku.product_type)}</span></span>
    <span className="catalog-number">{money(sku.public_reference_price_idr)}</span>
    
    <span className="catalog-number"><strong>{sku.stock_quantity}</strong><small>{stockLabel(sku.stock_status)}</small></span>
    <span><span className={`status-pill ${sku.is_active ? 'status-live' : 'status-draft'}`}>{sku.is_active ? 'Active' : 'Archived'}</span></span>
    <span className="catalog-row-actions"><details><summary className="button button-outline">Edit</summary><form className="catalog-edit-form" action={formAction} encType="multipart/form-data" onSubmit={validateCatalogImage}><input type="hidden" name="sku_id" value={sku.id} /><label>SKU<input name="sku" defaultValue={sku.sku} disabled={!canEdit} required /></label><label>Nama<input name="name" defaultValue={sku.name} disabled={!canEdit} required /></label><label>Kategori<select name="category_id" defaultValue={sku.category_id ?? ""} disabled={!canEdit} required>{categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><input type="hidden" name="product_type" value={sku.product_type} /><label>Series<input name="series" defaultValue={sku.series ?? ''} disabled={!canEdit} /></label><label>Color<input name="color" defaultValue={sku.color ?? ''} disabled={!canEdit} /></label><label>Harga<input name="public_reference_price_idr" type="number" min="0" defaultValue={sku.public_reference_price_idr ?? ''} disabled={!canEdit} /></label><label>Stock qty<input name="stock_quantity" type="number" min="0" defaultValue={sku.stock_quantity} disabled={!canEdit} /></label><label>Status stok<select name="stock_status" defaultValue={sku.stock_status} disabled={!canEdit}>{stockStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="catalog-image-field">Ganti foto SKU<input name="image_file" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canEdit} /><input type="hidden" name="current_image_url" value={sku.image_url ?? ''} /><small className="field-help">Kosongkan jika foto lama tetap dipakai.</small></label><label>Badge<input name="badge" defaultValue={sku.badge ?? ''} disabled={!canEdit} /></label><input type="hidden" name="sort_order" value={sku.sort_order} /><input type="hidden" name="is_active" value={sku.is_active ? 'on' : 'off'} /><div className="catalog-edit-actions"><small className={state.message ? (state.ok ? 'action-success' : 'action-error') : ''}>{state.message}</small><button className="button button-dark" type="submit" disabled={!canEdit || pending}>{pending ? 'Menyimpan...' : 'Simpan perubahan'}</button></div></form></details><form action={deleteAction} onSubmit={(event) => { if (!window.confirm(`Hapus ${sku.sku}? Jika sudah dipakai package/order, gunakan archive.`)) event.preventDefault(); }}><input type="hidden" name="sku_id" value={sku.id} /><button className="text-button danger-button" type="submit" disabled={!canEdit || deletePending}>{deletePending ? 'Menghapus...' : 'Hapus'}</button>{deleteState.message && <small className={deleteState.ok ? 'action-success' : 'action-error'}>{deleteState.message}</small>}</form></span>
  </div>;
}





