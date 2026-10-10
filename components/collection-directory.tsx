import Link from 'next/link';
import type { AccountIdentity as AccountIdentityData, CustomerProfile } from '../lib/account';
import type { AccountTierSummary } from '../lib/account-server';
import type { PublicBrand } from '../lib/packages-server';
import { SiteNavigation } from './site-navigation';

export function CollectionDirectory({ brands, identity, profile, needsProfile, tierSummary = null, basePath = '/catalog' }: { brands: PublicBrand[]; identity: AccountIdentityData | null; profile: CustomerProfile | null; needsProfile: boolean; tierSummary?: AccountTierSummary | null; basePath?: string }) {
  return <>
    <SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} tierSummary={tierSummary} />
    <main className="collection-directory-page">
      <section className="collection-directory-hero section-pad">
        <div><p className="eyebrow"><span className="eyebrow-line"></span> Luminails / katalog</p><h1>Mulai dari brand<br /><em>yang kamu percaya.</em></h1></div>
        <div className="collection-directory-hero-copy"><p>Pilih brand untuk melihat produk yang tersedia, cek warna dan series, lalu lanjutkan ke paket yang paling sesuai dengan kebutuhan studio.</p><span className="collection-directory-count">{brands.length} brand tersedia</span></div>
      </section>
      <section className="collection-brand-stack section-pad" aria-labelledby="collection-brand-title">
        <div className="section-heading"><div><p className="eyebrow">01 / Pilih brand</p><h2 id="collection-brand-title">Setiap brand punya<br /><em>karakter sendiri.</em></h2></div><p className="section-intro">Pilih brand untuk membuka katalog produk, mencari item, dan melihat detailnya.</p></div>
        {brands.length ? <div className="collection-brand-grid">{brands.map((brand, index) => <Link key={brand.id} className={`collection-brand-card collection-brand-card-${brand.visualTone}`} href={`/catalog/brand/${brand.slug}`}>
          <div className="collection-brand-visual">{brand.imageUrl ? <img src={brand.imageUrl} alt="" loading={index > 1 ? 'lazy' : undefined} /> : <div className="collection-brand-fallback"><span>{brand.name.slice(0, 1)}</span><small>Brand visual</small></div>}<div className="collection-brand-overlay"></div></div>
          <div className="collection-brand-card-copy"><span>{String(index + 1).padStart(2, '0')} / katalog brand</span><h3>{brand.name}</h3><p>{brand.tagline || brand.description || 'Lihat produk dari brand ini.'}</p><b>Lihat katalog <strong>-&gt;</strong></b></div>
        </Link>)}</div> : <div className="empty-state"><span aria-hidden="true">-</span><h3>Belum ada brand.</h3><p>Brand yang tersedia akan tampil di halaman ini.</p></div>}
      </section>
    </main>
  </>;
}
