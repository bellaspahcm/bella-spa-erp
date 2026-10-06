import { checkHqAuth, getHqDashboardPayload } from '@/services/hq-actions';
import { redirect } from 'next/navigation';
import HqDashboardClient from './hq-dashboard-client';
import { HqDashboardStats, HqTenantRecord } from '@/types/domain';

export const metadata = {
  title: 'HQ Portal - Tổng bộ Quản trị Cấp cao',
  description: 'Bảng điều khiển quản lý và giám sát toàn bộ các chi nhánh hệ thống.',
};

export default async function HqPage() {
  // 1. Verify Super Admin authorization on server side
  const auth = await checkHqAuth();
  if (!auth.authorized || !auth.user) {
    redirect('/hq/login');
  }

  // 2. Fetch all system-wide stats and tenants
  let stats: HqDashboardStats;
  let tenants: HqTenantRecord[] = [];
  try {
    const payload = await getHqDashboardPayload();
    stats = payload.stats;
    tenants = payload.tenants;
  } catch (error) {
    console.error('Error loading HQ data:', error);
    // Fallback default structure to prevent layout crash
    stats = {
      totalSpas: 0,
      activeSpas: 0,
      suspendedSpas: 0,
      totalRevenue: 0,
      totalSessions: 0,
      zaloSmsUsed: 87,
      spaGrowthData: []
    };
    tenants = [];
  }

  return (
    <HqDashboardClient 
      initialStats={stats} 
      initialTenants={tenants} 
      currentUser={auth.user}
    />
  );
}
