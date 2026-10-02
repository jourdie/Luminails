import { AdminConsole } from '../../components/admin-console';
import { getAdminDashboard, isAdminDashboardTab, type AdminSkuSort, type AdminSkuStatusFilter } from '../../lib/admin';

export const dynamic = 'force-dynamic';

type AdminSearchParams = {
  tab?: string;
  skuPage?: string;
  skuQuery?: string;
  skuBrand?: string;
  skuType?: string;
  skuStatus?: string;
  skuSort?: string;
};

const skuSorts: AdminSkuSort[] = ['name', 'sku', 'price-low', 'price-high', 'stock'];
const skuStatuses: AdminSkuStatusFilter[] = ['all', 'active', 'inactive'];

export default async function AdminPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const params = await searchParams;
  const activeTab = isAdminDashboardTab(params.tab) ? params.tab : 'overview';
  const skuPage = Math.max(1, Math.floor(Number(params.skuPage ?? 1) || 1));
  const skuSort = skuSorts.includes(params.skuSort as AdminSkuSort) ? params.skuSort as AdminSkuSort : 'name';
  const skuStatus = skuStatuses.includes(params.skuStatus as AdminSkuStatusFilter) ? params.skuStatus as AdminSkuStatusFilter : 'all';
  const skuType = ['all', 'GEL_POLISH', 'PREP', 'TOOL', 'ACCESSORY', 'LAMP', 'OTHER'].includes(params.skuType ?? '') ? params.skuType as 'all' | 'GEL_POLISH' | 'PREP' | 'TOOL' | 'ACCESSORY' | 'LAMP' | 'OTHER' : 'all';
  const dashboard = await getAdminDashboard({ tab: activeTab, skuPage, skuQuery: params.skuQuery, skuBrand: params.skuBrand, skuType, skuStatus, skuSort });
  return <AdminConsole dashboard={dashboard} activeTab={activeTab} skuFilters={{ query: params.skuQuery ?? '', brand: params.skuBrand ?? 'all', type: skuType, status: skuStatus, sort: skuSort }} />;
}
