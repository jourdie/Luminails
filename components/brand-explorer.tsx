'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { BrandPackage } from '../lib/packages';
import type { StorefrontPromotion } from '../lib/promotions-server';
import { PromoNotice } from './promo-notice';
import { formatIDR } from '../lib/packages';
import { SiteNavigation } from './site-navigation';
import type { AccountTierSummary } from '../lib/account-server';
import type { AccountIdentity as AccountIdentityData, CustomerProfile } from '../lib/account';
import { QuantityPriceBanner } from './quantity-price-banner';
import type { PublicBrand } from '../lib/packages-server';

export function BrandExplorer({ mode = 'packages', packages, brands: publicBrands = [], promotions, tierSummary, identity = null, profile = null, needsProfile = false }: { mode?: 'brands' | 'packages'; packages: BrandPackage[]; brands?: PublicBrand[]; promotions: StorefrontPromotion[]; tierSummary?: AccountTierSummary | null; identity?: AccountIdentityData | null; profile?: CustomerProfile | null; needsProfile?: boolean }) {
  const [brand, setBrand] = useState('all');
  const [segment, setSegment] = useState('all');

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = Math.min(window.scrollY * 0.08, 42);
        document.documentElement.style.setProperty('--brand-parallax', offset + 'px');
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const packageBrands = useMemo(() => ['all', ...Array.from(new Set(packages.map((item) => item.brandSlug)))], [packages]);
  const segments = useMemo(() => [{ value: 'all', label: 'Semua paket' }, ...Array.from(new Set(packages.map((item) => item.audience))).map((value) => ({ value, label: value.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') }))], [packages]);
  const visiblePackages = packages.filter((item) => (brand === 'all' || item.brandSlug === brand) && (segment === 'all' || item.audience === segment));

  return (
    <>
      <SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} tierSummary={tierSummary} />
      <PromoNotice promotions={promotions} />
      <main className="brand-portal">
      <section className="brand-portal-hero brand-stage">
        <div className="brand-stage-image" aria-hidden="true">
          <div className="brand-stage-hand"></div>
          <div className="brand-stage-bottle brand-stage-bottle-one"></div>
          <div className="brand-stage-bottle brand-stage-bottle-two"></div>
          <div className="brand-stage-glow brand-stage-glow-one"></div>
          <div className="brand-stage-glow brand-stage-glow-two"></div>
        </div>
        <div className="brand-stage-inner">
          <p className="brand-eyebrow brand-eyebrow-light">Luminails / nail supply profesional</p>
          <h1>{mode === 'brands' ? <>Pilih brand yang<br /><em>sesuai cara kerjamu.</em></> : <>Paket untuk<br /><em>restock berikutnya.</em></>}</h1>
          <p className="brand-stage-lead">{mode === 'brands' ? 'Kenali brand yang tersedia, lalu pilih paket yang sesuai dengan kebutuhan studio atau salon kamu.' : 'Pilih paket berdasarkan volume dan kebutuhan restock. Semua isi paket ditampilkan dengan jelas sebelum order.'}</p>
<div className="brand-portal-actions"><a className="brand-button brand-button-light" href={mode === 'packages' ? '#package-rhythm' : '#brand-directory'}>{mode === 'brands' ? 'Pilih brand' : 'Lihat paket'} <span>-&gt;</span></a><Link className="brand-button brand-button-ghost" href="/about">Tentang Luminails</Link></div>
          <div className="brand-proof brand-proof-centered"><span><strong>12–24</strong> item per paket</span><span><strong>Dipilih</strong> untuk studio</span><span><strong>Khusus bisnis</strong> di Luminails</span></div>
        </div>
        <div className="brand-stage-caption"><span>Referensi warna /</span><strong>tekstur dan hasil akhir</strong></div>
      </section>
      <QuantityPriceBanner packages={packages} />
      <section className="brand-portal-section" id="brand-directory">
        <div className="brand-portal-shell">
          <div className="brand-section-head"><span className="brand-section-index">01 / {mode === 'brands' ? 'Pilih brand' : 'Lihat paket'}</span><div><h2>Mulai dari brand<br /><em>yang sudah kamu kenal.</em></h2><p>Setelah itu, pilih kebutuhan studio dan lihat paket yang disusun untuk volume kerja nyata.</p></div></div>
          <div className="brand-public-directory">{mode === 'brands' && publicBrands.map((item) => <Link key={item.id} className="brand-directory-card brand-directory-card-link" href={`/packages?brand=${item.slug}`}><span>{item.name}</span><small>{item.tagline || item.description || 'Brand pilihan Luminails'}</small><b>-&gt;</b></Link>)}</div><div className="brand-directory">
            {packageBrands.map((value) => <button key={value} className={`brand-directory-card ${brand === value ? 'is-selected' : ''}`} onClick={() => setBrand(value)}>
              <span>{value === 'all' ? 'Semua brand' : value}</span>
              <small>{value === 'all' ? packages.length + ' paket' : packages.filter((item) => item.brandSlug === value).length + ' paket'}</small>
              <b>-&gt;</b>
            </button>)}
          </div>
        </div>
      </section>

<section className="brand-portal-section brand-portal-section-tint" id={mode === 'packages' ? 'package-rhythm' : undefined}>
        <div className="brand-portal-shell">
          <div className="brand-section-head brand-section-head-compact"><span className="brand-section-index">02 / Pilih kebutuhan</span><div><h2>Paket dengan<br /><em>isi yang jelas.</em></h2><p>Fokus pada kebutuhan studio berikutnya, tanpa harus memilih satu per satu dari awal.</p></div></div>
          <div className="brand-segment-tabs">{segments.map((item) => <button key={item.value} className={segment === item.value ? 'is-active' : ''} onClick={() => setSegment(item.value)}>{item.label}</button>)}</div>
          <div className="brand-package-grid">{visiblePackages.map((item) => <PackageCard key={item.slug} item={item} promotion={promotions[0]} />)}</div>
          {visiblePackages.length === 0 && <div className="brand-empty">Belum ada paket untuk pilihan ini. Coba brand atau kebutuhan lain.</div>}
        </div>
      </section>

      <section className="brand-portal-section brand-portal-dark">
        <div className="brand-portal-shell brand-story-grid"><div><span className="brand-section-index">03 / Standar Luminails</span><h2>Premium yang memberi<br /><em>rasa percaya diri.</em></h2></div><div className="brand-story-copy"><p>Setiap paket dibuat agar lebih cepat dipilih, mudah diulang, dan jelas nilainya untuk bisnis kamu.</p><Link className="brand-button brand-button-outline" href="/about">Kenali Luminails <span>-&gt;</span></Link></div></div>
      </section>
      </main>
    </>
  );
}

function PackageCard({ item, promotion }: { item: BrandPackage; promotion?: StorefrontPromotion }) {
  const currentPrice = item.pricingModel === 'quantity_range' ? (item.quantityPrices?.[0]?.unitPriceIdr ?? item.price) : item.price;
  const normalPrice = item.pricingModel === 'quantity_range' ? null : Math.max(item.compareAt, currentPrice);
  const savings = normalPrice === null ? 0 : Math.max(0, normalPrice - currentPrice);
  return <Link className={`brand-package-card brand-package-card-${item.tone}`} href={`/packages/${item.slug}`}><div className="brand-package-art"><span>{item.badge}</span>{promotion && <b className="package-promo-badge">Promo {promotion.code}</b>}{item.imageUrl ? <img className="brand-package-photo" src={item.imageUrl} alt={item.title} loading="lazy" /> : <div className="brand-package-no-photo">Foto belum tersedia</div>}<small>{item.brand}</small></div><div className="brand-package-copy"><p>{item.audience.replace('-', ' ')}</p><h3>{item.title}</h3><span>{item.description}</span><div className="brand-package-price"><strong>{formatIDR(currentPrice)} <em>{item.pricingModel === 'quantity_range' ? 'mulai per botol' : 'harga paket'}</em></strong>{normalPrice !== null && normalPrice > currentPrice && <><del>Harga normal {formatIDR(normalPrice)}</del><small>Hemat {formatIDR(savings)}</small></>}</div><b className="brand-package-arrow">-&gt;</b></div></Link>;
}
