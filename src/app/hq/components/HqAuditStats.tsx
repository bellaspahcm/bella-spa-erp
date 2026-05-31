import { Activity, ShieldCheck, Store, Users } from 'lucide-react';
import type { HqAuditLogRecord } from '@/types/domain';

interface HqAuditStatsProps {
  logs: HqAuditLogRecord[];
  tables: string[];
}

export function HqAuditStats({ logs, tables }: HqAuditStatsProps) {
  return (
    <>
      {/* Security KPIs Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        {/* Total activities in page */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
            <Activity size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng số tác vụ</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
              {logs.length === 15 ? '15+' : logs.length} Ghi nhận
            </h3>
            <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
              Đợt tải hiện tại
            </span>
          </div>
        </div>

        {/* Active users */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
            <Users size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Quản trị viên thao tác</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
              {new Set(logs.map(l => l.user_name)).size} Tài khoản
            </h3>
            <span className="text-[9px] bg-rose-50 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
              Hoạt động gần đây
            </span>
          </div>
        </div>

        {/* Touched branches */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
            <Store size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Chi nhánh phát sinh log</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
              {new Set(logs.map(l => l.tenant_name)).size} Chi nhánh
            </h3>
            <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
              Toàn hệ thống
            </span>
          </div>
        </div>

        {/* System Table Count */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck size={26} className="text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Danh mục giám sát</p>
            <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">
              {tables.length} Bảng dữ liệu
            </h3>
            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
              Cơ sở dữ liệu an toàn
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
