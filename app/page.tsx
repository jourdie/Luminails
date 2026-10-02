import { Storefront } from '../components/storefront';
import { getCatalogProducts } from '../lib/catalog';
import { getAccountContext } from '../lib/account-server';
import { getPublicPromotions } from '../lib/promotions-server';
import { getBrandPackagesFromDatabase, getRecommendationsForPlacementFromDatabase } from '../lib/packages-server';
import { getPublicTrustedLogos } from '../lib/trusted-logos';

export default async function HomePage() {
  const packagesPromise = getBrandPackagesFromDatabase();
  const [products, account, promotions, packages, trustedLogos] = await Promise.all([getCatalogProducts(), getAccountContext(), getPublicPromotions(), packagesPromise, getPublicTrustedLogos()]);
  const recommendations = await getRecommendationsForPlacementFromDatabase('home', undefined, packages);
  return <><Storefront products={products} packages={packages} promotions={promotions} recommendations={recommendations} trustedLogos={trustedLogos} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} /></>;
}
