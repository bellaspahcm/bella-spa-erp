'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdvancedFilters {
  startDate?: string;
  endDate?: string;
  ktvIds?: string[]; // Multi-select
  statuses?: string[]; // Multi-select
  types?: string[]; // Multi-select
  categories?: string[]; // Multi-select
  amountMin?: number;
  amountMax?: number;
  createdByIds?: string[]; // Multi-select
  search?: string;
}

interface AdjustmentsAdvancedFiltersProps {
  filters: AdvancedFilters;
  onFilterChange: (filters: AdvancedFilters) => void;
  onApply: () => void;
  onReset: () => void;
  ktvList: Array<{ id: string; full_name: string }>;
  userList: Array<{ id: string; full_name: string }>;
}

const BONUS_CATEGORIES = [
  'Thưởng hiệu suất',
  'Thưởng lễ tết',
  'Thưởng hoàn thành dự án',
  'Khác',
];

const DEDUCTION_CATEGORIES = [
  'Phạt vi phạm nội quy',
  'Phạt làm hỏng trang thiết bị',
  'Trừ tạm ứng',
  'Khác',
];

const ALL_CATEGORIES = [...new Set([...BONUS_CATEGORIES, ...DEDUCTION_CATEGORIES])];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const TYPE_OPTIONS = [
  { value: 'bonus', label: 'Thưởng' },
  { value: 'deduction', label: 'Phạt' },
];

export function AdjustmentsAdvancedFilters({
  filters,
  onFilterChange,
  onApply,
  onReset,
  ktvList,
  userList,
}: AdjustmentsAdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count active filters
  const activeFilterCount = [
    filters.startDate,
    filters.endDate,
    filters.ktvIds && filters.ktvIds.length > 0,
    filters.statuses && filters.statuses.length > 0,
    filters.types && filters.types.length > 0,
    filters.categories && filters.categories.length > 0,
    filters.amountMin !== undefined,
    filters.amountMax !== undefined,
    filters.createdByIds && filters.createdByIds.length > 0,
    filters.search,
  ].filter(Boolean).length;

  // Toggle handlers for multi-select
  const toggleArrayValue = (field: keyof AdvancedFilters, value: string) => {
    const currentArray = (filters[field] as string[]) || [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((v) => v !== value)
      : [...currentArray, value];
    
    onFilterChange({ ...filters, [field]: newArray.length > 0 ? newArray : undefined });
  };

  // Remove individual filter badge
  const removeFilter = (field: keyof AdvancedFilters) => {
    onFilterChange({ ...filters, [field]: undefined });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Bộ lọc nâng cao
          </span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 space-y-6 border-t border-gray-100 dark:border-gray-700 pt-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tìm kiếm
                </label>
                <input
                  type="text"
                  value={filters.search || ''}
                  onChange={(e) => onFilterChange({ ...filters, search: e.target.value || undefined })}
                  placeholder="Tên KTV, lý do, danh mục..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Từ tháng
                  </label>
                  <input
                    type="month"
                    value={filters.startDate || ''}
                    onChange={(e) =>
                      onFilterChange({ ...filters, startDate: e.target.value || undefined })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Đến tháng
                  </label>
                  <input
                    type="month"
                    value={filters.endDate || ''}
                    onChange={(e) =>
                      onFilterChange({ ...filters, endDate: e.target.value || undefined })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* KTV Multi-Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  KTV ({filters.ktvIds?.length || 0} đã chọn)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 space-y-1">
                  {ktvList.map((ktv) => (
                    <label
                      key={ktv.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.ktvIds?.includes(ktv.id) || false}
                        onChange={() => toggleArrayValue('ktvIds', ktv.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {ktv.full_name} ({ktv.email})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Type Multi-Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Loại
                </label>
                <div className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => toggleArrayValue('types', option.value)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        filters.types?.includes(option.value)
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Multi-Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Trạng thái
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => toggleArrayValue('statuses', option.value)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        filters.statuses?.includes(option.value)
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Multi-Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Danh mục
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => toggleArrayValue('categories', category)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        filters.categories?.includes(category)
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Số tiền tối thiểu (đ)
                  </label>
                  <input
                    type="number"
                    value={filters.amountMin || ''}
                    onChange={(e) =>
                      onFilterChange({
                        ...filters,
                        amountMin: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Số tiền tối đa (đ)
                  </label>
                  <input
                    type="number"
                    value={filters.amountMax || ''}
                    onChange={(e) =>
                      onFilterChange({
                        ...filters,
                        amountMax: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="∞"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Created By Multi-Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Người tạo ({filters.createdByIds?.length || 0} đã chọn)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 space-y-1">
                  {userList.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.createdByIds?.includes(user.id) || false}
                        onChange={() => toggleArrayValue('createdByIds', user.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {user.full_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={onApply}
                  className="flex-1 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Áp dụng
                </button>
                <button
                  onClick={onReset}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Đặt lại
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Filter Badges (Always visible when filters are active) */}
      {activeFilterCount > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Tìm: {filters.search}
              <button
                onClick={() => removeFilter('search')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.startDate && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Từ: {filters.startDate}
              <button
                onClick={() => removeFilter('startDate')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.endDate && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Đến: {filters.endDate}
              <button
                onClick={() => removeFilter('endDate')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.ktvIds && filters.ktvIds.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              KTV: {filters.ktvIds.length}
              <button
                onClick={() => removeFilter('ktvIds')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.types && filters.types.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Loại: {filters.types.length}
              <button
                onClick={() => removeFilter('types')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.statuses && filters.statuses.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Trạng thái: {filters.statuses.length}
              <button
                onClick={() => removeFilter('statuses')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.categories && filters.categories.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Danh mục: {filters.categories.length}
              <button
                onClick={() => removeFilter('categories')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.amountMin !== undefined && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Min: {filters.amountMin.toLocaleString()}đ
              <button
                onClick={() => removeFilter('amountMin')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.amountMax !== undefined && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Max: {filters.amountMax.toLocaleString()}đ
              <button
                onClick={() => removeFilter('amountMax')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.createdByIds && filters.createdByIds.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Người tạo: {filters.createdByIds.length}
              <button
                onClick={() => removeFilter('createdByIds')}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
