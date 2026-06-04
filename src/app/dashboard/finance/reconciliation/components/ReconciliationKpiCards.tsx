import { AlertTriangle, Link as LinkIcon, Wallet } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';

type ReconciliationKpiCardsProps = {
  debtCount: number;
  totalDebt: number;
  orphanedCount: number;
  totalOrphaned: number;
  totalMismatches: number;
};

export function ReconciliationKpiCards({
  debtCount,
  totalDebt,
  orphanedCount,
  totalOrphaned,
  totalMismatches,
}: ReconciliationKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
      <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl sm:rounded-[32px] p-5 sm:p-6 text-white shadow-lg shadow-rose-200 dark:shadow-none relative overflow-hidden w-full">
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black backdrop-blur-md">{debtCount} khách</span>
          </div>
          <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">Cần thu hồi nợ</p>
          <h3 className="text-2xl sm:text-3xl font-black break-words">{formatCurrency(totalDebt)}</h3>
        </div>
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </div>

      <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl sm:rounded-[32px] p-5 sm:p-6 text-white shadow-lg shadow-amber-200 relative overflow-hidden w-full">
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <LinkIcon className="w-6 h-6 text-white" />
            </div>
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black backdrop-blur-md">{orphanedCount} khoản</span>
          </div>
          <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">Tiền thu bị treo</p>
          <h3 className="text-2xl sm:text-3xl font-black break-words">{formatCurrency(totalOrphaned)}</h3>
        </div>
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </div>

      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl sm:rounded-[32px] p-5 sm:p-6 text-white shadow-lg shadow-purple-200 relative overflow-hidden w-full">
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black backdrop-blur-md">Xử lý ngay</span>
          </div>
          <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">Booking lệch giá trị</p>
          <h3 className="text-2xl sm:text-3xl font-black break-words">
            {totalMismatches} <span className="text-lg opacity-80">vụ việc</span>
          </h3>
        </div>
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </div>
    </div>
  );
}
