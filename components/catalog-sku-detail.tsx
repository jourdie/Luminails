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
        <Link className="package-back-link" href="/catalog">&lt;- Kembali ke katalog</Link>
        <div className="catalog-detail-grid">
          <div className="catalog-detail-media">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} width={800} height={800} /> : <span>SKU item</span>}<small>{product.sku}</small></div>
          <div className="catalog-detail-copy"><p className="eyebrow"><span className="eyebrow-line"></span> Detail produk / {product.brand}</p><h1>{product.name}</h1><p className="catalog-detail-description">Lihat detail produk ini sebelum memilih paket yang sesuai.</p><div className="catalog-detail-meta"><div><span>Koleksi / seri</span><strong>{product.series || 'Essentials'}</strong></div><div><span>Warna</span><strong>{product.color || 'Produk pilihan'}</strong></div><div><span>Klasifikasi</span><strong>{product.categoryLabel}</strong></div><div><span>Kode produk</span><strong>{product.sku}</strong></div></div><div className="catalog-detail-price"><span>{product.priceLabel}</span><strong>{product.price ? money(product.price) : 'Mengikuti paket'}</strong><small>Harga produk adalah referensi. Checkout tetap melalui paket.</small></div><div className="catalog-detail-actions">{product.packageLinks.length ? <div><span className="eyebrow">Paket yang memuat produk ini</span><div className="catalog-detail-package-links">{product.packageLinks.map((item) => <Link className="button button-dark" key={item.slug} href={`/packages/${item.slug}`}>{item.title} <span>-&gt;</span></Link>)}</div></div> : <Link className="button button-dark" href="/packages">Cari paket yang sesuai <span>-&gt;</span></Link>}<Link className="underlined-link" href="/catalog">Lihat produk lain</Link></div></div>
        </div>
      </div>
      <section className="catalog-detail-flow section-pad"><div><p className="eyebrow">Cara belanja</p><h2>Produk untuk memilih.<br /><em>Paket untuk order.</em></h2></div><p>Kamu bisa mengecek warna, series, dan tools lebih dulu. Setelah itu, jumlah, stok, pilihan tambahan, dan checkout tetap berjalan dalam satu paket.</p></section>
    </main>
  </>;
}
