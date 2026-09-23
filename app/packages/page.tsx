import { BrandExplorer } from '../../components/brand-explorer';
import { getBrandPackagesFromDatabase } from '../../lib/packages-server';

export const metadata = {
  title: 'B2B packages | Luminails',
  description: 'Large-format packages for home studios and salons.',
};

export default async function PackagesPage() {
  return <BrandExplorer packages={await getBrandPackagesFromDatabase()} />;
}
