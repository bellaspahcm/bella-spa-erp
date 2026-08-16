import { History, TrendingDown, TrendingUp } from 'lucide-react';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn } from '@/lib/utils';

import { MONTHS, YEARS } from '../constants';
import type { InventoryLog } from '../types';

type InventoryLogsPanelProps = {
  logs: InventoryLog[];
  logMonth: number;
  logYear: number;
  setLogMonth: (month: number) => void;
  setLogYear: (year: number) => void;
};

const REASON_LABELS: Record<string, string> = {
  session_consumption: 'Tiêu hao liệu trình',
  restock: 'Điều chỉnh cục bộ',
  transfer_receipt: 'Nhận từ Tổng bộ',
  transfer_shipment: 'Xuất chuyển kho',
  initial: 'Tồn kho ban đầu',
  monthly_reconciliation: 'Kiểm kê cuối tháng',
};

export function InventoryLogsPanel({
  logs,
  logMonth,
  logYear,
  setLogMonth,
  setLogYear,
}: InventoryLogsPanelProps) {
  return (
    <div className="xl:col-span-1">
      <div className="flex h-full flex-col customer-detail-card rounded-[2rem] border border-slate-100 bg-white p-5 shadow-xl sm:rounded-[3rem] sm:p-8">
        <div className="mb-5 flex items-center justify-between sm:mb-6">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <History className="text-primary w-5 h-5" /> Lịch sử Kho
          </h3>
        </div>

        <div className="mb-5 space-y-3 rounded-2xl bg-slate-50 p-4 sm:mb-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lọc theo tháng</p>
          <div className="bella-toolbar grid grid-cols-1 gap-2 sm:grid-cols-2">
            <PremiumSelect
              value={String(logMonth)}
              onChange={(val) => setLogMonth(Number(val))}
              options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
            />
            <PremiumSelect
              value={String(logYear)}
              onChange={(val) => setLogYear(Number(val))}
              options={YEARS.map(y => ({ value: String(y), label: String(y) }))}
            />
          </div>
          <p className="text-[9px] text-slate-400 font-medium text-right">{logs.length} giao dịch</p>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1">
          {logs.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Không có giao dịch trong khoảng này</p>
            </div>
          ) : logs.map(lg => (
            <div key={lg.id} className="flex gap-3 pb-4 border-b border-slate-50 last:border-0">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                  lg.change_amount > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-primary',
                )}
              >
                {lg.change_amount > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-start">
                  <p className="pr-2 text-sm font-black text-slate-900 break-words">{lg.inventory_items?.name}</p>
                  <span
                    className={cn(
                      'text-xs font-black whitespace-nowrap',
                      lg.change_amount > 0 ? 'text-emerald-500' : 'text-rose-500',
                    )}
                  >
                    {lg.change_amount > 0 ? '+' : ''}{lg.change_amount}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {REASON_LABELS[lg.reason] || lg.reason}
                </p>
                <p className="max-w-full break-words text-[10px] font-medium text-slate-400">{lg.notes || ''}</p>
                <p className="text-[10px] text-slate-400">
                  {lg.created_at ? new Date(lg.created_at).toLocaleDateString('vi-VN') : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
