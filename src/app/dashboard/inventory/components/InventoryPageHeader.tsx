import { AlertTriangle, Package, TrendingDown } from 'lucide-react';

import { cn } from '@/lib/utils';

type InventoryPageHeaderProps = {
  totalItems: number;
  lowCount: number;
  forecastCount?: number;
  forecastCritical?: number;
  forecastLoading?: boolean;
};

export function InventoryPageHeader({ 
  totalItems, 
  lowCount,
  forecastCount = 0,
  forecastCritical = 0,
  forecastLoading = false,
}: InventoryPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h1 className="mb-1 text-2xl font-black text-slate-900 sm:text-3xl">Quản Lý Kho Vật Tư</h1>
        <p className="text-slate-500 text-sm font-medium">
          Theo dõi tiêu hao vật tư, yêu cầu cấp hàng từ Tổng bộ và điều chỉnh tồn kho.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 customer-detail-card rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg sm:min-w-[160px] sm:rounded-[2rem]">
          <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center text-primary">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng mặt hàng</p>
            <p className="text-xl font-black text-slate-900">{totalItems}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-3 customer-detail-card rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg sm:min-w-[160px] sm:rounded-[2rem]">
          <div
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center',
              lowCount > 0 ? 'bg-amber-50 text-amber-500 animate-pulse' : 'bg-emerald-50 text-emerald-500',
            )}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sắp hết hàng</p>
            <p className="text-xl font-black text-slate-900">{lowCount}</p>
          </div>
        </div>
        
        {/* NEW: Forecast badge */}
        <div className="flex min-w-0 items-center gap-3 customer-detail-card rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg sm:min-w-[180px] sm:rounded-[2rem]">
          <div
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center',
              forecastLoading ? 'bg-slate-50 text-slate-400' :
              forecastCritical > 0 ? 'bg-red-50 text-red-500 animate-pulse' :
              forecastCount > 0 ? 'bg-orange-50 text-orange-500' : 
              'bg-emerald-50 text-emerald-500',
            )}
          >
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Dự báo thiếu (30 ngày)
            </p>
            {forecastLoading ? (
              <p className="text-sm font-bold text-slate-400 animate-pulse">Đang tính...</p>
            ) : (
              <p className="text-xl font-black text-slate-900">
                {forecastCount}
                {forecastCritical > 0 && (
                  <span className="text-sm font-bold text-red-500 ml-1">
                    ({forecastCritical} khẩn)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
