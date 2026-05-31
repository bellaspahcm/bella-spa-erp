import type { HqTenantRecord } from '@/types/domain';

type TransferFilterStatus = 'all' | 'pending' | 'shipped' | 'completed' | 'cancelled';

interface HqTransferFiltersProps {
  tenants: HqTenantRecord[];
  filterStatus: TransferFilterStatus;
  filterBranch: string;
  onFilterStatusChange: (value: TransferFilterStatus) => void;
  onFilterBranchChange: (value: string) => void;
}

export function HqTransferFilters({
  tenants,
  filterStatus,
  filterBranch,
  onFilterStatusChange,
  onFilterBranchChange,
}: HqTransferFiltersProps) {
  return (
    <>
      {/* Filters and Search for Transfers */}
      <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex gap-4 w-full md:max-w-xl">
        {/* Status Filter */}
        <div className="flex-1">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trạng thái đơn</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'pending' || v === 'shipped' || v === 'completed' || v === 'cancelled' || v === 'all') {
                onFilterStatusChange(v);
              }
            }}
            className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt cấp hàng</option>
            <option value="shipped">Đang vận chuyển</option>
            <option value="completed">Đã nhận hàng (Hoàn tất)</option>
            <option value="cancelled">Đã từ chối / Hủy đơn</option>
          </select>
        </div>

        {/* Branch Filter */}
        <div className="flex-1">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Chi nhánh yêu cầu</label>
          <select
            value={filterBranch}
            onChange={(e) => onFilterBranchChange(e.target.value)}
            className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
          >
            <option value="all">Tất cả chi nhánh</option>
            {tenants
              .filter(t => t.name !== 'Bella Spa Headquarter')
              .map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
        </div>
      </div>

      <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full font-black uppercase tracking-wider">
        Tổng bộ điều phối kho vận
      </span>
      </section>
    </>
  );
}
