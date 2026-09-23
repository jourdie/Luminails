import { Storefront } from '../components/storefront';
import { getCatalogProducts } from '../lib/catalog';
import { getAccountContext } from '../lib/account-server';

export default async function HomePage() {
  const [products, account] = await Promise.all([getCatalogProducts(), getAccountContext()]);
  return <><Storefront products={products} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} /></>;
}
