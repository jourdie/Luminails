import { CartPage } from '../../components/cart-page';
import { getAccountContext } from '../../lib/account-server';

export const metadata = {
  title: 'Shopping cart | Luminails',
  description: 'Review your selected Luminails package before checkout.',
};

export default async function CartRoute() {
  const account = await getAccountContext();
  return <CartPage identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} />
}
