import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteNavigation } from '../../../components/site-navigation';
import { CustomerOrderHistoryCustomer } from '../../../components/customer-order-history-customer';
import { getAccountContext } from '../../../lib/account-server';
import { getCustomerOrders } from '../../../lib/orders-server';

export const dynamic = 'force-dynamic';
export default async function CustomerOrdersPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const account = await getAccountContext({ lightweight: true });
  if (!account.identity) redirect('/auth?next=/account/orders');
  const params = await searchParams;
  const orders = await getCustomerOrders();
  return <><SiteNavigation identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} /><main className="account-page"><div className="account-shell"><div className="account-heading"><div><p className="eyebrow">Akun studio</p><h1>Riwayat<br /><em>order.</em></h1><p>Semua order, status pembayaran, promo, dan tracking kamu.</p></div><Link className="button button-outline" href="/account">Ringkasan akun</Link></div><CustomerOrderHistoryCustomer orders={orders} createdOrderId={params.created} /></div></main></>;
}
