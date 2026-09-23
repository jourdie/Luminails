'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { BrandPackage } from '../lib/packages';
import { formatIDR } from '../lib/packages';
import { SiteNavigation } from './site-navigation';

const segments = [
  { value: 'all', label: 'All packages' },
  { value: 'home-studio', label: 'Home studio' },
  { value: 'salon', label: 'Salon scale' },
  { value: 'restock', label: 'Restock' },
] as const;

export function BrandExplorer({ packages }: { packages: BrandPackage[] }) {
  const [brand, setBrand] = useState('all');
  const [segment, setSegment] = useState<(typeof segments)[number]['value']>('all');

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

  const brands = useMemo(() => ['all', ...Array.from(new Set(packages.map((item) => item.brandSlug)))], [packages]);
  const visiblePackages = packages.filter((item) => (brand === 'all' || item.brandSlug === brand) && (segment === 'all' || item.audience === segment));

  return (
    <>
      <SiteNavigation />
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
          <h1>Brands, selected<br /><em>for the way you work.</em></h1>
          <p className="brand-stage-lead">Jelajahi brand dan package eksklusif yang dikurasi untuk home studio, salon, dan ritme kerja profesional.</p>
          <div className="brand-portal-actions"><a className="brand-button brand-button-light" href="#brand-directory">Choose your brand <span>-&gt;</span></a><Link className="brand-button brand-button-ghost" href="/education">Read studio notes</Link></div>
          <div className="brand-proof brand-proof-centered"><span><strong>12-24</strong> item per package</span><span><strong>Curated</strong> by service</span><span><strong>B2B only</strong> on Luminails</span></div>
        </div>
        <div className="brand-stage-caption"><span>Blurred reference /</span><strong>colour, texture, finish</strong></div>
      </section>
      <section className="brand-portal-section" id="brand-directory">
        <div className="brand-portal-shell">
          <div className="brand-section-head"><span className="brand-section-index">01 / Choose your brand</span><div><h2>Start with a brand<br /><em>you already trust.</em></h2><p>Setelah itu, pilih kebutuhan studio dan lihat package yang sudah disusun untuk volume kerja nyata.</p></div></div>
          <div className="brand-directory">
            {brands.map((value) => <button key={value} className={`brand-directory-card ${brand === value ? 'is-selected' : ''}`} onClick={() => setBrand(value)}>
              <span>{value === 'all' ? 'All brands' : value === 'luminails-lab' ? 'Luminails Lab' : value === 'bluesky' ? 'Bluesky' : 'PARTY!'}</span>
              <small>{value === 'all' ? packages.length + ' packages' : packages.filter((item) => item.brandSlug === value).length + ' packages'}</small>
              <b>-&gt;</b>
            </button>)}
          </div>
        </div>
      </section>

      <section className="brand-portal-section brand-portal-section-tint">
        <div className="brand-portal-shell">
          <div className="brand-section-head brand-section-head-compact"><span className="brand-section-index">02 / Choose your rhythm</span><div><h2>Packages with a<br /><em>clear point of view.</em></h2><p>No marketplace clutter. Just the next shelf decision, made easier.</p></div></div>
          <div className="brand-segment-tabs">{segments.map((item) => <button key={item.value} className={segment === item.value ? 'is-active' : ''} onClick={() => setSegment(item.value)}>{item.label}</button>)}</div>
          <div className="brand-package-grid">{visiblePackages.map((item) => <PackageCard key={item.slug} item={item} />)}</div>
          {visiblePackages.length === 0 && <div className="brand-empty">No package in this edit yet. Try another brand or studio rhythm.</div>}
        </div>
      </section>

      <section className="brand-portal-section brand-portal-dark">
        <div className="brand-portal-shell brand-story-grid"><div><span className="brand-section-index">03 / The Luminails standard</span><h2>Premium is a quieter kind of <em>confidence.</em></h2></div><div className="brand-story-copy"><p>Setiap package punya alasan untuk ada: lebih cepat dipilih, lebih mudah diulang, dan lebih jelas nilai bisnisnya.</p><Link className="brand-button brand-button-outline" href="/education">Explore studio education <span>-&gt;</span></Link></div></div>
      </section>
      </main>
    </>
  );
}

function PackageCard({ item }: { item: BrandPackage }) {
  return <Link className={`brand-package-card brand-package-card-${item.tone}`} href={`/packages/${item.slug}`}><div className="brand-package-art"><span>{item.badge}</span><div className="brand-mini-bottle"></div><small>{item.brand}</small></div><div className="brand-package-copy"><p>{item.audience.replace('-', ' ')}</p><h3>{item.title}</h3><span>{item.description}</span><strong>{formatIDR(item.price)} <em>per package</em></strong><b className="brand-package-arrow">-&gt;</b></div></Link>;
}
