import { notFound } from 'next/navigation';
import { CatalogSkuDetail } from '../../../components/catalog-sku-detail';
import { getAccountContext } from '../../../lib/account-server';
import { getCatalogProductBySku } from '../../../lib/catalog';

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }) {
  const product = await getCatalogProductBySku((await params).sku);
  return { title: product ? product.name + ' | Luminails Catalog' : 'SKU | Luminails Catalog' };
}

export default async function CatalogSkuPage({ params }: { params: Promise<{ sku: string }> }) {
  const sku = (await params).sku;
  const [product, account] = await Promise.all([getCatalogProductBySku(sku), getAccountContext()]);
  if (!product) notFound();
  return <CatalogSkuDetail product={product} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} />;
}