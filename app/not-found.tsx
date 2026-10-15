import Link from 'next/link';
import { SiteNavigation } from '../components/site-navigation';

export default function NotFound() {
  return (
    <>
      <SiteNavigation />
      <main className="not-found-page">
        <section className="not-found-shell" aria-labelledby="not-found-title">
          <div className="not-found-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> Luminails / studio supply</p>
            <h1 id="not-found-title">Halaman ini<br /><em>tidak ditemukan.</em></h1>
            <p className="not-found-lead">Sepertinya link yang kamu buka sudah pindah, berubah nama, atau belum tersedia di rak Luminails.</p>
            <div className="not-found-actions">
              <Link className="button button-dark" href="/">Kembali ke beranda <span aria-hidden="true">-&gt;</span></Link>
              <Link className="button button-quiet" href="/catalog">Lihat catalog <span aria-hidden="true">-&gt;</span></Link>
            </div>
            <div className="not-found-meta" aria-label="Informasi error">
              <span>kode halaman</span><strong>404</strong>
              <span>status</span><strong>tidak ada di katalog</strong>
            </div>
          </div>

          <div className="not-found-art" aria-hidden="true">
            <span className="not-found-number">404</span>
            <span className="not-found-orbit not-found-orbit-one" />
            <span className="not-found-orbit not-found-orbit-two" />
            <span className="not-found-spark not-found-spark-one">✦</span>
            <span className="not-found-spark not-found-spark-two">+</span>
            <span className="not-found-shelf not-found-shelf-one" />
            <span className="not-found-shelf not-found-shelf-two" />
            <span className="not-found-bottle not-found-bottle-coral"><i>LN</i></span>
            <span className="not-found-bottle not-found-bottle-ink"><i>?</i></span>
            <span className="not-found-label">missing<br /><b>studio essential</b></span>
            <span className="not-found-art-note">not on<br />the shelf</span>
          </div>
        </section>
      </main>
    </>
  );
}
