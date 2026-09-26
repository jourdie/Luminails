'use client';

import { useActionState, useMemo, useState } from 'react';
import {
  addPackageItem,
  createInventoryStock,
  createPackage,
  deleteInventoryStock,
  deletePackageItem,
  deletePackage,
  deletePackageImage,
  updateInventoryStock, updatePackageItem,
  updatePackage,
  updateWhatsappSettings,
  updatePackageAllowedSkus,
  updatePackageImages,
  archivePackageType, savePackageType,
  deletePackageBenefit, deletePackageEligibility, savePackageBenefit, savePackageEligibility,
  type AdminActionState,
} from '../app/admin/actions';
import type { AdminBrand, AdminCustomerTier, AdminInventoryLocation, AdminInventoryStock, AdminPackage, AdminPackageAllowedSku, AdminPackageBenefit, AdminPackageEligibility, AdminPackageImage, AdminPackageItem, AdminPackagePrice, AdminPackageType, AdminPricingTier, AdminSku, AdminWhatsappSettings } from '../lib/admin';
import { IdrInput } from './idr-input';

const initialState: AdminActionState = { ok: false, message: '' };

export function AdminPackageConsole({ brands, packages, packageItems, packageAllowedSkus, packageImages, packagePrices, packageTypes, packageEligibility, packageBenefits, customerTiers, pricingTiers, skus, canEdit, onOpenSkuList }: { brands: AdminBrand[]; packages: AdminPackage[]; packageItems: AdminPackageItem[]; packageAllowedSkus: AdminPackageAllowedSku[]; packageImages: AdminPackageImage[]; packagePrices: AdminPackagePrice[]; packageTypes: AdminPackageType[]; packageEligibility: AdminPackageEligibility[]; packageBenefits: AdminPackageBenefit[]; customerTiers: AdminCustomerTier[]; pricingTiers: AdminPricingTier[]; skus: AdminSku[]; canEdit: boolean; onOpenSkuList: () => void }) {
  const [packageState, packageAction, packagePending] = useActionState(createPackage, initialState);
  const activeSkus = skus.filter((sku) => sku.is_active);
  const activeTiers = pricingTiers.filter((tier) => tier.is_active);  const [selectionMode, setSelectionMode] = useState<'fixed' | 'free_pick'>('fixed');
  const [packageTitle, setPackageTitle] = useState('');
  const [packageTypeId, setPackageTypeId] = useState(packageTypes.find((type) => type.is_active)?.id ?? '');
  const autoSlug = packageTitle.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const [packageQuery, setPackageQuery] = useState('');
  const [packageSort, setPackageSort] = useState<'newest' | 'name' | 'price'>('newest');
  const [packagePage, setPackagePage] = useState(0);
  const visiblePackages = useMemo(() => packages.filter((item) => (item.title + ' ' + item.slug + ' ' + item.brand_name).toLowerCase().includes(packageQuery.trim().toLowerCase())).sort((a, b) => packageSort === 'name' ? a.title.localeCompare(b.title) : packageSort === 'price' ? a.price_idr - b.price_idr : b.slug.localeCompare(a.slug)), [packages, packageQuery, packageSort]);
  const pagedPackages = visiblePackages.slice(packagePage * 10, packagePage * 10 + 10);

  return (
    <div className="admin-crud-stack">
      <div className="admin-page-heading"><div><p className="eyebrow">Offer builder</p><h2>Packages</h2></div><span className="notification-count">{packages.length} package · {brands.length} brand</span></div>
      <div className="admin-flow-callout"><div><p className="eyebrow">Dependency</p><strong>Brand Register → SKU list → Package</strong><p>Brand dibuat di Brand Register. SKU aktif menjadi isi package dan foto SKU dipakai sebagai cover customer.</p></div><button className="button button-outline" type="button" onClick={onOpenSkuList}>Buka SKU list</button></div>
      <section className="admin-panel">
       <div className={'admin-pagination'}><span>Halaman {Math.min(packagePage + 1, Math.max(1, Math.ceil(visiblePackages.length / 10)))} / {Math.max(1, Math.ceil(visiblePackages.length / 10))} - {visiblePackages.length} data</span><div><button type={'button'} className={'button button-outline'} disabled={packagePage <= 0} onClick={() => setPackagePage((page) => Math.max(0, page - 1))}>Sebelumnya</button><button type={'button'} className={'button button-outline'} disabled={packagePage >= Math.max(1, Math.ceil(visiblePackages.length / 10)) - 1} onClick={() => setPackagePage((page) => Math.min(Math.max(1, Math.ceil(visiblePackages.length / 10)) - 1, page + 1))}>Berikutnya</button></div></div>
       <div className={'admin-table-controls'}><input className={'admin-table-search'} value={packageQuery} onChange={(event) => { setPackageQuery(event.target.value); setPackagePage(0); }} placeholder={'Cari package, slug, atau brand'} /><select value={packageSort} onChange={(event) => { setPackageSort(event.target.value as 'newest' | 'name' | 'price'); setPackagePage(0); }}><option value={'newest'}>Terbaru</option><option value={'name'}>Nama</option><option value={'price'}>Harga termurah</option></select></div>
        <div className="panel-heading"><div><p className="eyebrow">Customer offer</p><h3>Tambah package</h3></div><span className="notification-count">{activeTiers.length} harga tier</span></div>
        {brands.length === 0 ? <p className="admin-empty-copy">Daftarkan brand di Brand Register terlebih dahulu.</p> : activeSkus.length === 0 ? <p className="admin-empty-copy">Buat minimal satu SKU aktif di SKU list sebelum membuat package.</p> : <form className="admin-crud-form" action={packageAction} encType="multipart/form-data">
          <label>Brand<select name="brand_id" disabled={!canEdit} required>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
                    <label>Nama package<input name="title" placeholder="Party 12 Botol" value={packageTitle} onChange={(event) => setPackageTitle(event.target.value)} disabled={!canEdit} required /></label>
          <label>Slug URL<input name="slug" placeholder="party-12-botol" value={autoSlug} readOnly disabled={!canEdit} /><small className="field-help">Otomatis mengikuti nama package, contoh: Party 12 botol refill → party-12-botol-refill.</small></label>
          <label>Tipe package<select name="package_type_id" value={packageTypeId} onChange={(event) => setPackageTypeId(event.target.value)} disabled={!canEdit} required>{packageTypes.filter((type) => type.is_active).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><input type="hidden" name="audience" value={packageTypes.find((type) => type.id === packageTypeId)?.slug ?? 'home-studio'} /></label>
          {activeTiers.map((tier) => <label key={tier.id}>{tier.name} · harga bundling<IdrInput name={'package_price_' + tier.id} placeholder="1.280.000" disabled={!canEdit} required /></label>)}
          <label>Harga normal market retail<IdrInput name="compare_at_price_idr" placeholder="1.500.000" disabled={!canEdit} /></label>
          <label className="admin-crud-wide">Deskripsi<textarea name="description" rows={3} placeholder="Paket 12 botol untuk kebutuhan party." disabled={!canEdit} required /></label>
          <label>Minimum qty package<input name="minimum_quantity" type="number" min="1" defaultValue="1" disabled={!canEdit} /></label><label>Minimum order eligible points<IdrInput name="minimum_subtotal_idr" placeholder="0" disabled={!canEdit} /></label><label>Points earning<select name="points_earning_mode" defaultValue="normal" disabled={!canEdit}><option value="normal">Normal</option><option value="reduced">Reduced</option><option value="none">Tidak earn</option></select></label><label>Points multiplier<input name="points_multiplier" type="number" min="0.01" step="0.01" defaultValue="1" disabled={!canEdit} /></label><label className="admin-check"><input name="allow_reward_redemption" type="checkbox" defaultChecked disabled={!canEdit} /> Boleh redeem reward</label><label className="admin-check"><input name="stackable" type="checkbox" disabled={!canEdit} /> Stackable dengan package lain</label>
          <label>Model isi package<select name="selection_mode" value={selectionMode} onChange={(event) => setSelectionMode(event.target.value as 'fixed' | 'free_pick')} disabled={!canEdit}><option value="fixed">Fixed · admin tentukan isi + quantity</option><option value="free_pick">Free pick · customer pilih isi</option></select></label>
          {selectionMode === 'free_pick' ? <label>Kapasitas pilihan<input name="selection_capacity" type="number" min="1" step="1" placeholder="12" disabled={!canEdit} required /><small className="field-help">Customer wajib memilih tepat sejumlah kapasitas ini, contoh 12 botol.</small></label> : <div className="admin-crud-wide package-mode-note"><strong>Fixed package</strong><span>Pilih SKU di bawah dan isi quantity per SKU. Tidak memakai kapasitas pilihan.</span></div>}
          {selectionMode === 'fixed' ? <div className="admin-crud-wide package-fixed-builder"><span className="field-label">SKU fixed package + quantity</span><div className="package-fixed-grid">{activeSkus.map((sku) => <label key={sku.id} className="admin-check package-fixed-option"><input type="checkbox" name="sku_ids" value={sku.id} disabled={!canEdit} /><span><strong>{sku.sku}</strong><small>{sku.name}</small></span><input name={'fixed_quantity_' + sku.id} type="number" min="1" step="1" defaultValue="1" disabled={!canEdit} aria-label={'Quantity ' + sku.name} /></label>)}</div><small className="field-help">Contoh salon starter: Base coat qty 2, Top coat qty 2, buffer qty 10.</small></div> : <div className="admin-crud-wide package-free-builder"><span className="field-label">SKU yang boleh dipilih customer</span><div className="package-allowed-grid">{activeSkus.map((sku) => <label key={sku.id} className="admin-check"><input type="checkbox" name="allowed_sku_ids" value={sku.id} disabled={!canEdit} /><span><strong>{sku.sku}</strong><small>{sku.name}</small></span></label>)}</div><small className="field-help">Checklist semua variasi yang boleh dipilih customer. Customer tidak bisa checkout sebelum total pilihannya sama dengan kapasitas.</small></div>}
           <label>Mulai tampil<input name={'starts_at'} type={'datetime-local'} disabled={!canEdit} /></label><label>Berakhir tampil<input name={'ends_at'} type={'datetime-local'} disabled={!canEdit} /></label>
          <label>Status<select name="status" defaultValue="published" disabled={!canEdit}><option value="published">Published · tampil ke customer</option><option value="draft">Draft · belum tampil</option><option value="archived">Archived</option></select></label>
          <label>Tone<select name="visual_tone" defaultValue="clay" disabled={!canEdit}><option value="clay">Clay</option><option value="ivory">Ivory</option><option value="plum">Plum</option></select></label>
          <label className="admin-crud-wide">Foto package (3-5 foto untuk Published)<input name="package_images" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!canEdit} /><small className="field-help">Published wajib 3-5 foto untuk slider customer. Draft boleh tanpa foto. JPG, PNG, WEBP maksimal 6 MB per foto.</small></label>
          <ActionFoot state={packageState} pending={packagePending} label="Buat package" disabled={!canEdit} />
        </form>}
      </section>
      <section className="admin-panel">
        <div className="panel-heading"><div><p className="eyebrow">Live catalog records</p><h3>Kelola package dan harga tier</h3></div><span className="notification-count">Harga IDR</span></div>
        {visiblePackages.length === 0 ? <p className="admin-empty-copy">Belum ada package yang cocok dengan pencarian.</p> : pagedPackages.map((item) => <PackageRow key={item.id} item={item} brands={brands} packageItems={packageItems.filter((packageItem) => packageItem.package_id === item.id)} packageAllowedSkus={packageAllowedSkus.filter((allowed) => allowed.package_id === item.id)} packageImages={packageImages.filter((image) => image.package_id === item.id)} packagePrices={packagePrices.filter((price) => price.package_id === item.id)} packageTypes={packageTypes} packageEligibility={packageEligibility.filter((rule) => rule.package_id === item.id)} packageBenefits={packageBenefits.filter((benefit) => benefit.package_id === item.id)} customerTiers={customerTiers} pricingTiers={activeTiers} skus={skus} canEdit={canEdit} />)}
      </section>
      <PackageTypesEditor packageTypes={packageTypes} canEdit={canEdit} />
    </div>
  );
}

