'use client';

/**
 * Customer Segmentation Dashboard (RFM Analysis)
 * 
 * Comprehensive customer segmentation analysis showing:
 * 1. RFM Matrix (Recency, Frequency, Monetary scatter plot)
 * 2. Segment Distribution (Pie chart with 11 segments)
 * 3. Top Customers by Segment (Table with recommendations)
 * 4. Revenue by Segment (Bar chart)
 * 
 * Data flows through Customer Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Users,
  TrendingUp,
  Award,
  AlertTriangle,
  Target,
  RefreshCw,
  Filter,
  Download,
  PieChart,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { CustomerSegment, SegmentDistribution } from '@/services/intelligence/customer/queries';
import {
  RFMMatrixChart,
  SegmentDistributionChart,
  RevenueBySegmentChart,
} from '@/components/intelligence/customer';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SegmentFilter = 'all' | 'champions' | 'at-risk' | 'high-risk';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function CustomerSegmentationDashboard() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SegmentFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Response state
  const [segmentData, setSegmentData] = useState<IntelligenceResponse<CustomerSegment[]> | null>(null);
  const [distributionData, setDistributionData] = useState<SegmentDistribution[]>([]);

  // ───────────────────────────────────────────────────────────────────────────
  // Initialize tenant and check authorization
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function initTenant() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

      if (!profile || !profile.tenant_id) {
        toast.error('Không tìm thấy tenant');
        return;
      }

      // Check if user has admin role
      if (profile.role !== 'admin') {
        toast.error('Bạn không có quyền truy cập trang này');
        router.push('/dashboard');
        return;
      }

      setTenantId(profile.tenant_id);
    }

    initTenant();
  }, [router]);

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch customer segmentation
  // ───────────────────────────────────────────────────────────────────────────

  const fetchSegmentation = async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // Fetch segmentation data
      const params = new URLSearchParams({ tenantId });
      const response = await fetch(`/api/intelligence/customer/segmentation?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSegmentData(data);

      // Calculate distribution
      if (data.data && data.data.length > 0) {
        const distribution = calculateDistribution(data.data);
        setDistributionData(distribution);
      }

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch customer segmentation:', error);
      toast.error('Không thể tải dữ liệu phân đoạn khách hàng');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchSegmentation();
    }
  }, [tenantId]);

  // ───────────────────────────────────────────────────────────────────────────
  // Helper functions
  // ───────────────────────────────────────────────────────────────────────────

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const calculateDistribution = (segments: CustomerSegment[]): SegmentDistribution[] => {
    const segmentMap: Record<string, { count: number; revenue: number; rfmScore: number }> = {};
    
    segments.forEach(customer => {
      if (!segmentMap[customer.segment]) {
        segmentMap[customer.segment] = { count: 0, revenue: 0, rfmScore: 0 };
      }
      segmentMap[customer.segment].count++;
      segmentMap[customer.segment].revenue += customer.totalRevenue;
      segmentMap[customer.segment].rfmScore += customer.rfmScore;
    });

    const totalCustomers = segments.length;

    return Object.entries(segmentMap).map(([segment, data]) => ({
      tenantId: tenantId!,
      segment,
      customerCount: data.count,
      totalRevenue: data.revenue,
      avgRfmScore: data.rfmScore / data.count,
      avgLifetimeValue: data.revenue / data.count,
      percentageOfTotal: (data.count / totalCustomers) * 100,
    }));
  };

  const getFilteredCustomers = () => {
    if (!segmentData || !segmentData.data) return [];

    switch (filter) {
      case 'champions':
        return segmentData.data.filter(c => c.segment === 'Champions' || c.segment === 'Loyal Customers');
      case 'at-risk':
        return segmentData.data.filter(c => c.churnRiskLevel === 'Medium Risk');
      case 'high-risk':
        return segmentData.data.filter(c => c.churnRiskLevel === 'High Risk');
      default:
        return segmentData.data;
    }
  };

  const getSummaryMetrics = () => {
    if (!segmentData || !segmentData.data || segmentData.data.length === 0) {
      return {
        totalCustomers: 0,
        champions: 0,
        atRisk: 0,
        avgRfmScore: 0,
      };
    }

    return {
      totalCustomers: segmentData.data.length,
      champions: segmentData.data.filter(c => c.segment === 'Champions').length,
      atRisk: segmentData.data.filter(c => c.churnRiskLevel === 'High Risk').length,
      avgRfmScore: segmentData.data.reduce((sum, c) => sum + c.rfmScore, 0) / segmentData.data.length,
    };
  };

  const getSegmentColor = (segment: string): string => {
    const colorMap: Record<string, string> = {
      'Champions': '#10b981',
      'Loyal Customers': '#06b6d4',
      'Potential Loyalists': '#8b5cf6',
      'Recent Customers': '#6366f1',
      'Promising': '#3b82f6',
      'Need Attention': '#f59e0b',
      'About To Sleep': '#f59e0b',
      'At Risk': '#ef4444',
      'Cannot Lose': '#dc2626',
      'Hibernating': '#9ca3af',
      'Lost': '#6b7280',
      'New': '#14b8a6',
      'Other': '#9ca3af',
    };
    return colorMap[segment] || '#9ca3af';
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  const summary = getSummaryMetrics();
  const filteredCustomers = getFilteredCustomers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Phân Đoạn Khách Hàng</h1>
          <p className="text-gray-600 mt-1">Phân tích RFM và chiến lược chăm sóc khách hàng</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSegmentation(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng Khách Hàng</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(summary.totalCustomers)}</p>
            </div>
            <Users className="w-10 h-10 text-blue-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Champions</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatNumber(summary.champions)}</p>
            </div>
            <Award className="w-10 h-10 text-green-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rủi Ro Cao</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatNumber(summary.atRisk)}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Điểm RFM TB</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{formatNumber(summary.avgRfmScore, 2)}</p>
            </div>
            <Target className="w-10 h-10 text-purple-600" />
          </div>
        </motion.div>
      </div>

      {/* Cache Metadata */}
      {segmentData?.metadata && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800"
        >
          <div className="flex items-center justify-between">
            <span>
              {segmentData.metadata.cacheHit ? '⚡ Cache hit' : '🔄 Fresh data'} •{' '}
              Query time: {segmentData.metadata.queryTimeMs}ms •{' '}
              Data sources: {segmentData.metadata.dataSourcesUsed.join(', ')}
            </span>
          </div>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RFM Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-pink-600" />
            Ma Trận RFM
          </h2>
          <RFMMatrixChart data={segmentData?.data || []} />
        </motion.div>

        {/* Segment Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-pink-600" />
            Phân Bố Phân Đoạn
          </h2>
          <SegmentDistributionChart data={distributionData} />
        </motion.div>
      </div>

      {/* Revenue by Segment */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-pink-600" />
          Doanh Thu Theo Phân Đoạn
        </h2>
        <RevenueBySegmentChart data={distributionData} />
      </motion.div>

      {/* Top Customers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Khách Hàng Theo Phân Đoạn</h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as SegmentFilter)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="champions">Champions</option>
                <option value="at-risk">Rủi ro trung bình</option>
                <option value="high-risk">Rủi ro cao</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Khách Hàng
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phân Đoạn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Điểm RFM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doanh Thu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hành Động
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.slice(0, 20).map((customer) => (
                <tr key={customer.customerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{customer.customerName}</div>
                      <div className="text-sm text-gray-500">{customer.customerPhone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="px-2 py-1 text-xs font-medium rounded-full"
                      style={{
                        backgroundColor: `${getSegmentColor(customer.segment)}20`,
                        color: getSegmentColor(customer.segment),
                      }}
                    >
                      {customer.segment}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(customer.rfmScore, 2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(customer.totalRevenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.recommendedAction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

// Wrap with ErrorBoundary to prevent full page crashes
export default function CustomerSegmentationDashboardWrapper() {
  return (
    <ErrorBoundary>
      <CustomerSegmentationDashboard />
    </ErrorBoundary>
  );
}
