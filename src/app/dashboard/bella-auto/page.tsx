import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import VehicleInventoryDashboard from '@/components/bella-auto/VehicleInventoryDashboard';
import { BellaAutoHeader } from '@/components/bella-auto/BellaAutoHeader';
import { AutoAnalyticsCharts } from '@/components/bella-auto/AutoAnalyticsCharts';
import BellaAutoAnalyticsDashboard from '@/components/bella-auto/BellaAutoAnalyticsDashboard';

export const dynamic = 'force-dynamic';

export default async function BellaAutoPage() {
  try {
    console.log('[BellaAutoPage] Starting render...');
    const supabase = await createClient();

    console.log('[BellaAutoPage] Getting user...');
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('[BellaAutoPage] No user, redirecting to login');
      redirect('/login');
    }

    console.log('[BellaAutoPage] User authenticated:', user.id);

  // Get tenant and user profile
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, full_name')
    .eq('id', user.id)
    .single();

  if (!profile?.tenant_id) {
    return <div>Không tìm thấy tenant</div>;
  }

  // Get tenant name
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', profile.tenant_id)
    .single();

  // Fetch vehicle stats for analytics
  const { data: vehicles } = await supabase
    .from('auto_vehicles')
    .select('status')
    .eq('tenant_id', profile.tenant_id);

  const vehicleStats = {
    total: vehicles?.length || 0,
    showroom: vehicles?.filter(v => v.status === 'showroom').length || 0,
    warehouse: vehicles?.filter(v => v.status === 'warehouse').length || 0,
    allocated: vehicles?.filter(v => v.status === 'allocated').length || 0,
    delivered: vehicles?.filter(v => v.status === 'delivered').length || 0,
  };

  const monogram = profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'BA';

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8">
      {/* Premium Dashboard Welcome Header - Real Estate Style */}
      <BellaAutoHeader 
        monogram={monogram}
        fullName={profile?.full_name || 'Admin'}
        tenantName={tenant?.name || 'Bella Auto'}
      />

      {/* Basic Analytics - HTML/CSS Charts */}
      <Suspense fallback={
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
        </div>
      }>
        <AutoAnalyticsCharts 
          totalVehicles={vehicleStats.total}
          showroomCount={vehicleStats.showroom}
          warehouseCount={vehicleStats.warehouse}
          allocatedCount={vehicleStats.allocated}
          deliveredCount={vehicleStats.delivered}
        />
      </Suspense>

      {/* Advanced Analytics - Recharts Interactive Charts */}
      <Suspense fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
        </div>
      }>
        <BellaAutoAnalyticsDashboard key={profile.tenant_id} tenantId={profile.tenant_id} />
      </Suspense>

      {/* Vehicle Inventory Dashboard */}
      <Suspense fallback={
        <div className="p-8 space-y-6 animate-pulse">
          <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      }>
        <VehicleInventoryDashboard tenantId={profile.tenant_id} />
      </Suspense>
    </div>
  );
  } catch (error) {
    console.error('[BellaAutoPage] Fatal error:', error);
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600">Lỗi tải Dashboard</h2>
          <p className="text-slate-600">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }
}
