import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteNavigation } from '../../components/site-navigation';
import { CheckoutForm } from '../../components/checkout-form';
import { getPackageAddOnsFromDatabase, getPackageBySlugFromDatabase } from '../../lib/packages-server';
import { formatIDR, selectQuantityPrice } from '../../lib/packages';
import { createClient } from '../../lib/supabase/server';
import { getPublicPromotions } from '../../lib/promotions-server';
import { PromoNotice } from '../../components/promo-notice';
import { getAccountContext, getCurrentUser } from '../../lib/account-server';
import { calculateEarnedPoints } from '../../lib/loyalty-engine';
import { catalogBrandsMatch } from '../../lib/brand-matching';

export const dynamic = 'force-dynamic';

type SearchParams = { package?: string; quantity?: string; notes?: string; selection?: string; benefits?: string };
type SelectedSku = { skuId: string; quantity: number };
type SelectedBenefit = { benefitId: string; skuId: string; quantity: number };

function parseSelectedSkus(value?: string): SelectedSku[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((row): row is SelectedSku => typeof row?.skuId === 'string' && Number.isInteger(row?.quantity) && row.quantity > 0) : [];
  } catch {
    return [];
  }
}

function parseSelectedBenefits(value?: string): SelectedBenefit[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((row): row is SelectedBenefit => typeof row?.benefitId === 'string' && typeof row?.skuId === 'string' && Number.isInteger(row?.quantity) && row.quantity > 0) : [];
  } catch {
    return [];
  }
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) redirect('/auth?next=/checkout');
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent('/checkout?' + new URLSearchParams(params as Record<string, string>).toString())}`);
  const [item, account] = await Promise.all([
    params.package ? getPackageBySlugFromDatabase(params.package) : Promise.resolve(undefined),
    getAccountContext(),
  ]);
  if (!item) return <><SiteNavigation identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} /><main className={'checkout-page'}><div className={'checkout-shell'}><h1>Pilih package<br /><em>untuk mulai.</em></h1><Link className={'brand-button brand-button-dark'} href={'/packages'}>Browse packages <span>-&gt;</span></Link></div></main></>;
  const quantity = Math.max(1, Math.min(1000, Number(params.quantity ?? 1) || 1));
  const packageUnitPrice = item.pricingModel === 'quantity_range' ? (selectQuantityPrice(item.quantityPrices, quantity) ?? item.price) : item.price;
  const packageSubtotal = packageUnitPrice * quantity;
  const selectedSkus = parseSelectedSkus(params.selection);
  const selectedBenefits = parseSelectedBenefits(params.benefits);
  const quantityMinimum = item.selectionMinimum ?? item.quantityPrices?.[0]?.minimumQuantity ?? 1;
  const quantityMaximum = item.selectionMaximum ?? null;
  const quantityValid = item.pricingModel !== 'quantity_range' || (quantity >= quantityMinimum && (quantityMaximum === null || quantity <= quantityMaximum));
  const selectedBottleTotal = selectedSkus.reduce((sum, row) => sum + row.quantity, 0);
  const selectionTarget = item.pricingModel === 'quantity_range' ? quantity : (item.selectionCapacity ?? 0);
  const selectionValid = item.selectionMode !== 'free_pick' || selectedBottleTotal === selectionTarget;
  const checkoutWarning = !quantityValid
    ? 'Jumlah botol berada di luar range package. Gunakan quantity mulai ' + quantityMinimum + (quantityMaximum === null ? ' botol ke atas.' : ' sampai ' + quantityMaximum + ' botol.')
    : !selectionValid
      ? selectedBottleTotal > selectionTarget
        ? 'Isi SKU melebihi quantity package. Kurangi ' + (selectedBottleTotal - selectionTarget) + ' botol sebelum checkout.'
        : 'Isi SKU belum lengkap. Tambahkan ' + (selectionTarget - selectedBottleTotal) + ' botol sebelum checkout.'
      : null;
  const [{ data: addresses }, { data: loyalty }, { data: rewards }, { data: pointSettings }, addOns, promotions] = await Promise.all([
    supabase.from('customer_addresses' as never).select('id, label, recipient_name, phone, address_line, city, province, postal_code, is_default').order('is_default', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('loyalty_accounts').select('available_points').eq('customer_id', user.id).maybeSingle(),
    supabase.from('loyalty_reward_catalog' as never).select('sku_id, points_cost, reward_name, reward_stock, max_redemption_quantity, minimum_order_value_idr, minimum_customer_tier_id, starts_at, ends_at, catalog_skus(name, catalog_products!inner(brand, is_published))').eq('is_active', true),
    supabase.from('loyalty_point_settings' as never).select('point_unit_value_idr').eq('key', 'default').maybeSingle(),
    getPackageAddOnsFromDatabase(item.brand),
    getPublicPromotions(),
  ]);
  const rewardOptions = ((rewards ?? []) as unknown as Array<{ sku_id: string; points_cost: number; reward_name?: string | null; reward_stock?: number; max_redemption_quantity?: number; minimum_order_value_idr?: number; starts_at?: string | null; ends_at?: string | null; catalog_skus?: { name?: string; catalog_products?: { brand?: string; is_published?: boolean } | { brand?: string; is_published?: boolean }[] | null } | null }>).filter((reward) => {
    const product = Array.isArray(reward.catalog_skus?.catalog_products) ? reward.catalog_skus?.catalog_products[0] : reward.catalog_skus?.catalog_products;
    return product?.is_published !== false && catalogBrandsMatch(product?.brand, item.brand) && (!reward.starts_at || new Date(reward.starts_at).getTime() <= Date.now()) && (!reward.ends_at || new Date(reward.ends_at).getTime() > Date.now());
  }).map((reward) => ({ sku_id: reward.sku_id, points_cost: Number(reward.points_cost), name: reward.reward_name ?? reward.catalog_skus?.name ?? 'Free product', reward_stock: Number(reward.reward_stock ?? 0), max_redemption_quantity: Number(reward.max_redemption_quantity ?? 1), minimum_order_value_idr: Number(reward.minimum_order_value_idr ?? 0) }));
  const pointUnitValue = Number((pointSettings as { point_unit_value_idr?: number } | null)?.point_unit_value_idr ?? 10000);
  const basePendingPoints = calculateEarnedPoints(packageSubtotal, 0, account.tierSummary?.multiplier ?? 1, pointUnitValue);
  const pendingPoints = item.pointsEarningMode === 'none' ? 0 : item.pointsEarningMode === 'reduced' ? Math.floor(basePendingPoints * Math.min(1, item.pointsMultiplier ?? 1)) : Math.floor(basePendingPoints * (item.pointsMultiplier ?? 1));
  return <><SiteNavigation identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} /><main className={'checkout-page'}><div className={'checkout-shell'}><Link className={'package-back-link'} href={`/packages/${item.slug}`}>&lt;- Kembali ke package</Link><p className={'brand-eyebrow'}>Luminails / checkout</p><h1>Siapkan order<br /><em>{item.title}.</em></h1><section className={'checkout-card'}><div><PromoNotice promotions={promotions} compact /><span className={'checkout-kicker'}>Order summary</span><h2>{item.title}</h2><p>{item.description}</p><div className={'checkout-line'}><span>Jumlah package</span><strong>{quantity}</strong></div><div className={'checkout-line'}><span>Harga indikatif</span><strong>{formatIDR(packageSubtotal)}</strong></div><div className={'checkout-line'}><span>Points pending setelah paid</span><strong>+{pendingPoints.toLocaleString('id-ID')} pts</strong></div><div className={'checkout-note'}><span>Next step</span><p>Harga final, promo eligible, stok, dan alamat akan diverifikasi kembali oleh order engine saat tombol order ditekan.</p></div></div><CheckoutForm item={item} quantity={quantity} notes={params.notes ?? ''} selectedSkus={selectedSkus} selectedBenefits={selectedBenefits} addresses={(addresses ?? []) as never[]} points={Number((loyalty as { available_points?: number } | null)?.available_points ?? 0)} pendingPoints={pendingPoints} packageSubtotal={packageSubtotal} tierName={account.tierSummary?.name ?? null} tierMultiplier={account.tierSummary?.multiplier ?? 1} pointUnitValueIdr={pointUnitValue} checkoutWarning={checkoutWarning} rewards={rewardOptions} addOns={addOns} contactPhone={account.profile?.phone ?? account.profile?.whatsapp ?? ''} /></section></div></main></>;
}
