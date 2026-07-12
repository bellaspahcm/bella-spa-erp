'use client';

/**
 * Rules Filters Component
 * 
 * Provides filtering controls for the rules list:
 * - Provider filter (booking, discount, payroll, commission, inventory)
 * - Status filter (draft, active, disabled, pending_approval, approved, rejected, archived)
 * - Search input (name, description)
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';


interface RulesFiltersProps {
  initialProvider?: string;
  initialStatus?: string;
  initialSearch?: string;
}

const PROVIDERS = [
  { value: 'all', label: 'Tất cả nghiệp vụ' },
  { value: 'booking', label: 'Đặt lịch' },
  { value: 'discount', label: 'Chiết khấu' },
  { value: 'payroll', label: 'Tính lương' },
  { value: 'commission', label: 'Hoa hồng' },
  { value: 'inventory', label: 'Kho hàng' },
];

const STATUSES = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'draft', label: 'Bản nháp', color: 'gray' },
  { value: 'active', label: 'Hoạt động', color: 'green' },
  { value: 'disabled', label: 'Đã tắt', color: 'yellow' },
  { value: 'pending_approval', label: 'Chờ duyệt', color: 'blue' },
  { value: 'approved', label: 'Đã duyệt', color: 'green' },
  { value: 'rejected', label: 'Từ chối', color: 'red' },
  { value: 'archived', label: 'Lưu trữ', color: 'gray' },
];

export function RulesFilters({
  initialProvider = 'all',
  initialStatus = 'all',
  initialSearch = '',
}: RulesFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1 when filters change
    params.delete('page');

    router.push(`/dashboard/rules?${params.toString()}`);
  };

  const handleProviderChange = (value: string | null) => {
    updateFilters({ provider: value || undefined });
  };

  const handleStatusChange = (value: string | null) => {
    updateFilters({ status: value || undefined });
  };

  const handleSearchChange = (value: string) => {
    updateFilters({ search: value });
  };

  const handleClearFilters = () => {
    router.push('/dashboard/rules');
  };

  const { tenantModuleKey } = useTenantModuleKey();
  const isBeautySpa = tenantModuleKey === 'beauty_spa';
  const isIndustrialCleaning = tenantModuleKey === 'industrial_cleaning';

  const buttonActive = isBeautySpa
    ? 'hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
    : isIndustrialCleaning
    ? 'hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/20 dark:hover:text-indigo-400 border-indigo-200 dark:border-indigo-800/60'
    : 'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 border-rose-200 dark:border-rose-800/60';

  const hasActiveFilters =
    initialProvider !== 'all' ||
    initialStatus !== 'all' ||
    initialSearch !== '';

  return (
    <div className="bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md border border-white/20 dark:border-white/5 p-4 rounded-xl shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
          {/* Provider Filter */}
          <Select value={initialProvider} onValueChange={handleProviderChange}>
            <SelectTrigger className="w-full md:w-[200px] rounded-lg bg-white/80 dark:bg-[#1c1b19]/80 border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-0 focus:ring-offset-0 focus:border-slate-300 dark:focus:border-slate-700">
              <SelectValue placeholder="Chọn nghiệp vụ" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider.value} value={provider.value} className="text-xs font-medium">
                  {provider.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={initialStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full md:w-[200px] rounded-lg bg-white/80 dark:bg-[#1c1b19]/80 border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-0 focus:ring-offset-0 focus:border-slate-300 dark:focus:border-slate-700">
              <SelectValue placeholder="Chọn trạng thái" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value} className="text-xs font-medium">
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Tìm kiếm luật..."
              className="pl-9 rounded-lg bg-white/80 dark:bg-[#1c1b19]/80 border-slate-200 dark:border-slate-800 text-xs font-medium focus-visible:ring-1 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-700"
              defaultValue={initialSearch}
              onChange={(e) => {
                const value = e.target.value;
                const timeout = setTimeout(() => {
                  handleSearchChange(value);
                }, 500);
                return () => clearTimeout(timeout);
              }}
            />
          </div>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button 
            variant="outline" 
            onClick={handleClearFilters}
            className={`rounded-lg h-9 px-4 text-xs font-semibold transition-all ${buttonActive}`}
          >
            Xóa bộ lọc
          </Button>
        )}
      </div>
    </div>
  );
}
