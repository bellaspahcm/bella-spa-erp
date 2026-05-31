import { AlertCircle, CheckCircle2, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface HqFranchiseRoyaltyStatsProps {
  totalProjectedFees: number;
  totalCollectedFees: number;
  totalOutstandingFees: number;
}

export function HqFranchiseRoyaltyStats({
  totalProjectedFees,
  totalCollectedFees,
  totalOutstandingFees,
}: HqFranchiseRoyaltyStatsProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
          <DollarSign size={26} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dự thu Royalty (Cộng dồn)</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{formatCurrency(totalProjectedFees)}</h3>
          <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Tổng hóa đơn phát sinh</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
          <CheckCircle2 size={26} className="text-emerald-500" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đã thu về HQ</p>
          <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">{formatCurrency(totalCollectedFees)}</h3>
          <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Doanh thu đã đối soát</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
          <AlertCircle size={26} className="text-amber-500" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Còn nợ chờ thu</p>
          <h3 className="text-2xl font-black text-amber-600 leading-none mb-1">{formatCurrency(totalOutstandingFees)}</h3>
          <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Hóa đơn chưa thanh toán</span>
        </div>
      </div>
    </section>
  );
}
