import { BrandExplorer } from '../../components/brand-explorer';
import { getBrandPackagesFromDatabase } from '../../lib/packages-server';

export const metadata = {
  title: 'Brands & packages | Luminails',
  description: 'Exclusive B2B packages curated for working studios.',
};

export default async function BrandsPage() {
  return <BrandExplorer packages={await getBrandPackagesFromDatabase()} />;
}
