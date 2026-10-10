import type { Metadata } from 'next';
import { SiteNavigation } from '../../components/site-navigation';
import { getAccountContext } from '../../lib/account-server';

export const metadata: Metadata = {
  title: 'About us | Luminails',
  description: 'Tentang Luminails dan cara kami membantu salon menata restock nail supply.',
};

export default async function AboutPage() {
  const account = await getAccountContext({ lightweight: true });
  return <>
    <SiteNavigation identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} />
    <main className="about-page">
      <section className="about-hero section-pad">
        <div><p className="eyebrow"><span className="eyebrow-line"></span> Tentang Luminails</p><h1>Supply yang rapi,<br /><em>untuk ritme salon.</em></h1></div>
        <p>Luminails membantu salon, nail artist, dan studio kecantikan menata pembelian nail supply melalui paket yang jelas, katalog produk yang mudah dicek, dan alur order ulang yang lebih tenang.</p>
      </section>
      <section className="about-story section-pad">
        <div><p className="eyebrow">Cara kami bekerja</p><h2>Kenali isi produk.<br /><em>Pilih paket dengan yakin.</em></h2></div>
        <div className="about-story-copy"><p>Kamu dapat melihat brand dan produk lebih dulu untuk mengecek warna, series, tools, dan essentials. Checkout dilakukan melalui paket agar jumlah, harga volume, stok, pilihan tambahan, dan benefit tetap jelas.</p><p>Setelah masuk, harga dan poin mengikuti akunmu. Pengalaman kami buat sederhana: lihat, pilih, checkout, lalu ulangi saat waktunya restock.</p><div className="about-socials"><a href="https://www.instagram.com/luminails.supply/" target="_blank" rel="noreferrer"><span className="about-social-icon about-social-instagram"><img src="/instagram-logo.jpeg" alt="Logo Instagram" /></span><span>Instagram</span><small>@luminails.supply</small></a><a href="https://shopee.co.id/luminails.supplies" target="_blank" rel="noreferrer"><span className="about-social-icon about-social-shopee"><img src="/shopee-logo.jpeg" alt="Logo Shopee" /></span><span>Shopee</span><small>luminails.supplies</small></a></div></div>
      </section>
      <section className="about-steps section-pad"><div><span>01</span><strong>Lihat katalog</strong><p>Pilih brand dan cek detail setiap produk.</p></div><div><span>02</span><strong>Pilih paket</strong><p>Gunakan paket sesuai ritme salonmu.</p></div><div><span>03</span><strong>Order ulang dengan mudah</strong><p>Riwayat order dan poin membantu restock berikutnya.</p></div></section>
    </main>
  </>;
}
