import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteNavigation } from '../../components/site-navigation';
import { CheckoutForm } from '../../components/checkout-form';
import { getPackageBySlugFromDatabase } from '../../lib/packages-server';
import { formatIDR } from '../../lib/packages';
import { createClient } from '../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ package?: string; quantity?: string; notes?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect(`/auth?next=${encodeURIComponent('/checkout?' + new URLSearchParams(params as Record<string, string>).toString())}`);
  const item = params.package ? await getPackageBySlugFromDatabase(params.package) : undefined;
  if (!item) return <><SiteNavigation /><main className="checkout-page"><div className="checkout-shell"><h1>Pilih package<br /><em>untuk mulai.</em></h1><Link className="brand-button brand-button-dark" href="/packages">Browse packages <span>→</span></Link></div></main></>;
  const quantity = Math.max(1, Math.min(100, Number(params.quantity ?? 1) || 1));
  const [{ data: addresses }, { data: loyalty }, { data: rewards }] = await Promise.all([
    supabase.from('customer_addresses' as never).select('id, label, recipient_name, phone, address_line, city, province, postal_code, is_default').order('is_default', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('loyalty_accounts').select('available_points').eq('customer_id', authData.user.id).maybeSingle(),
    supabase.from('loyalty_reward_catalog' as never).select('sku_id, points_cost, catalog_skus(name)').eq('is_active', true),
  ]);
  const rewardOptions = ((rewards ?? []) as unknown as Array<{ sku_id: string; points_cost: number; catalog_skus?: { name?: string } | null }>).map((reward) => ({ sku_id: reward.sku_id, points_cost: Number(reward.points_cost), name: reward.catalog_skus?.name ?? 'Free product' }));
  return <><SiteNavigation /><main className="checkout-page"><div className="checkout-shell"><Link className="package-back-link" href={`/packages/${item.slug}`}>&lt;- Kembali ke package</Link><p className="brand-eyebrow">Luminails / checkout</p><h1>Siapkan order<br /><em>{item.title}.</em></h1><section className="checkout-card"><div><span className="checkout-kicker">Order summary</span><h2>{item.title}</h2><p>{item.description}</p><div className="checkout-line"><span>Jumlah package</span><strong>{quantity}</strong></div><div className="checkout-line"><span>Harga indikatif</span><strong>{formatIDR(item.price * quantity)}</strong></div><div className="checkout-note"><span>Next step</span><p>Harga final, promo eligible, stok, dan alamat akan diverifikasi kembali oleh order engine saat tombol order ditekan.</p></div></div><CheckoutForm item={item} quantity={quantity} notes={params.notes ?? ''} addresses={(addresses ?? []) as never[]} points={Number((loyalty as { available_points?: number } | null)?.available_points ?? 0)} rewards={rewardOptions} /></section></div></main></>;
}
