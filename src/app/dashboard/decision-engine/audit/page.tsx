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

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import DecisionDetailDrawer from '@/components/decision-engine/DecisionDetailDrawer';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

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
  { value: '', label: 'All Types' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'booking', label: 'Booking' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'discount', label: 'Discount' },
  { value: 'approval', label: 'Approval' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'recommendation', label: 'Recommendation' },
];

const providerOptions = [
  { value: '', label: 'All Providers' },
  { value: 'RuleProvider', label: 'Rule Provider' },
  { value: 'BIProvider', label: 'BI Provider' },
  { value: 'AIProvider', label: 'AI Provider' },
  { value: 'CompositeProvider', label: 'Composite Provider' },
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
];

export default function DecisionAuditTrailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // Filters
  const [tenantId, setTenantId] = useState(searchParams.get('tenantId') || '');
  const [decisionType, setDecisionType] = useState(searchParams.get('decisionType') || '');
  const [provider, setProvider] = useState(searchParams.get('provider') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');

  // Selected decision for detail drawer
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);

  // Fetch data
  const fetchAuditLog = async () => {
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
  };

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
  }, [tenantId, decisionType, provider, status, dateFrom, dateTo, search, pagination.page]);

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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Decision Audit Trail
        </h1>
        <p className="text-gray-600">
          Comprehensive audit log của Decision Engine executions. Mọi quyết định đều giải trình được.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Tenant ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tenant ID *
            </label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Enter tenant ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary focus:outline-none"
            />
          </div>

          {/* Decision Type */}
          <div className="flex flex-col space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Decision Type
            </label>
            <PremiumSelect
              options={decisionTypeOptions}
              value={decisionType}
              onChange={setDecisionType}
              placeholder="All Types"
            />
          </div>

          {/* Provider */}
          <div className="flex flex-col space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Provider
            </label>
            <PremiumSelect
              options={providerOptions}
              value={provider}
              onChange={setProvider}
              placeholder="All Providers"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Status
            </label>
            <PremiumSelect
              options={statusOptions}
              value={status}
              onChange={setStatus}
              placeholder="All Statuses"
            />
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary focus:outline-none"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary focus:outline-none"
            />
          </div>

          {/* Search */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Decision ID
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by decision ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleApplyFilters}
            disabled={!tenantId}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all font-semibold shadow-sm text-sm active:scale-[0.98]"
          >
            Apply Filters
          </button>
          <button
            onClick={handleResetFilters}
            className="px-5 py-2.5 bg-gray-150 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-semibold text-sm active:scale-[0.98]"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Summary */}
        {!loading && data.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/50">
            <p className="text-sm font-medium text-slate-600">
              Showing {data.length} of {pagination.total} decisions (Page{' '}
              {pagination.page} of {pagination.totalPages})
            </p>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading audit log...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-600 mb-4 font-semibold">⚠️ {error}</p>
            <button
              onClick={fetchAuditLog}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover transition-all font-semibold active:scale-[0.98]"
            >
              Retry
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600 mb-4">
              📭 No decisions found matching your filters
            </p>
            {!tenantId && (
              <p className="text-sm text-gray-500">
                Please select a tenant to view audit logs
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Decision ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Execution Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {data.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => handleRowClick(entry.id)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900 font-semibold">
                        {entry.decision_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded-lg">
                          {entry.decision_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {entry.provider}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {entry.execution_time_ms}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {entry.confidence_score
                          ? `${(entry.confidence_score * 100).toFixed(0)}%`
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                disabled={pagination.page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                disabled={!pagination.hasMore}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
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
            // TODO: Open Time Machine interface (Task #10)
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
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
  };

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded inline-flex items-center gap-1 ${colors[status]}`}
    >
      <span>{icons[status]}</span>
      <span className="capitalize">{status}</span>
    </span>
  );
}
