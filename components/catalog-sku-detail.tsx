import Link from 'next/link';
import type { CatalogProduct } from '../lib/catalog';
import type { AccountIdentity as AccountIdentityData, CustomerProfile } from '../lib/account';
import type { AccountTierSummary } from '../lib/account-server';
import { SiteNavigation } from './site-navigation';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

export function CatalogSkuDetail({ product, identity, profile, needsProfile, tierSummary = null }: { product: CatalogProduct; identity: AccountIdentityData | null; profile: CustomerProfile | null; needsProfile: boolean; tierSummary?: AccountTierSummary | null }) {
  return <>
    <SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} tierSummary={tierSummary} />
    <main className="catalog-detail-page">
      <div className="catalog-detail-shell section-pad">
        <Link className="package-back-link" href="/catalog">&lt;- Kembali ke catalog</Link>
        <div className="catalog-detail-grid">
          <div className="catalog-detail-media">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span>SKU item</span>}<small>{product.sku}</small></div>
          <div className="catalog-detail-copy"><p className="eyebrow"><span className="eyebrow-line"></span> SKU detail / {product.brand}</p><h1>{product.name}</h1><p className="catalog-detail-description">Item ini bisa dilihat sebagai reference catalog dan dipilih melalui package yang sesuai.</p><div className="catalog-detail-meta"><div><span>Collection / series</span><strong>{product.series || 'Essentials'}</strong></div><div><span>Color / shade</span><strong>{product.color || 'Reference item'}</strong></div><div><span>Klasifikasi</span><strong>{product.categoryLabel}</strong></div><div><span>SKU code</span><strong>{product.sku}</strong></div></div><div className="catalog-detail-price"><span>{product.priceLabel}</span><strong>{product.price ? money(product.price) : 'Mengikuti package'}</strong><small>Harga ini adalah reference SKU. Checkout tetap melalui package.</small></div><div className="catalog-detail-actions">{product.packageLinks.length ? <div><span className="eyebrow">Package yang memuat SKU ini</span><div className="catalog-detail-package-links">{product.packageLinks.map((item) => <Link className="button button-dark" key={item.slug} href={`/packages/${item.slug}`}>{item.title} <span>-&gt;</span></Link>)}</div></div> : <Link className="button button-dark" href="/packages">Cari package yang sesuai <span>-&gt;</span></Link>}<Link className="underlined-link" href="/catalog">Lihat SKU lain</Link></div></div>
        </div>
      </div>
      <section className="catalog-detail-flow section-pad"><div><p className="eyebrow">Kenapa package-first?</p><h2>SKU untuk memilih.<br /><em>Package untuk order.</em></h2></div><p>Dengan cara ini customer bisa mengecek warna, series, dan tools lebih dulu, sementara sistem tetap menjaga quantity, stok, tier price, add-on, dan validasi checkout di satu alur package.</p></section>
    </main>
  </>;
}