import { PremiumSelect } from '@/components/ui/PremiumSelect';
import type { HqTenantRecord } from '@/types/domain';

type TransferFilterStatus = 'all' | 'pending' | 'shipped' | 'completed' | 'cancelled';

interface HqTransferFiltersProps {
  tenants: HqTenantRecord[];
  filterStatus: TransferFilterStatus;
  filterBranch: string;
  onFilterStatusChange: (value: TransferFilterStatus) => void;
  onFilterBranchChange: (value: string) => void;
}

const selectButtonClassName =
  'flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-xs font-bold text-slate-700 outline-none transition-all hover:border-primary/30 hover:bg-white focus:ring-4 focus:ring-primary/10 disabled:opacity-50';

const statusOptions: Array<{ value: TransferFilterStatus; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ duyệt cấp hàng' },
  { value: 'shipped', label: 'Đang vận chuyển' },
  { value: 'completed', label: 'Đã nhận hàng' },
  { value: 'cancelled', label: 'Đã từ chối / hủy đơn' },
];

export function HqTransferFilters({
  tenants,
  filterStatus,
  filterBranch,
  onFilterStatusChange,
  onFilterBranchChange,
}: HqTransferFiltersProps) {
  const branchOptions = [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...tenants
      .filter((tenant) => tenant.name !== 'Bella Spa Headquarter')
      .map((tenant) => ({ value: tenant.id, label: tenant.name })),
  ];

  return (
    <section className="grid grid-cols-1 gap-4 rounded-[2.5rem] border border-slate-100 bg-white p-5 text-left shadow-sm sm:p-6 lg:grid-cols-[minmax(0,36rem)_auto] lg:items-end">
      <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Trạng thái đơn</span>
          <PremiumSelect
            value={filterStatus}
            onChange={(value) => onFilterStatusChange(value as TransferFilterStatus)}
            options={statusOptions}
            buttonClassName={selectButtonClassName}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Chi nhánh yêu cầu</span>
          <PremiumSelect
            value={filterBranch}
            onChange={onFilterBranchChange}
            options={branchOptions}
            buttonClassName={selectButtonClassName}
          />
        </div>
      </div>

      <span className="inline-flex min-h-9 items-center justify-center rounded-full bg-slate-100 px-4 py-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">
        Tổng bộ điều phối kho vận
      </span>
    </section>
  );
}
