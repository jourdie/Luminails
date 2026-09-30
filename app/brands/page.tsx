import { BrandExplorer } from '../../components/brand-explorer';
import { getBrandPackagesFromDatabase, getPublicBrandsFromDatabase } from '../../lib/packages-server';
import { getPublicPromotions } from '../../lib/promotions-server';
import { getAccountContext } from '../../lib/account-server';

export const metadata = {
  title: 'Brands & packages | Luminails',
  description: 'Packages curated untuk working studios.',
};

export default async function BrandsPage() {
  const [packages, brands, promotions, account] = await Promise.all([getBrandPackagesFromDatabase(), getPublicBrandsFromDatabase(), getPublicPromotions(), getAccountContext()]);
  return <BrandExplorer mode="brands" packages={packages} brands={brands} promotions={promotions} tierSummary={account.tierSummary} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} />;
}
