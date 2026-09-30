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
  const segments = useMemo(() => [{ value: 'all', label: 'All packages' }, ...Array.from(new Set(packages.map((item) => item.audience))).map((value) => ({ value, label: value.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') }))], [packages]);
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
          <p className="brand-eyebrow brand-eyebrow-light">Luminails / professional nail supply</p>
          <h1>{mode === 'brands' ? <>Brands, selected<br /><em>for the way you work.</em></> : <>Packages built<br /><em>for your next restock.</em></>}</h1>
          <p className="brand-stage-lead">{mode === 'brands' ? 'Kenali brand yang tersedia di Luminails, lalu pilih package yang cocok dengan ritme home studio atau salon kamu.' : 'Pilih package berdasarkan volume, tipe studio, dan kebutuhan restock. Isi package sudah dikunci agar order tetap jelas.'}</p>
<div className="brand-portal-actions"><a className="brand-button brand-button-light" href={mode === 'packages' ? '#package-rhythm' : '#brand-directory'}>{mode === 'brands' ? 'Choose your brand' : 'Browse packages'} <span>-&gt;</span></a><Link className="brand-button brand-button-ghost" href="/about">Read studio notes</Link></div>
          <div className="brand-proof brand-proof-centered"><span><strong>12-24</strong> item per package</span><span><strong>Curated</strong> by service</span><span><strong>Khusus bisnis</strong> di Luminails</span></div>
        </div>
        <div className="brand-stage-caption"><span>Blurred reference /</span><strong>colour, texture, finish</strong></div>
      </section>
      <QuantityPriceBanner packages={packages} />
      <section className="brand-portal-section" id="brand-directory">
        <div className="brand-portal-shell">
          <div className="brand-section-head"><span className="brand-section-index">01 / {mode === 'brands' ? 'Choose your brand' : 'Browse packages'}</span><div><h2>Start with a brand<br /><em>you already trust.</em></h2><p>Setelah itu, pilih kebutuhan studio dan lihat package yang sudah disusun untuk volume kerja nyata.</p></div></div>
          <div className="brand-public-directory">{mode === 'brands' && publicBrands.map((item) => <Link key={item.id} className="brand-directory-card brand-directory-card-link" href={`/packages?brand=${item.slug}`}><span>{item.name}</span><small>{item.tagline || item.description || 'Brand pilihan Luminails'}</small><b>-&gt;</b></Link>)}</div><div className="brand-directory">
            {packageBrands.map((value) => <button key={value} className={`brand-directory-card ${brand === value ? 'is-selected' : ''}`} onClick={() => setBrand(value)}>
              <span>{value === 'all' ? 'All brands' : value}</span>
              <small>{value === 'all' ? packages.length + ' packages' : packages.filter((item) => item.brandSlug === value).length + ' packages'}</small>
              <b>-&gt;</b>
            </button>)}
          </div>
        </div>
      </section>

<section className="brand-portal-section brand-portal-section-tint" id={mode === 'packages' ? 'package-rhythm' : undefined}>
        <div className="brand-portal-shell">
          <div className="brand-section-head brand-section-head-compact"><span className="brand-section-index">02 / Choose your rhythm</span><div><h2>Packages with a<br /><em>clear point of view.</em></h2><p>No marketplace clutter. Just the next shelf decision, made easier.</p></div></div>
          <div className="brand-segment-tabs">{segments.map((item) => <button key={item.value} className={segment === item.value ? 'is-active' : ''} onClick={() => setSegment(item.value)}>{item.label}</button>)}</div>
          <div className="brand-package-grid">{visiblePackages.map((item) => <PackageCard key={item.slug} item={item} promotion={promotions[0]} />)}</div>
          {visiblePackages.length === 0 && <div className="brand-empty">No package in this edit yet. Try another brand or studio rhythm.</div>}
        </div>
      </section>

      <section className="brand-portal-section brand-portal-dark">
        <div className="brand-portal-shell brand-story-grid"><div><span className="brand-section-index">03 / The Luminails standard</span><h2>Premium is a quieter kind of <em>confidence.</em></h2></div><div className="brand-story-copy"><p>Setiap package punya alasan untuk ada: lebih cepat dipilih, lebih mudah diulang, dan lebih jelas nilai bisnisnya.</p><Link className="brand-button brand-button-outline" href="/about">Explore studio education <span>-&gt;</span></Link></div></div>
      </section>
      </main>
    </>
  );
}

function PackageCard({ item, promotion }: { item: BrandPackage; promotion?: StorefrontPromotion }) {
  const currentPrice = item.pricingModel === 'quantity_range' ? (item.quantityPrices?.[0]?.unitPriceIdr ?? item.price) : item.price;
  const normalPrice = item.pricingModel === 'quantity_range' ? null : Math.max(item.compareAt, currentPrice);
  const savings = normalPrice === null ? 0 : Math.max(0, normalPrice - currentPrice);
  return <Link className={`brand-package-card brand-package-card-${item.tone}`} href={`/packages/${item.slug}`}><div className="brand-package-art"><span>{item.badge}</span>{promotion && <b className="package-promo-badge">Promo {promotion.code}</b>}{item.imageUrl ? <img className="brand-package-photo" src={item.imageUrl} alt={item.title} loading="lazy" /> : <div className="brand-package-no-photo">Foto belum tersedia</div>}<small>{item.brand}</small></div><div className="brand-package-copy"><p>{item.audience.replace('-', ' ')}</p><h3>{item.title}</h3><span>{item.description}</span><div className="brand-package-price"><strong>{formatIDR(currentPrice)} <em>{item.pricingModel === 'quantity_range' ? 'mulai / botol' : 'harga package'}</em></strong>{normalPrice !== null && normalPrice > currentPrice && <><del>Normal {formatIDR(normalPrice)}</del><small>Hemat {formatIDR(savings)}</small></>}</div><b className="brand-package-arrow">-&gt;</b></div></Link>;
}
