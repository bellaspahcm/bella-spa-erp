import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { BookingStats } from '@/components/bella-auto/BookingStats';
import { BookingListTable } from '@/components/bella-auto/BookingListTable';
import { FileText, Plus } from 'lucide-react';

export const metadata = {
  title: 'Quản Lý Booking & Đặt Cọc | Bella Auto',
  description: 'Theo dõi trạng thái đặt cọc và xác nhận thanh toán của khách hàng',
};

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/login');
  }

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    redirect('/login');
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
            Quản Lý Booking & Đặt Cọc
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi trạng thái cọc và xác nhận thanh toán của khách hàng
          </p>
        </div>
        
        <a
          href="/dashboard/bella-auto/bookings/new"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Tạo Booking Mới
        </a>
      </div>

      {/* Stats */}
      <Suspense fallback={<StatsLoading />}>
        <BookingStats tenantId={profile.tenant_id} />
      </Suspense>

      {/* Table */}
      <Suspense fallback={<TableLoading />}>
        <BookingListTable tenantId={profile.tenant_id} />
      </Suspense>
    </div>
  );
}

function StatsLoading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl" />
      ))}
    </div>
  );
}

function TableLoading() {
  return (
    <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-64 bg-slate-100 dark:bg-slate-900 rounded" />
      </div>
    </div>
  );
}
