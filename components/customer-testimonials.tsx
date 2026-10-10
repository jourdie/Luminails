import type { TrustedLogo } from '../lib/trusted-logos';

export function CustomerTestimonials({ logos = [] }: { logos?: TrustedLogo[] }) {
  return <section className="testimonials-section section-pad" aria-labelledby="testimonials-title">
    <div className="testimonials-heading"><div><p className="eyebrow">Partner studio</p><h2 id="testimonials-title">Dipilih oleh<br /><em>studio yang aktif.</em></h2></div><p>Temukan produk yang sudah dipercaya oleh salon, nail artist, dan studio kecantikan.</p></div>
    {logos.length ? <div className="testimonials-grid">{logos.map((logo) => <figure className="testimonial-card trusted-logo-card" key={logo.id}><img src={logo.imageUrl} alt={logo.altText || logo.name} width={480} height={240} loading="lazy" /><figcaption><strong>{logo.name}</strong></figcaption></figure>)}</div> : <div className="trusted-logo-empty"><strong>Partner studio akan tampil di sini.</strong><p>Koleksi partner Luminails sedang disiapkan.</p></div>}
  </section>;
}
