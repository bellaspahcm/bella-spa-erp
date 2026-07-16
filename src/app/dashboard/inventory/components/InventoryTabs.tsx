import { ClipboardCheck, Package, ShoppingCart, Truck } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ActiveInventoryTab } from '../types';

type InventoryTabsProps = {
  activeTab: ActiveInventoryTab;
  onChange: (tab: ActiveInventoryTab) => void;
};

export function InventoryTabs({ activeTab, onChange }: InventoryTabsProps) {
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-slate-200 pb-px sm:gap-6">
      <button
        onClick={() => onChange('stock')}
        className={cn(
          'flex shrink-0 items-center gap-2 border-b-2 pb-4 text-xs font-black uppercase tracking-widest transition-all',
          activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600',
        )}
      >
        <Package className="w-4 h-4" /> Tồn kho Chi nhánh
      </button>
      <button
        onClick={() => onChange('requests')}
        className={cn(
          'flex shrink-0 items-center gap-2 border-b-2 pb-4 text-xs font-black uppercase tracking-widest transition-all',
          activeTab === 'requests' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600',
        )}
      >
        <Truck className="w-4 h-4" /> Yêu cầu cấp từ HQ
      </button>
      <button
        onClick={() => onChange('reconciliation')}
        className={cn(
          'flex shrink-0 items-center gap-2 border-b-2 pb-4 text-xs font-black uppercase tracking-widest transition-all',
          activeTab === 'reconciliation' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600',
        )}
      >
        <ClipboardCheck className="w-4 h-4" /> Kiểm kê cuối tháng
      </button>
      <button
        onClick={() => onChange('sales')}
        className={cn(
          'flex shrink-0 items-center gap-2 border-b-2 pb-4 text-xs font-black uppercase tracking-widest transition-all',
          activeTab === 'sales' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600',
        )}
      >
        <ShoppingCart className="w-4 h-4" /> Bán hàng sản phẩm
      </button>
    </div>
  );
}
