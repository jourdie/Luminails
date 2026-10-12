import { notFound } from 'next/navigation';
import { CollectionProductBrowser } from '../../../../components/collection-product-browser';
import { getCatalogProducts } from '../../../../lib/catalog';
import { getAccountContext } from '../../../../lib/account-server';
import { getPublicBrandsFromDatabase } from '../../../../lib/packages-server';

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }) {
  const brandSlug = (await params).brand;
  const brands = await getPublicBrandsFromDatabase();
  const brand = brands.find((item) => item.slug === brandSlug);
  return { title: brand ? brand.name + ' Catalog | Luminails' : 'Catalog | Luminails' };
}

export default async function CatalogBrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const brandSlug = (await params).brand;
  const [brands, account] = await Promise.all([getPublicBrandsFromDatabase(), getAccountContext({ lightweight: true })]);
  const brand = brands.find((item) => item.slug === brandSlug);
  if (!brand) notFound();
  const brandProducts = await getCatalogProducts({ withPackageLinks: true, brand: brand.name });
  return <CollectionProductBrowser brandName={brand.name} brandSlug={brand.slug} products={brandProducts} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} basePath="/catalog" />;
}
