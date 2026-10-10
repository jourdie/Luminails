import { BrandExplorer } from '../../components/brand-explorer';
import { getBrandPackagesFromDatabase } from '../../lib/packages-server';
import { getPublicPromotions } from '../../lib/promotions-server';
import { getAccountContext } from '../../lib/account-server';

export const metadata = {
  title: 'Paket | Luminails',
  description: 'Paket nail supply untuk home studio, salon, dan kebutuhan restock.',
};

export default async function PackagesPage() {
  const [packages, promotions, account] = await Promise.all([getBrandPackagesFromDatabase({ summary: true }), getPublicPromotions(), getAccountContext({ lightweight: true })]);
  return <BrandExplorer mode="packages" packages={packages} promotions={promotions} tierSummary={account.tierSummary} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} />;
}
