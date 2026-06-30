'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Plus, Download, Filter, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { AdjustmentRow } from './AdjustmentRow';
import { AdjustmentsAdvancedFilters } from './AdjustmentsAdvancedFilters';
import { AddAdjustmentModal } from './AddAdjustmentModal';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { useKTVList } from '@/hooks/useKTVList';
import { createClient } from '@/lib/supabase-client';
import type { Database } from '@/types/database.types';
import { toast } from 'sonner';

type SalaryAdjustment = {
  id: string;
  ktv_id: string;
  month_year: string;
  adjustment_type: 'bonus' | 'deduction';
  amount: number;
  category: string;
  reason: string;
  notes: string | null;
  status: 'draft' | 'approved' | 'rejected' | 'cancelled';
  approved_by_id: string | null;
  approved_at: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  ktv_name?: string;
  created_by_name?: string;
  approved_by_name?: string;
};

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

export function AdjustmentsListPage() {
  const tenantContext = useTenantContext();
  const { ktvList, isLoading: isLoadingKTV } = useKTVList(tenantContext?.tenantId);
  
  const [adjustments, setAdjustments] = useState<SalaryAdjustment[]>([]);
  const [filteredAdjustments, setFilteredAdjustments] = useState<SalaryAdjustment[]>([]);
  const [userList, setUserList] = useState<Array<{ id: string; full_name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAdjustments, setSelectedAdjustments] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  
  // Filter state - Advanced
  const [filters, setFilters] = useState<AdvancedFilters>({
    startDate: undefined,
    endDate: undefined,
    ktvIds: undefined,
    statuses: undefined,
    types: undefined,
    categories: undefined,
    amountMin: undefined,
    amountMax: undefined,
    createdByIds: undefined,
    search: undefined,
  });

  // Stats
  const [stats, setStats] = useState({
    totalBonuses: 0,
    totalDeductions: 0,
    pendingCount: 0,
  });

  // Fetch users list for "Created By" filter
  useEffect(() => {
    async function fetchUsers() {
      if (!tenantContext?.tenantId) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('tenant_id', tenantContext.tenantId)
          .order('full_name');

        if (!error && data) {
          setUserList(data as Array<{ id: string; full_name: string }>);
        }
      } catch (err) {
        console.error('[AdjustmentsListPage] Error fetching users:', err);
      }
    }

    fetchUsers();
  }, [tenantContext?.tenantId]);

  // Fetch adjustments
  const fetchAdjustments = useCallback(async () => {
    if (!tenantContext?.tenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      let query = (supabase as any)
        .from('salary_adjustments')
        .select(`
          *,
          ktv:users!ktv_id(full_name),
          created_by:users!created_by_id(full_name),
          approved_by:users!approved_by_id(full_name)
        `)
        .eq('tenant_id', tenantContext.tenantId)
        .order('created_at', { ascending: false });

      // Apply advanced filters
      if (filters.ktvIds && filters.ktvIds.length > 0) {
        query = query.in('ktv_id', filters.ktvIds);
      }

      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses);
      }

      if (filters.types && filters.types.length > 0) {
        query = query.in('adjustment_type', filters.types);
      }

      if (filters.categories && filters.categories.length > 0) {
        query = query.in('category', filters.categories);
      }

      if (filters.startDate) {
        query = query.gte('month_year', filters.startDate + '-01');
      }

      if (filters.endDate) {
        query = query.lte('month_year', filters.endDate + '-01');
      }

      if (filters.amountMin !== undefined) {
        query = query.gte('amount', filters.amountMin);
      }

      if (filters.amountMax !== undefined) {
        query = query.lte('amount', filters.amountMax);
      }

      if (filters.createdByIds && filters.createdByIds.length > 0) {
        query = query.in('created_by_id', filters.createdByIds);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('[AdjustmentsListPage] Error fetching adjustments:', fetchError);
        setError('Không thể tải danh sách thưởng/phạt');
        return;
      }

      // Transform data
      const adjustmentsData: SalaryAdjustment[] = (data || []).map((adj: any) => ({
        id: adj.id,
        ktv_id: adj.ktv_id,
        month_year: adj.month_year,
        adjustment_type: adj.adjustment_type,
        amount: Number(adj.amount),
        category: adj.category,
        reason: adj.reason,
        notes: adj.notes,
        status: adj.status,
        approved_by_id: adj.approved_by_id,
        approved_at: adj.approved_at,
        created_by_id: adj.created_by_id,
        created_at: adj.created_at,
        updated_at: adj.updated_at,
        ktv_name: adj.ktv?.full_name || 'N/A',
        created_by_name: adj.created_by?.full_name || 'N/A',
        approved_by_name: adj.approved_by?.full_name || null,
      }));

      setAdjustments(adjustmentsData);
      
      // Calculate stats (only approved)
      const approved = adjustmentsData.filter(a => a.status === 'approved');
      const bonuses = approved.filter(a => a.adjustment_type === 'bonus');
      const deductions = approved.filter(a => a.adjustment_type === 'deduction');
      const pending = adjustmentsData.filter(a => a.status === 'draft');

      setStats({
        totalBonuses: bonuses.reduce((sum, a) => sum + a.amount, 0),
        totalDeductions: deductions.reduce((sum, a) => sum + a.amount, 0),
        pendingCount: pending.length,
      });
    } catch (err) {
      console.error('[AdjustmentsListPage] Unexpected error:', err);
      setError('Lỗi hệ thống khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  }, [
    tenantContext?.tenantId,
    filters.ktvIds,
    filters.statuses,
    filters.types,
    filters.categories,
    filters.startDate,
    filters.endDate,
    filters.amountMin,
    filters.amountMax,
    filters.createdByIds,
  ]);

  // Initial fetch
  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  // Client-side filtering for search
  useEffect(() => {
    let filtered = [...adjustments];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (adj) =>
          adj.ktv_name?.toLowerCase().includes(searchLower) ||
          adj.category.toLowerCase().includes(searchLower) ||
          adj.reason.toLowerCase().includes(searchLower) ||
          adj.created_by_name?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredAdjustments(filtered);
    setCurrentPage(1);
  }, [adjustments, filters.search]);

  // Pagination
  const totalPages = Math.ceil(filteredAdjustments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAdjustments = filteredAdjustments.slice(startIndex, endIndex);

  // Handlers
  const handleFilterChange = (newFilters: AdvancedFilters) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    // Filters are already applied via useEffect, just close panel
    toast.success('Đã áp dụng bộ lọc');
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: undefined,
      endDate: undefined,
      ktvIds: undefined,
      statuses: undefined,
      types: undefined,
      categories: undefined,
      amountMin: undefined,
      amountMax: undefined,
      createdByIds: undefined,
      search: undefined,
    });
    toast.success('Đã xóa bộ lọc');
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchAdjustments();
  };

  const handleSelectAdjustment = (adjustmentId: string) => {
    setSelectedAdjustments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(adjustmentId)) {
        newSet.delete(adjustmentId);
      } else {
        newSet.add(adjustmentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedAdjustments.size === currentAdjustments.length) {
      setSelectedAdjustments(new Set());
    } else {
      setSelectedAdjustments(new Set(currentAdjustments.map((a) => a.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedAdjustments.size === 0) {
      alert('Vui lòng chọn ít nhất một bản ghi');
      return;
    }

    const draftOnly = Array.from(selectedAdjustments).filter((id) => {
      const adj = adjustments.find((a) => a.id === id);
      return adj?.status === 'draft';
    });

    if (draftOnly.length === 0) {
      alert('Không có bản ghi nào ở trạng thái Draft để duyệt');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn duyệt ${draftOnly.length} bản ghi?\n\nLương KTV sẽ được tự động tính lại.`)) {
      return;
    }

    // Import bulk approve action
    const { bulkApproveAdjustments } = await import('@/modules/salary/actions/approve-adjustment');

    try {
      const result = await bulkApproveAdjustments({ adjustmentIds: draftOnly });

      if (result.success) {
        alert(`Đã duyệt thành công ${result.approved} bản ghi!`);
        setSelectedAdjustments(new Set());
        fetchAdjustments();
      } else {
        alert(`Duyệt thành công: ${result.approved}\nThất bại: ${result.failed}\n\nLỗi:\n${result.errors.join('\n')}`);
        setSelectedAdjustments(new Set());
        fetchAdjustments();
      }
    } catch (error) {
      console.error('Bulk approve error:', error);
      alert('Lỗi hệ thống');
    }
  };

  const handleBulkReject = async () => {
    if (selectedAdjustments.size === 0) {
      alert('Vui lòng chọn ít nhất một bản ghi');
      return;
    }

    const draftOnly = Array.from(selectedAdjustments).filter((id) => {
      const adj = adjustments.find((a) => a.id === id);
      return adj?.status === 'draft';
    });

    if (draftOnly.length === 0) {
      alert('Không có bản ghi nào ở trạng thái Draft để từ chối');
      return;
    }

    const rejectionReason = window.prompt('Lý do từ chối chung cho tất cả bản ghi (tối thiểu 10 ký tự):');
    if (!rejectionReason) return;

    if (rejectionReason.trim().length < 10) {
      alert('Lý do từ chối phải có ít nhất 10 ký tự');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn từ chối ${draftOnly.length} bản ghi?`)) {
      return;
    }

    // Import bulk reject action
    const { bulkRejectAdjustments } = await import('@/modules/salary/actions/reject-adjustment');

    try {
      const result = await bulkRejectAdjustments({
        adjustmentIds: draftOnly,
        rejectionReason,
      });

      if (result.success) {
        alert(`Đã từ chối thành công ${result.rejected} bản ghi!`);
        setSelectedAdjustments(new Set());
        fetchAdjustments();
      } else {
        alert(`Từ chối thành công: ${result.rejected}\nThất bại: ${result.failed}\n\nLỗi:\n${result.errors.join('\n')}`);
        setSelectedAdjustments(new Set());
        fetchAdjustments();
      }
    } catch (error) {
      console.error('Bulk reject error:', error);
      alert('Lỗi hệ thống');
    }
  };

  const handleExportCSV = async () => {
    if (filteredAdjustments.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    const MAX_ROWS = 10000;
    const exportData = filteredAdjustments.slice(0, MAX_ROWS);

    if (filteredAdjustments.length > MAX_ROWS) {
      toast.warning(`Chỉ xuất ${MAX_ROWS} bản ghi đầu tiên (tổng: ${filteredAdjustments.length})`);
    }

    setIsExporting(true);
    const toastId = toast.loading('Đang chuẩn bị file CSV...');

    try {
      // Simulate progress for better UX
      await new Promise((resolve) => setTimeout(resolve, 300));

      const headers = [
        'Tháng',
        'KTV',
        'Loại',
        'Danh mục',
        'Số tiền (đ)',
        'Lý do',
        'Ghi chú',
        'Trạng thái',
        'Người tạo',
        'Ngày tạo',
        'Người duyệt',
        'Ngày duyệt',
      ];

      const rows = exportData.map((adj) => [
        adj.month_year.substring(0, 7),
        adj.ktv_name || '',
        adj.adjustment_type === 'bonus' ? 'Thưởng' : 'Phạt',
        adj.category,
        adj.amount,
        adj.reason,
        adj.notes || '',
        adj.status === 'draft'
          ? 'Chờ duyệt'
          : adj.status === 'approved'
          ? 'Đã duyệt'
          : adj.status === 'rejected'
          ? 'Từ chối'
          : 'Đã hủy',
        adj.created_by_name || '',
        new Date(adj.created_at).toLocaleDateString('vi-VN'),
        adj.approved_by_name || '',
        adj.approved_at ? new Date(adj.approved_at).toLocaleDateString('vi-VN') : '',
      ]);

      const csvContent = [
        '\uFEFF', // UTF-8 BOM for Excel
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `salary_adjustments_${new Date().toISOString().split('T')[0]}.csv`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(link.href);

      toast.success(`Đã xuất ${exportData.length} bản ghi thành công!`, { id: toastId });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Lỗi khi xuất file CSV', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
      <div className="space-y-6">
        {/* Back Button + Header */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Quay lại"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">Quay lại</span>
          </button>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Thưởng/Phạt lương
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Quản lý điều chỉnh thủ công lương KTV
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Lọc</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredAdjustments.length === 0 || isExporting}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xuất...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm điều chỉnh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Using hard-coded pixel values */}
      <div className="mt-6 flex flex-col md:flex-row">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex-1" style={{ marginRight: '24px', marginBottom: '24px' }}>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <Plus className="w-4 h-4" />
            <p className="text-sm font-medium">Tổng thưởng (đã duyệt)</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalBonuses.toLocaleString('vi-VN')} đ
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex-1">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
            <XCircle className="w-4 h-4" />
            <p className="text-sm font-medium">Tổng phạt (đã duyệt)</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalDeductions.toLocaleString('vi-VN')} đ
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex-1">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <p className="text-sm font-medium">Chờ duyệt</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.pendingCount}
          </p>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <AdjustmentsAdvancedFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          ktvList={ktvList}
          userList={userList}
        />
      )}

      {/* Bulk Actions */}
      {selectedAdjustments.size > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
            Đã chọn {selectedAdjustments.size} bản ghi
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkApprove}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Duyệt đã chọn
            </button>
            <button
              onClick={handleBulkReject}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Từ chối đã chọn
            </button>
            <button
              onClick={() => setSelectedAdjustments(new Set())}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Adjustments List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">Đang tải...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      ) : currentAdjustments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {filters.search || filters.statuses || filters.startDate || filters.ktvIds
              ? 'Không tìm thấy bản ghi nào phù hợp'
              : 'Chưa có điều chỉnh lương nào'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm điều chỉnh đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Table Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedAdjustments.size === currentAdjustments.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Tháng
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      KTV
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Loại
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Danh mục
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Số tiền
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Lý do
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Người tạo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Ngày tạo
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {currentAdjustments.map((adjustment) => (
                    <AdjustmentRow
                      key={adjustment.id}
                      adjustment={adjustment}
                      isSelected={selectedAdjustments.has(adjustment.id)}
                      onSelect={handleSelectAdjustment}
                      onRefresh={fetchAdjustments}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredAdjustments.length)} trong tổng số{' '}
                {filteredAdjustments.length} bản ghi
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Trước
                </button>

                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Trang {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Adjustment Modal */}
      {isModalOpen && tenantContext?.tenantId && (
        <AddAdjustmentModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          tenantId={tenantContext.tenantId}
          ktvList={ktvList}
        />
      )}
    </div>
  );
}
