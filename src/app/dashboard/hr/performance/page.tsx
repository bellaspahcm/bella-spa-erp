'use client';

/**
 * Employee Performance Dashboard
 * 
 * Comprehensive KTV performance analysis showing:
 * 1. Overall performance scores and rankings
 * 2. KPI achievement trends
 * 3. Customer satisfaction (star ratings)
 * 4. Productivity metrics (sessions completed, revenue contribution)
 * 
 * Data flows through HR Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Award,
  TrendingUp,
  Star,
  Target,
  RefreshCw,
  AlertCircle,
  Users,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { EmployeePerformance } from '@/services/intelligence/hr/queries';
import {
  PerformanceScoreChart,
  KpiTrendChart,
  RatingDistributionChart,
  ProductivityComparisonChart,
} from '@/components/intelligence/hr';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'overview' | 'kpi' | 'rating' | 'productivity';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function EmployeePerformanceDashboard() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Response state
  const [performanceData, setPerformanceData] = useState<IntelligenceResponse<EmployeePerformance[]> | null>(null);

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
  // Fetch performance metrics
  // ───────────────────────────────────────────────────────────────────────────

  const fetchPerformanceMetrics = async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ 
        tenantId, 
        month 
      });

      const response = await fetch(`/api/intelligence/hr/employee-performance?${params}`);
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setPerformanceData(data);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      toast.error('Không thể tải dữ liệu dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchPerformanceMetrics();
    }
  }, [tenantId, month]);

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

  // ───────────────────────────────────────────────────────────────────────────
  // Calculate aggregate metrics
  // ───────────────────────────────────────────────────────────────────────────

  const getAggregateMetrics = () => {
    if (!performanceData || !performanceData.data || performanceData.data.length === 0) {
      return {
        avgPerformanceScore: 0,
        avgKpiScore: 0,
        avgRating: 0,
        totalSessionsCompleted: 0,
        totalRevenueContribution: 0,
        topPerformers: [],
      };
    }

    const data = performanceData.data;
    const total = data.length;

    // Calculate averages
    const avgPerformanceScore = data.reduce((sum, ktv) => sum + ktv.overallPerformanceScore, 0) / total;
    const avgKpiScore = data.reduce((sum, ktv) => sum + ktv.kpiScore, 0) / total;
    const avgRating = data.reduce((sum, ktv) => sum + ktv.avgStarRating, 0) / total;
    const totalSessionsCompleted = data.reduce((sum, ktv) => sum + ktv.totalSessionsCompleted, 0);
    const totalRevenueContribution = data.reduce((sum, ktv) => sum + ktv.totalRevenueContributed, 0);

    // Get top 3 performers
    const topPerformers = [...data]
      .sort((a, b) => b.overallPerformanceScore - a.overallPerformanceScore)
      .slice(0, 3);

    return {
      avgPerformanceScore,
      avgKpiScore,
      avgRating,
      totalSessionsCompleted,
      totalRevenueContribution,
      topPerformers,
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render loading state
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-slate-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  const metrics = getAggregateMetrics();

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hiệu Suất KTV</h1>
          <p className="text-slate-600 mt-1">Đánh giá tổng hợp hiệu suất làm việc của kỹ thuật viên</p>
        </div>

        <div className="flex items-center gap-4">
          {/* View Mode Selector */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'overview'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tổng quan
            </button>
            <button
              onClick={() => setViewMode('kpi')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kpi'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              KPI
            </button>
            <button
              onClick={() => setViewMode('rating')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'rating'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đánh giá
            </button>
            <button
              onClick={() => setViewMode('productivity')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'productivity'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Năng suất
            </button>
          </div>

          {/* Month Selector */}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* Refresh Button */}
          <button
            onClick={() => fetchPerformanceMetrics(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Average Performance Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Điểm Hiệu Suất TB</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                {formatNumber(metrics.avgPerformanceScore, 1)}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                trên thang 100
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Award className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </motion.div>

        {/* Average KPI Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Điểm KPI TB</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {formatNumber(metrics.avgKpiScore, 1)}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                chỉ tiêu tháng
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </motion.div>

        {/* Average Rating */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Đánh Giá TB</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {formatNumber(metrics.avgRating, 1)} ⭐
              </p>
              <p className="text-sm text-slate-500 mt-2">
                từ khách hàng
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </motion.div>

        {/* Total Sessions Completed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tổng Ca Hoàn Thành</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatNumber(metrics.totalSessionsCompleted)}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Doanh thu: {formatCurrency(metrics.totalRevenueContribution)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Top Performers Banner */}
      {metrics.topPerformers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <Award className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Top 3 Xuất Sắc Tháng Này</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metrics.topPerformers.map((ktv, index) => (
              <div key={ktv.ktvId} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    index === 0 ? 'bg-yellow-400 text-yellow-900' :
                    index === 1 ? 'bg-slate-300 text-slate-900' :
                    'bg-amber-600 text-white'
                  } font-bold`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{ktv.ktvName}</p>
                    <p className="text-sm opacity-90">Điểm: {formatNumber(ktv.overallPerformanceScore, 1)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="opacity-75">KPI</p>
                    <p className="font-medium">{formatNumber(ktv.kpiScore, 1)}</p>
                  </div>
                  <div>
                    <p className="opacity-75">Đánh giá</p>
                    <p className="font-medium">{formatNumber(ktv.avgStarRating, 1)} ⭐</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Performance Score Distribution */}
        {(viewMode === 'overview' || viewMode === 'kpi') && performanceData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Phân Bổ Điểm Hiệu Suất</h3>
              </div>
              {performanceData.metadata.cacheHit && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
              )}
            </div>

            {performanceData.data.length > 0 ? (
              <PerformanceScoreChart data={performanceData.data} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Chart 2: KPI Trend */}
        {(viewMode === 'overview' || viewMode === 'kpi') && performanceData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Top 10 Đạt KPI Cao Nhất</h3>
              </div>
            </div>

            {performanceData.data.length > 0 ? (
              <KpiTrendChart data={performanceData.data} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Chart 3: Rating Distribution */}
        {(viewMode === 'overview' || viewMode === 'rating') && performanceData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Star className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Phân Bổ Đánh Giá Sao</h3>
              </div>
            </div>

            {performanceData.data.length > 0 ? (
              <RatingDistributionChart data={performanceData.data} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Chart 4: Productivity Comparison */}
        {(viewMode === 'overview' || viewMode === 'productivity') && performanceData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">So Sánh Năng Suất</h3>
              </div>
            </div>

            {performanceData.data.length > 0 ? (
              <ProductivityComparisonChart data={performanceData.data} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Cache Info Footer */}
      {performanceData && (
        <div className="text-center text-sm text-slate-500">
          <p>
            Dữ liệu được tạo lúc {new Date(performanceData.metadata.generatedAt).toLocaleTimeString('vi-VN')}
            {' '}({performanceData.metadata.cacheHit ? 'Cache' : 'Mới'})
          </p>
        </div>
      )}
    </div>
  );
}
