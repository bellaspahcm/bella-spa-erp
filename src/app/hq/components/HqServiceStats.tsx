import { Activity, Package, Send } from 'lucide-react';
import type { HqPackageTemplate } from '@/types/domain';

export interface HqDistributedPackageRecord {
  id: string;
  name: string;
  price: number;
  tenant_id: string;
  tenant_name: string;
  template_id: string;
  status: string;
}

interface HqServiceStatsProps {
  templates: HqPackageTemplate[];
  distributedList: HqDistributedPackageRecord[];
}

export function HqServiceStats({
  templates,
  distributedList,
}: HqServiceStatsProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex gap-4 items-center">
        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
          <Package size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng số gói mẫu</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none">{templates.length} Gói mẫu</h3>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex gap-4 items-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
          <Send size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Chi nhánh áp dụng</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none">
            {new Set(distributedList.map(d => d.tenant_id)).size} Chi nhánh
          </h3>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex gap-4 items-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
          <Activity size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Bản ghi phân phối</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none">{distributedList.length} Bản ghi</h3>
        </div>
      </div>
    </section>
  );
}
