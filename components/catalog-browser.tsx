'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CatalogProduct } from '../lib/catalog';
import type { AccountIdentity as AccountIdentityData, CustomerProfile } from '../lib/account';
import type { AccountTierSummary } from '../lib/account-server';
import { SiteNavigation } from './site-navigation';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

export function CatalogBrowser({ products, identity, profile, needsProfile, tierSummary = null }: { products: CatalogProduct[]; identity: AccountIdentityData | null; profile: CustomerProfile | null; needsProfile: boolean; tierSummary?: AccountTierSummary | null }) {
  const [query, setQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState('featured');
  const collections = useMemo(() => Array.from(new Set(products.map((product) => product.series.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [products]);
  const categories = useMemo(() => Array.from(new Map(products.map((product) => [product.category, product.categoryLabel])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [products]);
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCollection = collectionFilter === 'all' || product.series === collectionFilter;
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const haystack = `${product.brand} ${product.name} ${product.sku} ${product.series} ${product.color} ${product.categoryLabel}`.toLowerCase();
      return matchesCollection && matchesCategory && (!normalized || haystack.includes(normalized));
    });
    if (sort === 'price-low') return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === 'price-high') return [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [categoryFilter, collectionFilter, products, query, sort]);

  return <>
    <SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} tierSummary={tierSummary} />
    <main className="catalog-browser-page">
      <section className="catalog-browser-hero section-pad">
        <div><p className="eyebrow"><span className="eyebrow-line"></span> Luminails / katalog</p><h1>Kenali setiap produk,<br /><em>sebelum pilih paket.</em></h1></div>
        <div className="catalog-browser-hero-copy"><p>Cari produk berdasarkan brand, series, warna, atau kategori. Buka kartu produk untuk melihat detail dan paket yang memuatnya.</p><Link className="underlined-link" href="/packages">Lihat semua paket <span>-&gt;</span></Link></div>
      </section>

      <section className="catalog-browser-content section-pad" aria-labelledby="catalog-browser-title">
        <div className="section-heading"><div><p className="eyebrow">Katalog produk</p><h2 id="catalog-browser-title">Cek produk satu<br /><em>per satu.</em></h2></div><p className="section-intro">Lihat detail produk sebelum memilih paket. Checkout dilakukan melalui paket agar jumlah, stok, dan pilihan tambahan tetap jelas.</p></div>
        <div className="catalog-toolbar catalog-browser-toolbar">
          <label className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari SKU, nama, warna, series" aria-label="Cari SKU, nama, warna, series" /></label>
          <div className="filter-list catalog-collection-filters" role="group" aria-label="Filter collection"><button type="button" className={`filter-chip${collectionFilter === 'all' ? ' is-active' : ''}`} onClick={() => setCollectionFilter('all')}>Semua catalog</button>{collections.map((collection) => <button type="button" key={collection} className={`filter-chip${collectionFilter === collection ? ' is-active' : ''}`} onClick={() => setCollectionFilter(collection)}>{collection}</button>)}</div>
          <label className="catalog-classification-select">Klasifikasi <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter klasifikasi"><option value="all">Semua klasifikasi</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="sort-select">Urutkan <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Urutkan katalog"><option value="featured">Pilihan kami</option><option value="price-low">Harga terendah</option><option value="price-high">Harga tertinggi</option></select></label>
        </div>
        <div className="catalog-meta"><span><b>{visibleProducts.length}</b> dari {products.length} produk</span><span className="catalog-note">Klik kartu untuk melihat detail</span></div>
        {visibleProducts.length ? <div className="catalog-browser-grid">{visibleProducts.map((product) => <CatalogBrowserCard key={product.id} product={product} />)}</div> : <div className="empty-state"><span aria-hidden="true">-</span><h3>Belum ketemu.</h3><p>Coba kata kunci atau klasifikasi lain.</p><button type="button" className="button button-outline" onClick={() => { setQuery(''); setCollectionFilter('all'); setCategoryFilter('all'); }}>Reset katalog</button></div>}
      </section>

      <section className="catalog-flow section-pad" aria-label="Alur dari katalog ke checkout"><div className="catalog-flow-intro"><p className="eyebrow">Cara belanja</p><h2>Temukan produk,<br /><em>pilih paket.</em></h2></div><div className="catalog-flow-steps"><div><span>01</span><strong>Lihat katalog</strong><p>Temukan warna, tools, essentials, atau series lain.</p></div><div><span>02</span><strong>Cek detail produk</strong><p>Lihat foto, warna, series, dan paket yang memuatnya.</p></div><div><span>03</span><strong>Checkout paket</strong><p>Jumlah, stok, pilihan tambahan, dan checkout diproses di paket.</p></div></div></section>
    </main>
  </>;
}

function CatalogBrowserCard({ product }: { product: CatalogProduct }) {
  const packageLink = product.packageLinks[0];
  const detailHref = `/catalog/${encodeURIComponent(product.sku)}`;
  return <article className="catalog-browser-card">
    <Link className="catalog-browser-image-link" href={detailHref} aria-label={`Lihat detail ${product.name}`}><div className="catalog-browser-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} width={640} height={640} loading="lazy" /> : <span>Produk</span>}<b>{product.badge}</b><small>{product.sku}</small><span className="catalog-view-label">Lihat detail <strong>-&gt;</strong></span></div></Link>
    <div className="catalog-browser-card-copy"><div className="product-topline"><span>{product.brand}</span><span>{product.series || product.categoryLabel}</span></div><h3><Link href={detailHref}>{product.name}</Link></h3>{(product.series || product.color) && <p>{product.series}{product.series && product.color ? ' / ' : ''}{product.color}</p>}<div className="catalog-browser-card-foot"><span>{product.price ? money(product.price) : 'Harga mengikuti paket'}</span>{packageLink ? <Link className="button button-dark" href={`/packages/${packageLink.slug}`}>Lihat paket <span>-&gt;</span></Link> : <Link className="button button-outline" href="/packages">Cari paket</Link>}</div></div>
  </article>;
}
