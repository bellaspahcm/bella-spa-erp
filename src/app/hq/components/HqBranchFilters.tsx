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
    <section className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-5 text-left shadow-sm sm:p-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(20rem,36rem)_minmax(0,1fr)] xl:items-center">
        <div className="group relative w-full min-w-0">
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

        <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-2 custom-scrollbar">
          <div className="flex min-w-max gap-4 pr-2">
            <div className="flex min-w-[14rem] flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Phân loại mô hình</span>
              <div className="flex rounded-xl border border-slate-200/50 bg-slate-50 p-1">
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

            <div className="flex min-w-[12rem] flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Ngành kinh doanh</span>
              <div className="flex rounded-xl border border-slate-200/50 bg-slate-50 p-1">
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

            <div className="flex min-w-[14rem] flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Trạng thái vận hành</span>
              <div className="flex rounded-xl border border-slate-200/50 bg-slate-50 p-1">
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
        </div>
      </div>
    </section>
  );
}

export type { BranchModuleFilter, BranchStatusFilter, BranchTypeFilter };
