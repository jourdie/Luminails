import Link from 'next/link';
import type { BrandPackage } from '../lib/packages';
import { formatIDR } from '../lib/packages';

export function QuantityPriceBanner({ packages, compact = false }: { packages: BrandPackage[]; compact?: boolean }) {
  const quantityPackages = packages.filter((item) => item.pricingModel === 'quantity_range' && (item.quantityPrices?.length ?? 0) > 0);
  if (!quantityPackages.length) return null;

  return <section className={'quantity-price-banner' + (compact ? ' quantity-price-banner-compact' : '')} aria-label={'Harga paket berdasarkan jumlah'}>
    <div className={'quantity-price-banner-head'}>
      <div><span className={'brand-eyebrow'}>Harga volume</span><h2>Lebih banyak kebutuhan,<br /><em>lebih ringan harganya.</em></h2></div>
      <p>Harga per botol menyesuaikan jumlah yang kamu pilih.</p>
    </div>
    <div className={'quantity-price-banner-grid'}>
      {quantityPackages.map((item) => <Link className={'quantity-price-banner-card'} href={'/packages/' + item.slug} key={item.slug}>
        <span>{item.brand} / {item.audience.replace('-', ' ')}</span>
        <strong>{item.title}</strong>
        <div className={'quantity-price-banner-ranges'}>{(item.quantityPrices ?? []).map((row) => <div key={row.minimumQuantity}><span>{row.minimumQuantity}-{row.maximumQuantity ?? '+'} botol</span><b>{formatIDR(row.unitPriceIdr)}</b></div>)}</div>
        <small>Lihat paket <b>-&gt;</b></small>
      </Link>)}
    </div>
  </section>;
}
