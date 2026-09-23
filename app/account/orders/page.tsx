import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteNavigation } from '../../../components/site-navigation';
import { CustomerOrderHistory } from '../../../components/customer-order-history';
import { getAccountContext } from '../../../lib/account-server';
import { getCustomerOrders } from '../../../lib/orders-server';

export const dynamic = 'force-dynamic';
export default async function CustomerOrdersPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const account = await getAccountContext();
  if (!account.identity) redirect('/auth?next=/account/orders');
  const params = await searchParams;
  const orders = await getCustomerOrders();
  return <><SiteNavigation identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} /><main className="account-page"><div className="account-shell"><div className="account-heading"><div><p className="eyebrow">Customer workspace</p><h1>Order<br /><em>history.</em></h1><p>Semua order package, status pembayaran, promo, dan tracking Anda.</p></div><Link className="button button-outline" href="/account">Account overview</Link></div><CustomerOrderHistory orders={orders} createdOrderId={params.created} /></div></main></>;
}
