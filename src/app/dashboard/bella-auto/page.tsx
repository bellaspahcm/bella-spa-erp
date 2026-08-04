import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import VehicleInventoryDashboard from '@/components/bella-auto/VehicleInventoryDashboard';
import { RefreshCw, Bell, User } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BellaAutoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

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

  const monogram = profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'BA';

  return (
    <div className="p-6 w-full space-y-6">
      {/* Premium Dashboard Welcome Header - Real Estate Style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 shadow-sm transition-all">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-lg border border-cyan-500/20 shadow-sm select-none">
            {monogram}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Chào mừng trở lại, <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">{profile?.full_name || 'Admin'}</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Hệ thống quản lý ô tô <span className="font-semibold text-slate-700 dark:text-slate-200">{tenant?.name || 'Bella Auto'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          {/* Nút Load dữ liệu */}
          <button
            className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all duration-200 active:scale-95"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Nút Thông báo */}
          <button
            className="relative flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all duration-200 active:scale-95"
            title="Xem thông báo"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </button>
        </div>
      </div>

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
}
