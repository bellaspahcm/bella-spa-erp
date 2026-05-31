import { Search } from 'lucide-react';
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
    <>
      {/* Filter and Search Panel - Glassmorphic design */}
      <section className="bg-white/80 border border-slate-200/60 backdrop-blur-md rounded-[2.5rem] shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0">
            <Search size={14} />
          </div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Bộ lọc nhật ký nâng cao</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Branch filter */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Chi nhánh</label>
            <select
              value={selectedTenant}
              onChange={(e) => onSelectedTenantChange(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
            >
              <option value="all">Tất cả chi nhánh</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* User filter */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Người thực hiện</label>
            <select
              value={selectedUser}
              onChange={(e) => onSelectedUserChange(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
            >
              <option value="all">Tất cả người dùng</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Action filter */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Loại tác vụ</label>
            <select
              value={selectedAction}
              onChange={(e) => onSelectedActionChange(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
            >
              <option value="">Tất cả tác vụ</option>
              <option value="INSERT">Thêm mới (INSERT)</option>
              <option value="UPDATE">Cập nhật (UPDATE)</option>
              <option value="DELETE">Xóa bỏ (DELETE)</option>
            </select>
          </div>

          {/* Table filter */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Bảng dữ liệu</label>
            <select
              value={selectedTable}
              onChange={(e) => onSelectedTableChange(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
            >
              <option value="all">Tất cả bảng</option>
              {tables.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Từ ngày</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Đến ngày</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
            />
          </div>
        </div>
      </section>
    </>
  );
}
