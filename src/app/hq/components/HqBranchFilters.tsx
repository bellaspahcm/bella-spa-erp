'use client';

import { Search, Filter, X } from 'lucide-react';

type BranchTypeFilter = 'all' | 'direct' | 'franchise';
type BranchStatusFilter = 'all' | 'active' | 'suspended';
type BranchModuleFilter = 'all' | 'babycare' | 'beauty_spa';

interface HqBranchFiltersProps {
  searchTerm: string;
  typeFilter: BranchTypeFilter;
  statusFilter: BranchStatusFilter;
  moduleFilter: BranchModuleFilter;
  tierFilter?: string;
  regionFilter?: string;
  onSearchTermChange: (value: string) => void;
  onTypeFilterChange: (value: BranchTypeFilter) => void;
  onStatusFilterChange: (value: BranchStatusFilter) => void;
  onModuleFilterChange: (value: BranchModuleFilter) => void;
  onTierFilterChange?: (value: string) => void;
  onRegionFilterChange?: (value: string) => void;
  onClearAllFilters?: () => void;
}

export function HqBranchFilters({
  searchTerm,
  typeFilter,
  statusFilter,
  moduleFilter,
  tierFilter = 'all',
  regionFilter = 'all',
  onSearchTermChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onModuleFilterChange,
  onTierFilterChange,
  onRegionFilterChange,
  onClearAllFilters,
}: HqBranchFiltersProps) {
  const activeCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (moduleFilter !== 'all' ? 1 : 0) +
    (tierFilter !== 'all' ? 1 : 0) +
    (regionFilter !== 'all' ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  return (
    <section className="bg-white rounded-[2.5rem] border border-slate-200/80 p-5 md:p-6 shadow-xs text-left space-y-4">
      {/* Top Row: Search Input + Advanced Filter Button */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Tìm kiếm theo Tên Spa, hotline, email, mã chi nhánh..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs md:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>

        <button
          type="button"
          className="w-full sm:w-auto px-5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Filter size={15} />
          <span>Bộ lọc nâng cao</span>
        </button>
      </div>

      {/* Dropdown Filters Row (5 columns matching Image 1) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Phân loại mô hình */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 block">
            Phân loại mô hình
          </label>
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as BranchTypeFilter)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="all">Tất cả</option>
            <option value="direct">Trực thuộc</option>
            <option value="franchise">Nhượng quyền</option>
          </select>
        </div>

        {/* Ngành kinh doanh */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 block">
            Ngành kinh doanh
          </label>
          <select
            value={moduleFilter}
            onChange={(e) => onModuleFilterChange(e.target.value as BranchModuleFilter)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="all">Tất cả</option>
            <option value="beauty_spa">Beauty Spa</option>
            <option value="babycare">Mẹ & Bé</option>
          </select>
        </div>

        {/* Gói dịch vụ */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 block">
            Gói dịch vụ
          </label>
          <select
            value={tierFilter}
            onChange={(e) => onTierFilterChange && onTierFilterChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="all">Tất cả</option>
            <option value="free_trial">Free Trial</option>
            <option value="basic">Silver / Basic</option>
            <option value="pro">Gold / Pro</option>
            <option value="enterprise">Diamond / Enterprise</option>
          </select>
        </div>

        {/* Trạng thái */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 block">
            Trạng thái
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as BranchStatusFilter)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="all">Tất cả</option>
            <option value="active">Hoạt động</option>
            <option value="suspended">Tạm khóa</option>
          </select>
        </div>

        {/* Khu vực */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 block">
            Khu vực
          </label>
          <select
            value={regionFilter}
            onChange={(e) => onRegionFilterChange && onRegionFilterChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="all">Tất cả</option>
            <option value="TP. HCM">TP. HCM</option>
            <option value="Hà Nội">Hà Nội</option>
            <option value="Đà Nẵng">Đà Nẵng</option>
          </select>
        </div>
      </div>

      {/* Active Filter Chips Row matching Image 1 */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
          {typeFilter !== 'all' && (
            <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-black inline-flex items-center gap-1.5">
              <span>{typeFilter === 'franchise' ? 'Nhượng quyền' : 'Trực thuộc'}</span>
              <X size={13} className="cursor-pointer hover:text-blue-900" onClick={() => onTypeFilterChange('all')} />
            </span>
          )}

          {moduleFilter !== 'all' && (
            <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-black inline-flex items-center gap-1.5">
              <span>{moduleFilter === 'beauty_spa' ? 'Beauty Spa' : 'Mẹ & Bé'}</span>
              <X size={13} className="cursor-pointer hover:text-purple-900" onClick={() => onModuleFilterChange('all')} />
            </span>
          )}

          {tierFilter !== 'all' && (
            <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-black inline-flex items-center gap-1.5">
              <span>
                {tierFilter === 'pro'
                  ? 'Gold / Pro'
                  : tierFilter === 'basic'
                  ? 'Silver / Basic'
                  : tierFilter === 'enterprise'
                  ? 'Diamond'
                  : 'Free Trial'}
              </span>
              <X size={13} className="cursor-pointer hover:text-amber-950" onClick={() => onTierFilterChange && onTierFilterChange('all')} />
            </span>
          )}

          <button
            onClick={() => {
              onTypeFilterChange('all');
              onStatusFilterChange('all');
              onModuleFilterChange('all');
              onTierFilterChange && onTierFilterChange('all');
              onRegionFilterChange && onRegionFilterChange('all');
              onSearchTermChange('');
              if (onClearAllFilters) onClearAllFilters();
            }}
            className="text-xs font-black text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 cursor-pointer"
          >
            Xóa tất cả
          </button>
        </div>
      )}
    </section>
  );
}

export type { BranchModuleFilter, BranchStatusFilter, BranchTypeFilter };
