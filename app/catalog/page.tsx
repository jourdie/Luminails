import type { Metadata } from 'next';
import { CollectionDirectory } from '../../components/collection-directory';
import { getAccountContext } from '../../lib/account-server';
import { getCatalogProducts } from '../../lib/catalog';
import { getPublicBrandsFromDatabase } from '../../lib/packages-server';

export const metadata: Metadata = {
  title: 'Catalog | Luminails',
  description: 'Pilih brand lalu browse SKU Luminails sebelum memilih package.',
};

export default async function CatalogPage() {
  const [brands, products, account] = await Promise.all([getPublicBrandsFromDatabase(), getCatalogProducts(), getAccountContext()]);
  const imageByBrand = new Map<string, string>();
  for (const product of products) {
    if (product.imageUrl && !imageByBrand.has(product.brand.trim().toLowerCase())) imageByBrand.set(product.brand.trim().toLowerCase(), product.imageUrl);
  }
  const brandsWithImages = brands.map((brand) => ({ ...brand, imageUrl: brand.imageUrl ?? imageByBrand.get(brand.name.trim().toLowerCase()) ?? null }));
  return <CollectionDirectory brands={brandsWithImages} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} basePath="/catalog" />;
}