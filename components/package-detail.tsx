'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { BrandPackage, PackageRecommendation } from '../lib/packages';
import type { StorefrontPromotion } from '../lib/promotions-server';
import { PromoNotice } from './promo-notice';
import { formatIDR, formatQuantity, selectQuantityPrice } from '../lib/packages';
import { SiteNavigation } from './site-navigation';
import type { AccountTierSummary } from '../lib/account-server';
import type { AccountIdentity as AccountIdentityData, CustomerProfile } from '../lib/account';
import { calculateEarnedPoints } from '../lib/loyalty-engine';
import { PackageRecommendations } from './package-recommendations';

type BenefitSelection = Record<string, Record<string, number>>;
type Benefit = NonNullable<BrandPackage['benefits']>[number];

function BenefitPickerRow({ benefit, selection, onAdjust }: { benefit: Benefit; selection: Record<string, number>; onAdjust: (benefitId: string, skuId: string, delta: number, capacity: number) => void }) {
  const total = Object.values(selection).reduce((sum, value) => sum + value, 0);
  return <div className={'package-benefit-picker'}>
    <div className={'free-pick-heading'}><strong>{benefit.quantity} item untuk benefit {benefit.name}</strong><span>{total} / {benefit.quantity}</span></div>
    <div className={'free-pick-list'}>{(benefit.allowedSkus ?? []).map((sku) => <div className={'free-pick-row'} key={sku.id}><div><strong>{sku.name}</strong><span>{[sku.sku, sku.series, sku.color, sku.categoryLabel].filter(Boolean).join('  /  ')}</span></div><div className={'quantity-control'}><button type={'button'} onClick={() => onAdjust(benefit.id, sku.id, -1, benefit.quantity)} disabled={!selection[sku.id]}>-</button><span>{formatQuantity(selection[sku.id] ?? 0)}</span><button type={'button'} onClick={() => onAdjust(benefit.id, sku.id, 1, benefit.quantity)} disabled={total >= benefit.quantity}>+</button></div></div>)}</div>
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

export function PackageDetail({ item, promotions, tierSummary, recommendations = [], identity = null, profile = null, needsProfile = false, availablePoints = null }: { item: BrandPackage; promotions: StorefrontPromotion[]; tierSummary?: AccountTierSummary | null; recommendations?: PackageRecommendation[]; identity?: AccountIdentityData | null; profile?: CustomerProfile | null; needsProfile?: boolean; availablePoints?: number | null }) {
  const quantityPricing = item.pricingModel === 'quantity_range';
  const rangeMinimum = item.selectionMinimum ?? item.quantityPrices?.[0]?.minimumQuantity ?? 1;
  const rangeMaximum = item.selectionMaximum ?? item.quantityPrices?.find((row) => row.maximumQuantity === null)?.maximumQuantity ?? null;
  const [quantity, setQuantity] = useState(quantityPricing ? rangeMinimum : 1);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [benefitSelection, setBenefitSelection] = useState<BenefitSelection>({});
  const [galleryIndex, setGalleryIndex] = useState(0);
  const totalSelected = Object.values(selection).reduce((total, value) => total + value, 0);
  const skuCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    item.allowedSkus.forEach((sku) => {
      const category = sku.categoryLabel?.trim();
      if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return counts;
  }, [item.allowedSkus]);
  const skuCategories = useMemo(() => Array.from(skuCategoryCounts.keys()).sort((a, b) => a.localeCompare(b)), [skuCategoryCounts]);
  const filteredSkus = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return item.allowedSkus.filter((sku) => {
      const categoryMatch = categoryFilter === 'all' || sku.categoryLabel?.trim() === categoryFilter;
      const searchMatch = !normalized || (sku.sku + ' ' + sku.name + ' ' + (sku.series ?? '') + ' ' + (sku.color ?? '') + ' ' + (sku.categoryLabel ?? '')).toLowerCase().includes(normalized);
      return categoryMatch && searchMatch;
    });
  }, [item.allowedSkus, search, categoryFilter]);
  const totalContents = item.contents.map((content) => ({ ...content, totalQuantity: content.quantity * quantity }));
  const quantityInRange = !quantityPricing || (quantity >= rangeMinimum && (rangeMaximum === null || quantity <= rangeMaximum));
  const currentUnitPrice = quantityPricing ? (selectQuantityPrice(item.quantityPrices, quantity) ?? item.price) : item.price;
  const packageSubtotal = currentUnitPrice * quantity;
  const customerPoints = identity ? Math.max(0, Math.trunc(Number(availablePoints ?? tierSummary?.availablePoints ?? 0))) : null;
  const estimatedPoints = identity ? (item.pointsEarningMode === 'none' ? 0 : calculateEarnedPoints(packageSubtotal, 0, tierSummary?.multiplier ?? 1, tierSummary?.pointUnitValueIdr ?? 10000) * (item.pointsEarningMode === 'reduced' ? Math.min(1, item.pointsMultiplier ?? 1) : (item.pointsMultiplier ?? 1))) : null;
  const normalPackagePrice = quantityPricing ? null : Math.max(item.compareAt, currentUnitPrice);
  const normalPackageTotal = normalPackagePrice === null ? null : normalPackagePrice * quantity;
  const packageSavings = normalPackageTotal === null ? 0 : Math.max(0, normalPackageTotal - packageSubtotal);
  const freePickReady = item.selectionMode !== 'free_pick' ? true : quantityPricing ? quantityInRange && totalSelected === quantity : totalSelected === item.selectionCapacity;
  const selectionOverflow = item.selectionMode === 'free_pick' && totalSelected > (quantityPricing ? quantity : (item.selectionCapacity ?? 0));
  const selectionShortfall = Math.max(0, (quantityPricing ? quantity : (item.selectionCapacity ?? 0)) - totalSelected);
  const customerSelectedBenefits = (item.benefits ?? []).filter((benefit) => benefit.variantRule === 'customer_selected');
  const benefitsReady = customerSelectedBenefits.every((benefit) => Object.values(benefitSelection[benefit.id] ?? {}).reduce((total, value) => total + value, 0) === benefit.quantity);
  const gallery = item.images?.length ? item.images : item.imageUrl ? [{ id: 'fallback-cover', imageUrl: item.imageUrl, alt: item.title }] : [];
  const currentImage = gallery[galleryIndex] ?? gallery[0];

  function clampSelectionToQuantity(current: Record<string, number>, limit: number) {
    let remaining = Math.max(0, limit);
    const next: Record<string, number> = {};
    for (const [skuId, value] of Object.entries(current)) {
      if (remaining <= 0) break;
      const kept = Math.min(value, remaining);
      if (kept > 0) next[skuId] = kept;
      remaining -= kept;
    }
    return next;
  }

  function changeQuantity(delta: number) {
    const minimum = quantityPricing ? rangeMinimum : 1;
    const maximum = quantityPricing && rangeMaximum !== null ? rangeMaximum : Number.POSITIVE_INFINITY;
    const next = Math.min(maximum, Math.max(minimum, quantity + delta));
    setQuantity(next);
    if (item.selectionMode === 'free_pick') {
      setSelection((current) => clampSelectionToQuantity(current, next));
    }
  }
  function adjustSku(skuId: string, delta: number) {
    setSelection((current) => {
      const currentValue = current[skuId] ?? 0;
      const nextValue = Math.max(0, currentValue + delta);
      if (delta > 0 && totalSelected >= (quantityPricing ? quantity : (item.selectionCapacity ?? 0))) return current;
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
    const checkoutHref = '/checkout?' + params.toString();
    try {
      window.localStorage.setItem('luminails-cart', JSON.stringify({
        title: item.title,
        slug: item.slug,
        quantity,
        unitPrice: currentUnitPrice,
        subtotal: packageSubtotal,
        priceLabel: quantityPricing ? 'Harga per botol' : (item.priceLabel ?? 'Harga package'),
        checkoutHref,
      }));
      window.dispatchEvent(new Event('luminails-cart-updated'));
    } catch {
      // Checkout remains available even when browser storage is disabled.
    }
    window.location.href = checkoutHref;
  }

  return <>
    <SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} tierSummary={tierSummary} />
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
          <div className={'package-detail-stamp'}>{item.brand}<br /><b>SALON EDIT</b></div><p>CURATED FOR<br /><strong>{item.audience.replace('-', ' ')}</strong></p>
        </section>
        <section className={'package-detail-copy'}>
          <p className={'brand-eyebrow'}>{item.brand} / package edit</p><h1>{item.title}</h1><p className={'package-detail-lead'}>{item.longDescription}</p>
          <div className={'package-price-row'}><div><strong>{formatIDR(currentUnitPrice)}</strong>{normalPackagePrice !== null && normalPackagePrice > currentUnitPrice && <del className={'package-normal-price'}>Harga normal {formatIDR(normalPackagePrice)}</del>}<span>{quantityPricing ? 'Harga per botol / berubah mengikuti quantity' : 'Harga package / per package'}{packageSavings > 0 && ' / hemat ' + formatIDR(packageSavings) + (quantity > 1 ? ' total' : '')}</span><div className={'package-price-breakdown'}>{normalPackageTotal !== null && <span>Harga normal{quantity > 1 ? ' total' : ''}<b>{formatIDR(normalPackageTotal)}</b></span>}<span>Harga yang dibayar<b>{formatIDR(packageSubtotal)}</b></span>{normalPackageTotal !== null && packageSavings > 0 && <span className={'is-saving'}>Lebih hemat<b>{formatIDR(packageSavings)}</b></span>}<span>Saldo points customer<b>{customerPoints === null ? 'Login untuk melihat' : customerPoints.toLocaleString('id-ID') + ' pts'}</b></span><span>Earn dari order<b>{estimatedPoints === null ? 'Login untuk melihat' : '+' + Math.floor(estimatedPoints).toLocaleString('id-ID') + ' pts'}</b></span></div></div><span className={'package-delivery'}>{item.delivery}</span></div>
          <div className={'package-highlights'}>{item.highlights.map((highlight) => <span key={highlight}>+ {highlight}</span>)}</div>
          {item.eligibilityNote && <div className={'package-eligibility-note'}>{item.eligibilityNote}</div>}
          {item.benefits && item.benefits.length > 0 && <div className={'package-benefit-list'}><span className={'brand-eyebrow'}>Tier benefit</span>{item.benefits.map((benefit) => <div key={benefit.id}><strong>{benefit.quantity}x {benefit.name}</strong><small>{benefit.variantRule === 'customer_selected' ? 'Customer pilih variasinya' : 'Admin sudah menentukan item'}{benefit.notes ? ' - ' + benefit.notes : ''}</small></div>)}</div>}
          {customerSelectedBenefits.length > 0 && <PackageBenefitSelector benefits={customerSelectedBenefits} selection={benefitSelection} ready={benefitsReady} onAdjust={adjustBenefitSku} />}
          <div className={'package-quantity-top'}><span className={'brand-eyebrow'}>{quantityPricing ? 'Order quantity' : 'Package quantity'}</span><div className={'package-quantity-top-row'}><label>{quantityPricing ? 'Jumlah botol' : 'Jumlah package'}<div className={'quantity-control'}><button type={'button'} onClick={() => changeQuantity(-1)}>-</button><span>{formatQuantity(quantity)}</span><button type={'button'} onClick={() => changeQuantity(1)} disabled={quantityPricing && rangeMaximum !== null && quantity >= rangeMaximum}>+</button></div></label></div></div>
          {quantityPricing && <div className={'quantity-price-band-list'}><span className={'brand-eyebrow'}>Quantity pricing</span>{(item.quantityPrices ?? []).map((row) => <div key={row.minimumQuantity}><span>{row.minimumQuantity} - {row.maximumQuantity ?? '+'} botol</span><strong>{formatIDR(row.unitPriceIdr)} / botol</strong></div>)}</div>}{item.selectionMode === 'free_pick' && <section className={'free-pick-selector'}><div className={'free-pick-heading'}><div><span className={'brand-eyebrow'}>Free pick package</span><h2>Pilih isi package</h2></div><strong className={freePickReady ? 'is-ready' : ''}>{formatQuantity(totalSelected)} / {quantityPricing ? formatQuantity(quantity) : formatQuantity(item.selectionCapacity ?? 0)} botol</strong></div><p>Pilih dan atur sendiri isi setiap package. Kamu tetap checkout satu package, bukan checkout per SKU.</p><div className={'free-pick-filters'}><label className={'free-pick-category-filter'}><span>Kategori SKU</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label={'Filter kategori SKU'}><option value={'all'}>Semua kategori ({item.allowedSkus.length})</option>{skuCategories.map((category) => <option key={category} value={category}>{category} ({skuCategoryCounts.get(category)})</option>)}</select></label><label className={'search-box free-pick-search'}><span aria-hidden={'true'}>Search</span><input type={'search'} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={'Cari SKU, series, atau color reference'} aria-label={'Cari SKU, series, atau color reference'} /></label></div><div className={'free-pick-list'}>{filteredSkus.map((sku) => <div className={'free-pick-row'} key={sku.id}><div><strong>{sku.name}</strong><span>{[sku.sku, sku.series, sku.color, sku.categoryLabel].filter(Boolean).join('  /  ')}</span></div><div className={'quantity-control'}><button type={'button'} onClick={() => adjustSku(sku.id, -1)} disabled={!selection[sku.id]}>-</button><span>{formatQuantity(selection[sku.id] ?? 0)}</span><button type={'button'} onClick={() => adjustSku(sku.id, 1)} disabled={totalSelected >= (quantityPricing ? quantity : (item.selectionCapacity ?? 0))}>+</button></div></div>)}</div>{!filteredSkus.length && <p className={'free-pick-empty'}>Tidak ada SKU pada kategori atau pencarian ini.</p>}{selectionOverflow && <small className={'package-quantity-warning'}>Jumlah SKU melebihi quantity package. Kurangi {formatQuantity(totalSelected - (quantityPricing ? quantity : (item.selectionCapacity ?? 0)))} botol sebelum checkout.</small>}{!freePickReady && !selectionOverflow && <small className={'field-help'}>Masih kurang {formatQuantity(selectionShortfall)} botol untuk checkout.</small>}</section>}
          <div className={'package-detail-actions'}><label>Catatan order<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={'Contoh: mohon shade neutral lebih banyak.'} /></label><button className={'brand-button brand-button-dark package-checkout-button'} onClick={continueToCheckout} disabled={!freePickReady || !benefitsReady}>Lanjut ke checkout <span>-&gt;</span></button></div>
        </section>
      </div>
      <section className={'package-contents'}><div className={'brand-section-head brand-section-head-compact'}><span className={'brand-section-index'}>Inside the package</span><div><h2>{item.selectionMode === 'free_pick' ? <>Your selection,<br /><em>your studio rhythm.</em></> : <>Every item has<br /><em>a clear role.</em></>}</h2><p>{item.selectionMode === 'free_pick' ? 'Daftar di atas adalah SKU yang diizinkan admin untuk package ini.' : 'Komposisi package ditampilkan terbuka supaya mudah dicek sebelum order.'}</p></div></div>{item.selectionMode === 'fixed' && <><div className={'package-content-list'}>{item.contents.map((content, index) => <div className={'package-content-row'} key={content.skuId || content.name}><b>{String(index + 1).padStart(2, '0')}</b><div><strong>{content.name}</strong><span>{content.note}</span></div><em>{formatQuantity(content.quantity)} pcs / package</em></div>)}</div>{quantity > 1 && <div className={'package-quantity-preview'}><strong>Simulasi {formatQuantity(quantity)} package</strong><span>Total komponen yang disiapkan:</span>{totalContents.map((content) => <div key={content.name}><span>{content.name}</span><b>{formatQuantity(content.totalQuantity)} pcs</b></div>)}</div>}</>}</section>
      <PackageRecommendations items={recommendations} />
    </div></main>
  </>;
}
