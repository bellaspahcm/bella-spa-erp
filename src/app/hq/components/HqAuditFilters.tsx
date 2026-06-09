import { Search } from 'lucide-react';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import type { HqTenantRecord } from '@/types/domain';

interface HqAuditFiltersProps {
  tenants: HqTenantRecord[];
  users: Array<{ id: string; name: string }>;
  tables: string[];
  selectedTenant: string;
  selectedUser: string;
  selectedAction: string;
  selectedTable: string;
  startDate: string;
  endDate: string;
  onSelectedTenantChange: (value: string) => void;
  onSelectedUserChange: (value: string) => void;
  onSelectedActionChange: (value: string) => void;
  onSelectedTableChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

const selectButtonClassName =
  'flex min-h-10 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-xs font-bold text-slate-700 outline-none transition-all hover:border-primary/30 hover:bg-white focus:ring-4 focus:ring-primary/10';

const dateInputClassName =
  'block min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 outline-none transition-all [color-scheme:light] focus:border-primary focus:ring-4 focus:ring-primary/10';

export function HqAuditFilters({
  tenants,
  users,
  tables,
  selectedTenant,
  selectedUser,
  selectedAction,
  selectedTable,
  startDate,
  endDate,
  onSelectedTenantChange,
  onSelectedUserChange,
  onSelectedActionChange,
  onSelectedTableChange,
  onStartDateChange,
  onEndDateChange,
}: HqAuditFiltersProps) {
  return (
    <section className="space-y-6 rounded-[2.5rem] border border-slate-200/60 bg-white/80 p-5 text-left shadow-sm backdrop-blur-md sm:p-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
          <Search size={14} />
        </div>
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">Bộ lọc nhật ký nâng cao</h4>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="min-w-0 space-y-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Chi nhánh</span>
          <PremiumSelect
            value={selectedTenant}
            onChange={onSelectedTenantChange}
            options={[
              { value: 'all', label: 'Tất cả chi nhánh' },
              ...tenants.map((tenant) => ({ value: tenant.id, label: tenant.name })),
            ]}
            buttonClassName={selectButtonClassName}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Người thực hiện</span>
          <PremiumSelect
            value={selectedUser}
            onChange={onSelectedUserChange}
            options={[
              { value: 'all', label: 'Tất cả người dùng' },
              ...users.map((user) => ({ value: user.id, label: user.name })),
            ]}
            buttonClassName={selectButtonClassName}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Loại tác vụ</span>
          <PremiumSelect
            value={selectedAction}
            onChange={onSelectedActionChange}
            options={[
              { value: '', label: 'Tất cả tác vụ' },
              { value: 'INSERT', label: 'Thêm mới (INSERT)' },
              { value: 'UPDATE', label: 'Cập nhật (UPDATE)' },
              { value: 'DELETE', label: 'Xóa bỏ (DELETE)' },
            ]}
            buttonClassName={selectButtonClassName}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Bảng dữ liệu</span>
          <PremiumSelect
            value={selectedTable}
            onChange={onSelectedTableChange}
            options={[
              { value: 'all', label: 'Tất cả bảng' },
              ...tables.map((table) => ({ value: table, label: table })),
            ]}
            buttonClassName={selectButtonClassName}
          />
        </div>

        <label className="min-w-0 space-y-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Từ ngày</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className={dateInputClassName}
          />
        </label>

        <label className="min-w-0 space-y-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Đến ngày</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className={dateInputClassName}
          />
        </label>
      </div>
    </section>
  );
}
