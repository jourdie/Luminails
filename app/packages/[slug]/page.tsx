import { notFound } from 'next/navigation';
import { PackageDetail } from '../../../components/package-detail';
import { getPackageBySlugFromDatabase, getPackageRecommendationsFromDatabase } from '../../../lib/packages-server';
import { getPublicPromotions } from '../../../lib/promotions-server';
import { getAccountContext } from '../../../lib/account-server';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getPackageBySlugFromDatabase((await params).slug);
  return { title: item ? item.title + ' | Luminails' : 'Package | Luminails' };
}

export default async function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getPackageBySlugFromDatabase((await params).slug);
  if (!item) notFound();
  const [promotions, account, recommendations] = await Promise.all([getPublicPromotions(), getAccountContext(), getPackageRecommendationsFromDatabase(item.id)]);
  return <PackageDetail item={item} promotions={promotions} tierSummary={account.tierSummary} recommendations={recommendations} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} availablePoints={account.loyalty?.available_points ?? account.tierSummary?.availablePoints ?? 0} />;
}
