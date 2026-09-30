import { Storefront } from '../components/storefront';
import { getCatalogProducts } from '../lib/catalog';
import { getAccountContext } from '../lib/account-server';
import { getPublicPromotions } from '../lib/promotions-server';
import { getBrandPackagesFromDatabase } from '../lib/packages-server';
import { getPublicTrustedLogos } from '../lib/trusted-logos';

export default async function HomePage() {
  const [products, account, promotions, packages, trustedLogos] = await Promise.all([getCatalogProducts(), getAccountContext(), getPublicPromotions(), getBrandPackagesFromDatabase(), getPublicTrustedLogos()]);
  return <><Storefront products={products} packages={packages} promotions={promotions} trustedLogos={trustedLogos} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} /></>;
}
