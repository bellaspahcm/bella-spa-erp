'use client';

import { Suspense, useState } from 'react';
import { BookingStats } from '@/components/bella-auto/BookingStats';
import { BookingListTable } from '@/components/bella-auto/BookingListTable';
import { CreateBookingModal } from '@/components/bella-auto/CreateBookingModal';
import { FileText, Plus } from 'lucide-react';

export default function BookingsPageClient({ tenantId }: { tenantId: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleBookingCreated = () => {
    setRefreshKey(prev => prev + 1); // Trigger refresh
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 space-y-6 p-6">
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
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Tạo Booking Mới
        </button>
      </div>

      {/* Stats */}
      <Suspense key={`stats-${refreshKey}`} fallback={<StatsLoading />}>
        <BookingStats tenantId={tenantId} />
      </Suspense>

      {/* Table */}
      <Suspense key={`table-${refreshKey}`} fallback={<TableLoading />}>
        <BookingListTable tenantId={tenantId} />
      </Suspense>

      {/* Create Booking Modal */}
      <CreateBookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleBookingCreated}
      />
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
