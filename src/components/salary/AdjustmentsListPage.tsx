'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Plus, Download, Filter, CheckCircle2, XCircle, Loader2, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AdjustmentRow } from './AdjustmentRow';
import { AdjustmentsAdvancedFilters } from './AdjustmentsAdvancedFilters';
import { AddAdjustmentModal } from './AddAdjustmentModal';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { useKTVList } from '@/hooks/useKTVList';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { createClient } from '@/lib/supabase-client';
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
  const tenantId = tenantContext?.tenantId;
  const { ktvList } = useKTVList(tenantId);
  const { tenantModuleKey } = useTenantModuleKey();
  
  const [adjustments, setAdjustments] = useState<SalaryAdjustment[]>([]);
  const [filteredAdjustments, setFilteredAdjustments] = useState<SalaryAdjustment[]>([]);
  const [userList, setUserList] = useState<Array<{ id: string; full_name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAdjustments, setSelectedAdjustments] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const getThemeStyles = () => {
    switch (tenantModuleKey) {
      case 'beauty_spa':
        return {
          titleFont: 'font-serif text-slate-900',
          btnPrimary: 'bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200',
          btnOutline: 'border border-slate-200 bg-white text-slate-650 hover:text-emerald-800 hover:border-emerald-800/30 rounded-xl',
          iconBg: 'bg-emerald-50 text-emerald-800',
          cardBg: 'bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 hover:shadow-md transition-all duration-300',
          tableWrapper: 'bg-white rounded-[2rem] border border-slate-200/60 overflow-hidden shadow-sm',
          tableHeaderBg: 'bg-slate-50/70 border-b border-slate-100',
          tableHeaderCell: 'px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider',
          tableHeaderCellRight: 'px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider',
          bulkPanelBg: 'bg-emerald-50/50 border border-emerald-100/60 rounded-[2rem] p-4',
          bulkBtnApprove: 'bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl shadow-md transition-colors',
          bulkBtnReject: 'bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-colors',
          paginationBg: 'bg-white border border-slate-200/60 rounded-[2rem] p-4 shadow-sm',
        };
      default: // baby_care, industrial_cleaning, etc.
        return {
          titleFont: 'font-bold text-gray-900 dark:text-gray-100',
          btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors',
          btnOutline: 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors',
          iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400',
          cardBg: 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4',
          tableWrapper: 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden',
          tableHeaderBg: 'bg-gray-50 dark:bg-gray-900',
          tableHeaderCell: 'px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider',
          tableHeaderCellRight: 'px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider',
          bulkPanelBg: 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4',
          bulkBtnApprove: 'bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors',
          bulkBtnReject: 'bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors',
          paginationBg: 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4',
        };
    }
  };

  const theme = getThemeStyles();
  
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
      if (!tenantId) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('tenant_id', tenantId)
          .order('full_name');

        if (!error && data) {
          setUserList(data as Array<{ id: string; full_name: string }>);
        }
      } catch (err: unknown) {
        console.error('[AdjustmentsListPage] Error fetching users:', err);
      }
    }

    fetchUsers();
  }, [tenantId]);

  // Fetch adjustments
  const fetchAdjustments = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as unknown)
        .from('salary_adjustments')
        .select(`
          *,
          ktv:users!ktv_id(full_name),
          created_by:users!created_by_id(full_name),
          approved_by:users!approved_by_id(full_name)
        `)
        .eq('tenant_id', tenantId)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adjustmentsData: SalaryAdjustment[] = (data || []).map((adj: Record<string, unknown>) => ({
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
    } catch (err: unknown) {
      console.error('[AdjustmentsListPage] Unexpected error:', err);
      setError('Lỗi hệ thống khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  }, [
    tenantId,
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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl space-y-6">
      {/* Breadcrumbs & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-950/5 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
          <Link href="/dashboard" className="hover:text-emerald-800 transition-colors">
            Tổng quan
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <Link href="/dashboard/salary" className="hover:text-emerald-800 transition-colors">
            Bảng lương
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <span className="text-emerald-800 font-bold">Thưởng/Phạt lương</span>
        </div>
        
        <Link
          href="/dashboard/salary"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-655 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-800/30 group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          <span>Trở về bảng lương</span>
        </Link>
      </div>

      {/* Header Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest block">
            Tài chính & Đối soát
          </span>
          <h1 className={`${theme.titleFont} text-3xl md:text-4xl font-extrabold tracking-tight`}>
            Thưởng/Phạt lương
          </h1>
          <p className="text-sm text-slate-600 font-medium max-w-xl">
            Quản lý điều chỉnh thủ công lương KTV
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 h-11 text-xs font-bold uppercase tracking-wider ${theme.btnOutline}`}
          >
            <Filter className="w-4 h-4" />
            <span>Lọc</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredAdjustments.length === 0 || isExporting}
            className={`flex items-center gap-2 px-4 h-11 text-xs font-bold uppercase tracking-wider ${theme.btnOutline} disabled:opacity-50 disabled:cursor-not-allowed`}
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
            className={`flex items-center gap-2 px-4 h-11 text-xs font-bold uppercase tracking-wider ${theme.btnPrimary}`}
          >
            <Plus className="w-4 h-4" />
            <span>Thêm điều chỉnh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Premium Spa Style */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Total Bonuses */}
        <div className={theme.cardBg}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng thưởng (đã duyệt)</p>
              <p className="text-3xl font-extrabold font-serif text-emerald-800 mt-1.5 tabular-nums">
                {stats.totalBonuses.toLocaleString('vi-VN')} đ
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform ${tenantModuleKey === 'beauty_spa' ? 'bg-emerald-50 text-emerald-800' : 'bg-emerald-100 text-emerald-600'}`}>
              <Plus className="w-5 h-5" />
            </div>
          </div>
        </div>
        
        {/* Total Deductions */}
        <div className={theme.cardBg}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng phạt (đã duyệt)</p>
              <p className="text-3xl font-extrabold font-serif text-rose-650 mt-1.5 tabular-nums">
                {stats.totalDeductions.toLocaleString('vi-VN')} đ
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform ${tenantModuleKey === 'beauty_spa' ? 'bg-rose-50 text-rose-800' : 'bg-red-100 text-red-600'}`}>
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
        
        {/* Pending Count */}
        <div className={theme.cardBg}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Chờ duyệt</p>
              <p className="text-3xl font-extrabold font-serif text-amber-600 mt-1.5 tabular-nums">
                {stats.pendingCount}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform ${tenantModuleKey === 'beauty_spa' ? 'bg-amber-50 text-amber-800' : 'bg-amber-100 text-amber-600'}`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
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
        <div className={`flex items-center justify-between p-4 ${theme.bulkPanelBg}`}>
          <p className="text-sm font-medium text-slate-700">
            Đã chọn {selectedAdjustments.size} bản ghi
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkApprove}
              className={`px-4 py-2 text-sm font-medium ${theme.bulkBtnApprove}`}
            >
              Duyệt đã chọn
            </button>
            <button
              onClick={handleBulkReject}
              className={`px-4 py-2 text-sm font-medium ${theme.bulkBtnReject}`}
            >
              Từ chối đã chọn
            </button>
            <button
              onClick={() => setSelectedAdjustments(new Set())}
              className={`px-4 py-2 text-sm font-medium ${theme.btnOutline}`}
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
        <div className={`${theme.cardBg} p-12 text-center`}>
          <DollarSign className="w-16 h-16 text-slate-350 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4 font-medium">
            {filters.search || filters.statuses || filters.startDate || filters.ktvIds
              ? 'Không tìm thấy bản ghi nào phù hợp'
              : 'Chưa có điều chỉnh lương nào'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider ${theme.btnPrimary}`}
          >
            <Plus className="w-4 h-4" />
            <span>Thêm điều chỉnh đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Table Header */}
          <div className={theme.tableWrapper}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={theme.tableHeaderBg}>
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedAdjustments.size === currentAdjustments.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-emerald-800 rounded border-slate-200 focus:ring-emerald-800"
                      />
                    </th>
                    <th className={theme.tableHeaderCell}>
                      Tháng
                    </th>
                    <th className={theme.tableHeaderCell}>
                      KTV
                    </th>
                    <th className={theme.tableHeaderCell}>
                      Loại
                    </th>
                    <th className={theme.tableHeaderCell}>
                      Danh mục
                    </th>
                    <th className={theme.tableHeaderCellRight}>
                      Số tiền
                    </th>
                    <th className={theme.tableHeaderCell}>
                      Lý do
                    </th>
                    <th className={theme.tableHeaderCell}>
                      Trạng thái
                    </th>
                    <th className={theme.tableHeaderCell}>
                      Người tạo
                    </th>
                    <th className={theme.tableHeaderCell}>
                      Ngày tạo
                    </th>
                    <th className={theme.tableHeaderCellRight}>
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700 bg-white">
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
            <div className={`flex items-center justify-between p-4 ${theme.paginationBg}`}>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredAdjustments.length)} trong tổng số{' '}
                {filteredAdjustments.length} bản ghi
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 text-sm ${theme.btnOutline} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Trước
                </button>

                <span className="text-sm text-slate-600 dark:text-gray-400">
                  Trang {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 text-sm ${theme.btnOutline} disabled:opacity-50 disabled:cursor-not-allowed`}
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
