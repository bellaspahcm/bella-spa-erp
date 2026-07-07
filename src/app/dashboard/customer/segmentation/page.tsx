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
  ArrowLeft,
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
      <div className="flex items-center justify-center min-h-screen bg-background/30">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 bg-background/30 overflow-auto relative space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-12">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-12 h-12 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-slate-200/60 text-slate-600 hover:text-primary hover:border-primary/30 active:scale-95 transition-all shadow-sm shrink-0"
            title="Quay lại Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-[#EFE9E1] tracking-tight uppercase">Phân Đoạn Khách Hàng</h1>
            <p className="text-xs font-black text-slate-400 dark:text-[#CDBCAB] uppercase tracking-[0.25em] mt-1">Phân tích RFM và chiến lược chăm sóc khách hàng</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSegmentation(true)}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-2xl font-black transition-all active:scale-95 uppercase tracking-wider disabled:opacity-50 text-xs shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-400/20 via-primary/30 to-blue-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tổng Khách Hàng</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{formatNumber(summary.totalCustomers)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400/20 via-primary/30 to-emerald-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Champions</p>
              <p className="text-3xl font-black text-emerald-600 tracking-tight">{formatNumber(summary.champions)}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-600">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-400/20 via-primary/30 to-rose-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Rủi Ro Cao</p>
              <p className="text-3xl font-black text-rose-600 tracking-tight">{formatNumber(summary.atRisk)}</p>
            </div>
            <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-400/20 via-primary/30 to-purple-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Điểm RFM TB</p>
              <p className="text-3xl font-black text-purple-600 tracking-tight">{formatNumber(summary.avgRfmScore, 2)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20 text-purple-600">
              <Target className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* RFM Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
          <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-wider">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary">
              <BarChart3 className="w-5 h-5" />
            </div>
            Ma Trận RFM
          </h2>
          <RFMMatrixChart data={segmentData?.data || []} />
        </motion.div>

        {/* Segment Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
          <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-wider">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary">
              <PieChart className="w-5 h-5" />
            </div>
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
        className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
        <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-wider">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
          Doanh Thu Theo Phân Đoạn
        </h2>
        <RevenueBySegmentChart data={distributionData} />
      </motion.div>

      {/* Top Customers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="glass-pink backdrop-blur-sm bg-white/60 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl transition-all duration-300"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
        <div className="p-8 border-b border-slate-100/60 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Khách Hàng Theo Phân Đoạn</h2>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as SegmentFilter)}
              className="px-4 py-2 border border-slate-200 bg-white/80 rounded-2xl text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Tất cả</option>
              <option value="champions">Champions</option>
              <option value="at-risk">Rủi ro trung bình</option>
              <option value="high-risk">Rủi ro cao</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Khách Hàng
                </th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Phân Đoạn
                </th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Điểm RFM
                </th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Doanh Thu
                </th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Hành Động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 bg-white/40">
              {filteredCustomers.slice(0, 20).map((customer) => (
                <tr key={customer.customerId} className="hover:bg-white/60 transition-colors duration-200">
                  <td className="px-8 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{customer.customerName}</div>
                      <div className="text-xs font-medium text-slate-400 mt-0.5">{customer.customerPhone}</div>
                    </div>
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap">
                    <span
                      className="px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wide"
                      style={{
                        backgroundColor: `${getSegmentColor(customer.segment)}10`,
                        color: getSegmentColor(customer.segment),
                        border: `1px solid ${getSegmentColor(customer.segment)}20`,
                      }}
                    >
                      {customer.segment}
                    </span>
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-slate-700">
                    {formatNumber(customer.rfmScore, 2)}
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                    {formatCurrency(customer.totalRevenue)}
                  </td>
                  <td className="px-8 py-4 text-sm font-bold text-slate-500 leading-relaxed">
                    {customer.recommendedAction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Cache Info Footer */}
      {segmentData?.metadata && (
        <div className="text-center text-xs text-slate-400 font-bold uppercase tracking-wider mt-12 py-4 border-t border-slate-100/20 max-w-xl mx-auto">
          <p>
            Dữ liệu được tạo lúc {new Date(segmentData.metadata.generatedAt).toLocaleTimeString('vi-VN')} 
            {' '}({segmentData.metadata.cacheHit ? 'Từ cache' : 'Truy vấn mới'}) 
            {' '}- Query time: {segmentData.metadata.queryTimeMs}ms
          </p>
        </div>
      )}
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
