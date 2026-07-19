/**
 * Decision Engine Audit Trail Page (Sprint 1)
 * 
 * Main page for querying and viewing decision audit logs.
 * Features:
 * - Filter by tenant, decision type, provider, status, date range
 * - Search by decision ID
 * - Pagination
 * - Click row to open Decision Detail Drawer
 * 
 * Route: /dashboard/decision-engine/audit
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import DecisionDetailDrawer from '@/components/decision-engine/DecisionDetailDrawer';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { Button } from '@/components/ui/button';


interface AuditLogEntry {
  id: string;
  decision_id: string;
  decision_type: string;
  provider: string;
  execution_time_ms: number;
  status: 'success' | 'error' | 'warning';
  tenant_id: string;
  created_at: string;
  confidence_score?: number;
}

interface AuditResponse {
  success: boolean;
  error?: string;
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  filters: {
    tenantId?: string;
    decisionType?: string;
    provider?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  };
}

const decisionTypeOptions = [
  { value: '', label: 'Tất cả phân loại' },
  { value: 'payroll', label: 'Tính lương' },
  { value: 'booking', label: 'Đặt lịch' },
  { value: 'procurement', label: 'Mua sắm / Vật tư' },
  { value: 'eligibility', label: 'Điều kiện / Quyền lợi' },
  { value: 'discount', label: 'Chiết khấu' },
  { value: 'approval', label: 'Phê duyệt' },
  { value: 'pricing', label: 'Định giá' },
  { value: 'recommendation', label: 'Gợi ý thông minh' },
];

const providerOptions = [
  { value: '', label: 'Tất cả nhà cung cấp' },
  { value: 'RuleProvider', label: 'Bộ cung cấp Luật (Rule)' },
  { value: 'BIProvider', label: 'Bộ cung cấp Báo cáo (BI)' },
  { value: 'AIProvider', label: 'Bộ cung cấp Trí tuệ nhân tạo (AI)' },
  { value: 'CompositeProvider', label: 'Bộ cung cấp Tổng hợp' },
];

const statusOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'success', label: 'Thành công' },
  { value: 'error', label: 'Thất bại' },
  { value: 'warning', label: 'Cảnh báo' },
];

export default function DecisionAuditTrailPage() {
  const searchParams = useSearchParams();
  const { tenantModuleKey } = useTenantModuleKey();

  const isBeautySpa = tenantModuleKey === 'beauty_spa';
  const isIndustrialCleaning = tenantModuleKey === 'industrial_cleaning';
  
  const theme = isBeautySpa
    ? {
        gradient: 'from-emerald-500 to-teal-600',
        activeBtn: 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white shadow-sm',
        border: 'border-emerald-200/50 dark:border-emerald-800/50',
        badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
        textColor: 'text-emerald-600 dark:text-emerald-400',
      }
    : isIndustrialCleaning
    ? {
        gradient: 'from-indigo-500 to-blue-600',
        activeBtn: 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white shadow-sm',
        border: 'border-indigo-200/50 dark:border-indigo-800/50',
        badgeBg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400',
        textColor: 'text-indigo-600 dark:text-indigo-400',
      }
    : {
        gradient: 'from-rose-500 to-pink-600',
        activeBtn: 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600 text-white shadow-sm',
        border: 'border-rose-200/50 dark:border-rose-800/50',
        badgeBg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
        textColor: 'text-rose-600 dark:text-rose-400',
      };

  // State
  const [data, setData] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  // Filters - tenantId auto-filled from current user
  const [tenantId, setTenantId] = useState('');
  const [decisionType, setDecisionType] = useState(searchParams.get('decisionType') || '');
  const [provider, setProvider] = useState(searchParams.get('provider') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');

  // Selected decision for detail drawer
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);

  // Fetch current user and set tenant ID
  // NOTE: /api/tenant/context returns TenantContext directly: { tenantId, tenantName, ... }
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/tenant/context');
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          setError('Không thể xác định thông tin Tenant của bạn: ' + (errData.error || `HTTP ${response.status}`));
          setLoading(false);
          return;
        }
        const result = await response.json();
        // API returns TenantContext directly with camelCase `tenantId`
        const tenantIdValue = result.tenantId || result.tenant_id || result.data?.tenantId || result.data?.tenant_id;
        if (tenantIdValue) {
          setTenantId(tenantIdValue);
        } else {
          setError('Không thể xác định thông tin Tenant của bạn. Vui lòng liên hệ hỗ trợ.');
          setLoading(false);
        }
      } catch (err) {
        setError('Lỗi khi tải ngữ cảnh người dùng: ' + (err instanceof Error ? err.message : 'Lỗi không xác định'));
        setLoading(false);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch data
  const fetchAuditLog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (tenantId) params.append('tenantId', tenantId);
      if (decisionType) params.append('decisionType', decisionType);
      if (provider) params.append('provider', provider);
      if (status) params.append('status', status);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (search) params.append('search', search);
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/decision-engine/audit?${params.toString()}`);
      const result: AuditResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch audit log');
      }

      setData(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, decisionType, provider, status, dateFrom, dateTo, search, pagination.page, pagination.limit]);

  // Fetch on mount and when filters change
  useEffect(() => {
    // If no tenant ID, show "please enter tenant" message instead of loading spinner
    if (!tenantId) {
      setLoading(false);
      setData([]);
      setError(null);
      return;
    }
    
    fetchAuditLog();
  }, [tenantId, fetchAuditLog]);

  // Handle row click
  const handleRowClick = (id: string) => {
    setSelectedDecision(id);
    // TODO: Open Decision Detail Drawer (Task #8)
  };

  // Handle filter changes
  const handleApplyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchAuditLog();
  };

  const handleResetFilters = () => {
    setDecisionType('');
    setProvider('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="w-full max-w-full px-6 md:px-8 py-6 pb-10 space-y-6 flex-1 flex flex-col">
      {/* Filters */}
      <div className="bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/5 p-6 shadow-sm">
        <h2 className="text-base font-bold mb-4 text-slate-800 dark:text-slate-200">Bộ lọc tìm kiếm</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Decision Type */}
          <div className="flex flex-col space-y-1.5">
            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Phân loại quyết định
            </label>
            <PremiumSelect
              options={decisionTypeOptions}
              value={decisionType}
              onChange={setDecisionType}
              placeholder="Tất cả phân loại"
            />
          </div>

          {/* Provider */}
          <div className="flex flex-col space-y-1.5">
            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Nhà cung cấp quyết định
            </label>
            <PremiumSelect
              options={providerOptions}
              value={provider}
              onChange={setProvider}
              placeholder="Tất cả nhà cung cấp"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col space-y-1.5">
            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Trạng thái xử lý
            </label>
            <PremiumSelect
              options={statusOptions}
              value={status}
              onChange={setStatus}
              placeholder="Tất cả trạng thái"
            />
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Từ ngày
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold bg-white/80 dark:bg-[#1c1b19]/80 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Đến ngày
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold bg-white/80 dark:bg-[#1c1b19]/80 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700"
            />
          </div>

          {/* Search */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Tìm kiếm mã quyết định (Decision ID)
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nhập mã quyết định..."
              className="w-full px-3 py-2 text-sm font-medium bg-white/80 dark:bg-[#1c1b19]/80 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex gap-3 mt-4">
          <Button
            onClick={handleApplyFilters}
            disabled={loading || !tenantId}
            className="rounded-xl font-bold text-sm active:scale-95 transition-all shadow-sm h-9 px-5 bg-primary hover:bg-primary-hover text-primary-foreground border-transparent"
          >
            Áp dụng bộ lọc
          </Button>
          <Button
            variant="outline"
            onClick={handleResetFilters}
            className="rounded-xl font-bold text-sm active:scale-95 transition-all h-9 px-5"
          >
            Đặt lại
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/5 shadow-sm overflow-hidden">
        {/* Summary */}
        {!loading && data.length > 0 && (
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/20">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Hiển thị {data.length} trên {pagination.total} quyết định (Trang{' '}
              {pagination.page} / {pagination.totalPages})
            </p>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center">
            <div className={`inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 dark:border-slate-700 border-t-slate-500`}></div>
            <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-400">Đang tải nhật ký quyết định...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-600 mb-4 font-semibold text-sm">⚠️ {error}</p>
            <Button
              onClick={fetchAuditLog}
              className="rounded-xl font-bold text-sm active:scale-95 transition-all h-9 px-5 bg-primary hover:bg-primary-hover text-primary-foreground border-transparent"
            >
              Thử lại
            </Button>
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-slate-600 dark:text-slate-400 font-bold text-sm">
              📭 Không tìm thấy quyết định nào
            </p>
            <p className="text-sm text-slate-400">
              Vui lòng điều chỉnh lại bộ lọc tìm kiếm
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800/40">
                <thead className="bg-slate-50/50 dark:bg-slate-900/40">
                  <tr className="border-b border-slate-100 dark:border-slate-800/40">
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Mã Quyết Định (ID)
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Phân loại
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Nhà cung cấp
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Thời gian xử lý
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Độ tin cậy
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Thời gian tạo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {data.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => handleRowClick(entry.id)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900 dark:text-slate-100 font-bold">
                        {entry.decision_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-lg ${theme.badgeBg}`}>
                          {entry.decision_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-400">
                        {entry.provider}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-slate-600 dark:text-slate-400">
                        {entry.execution_time_ms}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600 dark:text-slate-400">
                        {entry.confidence_score
                          ? `${(entry.confidence_score * 100).toFixed(0)}%`
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500 dark:text-slate-400">
                        {format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/40 flex items-center justify-between">
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                disabled={pagination.page === 1}
                className="px-3.5 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                Trang trước
              </button>

              <span className="text-sm font-bold text-slate-500">
                Trang {pagination.page} / {pagination.totalPages}
              </span>

              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                disabled={!pagination.hasMore}
                className="px-3.5 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                Trang sau
              </button>
            </div>
          </>
        )}
      </div>

      {/* Decision Detail Drawer */}
      {selectedDecision && (
        <DecisionDetailDrawer
          decisionId={selectedDecision}
          onClose={() => setSelectedDecision(null)}
          onReplay={(id) => {
            alert(`Replay decision ${id} - Time Machine interface coming in Task #10`);
          }}
        />
      )}
    </div>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: 'success' | 'error' | 'warning' }) {
  const colors = {
    success: 'bg-green-150 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200/50 dark:border-green-900/30',
    error: 'bg-red-150 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200/50 dark:border-red-900/30',
    warning: 'bg-yellow-150 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400 border-yellow-200/50 dark:border-yellow-900/30',
  };

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
  };

  return (
    <span
      className={`px-2.5 py-0.5 text-xs font-bold border rounded-lg inline-flex items-center gap-1 ${colors[status]}`}
    >
      <span>{icons[status]}</span>
      <span className="capitalize">{status === 'success' ? 'Thành công' : status === 'warning' ? 'Cảnh báo' : 'Thất bại'}</span>
    </span>
  );
}
