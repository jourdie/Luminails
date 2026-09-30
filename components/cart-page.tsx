'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatIDR } from '../lib/packages';
import { SiteNavigation } from './site-navigation';
import type { AccountIdentity as AccountIdentityData, CustomerProfile } from '../lib/account';
import type { AccountTierSummary } from '../lib/account-server';

type CartItem = {
  title: string;
  slug: string;
  quantity: number;
  checkoutHref: string;
  unitPrice?: number;
  subtotal?: number;
  priceLabel?: string;
};

function money(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? formatIDR(value) : 'Belum tersedia';
}

export function CartPage({ identity, profile, needsProfile, tierSummary }: { identity: AccountIdentityData | null; profile: CustomerProfile | null; needsProfile: boolean; tierSummary: AccountTierSummary | null }) {
  const [item, setItem] = useState<CartItem | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('luminails-cart');
      const stored = raw ? JSON.parse(raw) as CartItem : null;
      setItem(stored);
      if (stored && typeof stored.unitPrice !== 'number' && stored.slug) {
        fetch('/api/cart/price?slug=' + encodeURIComponent(stored.slug) + '&quantity=' + encodeURIComponent(String(stored.quantity)))
          .then((response) => response.ok ? response.json() as Promise<{ unitPrice?: number; priceLabel?: string }> : null)
          .then((price) => {
            if (!price?.unitPrice) return;
            const enriched = { ...stored, unitPrice: Number(price.unitPrice), subtotal: Number(price.unitPrice) * stored.quantity, priceLabel: price.priceLabel ?? stored.priceLabel };
            window.localStorage.setItem('luminails-cart', JSON.stringify(enriched));
            setItem(enriched);
          })
          .catch(() => undefined);
      }
    } catch {
      setItem(null);
    }
    setReady(true);
  }, []);

  function clearCart() {
    window.localStorage.removeItem('luminails-cart');
    window.dispatchEvent(new Event('luminails-cart-updated'));
    setItem(null);
  }

  return <><SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} tierSummary={tierSummary} /><main className="cart-page"><div className="cart-page-shell">
    <Link className="package-back-link" href="/packages">&lt;- Kembali ke packages</Link>
    <p className="brand-eyebrow">Luminails / shopping cart</p>
    <h1>Keranjang<br /><em>order kamu.</em></h1>
    {!ready ? <p className="cart-page-note">Menyiapkan keranjang...</p> : item ? <>
      <section className="cart-page-card">
        <div className="cart-page-item-copy"><span className="checkout-kicker">1 package tersimpan</span><h2>{item.title}</h2><p>Add-on tools dan accessories dipilih di langkah checkout setelah package ini.</p></div>
        <div className="cart-page-item-meta" aria-label="Ringkasan harga package">
          <div><span>{item.priceLabel ?? 'Harga package'}</span><strong>{money(item.unitPrice)}</strong></div>
          <div><span>Jumlah</span><strong>{item.quantity}</strong></div>
          <div className="cart-page-subtotal"><span>Subtotal</span><strong>{money(item.subtotal ?? (item.unitPrice !== undefined ? item.unitPrice * item.quantity : undefined))}</strong></div>
        </div>
        <div className="cart-page-actions"><Link className="brand-button brand-button-dark" href={item.checkoutHref}>Lanjut ke checkout <span>-&gt;</span></Link><button className="cart-delete-button" type="button" onClick={clearCart} aria-label="Hapus package dari keranjang" title="Hapus package dari keranjang"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h6l1-13M10 11v5m4-5v5" /></svg></button></div>
      </section>
      <section className="cart-add-product"><div><span className="checkout-kicker">Masih perlu produk lain?</span><h2>Tambah item untuk studio kamu.</h2><p>Pilih package lain dari katalog. Keranjang akan menyimpan pilihan terbaru sebelum kamu lanjut checkout.</p></div><Link className="brand-button brand-button-light" href="/packages">Tambah produk <span>+</span></Link></section>
    </> : <section className="cart-page-card cart-page-empty"><h2>Belum ada package.</h2><p>Pilih package terlebih dahulu. Setelah itu pilihan quantity dan nominal akan tersimpan di sini sebelum checkout.</p><Link className="brand-button brand-button-dark" href="/packages">Tambah produk <span>+</span></Link></section>}
  </div></main></>;
}