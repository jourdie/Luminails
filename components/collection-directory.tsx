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
        <div><p className="eyebrow"><span className="eyebrow-line"></span> Luminails / catalog</p><h1>Start with the<br /><em>brand you trust.</em></h1></div>
        <div className="collection-directory-hero-copy"><p>Pilih brand untuk melihat semua SKU yang tersedia, cek warna dan series, lalu lanjutkan ke package yang paling sesuai dengan kebutuhan studio.</p><span className="collection-directory-count">{brands.length} brand curated</span></div>
      </section>
      <section className="collection-brand-stack section-pad" aria-labelledby="collection-brand-title">
        <div className="section-heading"><div><p className="eyebrow">01 / Choose a brand</p><h2 id="collection-brand-title">Every brand has<br /><em>its own point of view.</em></h2></div><p className="section-intro">Klik visual brand untuk masuk ke katalog SKU. Di dalamnya kamu bisa mencari, menyaring catalog, dan membuka detail setiap item.</p></div>
        {brands.length ? <div className="collection-brand-grid">{brands.map((brand, index) => <Link key={brand.id} className={`collection-brand-card collection-brand-card-${brand.visualTone}`} href={`/catalog/brand/${brand.slug}`}>
          <div className="collection-brand-visual">{brand.imageUrl ? <img src={brand.imageUrl} alt="" loading={index > 1 ? 'lazy' : undefined} /> : <div className="collection-brand-fallback"><span>{brand.name.slice(0, 1)}</span><small>Brand visual</small></div>}<div className="collection-brand-overlay"></div></div>
          <div className="collection-brand-card-copy"><span>{String(index + 1).padStart(2, '0')} / brand catalog</span><h3>{brand.name}</h3><p>{brand.tagline || brand.description || 'Browse the complete SKU catalog.'}</p><b>Lihat catalog <strong>-&gt;</strong></b></div>
        </Link>)}</div> : <div className="empty-state"><span aria-hidden="true">-</span><h3>Collection belum tersedia.</h3><p>Brand yang sudah dipublish akan tampil di halaman ini.</p></div>}
      </section>
    </main>
  </>;
}