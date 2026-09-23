'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CatalogProduct } from '../lib/catalog';
import type { AccountIdentity as AccountIdentityData } from '../lib/account';
import type { CustomerProfile } from '../lib/account';
import { SiteNavigation } from './site-navigation';

type Cart = Record<string, number>;

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

export function Storefront({ products, identity, profile, needsProfile }: { products: CatalogProduct[]; identity: AccountIdentityData | null; profile: CustomerProfile | null; needsProfile: boolean }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast, setToast] = useState('');

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const categoryMatch = filter === 'all' || product.category === filter;
      const queryMatch = !normalized || `${product.brand} ${product.name} ${product.sku}`.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
    if (sort === 'price-low') return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === 'price-high') return [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [filter, products, query, sort]);

  const cartEntries = Object.entries(cart)
    .map(([id, quantity]) => ({ product: products.find((product) => product.id === id), quantity }))
    .filter((entry): entry is { product: CatalogProduct; quantity: number } => Boolean(entry.product && entry.quantity > 0));
  const cartCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const cartTotal = cartEntries.reduce((sum, entry) => sum + entry.quantity * entry.product.price, 0);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function addToCart(product: CatalogProduct) {
    setCart((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
    notify('Produk masuk ke keranjang.');
  }

  function updateQuantity(id: string, delta: number) {
    setCart((current) => {
      const nextQuantity = Math.max((current[id] ?? 0) + delta, 0);
      const next = { ...current };
      if (nextQuantity === 0) delete next[id];
      else next[id] = nextQuantity;
      return next;
    });
  }

  function resetCatalog() {
    setFilter('all');
    setQuery('');
  }

  function reviewOrder() {
    if (!identity) { setCartOpen(false); setLoginOpen(true); return; }
    if (needsProfile) { window.location.href = '/account/profile'; return; }
    notify('Data order siap. Tahap pembayaran dan kurir akan dikonfirmasi setelah review.');
  }

  return (
    <>
      <div className="announcement">Gratis konsultasi order untuk buyer B2B baru <span>-&gt;</span></div>
      <SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} onLoginOpen={() => setLoginOpen(true)} />

      <main id="top">
        <section className="hero section-pad">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line"></span> Luminails Commerce</p>
            <h1>Belanja nail supply, <em>dengan ritme</em> salon kamu.</h1>
            <p className="hero-description">Stok pilihan untuk tangan yang selalu bekerja. Harga B2B yang jelas, repeat order yang lebih cepat, dan support manusia saat kamu butuh.</p>
            <div className="hero-actions"><a className="button button-dark" href="/packages">Explore packages <span>-&gt;</span></a><button className="button button-quiet" onClick={() => setLoginOpen(true)}>Daftar akun B2B</button></div>
            <div className="hero-notes" aria-label="Keunggulan Luminails"><div><strong>500+</strong><span>SKU pilihan</span></div><div><strong>24 jam</strong><span>respon order</span></div><div><strong>1 alur</strong><span>untuk repeat</span></div></div>
          </div>
          <div className="hero-art" aria-label="Kolase warna produk Luminails" role="img"><div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div><span className="art-star star-one">*</span><span className="art-star star-two">*</span><div className="swatch-label label-top">SHADES<br /><b>SPRING / 26</b></div><div className="product-tile tile-main"><div className="tile-topline"><span>BLUESKY</span><span>GEL 07</span></div><div className="bottle-bloom bloom-coral"></div><div className="bottle-neck"></div><div className="bottle-cap"></div><div className="tile-name">petal<br /><em>glow</em></div></div><div className="product-tile tile-small tile-left"><div className="mini-cap"></div><div className="mini-bottle mini-lilac"></div><span>01 / soft lilac</span></div><div className="product-tile tile-small tile-right"><div className="mini-cap"></div><div className="mini-bottle mini-ink"></div><span>09 / ink noir</span></div><div className="art-caption">curated essentials<br /><b>for working artists</b></div></div>
        </section>

        <section className="signal-band" id="how-it-works"><div className="signal-intro"><span className="signal-mark">*</span><p>Order berulang<br /><em>tanpa mulai dari nol.</em></p></div><div className="signal-item"><span>01</span><p><b>Harga B2B rapi</b>Tier dan harga akunmu muncul otomatis.</p></div><div className="signal-item"><span>02</span><p><b>Review sebelum bayar</b>Ongkir final dikonfirmasi setelah allocation.</p></div><div className="signal-item"><span>03</span><p><b>Repeat semudah satu klik</b>Riwayat order jadi katalog personalmu.</p></div></section>

        <section className="catalog-section section-pad" id="catalog">
          <div className="section-heading"><div><p className="eyebrow">Supporting essentials</p><h2>Finish the package<br /><em>with intention.</em></h2></div><p className="section-intro">Temukan item pelengkap untuk melengkapi package utama studio kamu.</p></div>
          <div className="catalog-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari produk atau SKU" aria-label="Cari produk atau SKU" /></label><div className="filter-list" role="group" aria-label="Filter kategori">{[['all', 'Semua'], ['gel', 'Color gel'], ['prep', 'Prep'], ['tools', 'Tools']].map(([value, label]) => <button key={value} className={`filter-chip${filter === value ? ' is-active' : ''}`} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="sort-select">Urutkan <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Urutkan produk"><option value="featured">Pilihan kami</option><option value="price-low">Harga terendah</option><option value="price-high">Harga tertinggi</option></select></label></div>
          <div className="catalog-meta"><span><b>{visibleProducts.length}</b> produk contoh</span><span className="catalog-note">Harga demo B2B · Login untuk tier akunmu</span></div>
          {visibleProducts.length > 0 ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />)}</div> : <div className="empty-state"><span>◎</span><h3>Belum ketemu.</h3><p>Coba kata kunci lain atau reset filter katalog.</p><button className="button button-outline" onClick={resetCatalog}>Reset katalog</button></div>}
        </section>

        <section className="collection-section section-pad" id="collections"><div className="collection-intro"><p className="eyebrow">Mulai dari kebutuhanmu</p><h2>Rapi di rak,<br /><em>ringan di kepala.</em></h2><a href="#catalog" className="underlined-link">Jelajahi semua produk <span>-&gt;</span></a></div><div className="collection-grid"><a href="#catalog" className="collection-card card-lilac"><span className="collection-index">01</span><div className="collection-shape shape-bottle"></div><div><h3>Gel polish</h3><p>Warna yang siap dipakai kerja.</p></div><span className="collection-arrow">-&gt;</span></a><a href="#catalog" className="collection-card card-coral"><span className="collection-index">02</span><div className="collection-shape shape-tools"><i></i><i></i><i></i></div><div><h3>Prep &amp; tools</h3><p>Fondasi untuk hasil yang rapi.</p></div><span className="collection-arrow">-&gt;</span></a><a href="#catalog" className="collection-card card-ink"><span className="collection-index">03</span><div className="collection-shape shape-box"></div><div><h3>Studio restock</h3><p>Paket praktis untuk refill rutin.</p></div><span className="collection-arrow">-&gt;</span></a></div></section>
        <section className="closing-section section-pad"><div className="closing-mark">L<span>/</span>N</div><div><p className="eyebrow">Buat order pertamamu lebih ringan</p><h2>Salon yang sibuk<br /><em>butuh alur yang tenang.</em></h2></div><button className="button button-light" onClick={() => setLoginOpen(true)}>Mulai dari akun B2B <span>-&gt;</span></button></section>
      </main>

      <footer className="site-footer section-pad"><a className="brand" href="/">luminails<span className="brand-dot">.</span></a><p>Nail supply untuk tangan yang selalu bekerja.</p><div className="footer-links"><a href="#catalog">Katalog</a><a href="#how-it-works">Cara kerja</a><a href="#top">Bantuan</a></div><small>© 2026 Luminails Commerce · Next.js + Supabase foundation</small></footer>

      {cartOpen && <><div className="drawer-backdrop" onClick={() => setCartOpen(false)}></div><aside className="cart-drawer is-open" aria-label="Keranjang belanja"><div className="drawer-head"><div><p className="eyebrow">Order draft</p><h2>Keranjangmu</h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang">×</button></div><div className="drawer-body">{cartEntries.length === 0 ? <div className="drawer-empty"><span>*</span><p>Keranjangmu masih kosong.<br />Pilih essentials untuk mulai order.</p></div> : cartEntries.map(({ product, quantity }) => <div className="cart-line" key={product.id}><div className="cart-thumb"><div className={`product-bottle ${product.tone}`} data-shade={product.shade}></div></div><div><h3>{product.name}</h3><small>{product.sku} · {money(product.price)}</small><strong>{money(product.price * quantity)}</strong><div className="line-controls"><button onClick={() => updateQuantity(product.id, -1)} aria-label="Kurangi jumlah">-</button><span>{quantity}</span><button onClick={() => updateQuantity(product.id, 1)} aria-label="Tambah jumlah">+</button></div></div><button className="remove-line" onClick={() => updateQuantity(product.id, -quantity)} aria-label={`Hapus ${product.name}`}>×</button></div>)}</div><div className="drawer-foot"><div className="drawer-summary"><span>Subtotal contoh</span><strong>{money(cartTotal)}</strong></div><p>Ongkir akan dikonfirmasi setelah review fulfillment.</p><button className="button button-dark button-full" onClick={() => notify('Review order akan terhubung ke akun B2B.')}>Review order <span>-&gt;</span></button></div></aside></>}
      {loginOpen && <><div className="modal-backdrop" onClick={() => setLoginOpen(false)}></div><section className="login-modal is-open" role="dialog" aria-modal="true" aria-labelledby="login-title"><button className="icon-button modal-close" onClick={() => setLoginOpen(false)} aria-label="Tutup">×</button><span className="modal-kicker">LUMINAILS / B2B</span><h2 id="login-title">Harga yang mengikuti<br /><em>cara kerjamu.</em></h2><p>Masuk untuk melihat tier harga, menyimpan alamat studio, dan mengulang order lebih cepat.</p><Link className="button button-dark button-full" href="/auth" onClick={() => setLoginOpen(false)}>Lanjut dengan email <span>-&gt;</span></Link><button className="button button-outline button-full" onClick={() => setLoginOpen(false)}>Lihat-lihat dulu</button><small>User baru mulai dari harga standard. Tier Premium B2B aktif setelah threshold tercapai.</small></section></>}
      <div className={`toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

function ProductCard({ product, onAdd }: { product: CatalogProduct; onAdd: () => void }) {
  return <article className="product-card"><div className="product-image"><span className="product-badge">{product.badge}</span><div className={`product-bottle ${product.tone}`} data-shade={product.shade}></div><span className="product-sku">{product.sku}</span></div><div className="product-info"><div className="product-topline"><span>{product.brand}</span><span>{product.categoryLabel}</span></div><h3>{product.name}</h3><div className="product-bottom"><div className="product-price">{money(product.price)}<small>{product.priceLabel}</small></div><button className="add-product" onClick={onAdd} aria-label={`Tambah ${product.name} ke keranjang`}>+</button></div></div></article>;
}
