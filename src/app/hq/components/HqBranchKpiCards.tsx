import { Activity, DollarSign, MessageSquare, Store } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { HqDashboardStats } from '@/types/domain';

interface HqBranchKpiCardsProps {
  stats: HqDashboardStats;
}

export function HqBranchKpiCards({ stats }: HqBranchKpiCardsProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
          <Store size={26} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Số chi nhánh Spa</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stats.totalSpas} Spa</h3>
          <p className="text-[10px] text-slate-500 font-bold">
            <span className="text-emerald-600 font-black">{stats.activeSpas} Hoạt động</span> | <span>{stats.suspendedSpas} Khóa</span>
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
          <DollarSign size={26} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Doanh thu toàn sàn</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{formatCurrency(stats.totalRevenue)}</h3>
          <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
            <span className="text-emerald-600 font-black">100% Thực thu đối soát</span>
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
          <Activity size={26} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng ca liệu trình</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stats.totalSessions} Ca</h3>
          <p className="text-[10px] text-slate-500 font-bold">Lưu lượng liệu trình thực tế</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
          <MessageSquare size={26} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Zalo SMS tiêu thụ</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stats.zaloSmsUsed} Tin</h3>
          <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
            <span className="text-blue-600 font-black">ZNS Smart Reminders</span>
          </p>
        </div>
      </div>
    </section>
  );
}
