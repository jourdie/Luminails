import { CartPage } from '../../components/cart-page';
import { getAccountContext } from '../../lib/account-server';

export const metadata = {
  title: 'Keranjang | Luminails',
  description: 'Periksa paket pilihanmu sebelum melanjutkan ke checkout.',
};

export default async function CartRoute() {
  const account = await getAccountContext({ lightweight: true });
  return <CartPage identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} />
}
