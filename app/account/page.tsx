import { redirect } from 'next/navigation';
import { AccountOverview } from '../../components/account-overview';
import { getAccountContext } from '../../lib/account-server';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const account = await getAccountContext();
  if (!account.identity) redirect('/auth?next=/account');
  return <AccountOverview identity={account.identity} profile={account.profile} loyalty={account.loyalty} needsProfile={account.needsProfile} />;
}
