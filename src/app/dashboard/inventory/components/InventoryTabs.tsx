import { ClipboardCheck, Package, Truck } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ActiveInventoryTab } from '../types';

type InventoryTabsProps = {
  activeTab: ActiveInventoryTab;
  onChange: (tab: ActiveInventoryTab) => void;
};

export function InventoryTabs({ activeTab, onChange }: InventoryTabsProps) {
  return (
    <div className="flex border-b border-slate-200 gap-6">
      <button
        onClick={() => onChange('stock')}
        className={cn(
          'pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2',
          activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600',
        )}
      >
        <Package className="w-4 h-4" /> Tồn kho Chi nhánh
      </button>
      <button
        onClick={() => onChange('requests')}
        className={cn(
          'pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2',
          activeTab === 'requests' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600',
        )}
      >
        <Truck className="w-4 h-4" /> Yêu cầu cấp từ HQ
      </button>
      <button
        onClick={() => onChange('reconciliation')}
        className={cn(
          'pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2',
          activeTab === 'reconciliation' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600',
        )}
      >
        <ClipboardCheck className="w-4 h-4" /> Kiểm kê cuối tháng
      </button>
    </div>
  );
}
