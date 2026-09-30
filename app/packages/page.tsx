import { BrandExplorer } from '../../components/brand-explorer';
import { getBrandPackagesFromDatabase } from '../../lib/packages-server';
import { getPublicPromotions } from '../../lib/promotions-server';
import { getAccountContext } from '../../lib/account-server';

export const metadata = {
  title: 'Packages | Luminails',
  description: 'Large-format packages for home studios and salons.',
};

export default async function PackagesPage() {
  const [packages, promotions, account] = await Promise.all([getBrandPackagesFromDatabase(), getPublicPromotions(), getAccountContext()]);
  return <BrandExplorer mode="packages" packages={packages} promotions={promotions} tierSummary={account.tierSummary} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} />;
}
