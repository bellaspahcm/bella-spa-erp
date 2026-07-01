'use client';

/**
 * Workforce Analytics Dashboard
 * 
 * Comprehensive HR workforce analysis showing:
 * 1. Headcount trends (current/new hires/terminations)
 * 2. Turnover rate and retention metrics
 * 3. Employee tenure distribution
 * 4. Role distribution and department breakdown
 * 
 * Data flows through HR Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  TrendingDown,
  UserPlus,
  UserMinus,
  Calendar,
  RefreshCw,
  AlertCircle,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { WorkforceAnalytics } from '@/services/intelligence/hr/queries';
import {
  HeadcountTrendChart,
  TurnoverRateChart,
  TenureDistributionChart,
  RoleDistributionChart,
} from '@/components/intelligence/hr';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PeriodType = 'month' | 'quarter' | 'year';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function WorkforceAnalyticsDashboard() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Response state
  const [workforceData, setWorkforceData] = useState<IntelligenceResponse<WorkforceAnalytics[]> | null>(null);

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
  // Fetch workforce analytics
  // ───────────────────────────────────────────────────────────────────────────

  const fetchWorkforceAnalytics = async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({
        tenantId,
        period,
      });

      const response = await fetch(`/api/intelligence/hr/workforce-analytics?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setWorkforceData(data);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch workforce analytics:', error);
      toast.error('Không thể tải dữ liệu phân tích nhân sự');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchWorkforceAnalytics();
    }
  }, [tenantId, period]);

  // ───────────────────────────────────────────────────────────────────────────
  // Helper functions
  // ───────────────────────────────────────────────────────────────────────────

  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatPercent = (value: number, decimals = 1) => {
    return `${formatNumber(value, decimals)}%`;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Generate chart data from API responses
  // ───────────────────────────────────────────────────────────────────────────

  const getCurrentMetrics = () => {
    if (!workforceData || !workforceData.data || workforceData.data.length === 0) return null;
    return workforceData.data[0]; // Latest month
  };

  const getHeadcountTrendData = () => {
    if (!workforceData || !workforceData.data) return [];

    return workforceData.data
      .slice()
      .reverse() // Show oldest to newest
      .map(item => ({
        month: item.month.substring(5, 7) + '/' + item.month.substring(0, 4), // MM/YYYY
        headcount: item.currentHeadcount,
        newHires: item.newHires,
        terminations: item.terminations,
      }));
  };

  const getTurnoverRateData = () => {
    if (!workforceData || !workforceData.data) return [];

    return workforceData.data
      .slice()
      .reverse()
      .map(item => ({
        month: item.month.substring(5, 7) + '/' + item.month.substring(0, 4),
        turnoverRate: item.turnoverRatePct,
      }));
  };

  const getTenureDistributionData = () => {
    // TODO: Implement tenure distribution once data is available
    // For now, return placeholder showing average tenure
    const current = getCurrentMetrics();
    if (!current) return [];

    // Placeholder data - will be replaced with actual tenure breakdown
    return [];
  };

  const getRoleDistributionData = () => {
    if (!workforceData || !workforceData.data) return [];

    // Group by role and sum current headcount
    const roleMap = new Map<string, { count: number; percentage: number }>();
    
    workforceData.data.forEach(item => {
      if (!roleMap.has(item.role)) {
        roleMap.set(item.role, {
          count: item.currentHeadcount,
          percentage: item.roleDistributionPct,
        });
      }
    });

    return Array.from(roleMap.entries()).map(([role, data]) => ({
      role,
      count: data.count,
      percentage: data.percentage,
    }));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Calculate metrics
  // ───────────────────────────────────────────────────────────────────────────

  const calculateHeadcountChange = () => {
    if (!workforceData || !workforceData.data || workforceData.data.length < 2) return 0;

    const current = workforceData.data[0].currentHeadcount;
    const previous = workforceData.data[1].currentHeadcount;

    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getAverageTenure = () => {
    const current = getCurrentMetrics();
    if (!current) return 0;
    return current.avgTenureMonths;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render loading state
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-slate-600">Đang tải dữ liệu nhân sự...</p>
        </div>
      </div>
    );
  }

  const currentMetrics = getCurrentMetrics();

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Phân Tích Nhân Sự</h1>
          <p className="text-slate-600 mt-1">Theo dõi quy mô nhân sự, tỷ lệ nghỉ việc và phân bố nhân viên</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodType)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="month">Tháng gần đây</option>
            <option value="quarter">Quý gần đây</option>
            <option value="year">Năm gần đây</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={() => fetchWorkforceAnalytics(true)}
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
        {/* Metric 1: Current Headcount */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tổng Nhân Sự</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {currentMetrics ? formatNumber(currentMetrics.currentHeadcount) : '--'}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {calculateHeadcountChange() >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${calculateHeadcountChange() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculateHeadcountChange() >= 0 ? '+' : ''}{formatNumber(calculateHeadcountChange(), 1)}%
                </span>
                <span className="text-sm text-slate-500">so với tháng trước</span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </motion.div>

        {/* Metric 2: New Hires */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tuyển Mới</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {currentMetrics ? formatNumber(currentMetrics.newHires) : '--'}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                người trong tháng này
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <UserPlus className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </motion.div>

        {/* Metric 3: Terminations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Nghỉ Việc</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {currentMetrics ? formatNumber(currentMetrics.terminations) : '--'}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                người trong tháng này
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <UserMinus className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </motion.div>

        {/* Metric 4: Turnover Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tỷ Lệ Nghỉ Việc</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">
                {currentMetrics ? formatPercent(currentMetrics.turnoverRatePct) : '--'}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Thời gian làm TB: {getAverageTenure()} tháng
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingDown className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Headcount Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Xu Hướng Nhân Sự</h3>
            </div>
            {workforceData?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {workforceData && workforceData.data.length > 0 ? (
            <HeadcountTrendChart data={getHeadcountTrendData()} height={300} />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">Chưa có dữ liệu</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Chart 2: Turnover Rate Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingDown className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Tỷ Lệ Nghỉ Việc</h3>
            </div>
          </div>

          {workforceData && workforceData.data.length > 0 ? (
            <TurnoverRateChart data={getTurnoverRateData()} height={300} />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">Chưa có dữ liệu</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Chart 3: Tenure Distribution - Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Thâm Niên Trung Bình</h3>
            </div>
          </div>

          {currentMetrics ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-6xl font-bold text-purple-600 mb-2">
                  {formatNumber(currentMetrics.avgTenureMonths, 1)}
                </div>
                <p className="text-lg text-slate-600">tháng</p>
                <p className="text-sm text-slate-500 mt-4">
                  Thời gian làm việc trung bình của nhân viên
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">Chưa có dữ liệu</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Chart 4: Role Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <PieChart className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Phân Bố Vai Trò</h3>
            </div>
          </div>

          {currentMetrics && getRoleDistributionData().length > 0 ? (
            <>
              <RoleDistributionChart data={getRoleDistributionData()} height={250} />
              
              {/* Role Summary Table */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  {getRoleDistributionData().slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{item.role}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-900">{item.count} người</span>
                        <span className="text-slate-500">({formatPercent(item.percentage)})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">Chưa có dữ liệu</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Cache Info Footer */}
      {workforceData && (
        <div className="text-center text-sm text-slate-500">
          <p>
            Dữ liệu được tạo lúc {new Date(workforceData.metadata.generatedAt).toLocaleTimeString('vi-VN')}
            {' '}({workforceData.metadata.cacheHit ? 'Từ cache' : 'Truy vấn mới'})
            {' '}- Query time: {workforceData.metadata.queryTimeMs}ms
          </p>
        </div>
      )}
    </div>
  );
}
