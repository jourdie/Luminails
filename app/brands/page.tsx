import { BrandExplorer } from '../../components/brand-explorer';
import { getBrandPackagesFromDatabase } from '../../lib/packages-server';
import { getPublicPromotions } from '../../lib/promotions-server';
import { getAccountContext } from '../../lib/account-server';

export const metadata = {
  title: 'Brands & packages | Luminails',
  description: 'Exclusive B2B packages curated for working studios.',
};

export default async function BrandsPage() {
  const [packages, promotions, account] = await Promise.all([getBrandPackagesFromDatabase(), getPublicPromotions(), getAccountContext()]);
  return <BrandExplorer packages={packages} promotions={promotions} tierSummary={account.tierSummary} />;
}
