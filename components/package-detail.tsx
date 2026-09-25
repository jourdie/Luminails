'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { BrandPackage } from '../lib/packages';
import type { StorefrontPromotion } from '../lib/promotions-server';
import { PromoNotice } from './promo-notice';
import { formatIDR, formatQuantity } from '../lib/packages';
import { SiteNavigation } from './site-navigation';
import type { AccountTierSummary } from '../lib/account-server';

type BenefitSelection = Record<string, Record<string, number>>;
type Benefit = NonNullable<BrandPackage['benefits']>[number];

function BenefitPickerRow({ benefit, selection, onAdjust }: { benefit: Benefit; selection: Record<string, number>; onAdjust: (benefitId: string, skuId: string, delta: number, capacity: number) => void }) {
  const total = Object.values(selection).reduce((sum, value) => sum + value, 0);
  return <div className={'package-benefit-picker'}>
    <div className={'free-pick-heading'}><strong>{benefit.quantity} item untuk benefit {benefit.name}</strong><span>{total} / {benefit.quantity}</span></div>
    <div className={'free-pick-list'}>{(benefit.allowedSkus ?? []).map((sku) => <div className={'free-pick-row'} key={sku.id}><div><strong>{sku.name}</strong><span>{sku.sku}</span></div><div className={'quantity-control'}><button type={'button'} onClick={() => onAdjust(benefit.id, sku.id, -1, benefit.quantity)} disabled={!selection[sku.id]}>-</button><span>{formatQuantity(selection[sku.id] ?? 0)}</span><button type={'button'} onClick={() => onAdjust(benefit.id, sku.id, 1, benefit.quantity)} disabled={total >= benefit.quantity}>+</button></div></div>)}</div>
    {!(benefit.allowedSkus ?? []).length && <small className={'field-help'}>Benefit belum memiliki SKU pilihan. Admin perlu melengkapi whitelist.</small>}
  </div>;
}

function PackageBenefitSelector({ benefits, selection, ready, onAdjust }: { benefits: Benefit[]; selection: BenefitSelection; ready: boolean; onAdjust: (benefitId: string, skuId: string, delta: number, capacity: number) => void }) {
  return <section className={'free-pick-selector package-benefit-selector'}>
    <div className={'free-pick-heading'}><div><span className={'brand-eyebrow'}>Benefit tier</span><h2>Pilih free item kamu</h2></div><strong className={ready ? 'is-ready' : ''}>{ready ? 'Lengkap' : 'Belum lengkap'}</strong></div>
    <p>Pilih item bonus dari SKU yang sudah ditentukan admin untuk tier kamu.</p>
    {benefits.map((benefit) => <BenefitPickerRow key={benefit.id} benefit={benefit} selection={selection[benefit.id] ?? {}} onAdjust={onAdjust} />)}
  </section>;
}

