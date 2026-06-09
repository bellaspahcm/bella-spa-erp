'use client';

import { Search } from 'lucide-react';

type BranchTypeFilter = 'all' | 'direct' | 'franchise';
type BranchStatusFilter = 'all' | 'active' | 'suspended';
type BranchModuleFilter = 'all' | 'babycare' | 'beauty_spa';

interface HqBranchFiltersProps {
  searchTerm: string;
  typeFilter: BranchTypeFilter;
  statusFilter: BranchStatusFilter;
  moduleFilter: BranchModuleFilter;
  onSearchTermChange: (value: string) => void;
  onTypeFilterChange: (value: BranchTypeFilter) => void;
  onStatusFilterChange: (value: BranchStatusFilter) => void;
  onModuleFilterChange: (value: BranchModuleFilter) => void;
}

export function HqBranchFilters({
  searchTerm,
  typeFilter,
  statusFilter,
  moduleFilter,
  onSearchTermChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onModuleFilterChange,
}: HqBranchFiltersProps) {
  return (
    <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 text-left">
      <div className="relative w-full xl:max-w-md group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="block w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-slate-700 placeholder:text-slate-400 text-sm font-medium"
          placeholder="Tìm kiếm theo Tên Spa, hotline, email..."
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center w-full xl:w-auto">
        <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Phân loại mô hình</span>
          <div className="flex bg-slate-50 border border-slate-200/50 rounded-xl p-1 shrink-0">
            {([
              { label: 'Tất cả', value: 'all' },
              { label: 'Trực thuộc', value: 'direct' },
              { label: 'Nhượng quyền', value: 'franchise' },
            ] as const).map((btn) => (
              <button
                key={btn.value}
                onClick={() => onTypeFilterChange(btn.value)}
                className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                  typeFilter === btn.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Ngành kinh doanh</span>
          <div className="flex bg-slate-50 border border-slate-200/50 rounded-xl p-1 shrink-0">
            {([
              { label: 'Tất cả', value: 'all' },
              { label: 'Mẹ & Bé', value: 'babycare' },
              { label: 'Beauty', value: 'beauty_spa' },
            ] as const).map((btn) => (
              <button
                key={btn.value}
                onClick={() => onModuleFilterChange(btn.value)}
                className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                  moduleFilter === btn.value
                    ? 'bg-fuchsia-700 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Trạng thái vận hành</span>
          <div className="flex bg-slate-50 border border-slate-200/50 rounded-xl p-1 shrink-0">
            {([
              { label: 'Tất cả', value: 'all' },
              { label: 'Hoạt động', value: 'active' },
              { label: 'Tạm khóa', value: 'suspended' },
            ] as const).map((btn) => (
              <button
                key={btn.value}
                onClick={() => onStatusFilterChange(btn.value)}
                className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                  statusFilter === btn.value
                    ? 'bg-primary text-white shadow-sm shadow-pink-100 dark:shadow-none'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export type { BranchModuleFilter, BranchStatusFilter, BranchTypeFilter };
