import { checkHqAuth, getHqDashboardStats, getAllTenants } from '@/services/hq-actions';
import { redirect } from 'next/navigation';
import HqDashboardClient from './hq-dashboard-client';
import { HqDashboardStats, HqTenantRecord } from '@/types/domain';

export const metadata = {
  title: 'Bella Spa HQ - Tổng bộ Quản trị Cấp cao',
  description: 'Bảng điều khiển quản lý và giám sát toàn bộ các chi nhánh hệ thống Bella Spa.',
};

export default async function HqPage() {
  // 1. Verify Super Admin authorization on server side
  const auth = await checkHqAuth();
  if (!auth.authorized || !auth.user) {
    redirect('/dashboard');
  }

  // 2. Fetch all system-wide stats and tenants
  let stats: HqDashboardStats;
  let tenants: HqTenantRecord[] = [];
  try {
    stats = await getHqDashboardStats();
    tenants = await getAllTenants() as unknown as HqTenantRecord[];
  } catch (error) {
    console.error('Error loading HQ data:', error);
    // Fallback default structure to prevent layout crash
    stats = {
      totalSpas: 1,
      activeSpas: 1,
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
