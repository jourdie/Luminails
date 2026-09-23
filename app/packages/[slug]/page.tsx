import { notFound } from 'next/navigation';
import { PackageDetail } from '../../../components/package-detail';
import { getPackageBySlugFromDatabase } from '../../../lib/packages-server';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getPackageBySlugFromDatabase((await params).slug);
  return { title: item ? item.title + ' | Luminails' : 'Package | Luminails' };
}

export default async function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getPackageBySlugFromDatabase((await params).slug);
  if (!item) notFound();
  return <PackageDetail item={item} />;
}
