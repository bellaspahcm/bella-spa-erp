import { AlertCircle, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { InterBranchClearingRecord } from '@/services/clearing-actions';

interface HqClearingStatsProps {
  records: InterBranchClearingRecord[];
}

export function HqClearingStats({ records }: HqClearingStatsProps) {
  const totalAmount = records.reduce((acc, r) => acc + Number(r.calculated_amount), 0);
  const clearedAmount = records
    .filter(r => r.status === 'cleared')
    .reduce((acc, r) => acc + Number(r.calculated_amount), 0);
  const pendingAmount = records
    .filter(r => r.status === 'pending')
    .reduce((acc, r) => acc + Number(r.calculated_amount), 0);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
          <ArrowLeftRight size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng bù trừ liên chi nhánh</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
            {formatCurrency(totalAmount)}
          </h3>
          <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
            {records.length} Giao dịch công nợ
          </span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
          <CheckCircle2 size={26} className="text-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đã đối soát bù trừ</p>
          <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">
            {formatCurrency(clearedAmount)}
          </h3>
          <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
            Đã thanh lý công nợ nội bộ
          </span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
          <AlertCircle size={26} className="text-amber-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dư nợ đang chờ</p>
          <h3 className="text-2xl font-black text-amber-600 leading-none mb-1">
            {formatCurrency(pendingAmount)}
          </h3>
          <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
            Đang đợi chi nhánh thanh toán
          </span>
        </div>
      </div>
    </section>
  );
}
