'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CatalogProduct } from '../lib/catalog';
import type { AccountIdentity as AccountIdentityData, CustomerProfile } from '../lib/account';
import type { AccountTierSummary } from '../lib/account-server';
import { SiteNavigation } from './site-navigation';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

export function CollectionProductBrowser({ brandName, brandSlug, products, identity, profile, needsProfile, tierSummary = null, basePath = '/catalog' }: { brandName: string; brandSlug: string; products: CatalogProduct[]; identity: AccountIdentityData | null; profile: CustomerProfile | null; needsProfile: boolean; tierSummary?: AccountTierSummary | null; basePath?: string }) {
  const [query, setQuery] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState('featured');
  const series = useMemo(() => Array.from(new Set(products.map((product) => product.series.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [products]);
  const categories = useMemo(() => Array.from(new Map(products.map((product) => [product.category, product.categoryLabel])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [products]);
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesSeries = seriesFilter === 'all' || product.series === seriesFilter;
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const haystack = `${product.brand} ${product.name} ${product.sku} ${product.series} ${product.color} ${product.categoryLabel}`.toLowerCase();
      return matchesSeries && matchesCategory && (!normalized || haystack.includes(normalized));
    });
    if (sort === 'price-low') return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === 'price-high') return [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [categoryFilter, products, query, seriesFilter, sort]);

  return <><SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} tierSummary={tierSummary} /><main className="collection-products-page">
    <section className="collection-products-hero section-pad">
      <Link className="package-back-link" href={basePath}>&lt;- Semua catalog</Link>
      <div className="collection-products-hero-grid"><div><p className="eyebrow"><span className="eyebrow-line"></span> {brandName} / SKU catalog</p><h1>Explore the<br /><em>full catalog.</em></h1></div><p>Semua SKU {brandName} dalam satu tempat. Cari berdasarkan nama, warna, series, atau klasifikasi sebelum memilih package.</p></div>
    </section>
    <section className="collection-products-content section-pad" aria-labelledby="collection-products-title">
      <div className="section-heading"><div><p className="eyebrow">02 / Browse SKUs</p><h2 id="collection-products-title">Find your<br /><em>next studio essential.</em></h2></div><p className="section-intro">SKU hanya untuk katalog reference. Checkout tetap dilakukan melalui package agar quantity, stok, add-on, dan tier price tervalidasi.</p></div>
      <div className="catalog-toolbar collection-products-toolbar">
        <label className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari SKU, nama, warna" aria-label="Cari SKU, nama, warna" /></label>
        <div className="filter-list collection-series-filters" role="group" aria-label="Filter series"><button type="button" className={`filter-chip${seriesFilter === 'all' ? ' is-active' : ''}`} onClick={() => setSeriesFilter('all')}>Semua catalog</button>{series.map((item) => <button type="button" className={`filter-chip${seriesFilter === item ? ' is-active' : ''}`} key={item} onClick={() => setSeriesFilter(item)}>{item}</button>)}</div>
        <label className="catalog-classification-select">Klasifikasi <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter klasifikasi"><option value="all">Semua</option>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="sort-select">Urutkan <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Urutkan SKU"><option value="featured">Pilihan kami</option><option value="price-low">Harga terendah</option><option value="price-high">Harga tertinggi</option></select></label>
      </div>
      <div className="catalog-meta"><span><b>{visibleProducts.length}</b> dari {products.length} SKU</span><span className="catalog-note">Klik kartu untuk melihat detail</span></div>
      {visibleProducts.length ? <div className="catalog-browser-grid">{visibleProducts.map((product) => <CollectionProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><span aria-hidden="true">-</span><h3>Belum ketemu.</h3><p>Coba kata kunci atau filter lain.</p><button type="button" className="button button-outline" onClick={() => { setQuery(''); setSeriesFilter('all'); setCategoryFilter('all'); }}>Reset filter</button></div>}
    </section>
    <section className="collection-products-footer section-pad"><div><p className="eyebrow">03 / Ready to order?</p><h2>Pilih SKU, lalu<br /><em>fill your package.</em></h2></div><Link className="button button-light" href={`/packages?brand=${brandSlug}`}>Lihat package {brandName} <span>-&gt;</span></Link></section>
  </main></>;
}

function CollectionProductCard({ product }: { product: CatalogProduct }) {
  const detailHref = `/catalog/${encodeURIComponent(product.sku)}`;
  const packageLink = product.packageLinks[0];
  return <article className="catalog-browser-card collection-product-card"><Link className="catalog-browser-image-link" href={detailHref} aria-label={`Lihat detail ${product.name}`}><div className="catalog-browser-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <span>SKU item</span>}<b>{product.badge}</b><small>{product.sku}</small><span className="catalog-view-label">View SKU detail <strong>-&gt;</strong></span></div></Link><div className="catalog-browser-card-copy"><div className="product-topline"><span>{product.categoryLabel}</span><span>{product.series || product.color}</span></div><h3><Link href={detailHref}>{product.name}</Link></h3>{product.color && <p>{product.color}</p>}<div className="catalog-browser-card-foot"><span>{product.price ? money(product.price) : 'Harga mengikuti package'}</span>{packageLink ? <Link className="button button-dark" href={`/packages/${packageLink.slug}`}>Lihat package <span>-&gt;</span></Link> : <Link className="button button-outline" href={`/packages?brand=${product.brand}`}>Cari package</Link>}</div></div></article>;
}