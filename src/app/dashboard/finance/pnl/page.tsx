'use client';

/**
 * P&L (Profit & Loss) Dashboard
 * 
 * Comprehensive financial analysis dashboard showing:
 * 1. Monthly P&L Statement
 * 2. Revenue Breakdown
 * 3. Profitability Trends
 * 4. Expense Breakdown
 * 
 * Data flows through Intelligence Layer with automatic caching via React Query hooks.
 * 
 * REFACTORED: 2026-06-22
 * - Replaced fetch() calls with React Query hooks
 * - Automatic cache management with proper staleTime
 * - Optimistic UI updates with loading/error states
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  LineChart,
  Calendar,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useMonthlyPnL,
  useRevenueBreakdown,
  useExpenseBreakdown,
  useProfitabilityTrends,
  useRefreshFinanceData,
} from '@/hooks/intelligence';
import {
  PnLStatementChart,
  RevenueBreakdownChart,
  ExpenseBreakdownChart,
  ProfitabilityTrendChart,
} from '@/components/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PeriodType = 'current_month' | 'last_month' | 'custom';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PnLDashboardPage() {
  const [period, setPeriod] = useState<PeriodType>('current_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Calculate month/year based on period
  const { month, year } = useMemo(() => {
    const now = new Date();
    if (period === 'last_month') {
      now.setMonth(now.getMonth() - 1);
    }
    return {
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: String(now.getFullYear()),
    };
  }, [period]);

  // Fetch data using Intelligence Layer hooks
  const monthlyPnL = useMonthlyPnL(month, year);
  const revenueBreakdown = useRevenueBreakdown(month, year);
  const expenseBreakdown = useExpenseBreakdown(month, year);
  const profitabilityTrends = useProfitabilityTrends(month, year);

  // Manual refresh mutation
  const { mutate: refreshData, isPending: isRefreshing } = useRefreshFinanceData();

  // Combined loading state
  const isLoading =
    monthlyPnL.isLoading ||
    revenueBreakdown.isLoading ||
    expenseBreakdown.isLoading ||
    profitabilityTrends.isLoading;

  // Handle manual refresh
  const handleRefresh = () => {
    refreshData('all', {
      onSuccess: () => {
        toast.success('Dữ liệu đã được cập nhật');
      },
      onError: (error) => {
        toast.error(`Lỗi làm mới: ${error.message}`);
      },
    });
  };

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

  const getCurrentMonthPnL = () => {
    if (!monthlyPnL.data || !monthlyPnL.data.data || monthlyPnL.data.data.length === 0) return null;
    return monthlyPnL.data.data[0]; // Latest month
  };

  const getProfitabilityTrendData = () => {
    if (!profitabilityTrends.data || !profitabilityTrends.data.data) return [];

    return profitabilityTrends.data.data.monthlyTrends.map(trend => ({
      date: trend.month.substring(5, 7) + '/' + trend.month.substring(0, 4), // MM/YYYY
      revenue: trend.totalRevenue,
      expenses: trend.totalExpense,
      profit: trend.netProfit,
    }));
  };

  const getRevenueBreakdownData = () => {
    if (!revenueBreakdown.data || !revenueBreakdown.data.data) return [];

    return revenueBreakdown.data.data.byType.map(item => ({
      source: item.type,
      revenue: item.amount,
      percentage: item.percentage,
    }));
  };

  const getExpenseBreakdownData = () => {
    if (!expenseBreakdown.data || !expenseBreakdown.data.data) return [];

    return expenseBreakdown.data.data.byCategory.map(item => ({
      category: item.category,
      expense: item.amount,
      percentage: item.percentage,
    }));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Calculate growth percentages
  // ───────────────────────────────────────────────────────────────────────────

  const calculateMoMGrowth = () => {
    if (!profitabilityTrends.data || !profitabilityTrends.data.data) return 0;
    const trends = profitabilityTrends.data.data.monthlyTrends;
    if (trends.length < 2) return 0;

    const current = trends[trends.length - 1].netProfit;
    const previous = trends[trends.length - 2].netProfit;

    if (previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const calculateYoYGrowth = () => {
    if (!profitabilityTrends.data || !profitabilityTrends.data.data) return 0;
    const trends = profitabilityTrends.data.data.monthlyTrends;
    if (trends.length < 12) return 0;

    const current = trends[trends.length - 1].netProfit;
    const lastYear = trends[trends.length - 12].netProfit;

    if (lastYear === 0) return 0;
    return ((current - lastYear) / Math.abs(lastYear)) * 100;
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

  const currentPnL = getCurrentMonthPnL();

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Báo Cáo Lãi/Lỗ</h1>
          <p className="text-slate-600 mt-1">Phân tích lợi nhuận và hiệu suất tài chính</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodType)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="current_month">Tháng này</option>
            <option value="last_month">Tháng trước</option>
            <option value="custom">Tùy chỉnh</option>
          </select>

          {/* Custom Date Range (shown when period is 'custom') */}
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-slate-600">đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
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
        {/* Card 1: Monthly P&L Statement (col-span-2) */}
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
              <h3 className="text-lg font-semibold text-slate-900">Báo Cáo P&L Tháng</h3>
            </div>
            {monthlyPnL.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {currentPnL ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-slate-600">Tổng doanh thu</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(currentPnL.totalRevenue)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Tổng chi phí</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(currentPnL.totalExpense)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Lợi nhuận ròng</p>
                  <p className={`text-xl font-bold ${currentPnL.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(currentPnL.netProfit)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Biên lợi nhuận</p>
                  <p className={`text-xl font-bold ${currentPnL.netMarginPct >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatNumber(currentPnL.netMarginPct, 1)}%
                  </p>
                </div>
              </div>

              {/* P&L Waterfall Chart */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Biểu đồ P&L</p>
                <PnLStatementChart
                  data={{
                    totalRevenue: currentPnL.totalRevenue,
                    totalExpenses: currentPnL.totalExpense,
                    netProfit: currentPnL.netProfit,
                    profitMargin: currentPnL.netMarginPct,
                  }}
                  height={250}
                />
              </div>

              {/* Revenue & Expense Summary */}
              <div className="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Top 3 nguồn doanh thu:</p>
                  {revenueBreakdown.data?.data.byType.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.type}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Top 3 danh mục chi phí:</p>
                  {expenseBreakdown.data?.data.byCategory.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.category}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 2: Revenue Breakdown (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <PieChart className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Phân Tích Doanh Thu</h3>
            </div>
            {revenueBreakdown.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {revenueBreakdown.data ? (
            <>
              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-slate-600">Tổng doanh thu</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(revenueBreakdown.data.data.totalRevenue)}
                </p>
              </div>

              {/* Revenue Breakdown Chart */}
              <RevenueBreakdownChart data={getRevenueBreakdownData()} height={250} />

              {/* Top Sources */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-2">Nguồn thu hàng đầu:</p>
                {revenueBreakdown.data.data.byType.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{item.type}</span>
                    <span className="font-medium text-green-600">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 3: Profitability Trends (col-span-2) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <LineChart className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Xu Hướng Lợi Nhuận</h3>
            </div>
            {profitabilityTrends.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {profitabilityTrends.data ? (
            <>
              {/* Profitability Trend Chart */}
              <ProfitabilityTrendChart data={getProfitabilityTrendData()} height={250} />

              {/* Growth Metrics */}
              <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm text-slate-600">Tăng trưởng MoM</p>
                  <div className="flex items-center gap-2 mt-1">
                    {calculateMoMGrowth() >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`text-xl font-bold ${calculateMoMGrowth() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(calculateMoMGrowth())}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Tăng trưởng YoY</p>
                  <div className="flex items-center gap-2 mt-1">
                    {calculateYoYGrowth() >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`text-xl font-bold ${calculateYoYGrowth() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(calculateYoYGrowth())}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 4: Expense Breakdown (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <PieChart className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Phân Tích Chi Phí</h3>
            </div>
            {expenseBreakdown.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {expenseBreakdown.data ? (
            <>
              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-slate-600">Tổng chi phí</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(expenseBreakdown.data.data.totalExpense)}
                </p>
              </div>

              {/* Expense Breakdown Chart */}
              <ExpenseBreakdownChart data={getExpenseBreakdownData()} height={250} />

              {/* Top Categories */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-2">Danh mục chi phí hàng đầu:</p>
                {expenseBreakdown.data.data.byCategory.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{item.category}</span>
                    <span className="font-medium text-red-600">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Cache Info Footer */}
      {monthlyPnL.data && (
        <div className="text-center text-sm text-slate-500">
          <p>
            Dữ liệu được tạo lúc {new Date(monthlyPnL.data.metadata.computedAt).toLocaleTimeString('vi-VN')}
            {' '}({monthlyPnL.data.metadata.cached ? 'Từ cache' : 'Truy vấn mới'})
            {monthlyPnL.data.metadata.executionTime && ` - Query time: ${monthlyPnL.data.metadata.executionTime}ms`}
          </p>
        </div>
      )}
    </div>
  );
}
