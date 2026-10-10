import type { StorefrontPromotion } from '../lib/promotions-server';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

function offerText(promotion: StorefrontPromotion) {
  if (promotion.discount_type === 'percentage') return promotion.discount_value + '% off';
  if (promotion.discount_type === 'fixed_amount') return money(promotion.discount_value) + ' off';
  if (promotion.discount_type === 'fixed_price' && promotion.bundle_price_idr) return 'Bundling ' + money(promotion.bundle_price_idr);
  if (promotion.discount_type === 'free_shipping') return 'Gratis ongkir';
  return 'Promo aktif';
}

export function PromoNotice({ promotions, compact = false }: { promotions: StorefrontPromotion[]; compact?: boolean }) {
  if (!promotions.length) return null;
  const promotion = promotions[0];
  return <div className={compact ? 'promo-notice promo-notice-compact' : 'promo-notice'}><span className="promo-notice-mark">%</span><div><strong>{promotion.name}</strong><span>{offerText(promotion)} · gunakan kode <b>{promotion.code}</b></span></div><a href="/packages">Lihat paket <span>→</span></a></div>;
}
