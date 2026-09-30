import type { Metadata } from 'next';
import { SiteNavigation } from '../../components/site-navigation';
import { getAccountContext } from '../../lib/account-server';

export const metadata: Metadata = {
  title: 'About us | Luminails',
  description: 'Tentang Luminails dan cara kami membantu salon menata restock nail supply.',
};

export default async function AboutPage() {
  const account = await getAccountContext();
  return <>
    <SiteNavigation identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} />
    <main className="about-page">
      <section className="about-hero section-pad">
        <div><p className="eyebrow"><span className="eyebrow-line"></span> Luminails / about us</p><h1>Supply yang rapi,<br /><em>untuk ritme salon.</em></h1></div>
        <p>Luminails membantu salon, nail artist, dan studio kecantikan menata pembelian nail supply melalui package yang jelas, katalog SKU yang mudah dicek, dan alur repeat order yang lebih tenang.</p>
      </section>
      <section className="about-story section-pad">
        <div><p className="eyebrow">Cara kami bekerja</p><h2>Kenali isi produk.<br /><em>Pilih package dengan yakin.</em></h2></div>
        <div className="about-story-copy"><p>Customer dapat browse brand dan SKU lebih dulu untuk mengecek warna, series, tools, dan essentials. Checkout dilakukan melalui package agar quantity, harga volume, stok, add-on, dan benefit tetap tervalidasi.</p><p>Setelah login, harga dan points mengikuti akunmu. Kami menjaga pengalaman tetap sederhana: lihat, pilih, checkout, lalu ulangi saat waktunya restock.</p><div className="about-socials"><a href="https://www.instagram.com/luminails.supply/" target="_blank" rel="noreferrer"><span className="about-social-icon about-social-instagram"><img src="/instagram-logo.jpeg" alt="Logo Instagram" /></span><span>Instagram</span><small>@luminails.supply</small></a><a href="https://shopee.co.id/luminails.supplies" target="_blank" rel="noreferrer"><span className="about-social-icon about-social-shopee"><img src="/shopee-logo.jpeg" alt="Logo Shopee" /></span><span>Shopee</span><small>luminails.supplies</small></a></div></div>
      </section>
      <section className="about-steps section-pad"><div><span>01</span><strong>Browse Catalog</strong><p>Pilih brand dan cek detail setiap SKU.</p></div><div><span>02</span><strong>Choose a Package</strong><p>Gunakan package sesuai ritme salonmu.</p></div><div><span>03</span><strong>Repeat with clarity</strong><p>Riwayat order dan points membantu restock berikutnya.</p></div></section>
    </main>
  </>;
}