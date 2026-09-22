import { AdminConsole } from '../../components/admin-console';
import { getAdminDashboard } from '../../lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const dashboard = await getAdminDashboard();
  return <AdminConsole dashboard={dashboard} />;
}
