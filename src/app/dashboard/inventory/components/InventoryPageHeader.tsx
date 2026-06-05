import { AlertTriangle, Package } from 'lucide-react';

import { cn } from '@/lib/utils';

type InventoryPageHeaderProps = {
  totalItems: number;
  lowCount: number;
};

export function InventoryPageHeader({ totalItems, lowCount }: InventoryPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h1 className="mb-1 text-2xl font-black text-slate-900 sm:text-3xl">Quản Lý Kho Vật Tư</h1>
        <p className="text-slate-500 text-sm font-medium">
          Theo dõi tiêu hao vật tư, yêu cầu cấp hàng từ Tổng bộ và điều chỉnh tồn kho.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg sm:min-w-[160px] sm:rounded-[2rem]">
          <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center text-primary">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng mặt hàng</p>
            <p className="text-xl font-black text-slate-900">{totalItems}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-3 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg sm:min-w-[160px] sm:rounded-[2rem]">
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
      </div>
    </div>
  );
}
