import { redirect } from 'next/navigation';
import { ProfileForm } from '../../../components/profile-form';
import { getAccountContext } from '../../../lib/account-server';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const account = await getAccountContext();
  if (!account.identity) redirect('/auth?next=/account/profile');
  return <ProfileForm identity={account.identity} profile={account.profile} />;
}
