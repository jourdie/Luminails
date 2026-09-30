import type { TrustedLogo } from '../lib/trusted-logos';

export function CustomerTestimonials({ logos = [] }: { logos?: TrustedLogo[] }) {
  return <section className="testimonials-section section-pad" aria-labelledby="testimonials-title">
    <div className="testimonials-heading"><div><p className="eyebrow">Trusted by</p><h2 id="testimonials-title">Dipercaya oleh<br /><em>working studios.</em></h2></div><p>Logo partner dapat diatur urutannya dari admin workspace dan akan tampil seragam di halaman utama.</p></div>
    {logos.length ? <div className="testimonials-grid">{logos.map((logo) => <figure className="testimonial-card trusted-logo-card" key={logo.id}><img src={logo.imageUrl} alt={logo.altText || logo.name} /><figcaption><strong>{logo.name}</strong></figcaption></figure>)}</div> : <div className="trusted-logo-empty"><strong>Trusted by customer salon dan studio pilihan.</strong><p>Logo customer akan tampil di sini setelah ditambahkan dari admin workspace.</p></div>}
  </section>;
}