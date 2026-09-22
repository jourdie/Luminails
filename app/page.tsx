import { Storefront } from '../components/storefront';
import { getCatalogProducts } from '../lib/catalog';

export default async function HomePage() {
  const products = await getCatalogProducts();
  return <Storefront products={products} />;
}
