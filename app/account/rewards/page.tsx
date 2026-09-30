import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CustomerRewards } from '../../../components/customer-rewards';
import { getAccountContext } from '../../../lib/account-server';
import { getCustomerRewards } from '../../../lib/rewards-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Redeem Rewards | Luminails', description: 'Tukar Luminails Points dengan reward pilihan untuk order package berikutnya.' };

export default async function RewardsPage() {
  const [account, rewards] = await Promise.all([getAccountContext(), getCustomerRewards()]);
  if (!account.identity) redirect('/auth?next=/account/rewards');
  return <CustomerRewards rewards={rewards} identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} loyaltyPoints={Number(account.loyalty?.available_points ?? 0)} pointUnitValueIdr={account.tierSummary?.pointUnitValueIdr ?? 10000} tierSummary={account.tierSummary} />;
}