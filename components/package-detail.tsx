'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { BrandPackage } from '../lib/packages';
import { formatIDR, formatQuantity } from '../lib/packages';
import { SiteNavigation } from './site-navigation';

export function PackageDetail({ item }: { item: BrandPackage }) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  function continueToCheckout() {
    const params = new URLSearchParams({ package: item.slug, quantity: String(quantity) });
    if (notes.trim()) params.set('notes', notes.trim());
    window.location.href = '/checkout?' + params.toString();
  }

  return <><SiteNavigation /><main className="package-detail-page"><div className="package-detail-shell"><Link className="package-back-link" href="/brands">&lt;- Back to brand edit</Link><div className="package-detail-grid"><section className={`package-detail-art package-detail-art-${item.tone}`}><span className="package-detail-edition">{item.badge}</span><div className="package-detail-orbit"></div><div className="package-detail-bottle package-detail-bottle-one"></div><div className="package-detail-bottle package-detail-bottle-two"></div><div className="package-detail-stamp">{item.brand}<br /><b>B2B EDIT</b></div><p>CURATED FOR<br /><strong>{item.audience.replace('-', ' ')}</strong></p></section><section className="package-detail-copy"><p className="brand-eyebrow">{item.brand} / package edit</p><h1>{item.title}</h1><p className="package-detail-lead">{item.longDescription}</p><div className="package-price-row"><div><strong>{formatIDR(item.price)}</strong><span>per package - save {formatIDR(item.compareAt - item.price)}</span></div><span className="package-delivery">{item.delivery}</span></div><div className="package-highlights">{item.highlights.map((highlight) => <span key={highlight}>+  {highlight}</span>)}</div><div className="package-detail-actions"><label>Jumlah package<div className="quantity-control"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Kurangi jumlah package">-</button><span>{formatQuantity(quantity)}</span><button onClick={() => setQuantity((value) => value + 1)} aria-label="Tambah jumlah package">+</button></div></label><label>Catatan order<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: mohon shade neutral lebih banyak." /></label><button className="brand-button brand-button-dark package-checkout-button" onClick={continueToCheckout}>Lanjut ke checkout <span>-&gt;</span></button></div></section></div><section className="package-contents"><div className="brand-section-head brand-section-head-compact"><span className="brand-section-index">Inside the package</span><div><h2>Every item has<br /><em>a clear role.</em></h2><p>Komposisi package ditampilkan terbuka supaya mudah dicek sebelum order.</p></div></div><div className="package-content-list">{item.contents.map((content, index) => <div className="package-content-row" key={content.name}><b>{String(index + 1).padStart(2, '0')}</b><div><strong>{content.name}</strong><span>{content.note}</span></div><em>{formatQuantity(content.quantity)} pcs</em></div>)}</div></section></div></main></>;
}