function PackageTypesEditor({ packageTypes, canEdit }: { packageTypes: AdminPackageType[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(savePackageType, initialState);
  return <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">Package taxonomy</p><h3>Tambah / edit tipe package</h3></div><span className="notification-count">Dropdown customer mengikuti data ini</span></div><form className="admin-crud-form" action={action}><label>Nama tipe<input name="name" required placeholder="Distributor" disabled={!canEdit} /></label><label>Slug<input name="slug" placeholder="distributor" disabled={!canEdit} /><small className="field-help">Kosongkan untuk dibuat otomatis dari nama.</small></label><label>Deskripsi<input name="description" placeholder="Paket untuk distributor" disabled={!canEdit} /></label><label>Urutan<input name="sort_order" type="number" min="0" defaultValue="0" disabled={!canEdit} /></label><div className="admin-crud-action"><span className={state.message ? (state.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{state.message || 'Tipe aktif akan muncul saat admin membuat package.'}</span><button className="button button-dark" disabled={!canEdit || pending}>{pending ? '...' : 'Buat tipe'}</button></div></form><div className="package-type-list">{packageTypes.map((type) => <PackageTypeRow key={type.id} type={type} canEdit={canEdit} />)}</div></section>;
}

function PackageTypeRow({ type, canEdit }: { type: AdminPackageType; canEdit: boolean }) {
  const [state, action, pending] = useActionState(savePackageType, initialState);
  const [archiveState, archiveAction, archivePending] = useActionState(archivePackageType, initialState);
  return <div className="admin-data-row admin-data-row-form"><form action={action}><input type="hidden" name="package_type_id" value={type.id} /><input name="name" defaultValue={type.name} disabled={!canEdit} /><input name="slug" defaultValue={type.slug} disabled={!canEdit} /><input name="description" defaultValue={type.description ?? ''} disabled={!canEdit} /><input name="sort_order" type="number" defaultValue={type.sort_order} disabled={!canEdit} /><input type="hidden" name="is_active" value={type.is_active ? 'on' : 'off'} /><button className="button button-outline" disabled={!canEdit || pending}>Simpan</button>{state.message && <small>{state.message}</small>}</form><form action={archiveAction}><input type="hidden" name="package_type_id" value={type.id} /><button className="text-button danger-button" disabled={!canEdit || archivePending}>Arsipkan</button>{archiveState.message && <small>{archiveState.message}</small>}</form></div>;
}

function PackageRow({ item, brands, packageItems, packageAllowedSkus, packageImages, packagePrices, packageTypes, packageEligibility, packageBenefits, customerTiers, pricingTiers, skus, canEdit }: { item: AdminPackage; brands: AdminBrand[]; packageItems: AdminPackageItem[]; packageAllowedSkus: AdminPackageAllowedSku[]; packageImages: AdminPackageImage[]; packagePrices: AdminPackagePrice[]; packageTypes: AdminPackageType[]; packageEligibility: AdminPackageEligibility[]; packageBenefits: AdminPackageBenefit[]; customerTiers: AdminCustomerTier[]; pricingTiers: AdminPricingTier[]; skus: AdminSku[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updatePackage, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePackage, initialState);
  const [expanded, setExpanded] = useState(false);
  const currentPrice = (tier: AdminPricingTier) => packagePrices.find((price) => price.pricing_tier_id === tier.id)?.unit_price_idr ?? (tier.code === 'STANDARD' ? item.price_idr : undefined);
  return (
    <div className="admin-crud-record">
      <div className="admin-data-table package-summary-table" role="row">
        <div><strong>{item.title}</strong><small>{item.slug}</small></div>
        <div><span>Brand</span><strong>{item.brand_name}</strong></div>
        <div><span>Isi</span><strong>{item.selection_mode === 'free_pick' ? 'Free pick' : 'Fixed'}</strong></div>
        <div><span>Status</span><strong>{item.status}</strong></div>
        <div><button type="button" className="button button-outline" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Tutup detail' : 'Buka detail'}</button></div>
      </div>
      {expanded && <div className="package-detail-panel">
      <form className="admin-crud-form admin-crud-row-form" action={action}>
        <input type="hidden" name="package_id" value={item.id} />
        <label>Brand<select name="brand_id" defaultValue={item.brand_id} disabled={!canEdit}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
        <label>Nama package<input name="title" defaultValue={item.title} disabled={!canEdit} /></label>
        <label>Slug<input name="slug" defaultValue={item.slug} disabled={!canEdit} /></label>
        <label>Tipe package<select name="package_type_id" defaultValue={item.package_type_id ?? ''} disabled={!canEdit}>{packageTypes.filter((type) => type.is_active).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><input type="hidden" name="audience" value={item.audience} /></label><label>Model isi package<select name="selection_mode" defaultValue={item.selection_mode} disabled={!canEdit}><option value="fixed">Fixed · isi sudah ditentukan</option><option value="free_pick">Free pick · customer pilih isi</option></select></label><label>Kapasitas pilihan<input name="selection_capacity" type="number" min="1" step="1" defaultValue={item.selection_capacity ?? ''} disabled={!canEdit} placeholder="Contoh 12" /></label>
        {pricingTiers.map((tier) => <label key={tier.id}>{tier.name} · bundling<IdrInput name={'package_price_' + tier.id} defaultValue={currentPrice(tier)} disabled={!canEdit} /></label>)}
        <label>Harga normal market retail<IdrInput name="compare_at_price_idr" defaultValue={item.compare_at_price_idr ?? undefined} disabled={!canEdit} /></label>
         <label>Mulai tampil<input name={'starts_at'} type={'datetime-local'} defaultValue={item.starts_at ? new Date(item.starts_at).toISOString().slice(0, 16) : ''} disabled={!canEdit} /></label><label>Berakhir tampil<input name={'ends_at'} type={'datetime-local'} defaultValue={item.ends_at ? new Date(item.ends_at).toISOString().slice(0, 16) : ''} disabled={!canEdit} /></label>
        <label className="admin-crud-wide">Deskripsi<textarea name="description" rows={2} defaultValue={item.description} disabled={!canEdit} /></label>
        <label>Minimum qty package<input name="minimum_quantity" type="number" min="1" defaultValue={item.minimum_quantity ?? 1} disabled={!canEdit} /></label><label>Minimum order eligible points<IdrInput name="minimum_subtotal_idr" defaultValue={item.minimum_subtotal_idr ?? undefined} disabled={!canEdit} /></label><label>Points earning<select name="points_earning_mode" defaultValue={item.points_earning_mode ?? 'normal'} disabled={!canEdit}><option value="normal">Normal</option><option value="reduced">Reduced</option><option value="none">Tidak earn</option></select></label><label>Points multiplier<input name="points_multiplier" type="number" min="0.01" step="0.01" defaultValue={item.points_multiplier ?? 1} disabled={!canEdit} /></label><label className="admin-check"><input name="allow_reward_redemption" type="checkbox" defaultChecked={item.allow_reward_redemption ?? true} disabled={!canEdit} /> Boleh redeem reward</label><label className="admin-check"><input name="stackable" type="checkbox" defaultChecked={item.stackable ?? false} disabled={!canEdit} /> Stackable</label>
        <input type="hidden" name="long_description" value={item.long_description ?? ''} />
        <input type="hidden" name="badge" value={item.badge ?? ''} />
        <input type="hidden" name="delivery_note" value={item.delivery_note ?? ''} />
        <input type="hidden" name="sort_order" value={item.sort_order} />
        <input type="hidden" name="visual_tone" value={item.visual_tone} />
        <div className="admin-crud-record-foot"><small>{item.brand_name} · Harga berbeda mengikuti B2B Tier</small><span>{state.message || deleteState.message}</span><button className="button button-dark" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Simpan package'}</button></div>
      </form>
      <form action={deleteAction} className="admin-crud-delete" onSubmit={(event) => { if (!window.confirm(`Hapus package ${item.title}? Isi, harga, dan foto package akan ikut terhapus jika tidak dipakai transaksi.`)) event.preventDefault(); }}><input type="hidden" name="package_id" value={item.id} /><button className="text-button" type="submit" disabled={!canEdit || deletePending}>{deletePending ? '...' : 'Hapus package'}</button></form>
      <PackageImageEditor packageId={item.id} images={packageImages} canEdit={canEdit} />
      {item.selection_mode === 'free_pick' ? <PackageAllowedSkuEditor packageId={item.id} allowedSkus={packageAllowedSkus} skus={skus} canEdit={canEdit} /> : <PackageItemsEditor packageId={item.id} packageItems={packageItems} skus={skus} canEdit={canEdit} />}
      <PackageRulesEditor packageId={item.id} rules={packageEligibility} benefits={packageBenefits} customerTiers={customerTiers} brands={brands} skus={skus} canEdit={canEdit} />
      </div>}
    </div>
  );
}

function PackageImageEditor({ packageId, images, canEdit }: { packageId: string; images: AdminPackageImage[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updatePackageImages, initialState);
  return <div className="package-images-editor"><div className="package-items-heading"><span>Foto package customer</span><small>{images.length} / 5 foto</small></div>{images.length > 0 && <div className="package-images-grid">{images.map((image) => <PackageImageRow key={image.id} image={image} canEdit={canEdit} />)}</div>}<form className="admin-crud-inline-form package-image-upload-form" action={action} encType="multipart/form-data"><input type="hidden" name="package_id" value={packageId} /><label>Tambah foto<input name="package_images" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!canEdit} /></label><div className="admin-crud-record-foot"><span className={state.message ? (state.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{state.message || 'Foto paling pertama menjadi cover package.'}</span><button className="button button-outline" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Upload foto'}</button></div></form></div>;
}

function PackageImageRow({ image, canEdit }: { image: AdminPackageImage; canEdit: boolean }) {
  const [state, action, pending] = useActionState(deletePackageImage, initialState);
  return <div className="package-image-row"><img src={image.image_url} alt={image.alt_text || 'Foto package'} /><form action={action} onSubmit={(event) => { if (!window.confirm('Hapus foto package ini? Package Published harus menyisakan minimal 3 foto.')) event.preventDefault(); }}><input type="hidden" name="package_image_id" value={image.id} /><button className="text-button" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Hapus'}</button><span className={state.message ? (state.ok ? 'action-success' : 'action-error') : ''}>{state.message}</span></form></div>;
}

function PackageAllowedSkuEditor({ packageId, allowedSkus, skus, canEdit }: { packageId: string; allowedSkus: AdminPackageAllowedSku[]; skus: AdminSku[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updatePackageAllowedSkus, initialState);
  const allowed = new Set(allowedSkus.map((item) => item.sku_id));
  return <div className="package-items-editor"><div className="package-items-heading"><span>SKU yang boleh dipilih customer</span><small>{allowedSkus.length} SKU · customer wajib memenuhi kapasitas package</small></div><form className="admin-crud-inline-form package-allowed-form" action={action}><input type="hidden" name="package_id" value={packageId} /><input type="hidden" name="selection_mode" value="free_pick" /><div className="package-allowed-grid">{skus.filter((sku) => sku.is_active).map((sku) => <label key={sku.id} className="admin-check"><input type="checkbox" name="allowed_sku_ids" value={sku.id} defaultChecked={allowed.has(sku.id)} disabled={!canEdit} /><span><strong>{sku.sku}</strong><small>{sku.name}</small></span></label>)}</div><div className="admin-crud-record-foot"><span className={state.message ? (state.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{state.message || 'Checklist SKU yang boleh dipilih dalam free-pick package.'}</span><button className="button button-outline" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Simpan whitelist'}</button></div></form></div>;
}

function PackageItemsEditor({ packageId, packageItems, skus, canEdit }: { packageId: string; packageItems: AdminPackageItem[]; skus: AdminSku[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(addPackageItem, initialState);
  return (
    <div className="package-items-editor">
      <div className="package-items-heading"><span>Isi package</span><small>{packageItems.length} item</small></div>
      {packageItems.length > 0 && <div className="admin-data-table package-content-table" role="table" aria-label="Isi package">
        <div className="admin-data-head package-content-head" role="row"><span>SKU / item</span><span>Qty</span><span>Catatan</span><span>Status</span><span>Aksi</span></div>
        {packageItems.map((item) => <PackageItemRow key={item.id} item={item} canEdit={canEdit} />)}
      </div>}
      {skus.filter((sku) => sku.is_active).length === 0 ? <small className="admin-empty-copy">Belum ada SKU aktif untuk dipilih. Buat SKU dari modul SKU list terlebih dahulu.</small> : <form className="admin-crud-inline-form package-item-form" action={action}>
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
  const [state, action, pending] = useActionState(updatePackageItem, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePackageItem, initialState);
  return <div className="admin-data-row admin-package-content-row" role="row"><form className="package-content-form" action={action}><input type="hidden" name="package_item_id" value={item.id} /><div><strong>{item.item_name_snapshot}</strong><small>SKU snapshot · quantity per 1 package</small></div><label>Qty<input name="quantity" type="number" min="1" step="1" defaultValue={item.quantity} disabled={!canEdit} /></label><label>Catatan<input name="item_note" defaultValue={item.item_note ?? ''} placeholder="Opsional" disabled={!canEdit} /></label><span className={state.message ? (state.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{state.message || 'Customer akan melihat quantity ini.'}</span><button className="button button-outline" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Simpan'}</button></form><form className="package-delete-form" action={deleteAction} onSubmit={(event) => { if (!window.confirm('Hapus item SKU ini dari package?')) event.preventDefault(); }}><input type="hidden" name="package_item_id" value={item.id} /><button className="text-button danger-button" type="submit" disabled={!canEdit || deletePending}>{deletePending ? '...' : 'Hapus'}</button>{deleteState.message && <small className={deleteState.ok ? 'action-success' : 'action-error'}>{deleteState.message}</small>}</form></div>;
}

function PackageRulesEditor({ packageId, rules, benefits, customerTiers, brands, skus, canEdit }: { packageId: string; rules: AdminPackageEligibility[]; benefits: AdminPackageBenefit[]; customerTiers: AdminCustomerTier[]; brands: AdminBrand[]; skus: AdminSku[]; canEdit: boolean }) {
  const [ruleState, ruleAction, rulePending] = useActionState(savePackageEligibility, initialState);
  const [benefitState, benefitAction, benefitPending] = useActionState(savePackageBenefit, initialState);
  const activeTiers = customerTiers.filter((tier) => tier.is_active);
  const activeBrands = brands.filter((brand) => brand.is_published);
  const activeSkus = skus.filter((sku) => sku.is_active);
  const tierName = (id: string | null) => activeTiers.find((tier) => tier.id === id)?.name ?? 'Semua tier';
  const brandName = (id: string | null) => brands.find((brand) => brand.id === id)?.name ?? 'Semua brand';
  const skuName = (id: string | null) => skus.find((sku) => sku.id === id)?.name ?? 'Semua SKU';
  return <div className="package-rules-editor">
    <div className="package-items-heading"><span>Eligibility & benefit package</span><small>{rules.length} rule · {benefits.length} benefit</small></div>
    <p className="field-help">Tanpa rule, package berlaku untuk semua customer. Tambahkan rule bila package hanya boleh dibeli tier, brand, atau SKU tertentu.</p>
    <form className="admin-crud-inline-form package-rule-form" action={ruleAction}>
      <input type="hidden" name="package_id" value={packageId} />
      <label>Customer tier<select name="customer_tier_id" disabled={!canEdit}><option value="">Semua tier</option>{activeTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
      <label>Brand<select name="brand_id" disabled={!canEdit}><option value="">Semua brand</option>{activeBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
      <label>SKU<select name="sku_id" disabled={!canEdit}><option value="">Semua SKU</option>{activeSkus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku} · {sku.name}</option>)}</select></label>
      <label>Minimum qty<input name="minimum_quantity" type="number" min="1" defaultValue="1" disabled={!canEdit} /></label>
      <label>Minimum order (IDR)<IdrInput name="minimum_order_value_idr" placeholder="0" disabled={!canEdit} /></label>
      <div className="admin-crud-record-foot"><span className={ruleState.message ? (ruleState.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{ruleState.message || 'Satu rule cukup memiliki salah satu target.'}</span><button className="button button-outline" type="submit" disabled={!canEdit || rulePending}>{rulePending ? '...' : 'Tambah eligibility'}</button></div>
    </form>
    {rules.length > 0 && <div className="admin-data-table package-rule-table" role="table" aria-label="Eligibility package"><div className="admin-data-head package-rule-head" role="row"><span>Target</span><span>Minimum</span><span>Aksi</span></div>{rules.map((rule) => <PackageEligibilityRow key={rule.id} rule={rule} canEdit={canEdit} tierName={tierName(rule.customer_tier_id)} brandName={brandName(rule.brand_id)} skuName={skuName(rule.sku_id)} />)}</div>}
    <form className="admin-crud-inline-form package-rule-form" action={benefitAction}>
      <input type="hidden" name="package_id" value={packageId} />
      <label>Benefit untuk tier<select name="customer_tier_id" disabled={!canEdit}><option value="">Semua tier</option>{activeTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
      <label>SKU bonus<select name="reward_sku_id" required disabled={!canEdit}><option value="">Pilih SKU</option>{activeSkus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku} · {sku.name}</option>)}</select></label>
      <label>Qty bonus<input name="quantity" type="number" min="1" defaultValue="1" disabled={!canEdit} /></label>
      <label>Variasi<select name="variant_rule" defaultValue="customer_selected" disabled={!canEdit}><option value="customer_selected">Customer pilih variasi</option><option value="admin_selected">Admin tentukan item</option></select></label>
       <label className={'admin-crud-wide'}>SKU yang boleh dipilih customer <div className={'package-allowed-grid'}>{activeSkus.map((sku) => <label key={sku.id} className={'admin-check'}><input name={'allowed_sku_ids'} value={sku.id} type={'checkbox'} disabled={!canEdit} /><span><strong>{sku.sku}</strong><small>{sku.name}</small></span></label>)}</div><small className={'field-help'}>Untuk customer_selected, checklist semua SKU yang boleh dipilih customer.</small></label>
      <label className="admin-crud-wide">Catatan<input name="notes" placeholder="Contoh: pilih 2 tools dari daftar yang diizinkan" disabled={!canEdit} /></label>
      <div className="admin-crud-record-foot"><span className={benefitState.message ? (benefitState.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{benefitState.message || 'Benefit dapat berbeda per tier customer.'}</span><button className="button button-outline" type="submit" disabled={!canEdit || benefitPending}>{benefitPending ? '...' : 'Tambah benefit'}</button></div>
    </form>
    {benefits.length > 0 && <div className="admin-data-table package-rule-table" role="table" aria-label="Benefit package"><div className="admin-data-head package-rule-head" role="row"><span>Tier / benefit</span><span>Variasi</span><span>Aksi</span></div>{benefits.map((benefit) => <PackageBenefitRow key={benefit.id} benefit={benefit} canEdit={canEdit} tierName={tierName(benefit.customer_tier_id)} skuName={skuName(benefit.reward_sku_id)} />)}</div>}
  </div>;
}

function PackageEligibilityRow({ rule, canEdit, tierName, brandName, skuName }: { rule: AdminPackageEligibility; canEdit: boolean; tierName: string; brandName: string; skuName: string }) {
  const [state, action, pending] = useActionState(deletePackageEligibility, initialState);
  return <div className="admin-data-row package-rule-row" role="row"><div><strong>{tierName} · {brandName} · {skuName}</strong></div><div><small>Minimal {rule.minimum_quantity} package · order {formatAdminIdr(rule.minimum_order_value_idr)}</small></div><form action={action} onSubmit={(event) => { if (!window.confirm('Hapus rule eligibility ini?')) event.preventDefault(); }}><input type="hidden" name="eligibility_id" value={rule.id} /><button className="text-button danger-button" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Hapus rule'}</button>{state.message && <small>{state.message}</small>}</form></div>;
}

function PackageBenefitRow({ benefit, canEdit, tierName, skuName }: { benefit: AdminPackageBenefit; canEdit: boolean; tierName: string; skuName: string }) {
  const [state, action, pending] = useActionState(deletePackageBenefit, initialState);
  return <div className="admin-data-row package-rule-row" role="row"><div><strong>{tierName} · {benefit.quantity}x {skuName}</strong></div><div><small>{benefit.variant_rule === 'customer_selected' ? 'Customer pilih variasi' : 'Admin tentukan item'}{benefit.notes ? ` · ${benefit.notes}` : ''}</small></div><form action={action} onSubmit={(event) => { if (!window.confirm('Hapus benefit package ini?')) event.preventDefault(); }}><input type="hidden" name="benefit_id" value={benefit.id} /><button className="text-button danger-button" type="submit" disabled={!canEdit || pending}>{pending ? '...' : 'Hapus benefit'}</button>{state.message && <small>{state.message}</small>}</form></div>;
}

function formatAdminIdr(value: number | null | undefined) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value ?? 0);
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
      <form action={deleteAction} className="admin-crud-delete" onSubmit={(event) => { if (!window.confirm(`Hapus stock ${item.sku_name} di ${item.location_name}? Riwayat movement yang terkait dapat mencegah penghapusan.`)) event.preventDefault(); }}><input type="hidden" name="stock_id" value={item.id} /><button className="text-button danger-button" type="submit" disabled={!canEdit || deletePending}>{deletePending ? '...' : 'Hapus stock row'}</button></form>
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
