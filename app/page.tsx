import { Storefront } from '../components/storefront';
import { getCatalogProducts } from '../lib/catalog';
import { getAccountContext } from '../lib/account-server';
import { getPublicPromotions } from '../lib/promotions-server';

export default async function HomePage() {
  const [products, account, promotions] = await Promise.all([getCatalogProducts(), getAccountContext(), getPublicPromotions()]);
  return <><Storefront products={products} promotions={promotions} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} /></>;
}
