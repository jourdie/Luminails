'use client';

import Link from 'next/link';
import type { PackageRecommendation } from '../lib/packages';
import { formatIDR } from '../lib/packages';

export function PackageRecommendations({ items }: { items: PackageRecommendation[] }) {
  if (!items.length) return null;
  return <section className="package-recommendations">
    <div className="package-recommendations-head">
      <div><span className="brand-eyebrow">Continue the edit</span><h2>You Might Also Like..</h2></div>
      <p>Tools, SKU reference, dan package lain yang dipilih untuk alur order kamu.</p>
    </div>
    <div className="package-recommendations-grid">
      {items.map((item) => <Link className="package-recommendation-card" href={item.href} key={item.id}>
        <div className="package-recommendation-media">{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span>{item.kind === 'sku' ? 'SKU' : 'LN'}</span>}</div>
        <div className="package-recommendation-copy"><small>{item.kind === 'sku' ? 'SKU reference  /  package-first' : 'Package pilihan'}</small><h3>{item.title}</h3><p>{item.subtitle}</p><strong>{item.price != null ? formatIDR(item.price) : 'Lihat detail'} <span>-&gt;</span></strong></div>
      </Link>)}
    </div>
  </section>;
}