export function PackageDetail({ item, promotions, tierSummary }: { item: BrandPackage; promotions: StorefrontPromotion[]; tierSummary?: AccountTierSummary | null }) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [benefitSelection, setBenefitSelection] = useState<BenefitSelection>({});
  const [galleryIndex, setGalleryIndex] = useState(0);
  const totalSelected = Object.values(selection).reduce((total, value) => total + value, 0);
  const filteredSkus = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return item.allowedSkus.filter((sku) => !normalized || (sku.sku + ' ' + sku.name).toLowerCase().includes(normalized));
  }, [item.allowedSkus, search]);
  const totalContents = item.contents.map((content) => ({ ...content, totalQuantity: content.quantity * quantity }));
  const freePickReady = item.selectionMode !== 'free_pick' || totalSelected === item.selectionCapacity;
  const customerSelectedBenefits = (item.benefits ?? []).filter((benefit) => benefit.variantRule === 'customer_selected');
  const benefitsReady = customerSelectedBenefits.every((benefit) => Object.values(benefitSelection[benefit.id] ?? {}).reduce((total, value) => total + value, 0) === benefit.quantity);
  const gallery = item.images?.length ? item.images : item.imageUrl ? [{ id: 'fallback-cover', imageUrl: item.imageUrl, alt: item.title }] : [];
  const currentImage = gallery[galleryIndex] ?? gallery[0];

  function adjustSku(skuId: string, delta: number) {
    setSelection((current) => {
      const currentValue = current[skuId] ?? 0;
      const nextValue = Math.max(0, currentValue + delta);
      if (delta > 0 && totalSelected >= (item.selectionCapacity ?? 0)) return current;
      const next = { ...current };
      if (nextValue === 0) delete next[skuId]; else next[skuId] = nextValue;
      return next;
    });
  }

  function adjustBenefitSku(benefitId: string, skuId: string, delta: number, capacity: number) {
    setBenefitSelection((current) => {
      const currentBenefit = current[benefitId] ?? {};
      const currentValue = currentBenefit[skuId] ?? 0;
      const selectedTotal = Object.values(currentBenefit).reduce((total, value) => total + value, 0);
      if (delta > 0 && selectedTotal >= capacity) return current;
      const nextValue = Math.max(0, currentValue + delta);
      const nextBenefit = { ...currentBenefit };
      if (nextValue === 0) delete nextBenefit[skuId]; else nextBenefit[skuId] = nextValue;
      return { ...current, [benefitId]: nextBenefit };
    });
  }

  function moveGallery(delta: number) {
    if (!gallery.length) return;
    setGalleryIndex((current) => (current + delta + gallery.length) % gallery.length);
  }

  function continueToCheckout() {
    if (!freePickReady || !benefitsReady) return;
    const params = new URLSearchParams({ package: item.slug, quantity: String(quantity) });
    if (notes.trim()) params.set('notes', notes.trim());
    if (item.selectionMode === 'free_pick') params.set('selection', JSON.stringify(Object.entries(selection).filter(([, value]) => value > 0).map(([skuId, value]) => ({ skuId, quantity: value }))));
    if (customerSelectedBenefits.length) params.set('benefits', JSON.stringify(customerSelectedBenefits.flatMap((benefit) => Object.entries(benefitSelection[benefit.id] ?? {}).filter(([, value]) => value > 0).map(([skuId, value]) => ({ benefitId: benefit.id, skuId, quantity: value })))));
    window.location.href = '/checkout?' + params.toString();
  }

  return <>
    <SiteNavigation tierSummary={tierSummary} />
    <PromoNotice promotions={promotions} />
    <main className={'package-detail-page'}><div className={'package-detail-shell'}>
      <Link className={'package-back-link'} href={'/packages'}>&lt;- Kembali ke packages</Link>
      <div className={'package-detail-grid'}>
        <section className={'package-detail-art package-detail-art-' + item.tone}>
          <span className={'package-detail-edition'}>{item.badge}</span><div className={'package-detail-orbit'} />
          <div className={'package-gallery'}>
            {currentImage ? <img className={'package-gallery-image'} src={currentImage.imageUrl} alt={currentImage.alt || item.title} /> : <div className={'package-detail-no-photo'}>Foto package belum tersedia</div>}
            {gallery.length > 1 && <><div className={'package-gallery-controls'}><button type={'button'} onClick={() => moveGallery(-1)} aria-label={'Foto package sebelumnya'}>&lt;</button><span>{galleryIndex + 1} / {gallery.length}</span><button type={'button'} onClick={() => moveGallery(1)} aria-label={'Foto package berikutnya'}>&gt;</button></div><div className={'package-gallery-thumbs'}>{gallery.map((image, index) => <button type={'button'} className={index === galleryIndex ? 'is-active' : ''} key={image.id || image.imageUrl} onClick={() => setGalleryIndex(index)} aria-label={'Lihat foto package ' + (index + 1)}><img src={image.imageUrl} alt={''} /></button>)}</div></>}
          </div>
          <div className={'package-detail-stamp'}>{item.brand}<br /><b>B2B EDIT</b></div><p>CURATED FOR<br /><strong>{item.audience.replace('-', ' ')}</strong></p>
        </section>
        <section className={'package-detail-copy'}>
          <p className={'brand-eyebrow'}>{item.brand} / package edit</p><h1>{item.title}</h1><p className={'package-detail-lead'}>{item.longDescription}</p>
          <div className={'package-price-row'}><div><strong>{formatIDR(item.price)}</strong><span>{item.priceLabel ?? 'Harga bundling'} - per package - save {formatIDR(Math.max(0, item.compareAt - item.price))}</span></div><span className={'package-delivery'}>{item.delivery}</span></div>
          <div className={'package-highlights'}>{item.highlights.map((highlight) => <span key={highlight}>+ {highlight}</span>)}</div>
          {item.eligibilityNote && <div className={'package-eligibility-note'}>{item.eligibilityNote}</div>}
          {item.benefits && item.benefits.length > 0 && <div className={'package-benefit-list'}><span className={'brand-eyebrow'}>Tier benefit</span>{item.benefits.map((benefit) => <div key={benefit.id}><strong>{benefit.quantity}x {benefit.name}</strong><small>{benefit.variantRule === 'customer_selected' ? 'Customer pilih variasinya' : 'Admin sudah menentukan item'}{benefit.notes ? ' - ' + benefit.notes : ''}</small></div>)}</div>}
          {customerSelectedBenefits.length > 0 && <PackageBenefitSelector benefits={customerSelectedBenefits} selection={benefitSelection} ready={benefitsReady} onAdjust={adjustBenefitSku} />}
          {item.selectionMode === 'free_pick' && <section className={'free-pick-selector'}><div className={'free-pick-heading'}><div><span className={'brand-eyebrow'}>Free pick package</span><h2>Pilih isi package</h2></div><strong className={freePickReady ? 'is-ready' : ''}>{formatQuantity(totalSelected)} / {formatQuantity(item.selectionCapacity ?? 0)} botol</strong></div><p>Pilih dan atur sendiri isi setiap package. Kamu tetap checkout satu package, bukan checkout per SKU.</p><label className={'search-box free-pick-search'}><span aria-hidden={'true'}>Search</span><input type={'search'} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={'Cari SKU atau nama shade'} aria-label={'Cari SKU atau nama shade'} /></label><div className={'free-pick-list'}>{filteredSkus.map((sku) => <div className={'free-pick-row'} key={sku.id}><div><strong>{sku.name}</strong><span>{sku.sku}{sku.categoryLabel ? ' - ' + sku.categoryLabel : ''}</span></div><div className={'quantity-control'}><button type={'button'} onClick={() => adjustSku(sku.id, -1)} disabled={!selection[sku.id]}>-</button><span>{formatQuantity(selection[sku.id] ?? 0)}</span><button type={'button'} onClick={() => adjustSku(sku.id, 1)} disabled={totalSelected >= (item.selectionCapacity ?? 0)}>+</button></div></div>)}</div>{!freePickReady && <small className={'field-help'}>Masih kurang {formatQuantity((item.selectionCapacity ?? 0) - totalSelected)} botol untuk checkout.</small>}</section>}
          <div className={'package-detail-actions'}><label>Jumlah package<div className={'quantity-control'}><button type={'button'} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button><span>{formatQuantity(quantity)}</span><button type={'button'} onClick={() => setQuantity((value) => value + 1)}>+</button></div></label><label>Catatan order<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={'Contoh: mohon shade neutral lebih banyak.'} /></label><button className={'brand-button brand-button-dark package-checkout-button'} onClick={continueToCheckout} disabled={!freePickReady || !benefitsReady}>Lanjut ke checkout <span>-&gt;</span></button></div>
        </section>
      </div>
      <section className={'package-contents'}><div className={'brand-section-head brand-section-head-compact'}><span className={'brand-section-index'}>Inside the package</span><div><h2>{item.selectionMode === 'free_pick' ? <>Your selection,<br /><em>your studio rhythm.</em></> : <>Every item has<br /><em>a clear role.</em></>}</h2><p>{item.selectionMode === 'free_pick' ? 'Daftar di atas adalah SKU yang diizinkan admin untuk package ini.' : 'Komposisi package ditampilkan terbuka supaya mudah dicek sebelum order.'}</p></div></div>{item.selectionMode === 'fixed' && <><div className={'package-content-list'}>{item.contents.map((content, index) => <div className={'package-content-row'} key={content.skuId || content.name}><b>{String(index + 1).padStart(2, '0')}</b><div><strong>{content.name}</strong><span>{content.note}</span></div><em>{formatQuantity(content.quantity)} pcs / package</em></div>)}</div>{quantity > 1 && <div className={'package-quantity-preview'}><strong>Simulasi {formatQuantity(quantity)} package</strong><span>Total komponen yang disiapkan:</span>{totalContents.map((content) => <div key={content.name}><span>{content.name}</span><b>{formatQuantity(content.totalQuantity)} pcs</b></div>)}</div>}</>}</section>
    </div></main>
  </>;
}
