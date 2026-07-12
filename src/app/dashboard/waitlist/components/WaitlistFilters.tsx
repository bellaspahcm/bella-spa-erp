'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X, Filter } from 'lucide-react';
import type { WaitlistStatus } from '@/types/waitlist';

interface WaitlistFiltersProps {
  tenantId: string;
  packageId?: string;
  preferredDate?: string;
  status?: WaitlistStatus;
  search?: string;
}

interface Package {
  id: string;
  name: string;
}

const statusOptions: { value: WaitlistStatus; label: string }[] = [
  { value: 'active', label: 'Đang chờ' },
  { value: 'notified', label: 'Đã thông báo' },
  { value: 'reserved', label: 'Đã giữ chỗ' },
  { value: 'converted', label: 'Đã đặt lịch' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const datePresets = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'tomorrow', label: 'Ngày mai' },
  { value: 'this_week', label: 'Tuần này' },
  { value: 'custom', label: 'Tùy chỉnh' },
];

export function WaitlistFilters({
  tenantId,
  packageId,
  preferredDate,
  status,
  search,
}: WaitlistFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [localSearch, setLocalSearch] = useState(search || '');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch packages for dropdown
  useEffect(() => {
    const fetchPackages = async () => {
      if (!tenantId) return;

      setIsLoadingPackages(true);
      try {
        const response = await fetch(`/api/packages?tenant_id=${tenantId}&limit=100`);
        if (response.ok) {
          const data = await response.json();
          setPackages(data.packages || []);
        }
      } catch (err) {
        console.error('Error fetching packages:', err);
      } finally {
        setIsLoadingPackages(false);
      }
    };

    void fetchPackages();
  }, [tenantId]);

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1 when filters change
    params.set('page', '1');

    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    setLocalSearch('');
    router.push(pathname);
  };

  const hasActiveFilters = packageId || preferredDate || status || search;

  // Convert date preset to actual date
  const getDateFromPreset = (preset: string): string | undefined => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (preset) {
      case 'today':
        return today.toISOString().split('T')[0];
      case 'tomorrow':
        return tomorrow.toISOString().split('T')[0];
      case 'this_week':
        // Return start of week (Monday)
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1);
        return monday.toISOString().split('T')[0];
      default:
        return undefined;
    }
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Mobile filter toggle */}
      <div className="flex items-center gap-3 sm:hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" />
          Bộ lọc
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-white">
              {[packageId, preferredDate, status, search].filter(Boolean).length}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Filter controls */}
      <div className={`${showFilters ? 'block' : 'hidden'} sm:block`}>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Package filter */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Dịch vụ
              </label>
              <select
                value={packageId || ''}
                onChange={(e) => updateFilters({ package_id: e.target.value || undefined })}
                disabled={isLoadingPackages}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100"
              >
                <option value="">Tất cả dịch vụ</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date filter */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Ngày
              </label>
              <select
                value={preferredDate || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'custom') {
                    // Open date picker (future enhancement)
                    return;
                  }
                  const date = getDateFromPreset(value) || undefined;
                  updateFilters({ preferred_date: date });
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Tất cả ngày</option>
                {datePresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Trạng thái
              </label>
              <select
                value={status || ''}
                onChange={(e) => updateFilters({ status: e.target.value as WaitlistStatus | undefined })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Tất cả trạng thái</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tìm kiếm
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateFilters({ search: localSearch || undefined });
                    }
                  }}
                  placeholder="Tên hoặc SĐT..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                {localSearch && (
                  <button
                    onClick={() => {
                      setLocalSearch('');
                      updateFilters({ search: undefined });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Clear filters button (desktop) */}
          {hasActiveFilters && (
            <div className="mt-4 hidden sm:block">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
