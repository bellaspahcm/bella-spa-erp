'use client';

/**
 * Budget Tracking Dashboard
 * 
 * Comprehensive budget monitoring and variance analysis dashboard showing:
 * 1. Budget Variance Overview (budget vs actual by category)
 * 2. Budget Performance Summary (utilization gauge with status counts)
 * 3. Variance Trend by Category (historical variance trends)
 * 4. Budget Status Breakdown (pie chart of status distribution)
 * 
 * Data flows through Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  PiggyBank,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  PieChart,
  LineChart,
  Calendar,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import {
  BudgetVarianceChart,
  BudgetUtilizationChart,
  VarianceTrendChart,
  BudgetStatusChart,
} from '@/components/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BudgetVarianceItem {
  category: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'on_target' | 'over';
}

interface VarianceTrendDataPoint {
  month: string;
  [category: string]: string | number;
}

interface BudgetVarianceData {
  month: string;
  totalBudget: number;
  totalActual: number;
  variance: number;
  variancePercent: number;
  utilization: number;
  categories: BudgetVarianceItem[];
  categoriesUnder: number;
  categoriesOnTarget: number;
  categoriesOver: number;
  historicalTrend: Array<{
    month: string;
    categoryVariances: Record<string, number>;
  }>;
}

interface MonthOption {
  value: string;
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BudgetTrackingDashboardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Response state
  const [budgetVariance, setBudgetVariance] = useState<IntelligenceResponse<BudgetVarianceData> | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // Initialize tenant and current month
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

  // Set current month on mount
  useEffect(() => {
    const now = new Date();
    setSelectedMonth(now.toISOString().slice(0, 7)); // YYYY-MM
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Generate month options (last 12 months)
  // ───────────────────────────────────────────────────────────────────────────

  const getMonthOptions = (): MonthOption[] => {
    const months: MonthOption[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const value = date.toISOString().slice(0, 7); // YYYY-MM
      const label = date.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' });
      months.push({ value, label });
    }
    return months;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch budget variance data
  // ───────────────────────────────────────────────────────────────────────────

  const fetchBudgetVariance = async (refresh = false) => {
    if (!tenantId || !selectedMonth) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const baseUrl = `/api/intelligence/finance`;
      const params = new URLSearchParams({ tenantId, month: selectedMonth });

      const response = await fetch(`${baseUrl}/budget-variance?${params}`);
      const data = await response.json();

      // Check for errors
      if (data.error) throw new Error(data.error);

      setBudgetVariance(data);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch budget variance:', error);
      toast.error('Không thể tải dữ liệu dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tenantId && selectedMonth) {
      fetchBudgetVariance();
    }
  }, [tenantId, selectedMonth]);

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

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}%`;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Generate chart data from API responses
  // ───────────────────────────────────────────────────────────────────────────

  const getBudgetVarianceData = () => {
    if (!budgetVariance || !budgetVariance.data) return [];
    return budgetVariance.data.categories;
  };

  const getBudgetUtilizationData = () => {
    if (!budgetVariance || !budgetVariance.data) return null;

    return {
      totalBudget: budgetVariance.data.totalBudget,
      totalActual: budgetVariance.data.totalActual,
      utilization: budgetVariance.data.utilization,
      categoriesUnder: budgetVariance.data.categoriesUnder,
      categoriesOnTarget: budgetVariance.data.categoriesOnTarget,
      categoriesOver: budgetVariance.data.categoriesOver,
    };
  };

  const getVarianceTrendData = () => {
    if (!budgetVariance || !budgetVariance.data || !budgetVariance.data.historicalTrend) return { data: [], categories: [] };

    // Transform historical trend data for chart
    const trendData: VarianceTrendDataPoint[] = budgetVariance.data.historicalTrend.map(item => {
      const dataPoint: VarianceTrendDataPoint = { month: item.month };
      Object.entries(item.categoryVariances).forEach(([category, variance]) => {
        dataPoint[category] = variance;
      });
      return dataPoint;
    });

    // Get top 5 categories by absolute variance
    const topCategories = budgetVariance.data.categories
      .sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent))
      .slice(0, 5)
      .map(item => item.category);

    return { data: trendData, categories: topCategories };
  };

  const getBudgetStatusData = () => {
    if (!budgetVariance || !budgetVariance.data) return [];

    const totalCategories = budgetVariance.data.categories.length;

    return [
      {
        status: 'under' as const,
        count: budgetVariance.data.categoriesUnder,
        percentage: totalCategories > 0 ? (budgetVariance.data.categoriesUnder / totalCategories) * 100 : 0,
      },
      {
        status: 'on_target' as const,
        count: budgetVariance.data.categoriesOnTarget,
        percentage: totalCategories > 0 ? (budgetVariance.data.categoriesOnTarget / totalCategories) * 100 : 0,
      },
      {
        status: 'over' as const,
        count: budgetVariance.data.categoriesOver,
        percentage: totalCategories > 0 ? (budgetVariance.data.categoriesOver / totalCategories) * 100 : 0,
      },
    ];
  };

  const getOverBudgetCategories = () => {
    if (!budgetVariance || !budgetVariance.data) return [];
    return budgetVariance.data.categories
      .filter(item => item.status === 'over')
      .sort((a, b) => b.variancePercent - a.variancePercent)
      .slice(0, 3);
  };

  const getUnderBudgetCategories = () => {
    if (!budgetVariance || !budgetVariance.data) return [];
    return budgetVariance.data.categories
      .filter(item => item.status === 'under')
      .sort((a, b) => a.variancePercent - b.variancePercent)
      .slice(0, 3);
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

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  const varianceTrendData = getVarianceTrendData();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Theo Dõi Ngân Sách</h1>
          <p className="text-slate-600 mt-1">Giám sát ngân sách và phương sai chi phí</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {getMonthOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchBudgetVariance(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Budget Variance Overview (col-span-2) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Tổng Quan Phương Sai Ngân Sách</h3>
            </div>
            {budgetVariance?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {budgetVariance && budgetVariance.data ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-slate-600">Tổng ngân sách</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrency(budgetVariance.data.totalBudget)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Chi tiêu thực tế</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(budgetVariance.data.totalActual)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Phương sai</p>
                  <div className="flex items-center gap-1">
                    {budgetVariance.data.variance >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-red-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-green-600" />
                    )}
                    <p className={`text-xl font-bold ${budgetVariance.data.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(budgetVariance.data.variance))}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Tỷ lệ sử dụng</p>
                  <p className={`text-xl font-bold ${
                    budgetVariance.data.utilization > 100 ? 'text-red-600' :
                    budgetVariance.data.utilization < 85 ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {formatNumber(budgetVariance.data.utilization, 1)}%
                  </p>
                </div>
              </div>

              {/* Budget Variance Chart */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">So sánh ngân sách theo danh mục</p>
                <BudgetVarianceChart data={getBudgetVarianceData()} height={350} />
              </div>

              {/* Top Over/Under Budget Categories */}
              <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                {/* Over Budget */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-slate-700">Vượt ngân sách:</p>
                  </div>
                  {getOverBudgetCategories().length > 0 ? (
                    <div className="space-y-1">
                      {getOverBudgetCategories().map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{item.category}</span>
                          <span className="font-medium text-red-600">+{formatNumber(item.variancePercent, 1)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Không có danh mục nào</p>
                  )}
                </div>

                {/* Under Budget */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium text-slate-700">Dưới ngân sách:</p>
                  </div>
                  {getUnderBudgetCategories().length > 0 ? (
                    <div className="space-y-1">
                      {getUnderBudgetCategories().map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{item.category}</span>
                          <span className="font-medium text-green-600">{formatNumber(item.variancePercent, 1)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Không có danh mục nào</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-slate-500">
              <AlertCircle className="h-12 w-12 mb-3" />
              <p>Chưa có dữ liệu ngân sách cho tháng này</p>
            </div>
          )}
        </motion.div>

        {/* Card 2: Budget Performance Summary (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Hiệu Suất Ngân Sách</h3>
            </div>
            {budgetVariance?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {getBudgetUtilizationData() ? (
            <BudgetUtilizationChart data={getBudgetUtilizationData()!} height={250} />
          ) : (
            <div className="flex items-center justify-center h-64">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 3: Variance Trend by Category (col-span-2) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <LineChart className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Xu Hướng Phương Sai</h3>
            </div>
            {budgetVariance?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {varianceTrendData.data.length > 0 ? (
            <>
              <p className="text-sm text-slate-600 mb-3">
                Xu hướng phương sai % cho top 5 danh mục chi phí
              </p>
              <VarianceTrendChart
                data={varianceTrendData.data}
                categories={varianceTrendData.categories}
                height={300}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 4: Budget Status Breakdown (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <PieChart className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Trạng Thái Ngân Sách</h3>
            </div>
            {budgetVariance?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {budgetVariance && budgetVariance.data ? (
            <>
              <p className="text-sm text-slate-600 mb-3">
                Phân bổ danh mục theo trạng thái
              </p>
              <BudgetStatusChart data={getBudgetStatusData()} height={250} />

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-600 mb-2">Tổng số danh mục:</p>
                <p className="text-2xl font-bold text-slate-900">
                  {budgetVariance.data.categories.length}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Cache Info Footer */}
      {budgetVariance && (
        <div className="text-center text-sm text-slate-500">
          <p>
            Dữ liệu được tạo lúc {new Date(budgetVariance.metadata.generatedAt).toLocaleTimeString('vi-VN')}
            {' '}({budgetVariance.metadata.cacheHit ? 'Từ cache' : 'Truy vấn mới'})
            {' '}- Query time: {budgetVariance.metadata.queryTimeMs}ms
          </p>
        </div>
      )}
    </div>
  );
}
