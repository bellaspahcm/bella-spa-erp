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
 * Data flows through Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  LineChart,
  Calendar,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type {
  MonthlyPnL,
  RevenueBreakdown,
  ExpenseBreakdown,
  ProfitabilityTrends,
} from '@/services/intelligence/finance/queries';
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
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('current_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Response states
  const [monthlyPnL, setMonthlyPnL] = useState<IntelligenceResponse<MonthlyPnL[]> | null>(null);
  const [revenueBreakdown, setRevenueBreakdown] = useState<IntelligenceResponse<RevenueBreakdown> | null>(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState<IntelligenceResponse<ExpenseBreakdown> | null>(null);
  const [profitabilityTrends, setProfitabilityTrends] = useState<IntelligenceResponse<ProfitabilityTrends> | null>(null);

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
  // Fetch all metrics
  // ───────────────────────────────────────────────────────────────────────────

  const fetchAllMetrics = async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const baseUrl = `/api/intelligence/finance`;
      const params = new URLSearchParams({ tenantId, period });

      if (period === 'custom' && startDate && endDate) {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }

      const [pnl, revenue, expense, profitability] = await Promise.all([
        fetch(`${baseUrl}/monthly-pnl?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/revenue-breakdown?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/expense-breakdown?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/profitability-trends?${params}`).then(r => r.json()),
      ]);

      // Check for errors
      if (pnl.error) throw new Error(pnl.error);
      if (revenue.error) throw new Error(revenue.error);
      if (expense.error) throw new Error(expense.error);
      if (profitability.error) throw new Error(profitability.error);

      setMonthlyPnL(pnl);
      setRevenueBreakdown(revenue);
      setExpenseBreakdown(expense);
      setProfitabilityTrends(profitability);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch P&L metrics:', error);
      toast.error('Không thể tải dữ liệu dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchAllMetrics();
    }
  }, [tenantId, period, startDate, endDate]);

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
    if (!monthlyPnL || !monthlyPnL.data || monthlyPnL.data.length === 0) return null;
    return monthlyPnL.data[0]; // Latest month
  };

  const getProfitabilityTrendData = () => {
    if (!profitabilityTrends || !profitabilityTrends.data) return [];

    return profitabilityTrends.data.monthlyTrends.map(trend => ({
      date: trend.month.substring(5, 7) + '/' + trend.month.substring(0, 4), // MM/YYYY
      revenue: trend.totalRevenue,
      expenses: trend.totalExpense,
      profit: trend.netProfit,
    }));
  };

  const getRevenueBreakdownData = () => {
    if (!revenueBreakdown || !revenueBreakdown.data) return [];

    return revenueBreakdown.data.byType.map(item => ({
      source: item.type,
      revenue: item.amount,
      percentage: item.percentage,
    }));
  };

  const getExpenseBreakdownData = () => {
    if (!expenseBreakdown || !expenseBreakdown.data) return [];

    return expenseBreakdown.data.byCategory.map(item => ({
      category: item.category,
      expense: item.amount,
      percentage: item.percentage,
    }));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Calculate growth percentages
  // ───────────────────────────────────────────────────────────────────────────

  const calculateMoMGrowth = () => {
    if (!profitabilityTrends || !profitabilityTrends.data) return 0;
    const trends = profitabilityTrends.data.monthlyTrends;
    if (trends.length < 2) return 0;

    const current = trends[trends.length - 1].netProfit;
    const previous = trends[trends.length - 2].netProfit;

    if (previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const calculateYoYGrowth = () => {
    if (!profitabilityTrends || !profitabilityTrends.data) return 0;
    const trends = profitabilityTrends.data.monthlyTrends;
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
            onClick={() => fetchAllMetrics(true)}
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
            {monthlyPnL?.metadata.cacheHit && (
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
                  {revenueBreakdown?.data.byType.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.type}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Top 3 danh mục chi phí:</p>
                  {expenseBreakdown?.data.byCategory.slice(0, 3).map((item, idx) => (
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
            {revenueBreakdown?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {revenueBreakdown ? (
            <>
              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-slate-600">Tổng doanh thu</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(revenueBreakdown.data.totalRevenue)}
                </p>
              </div>

              {/* Revenue Breakdown Chart */}
              <RevenueBreakdownChart data={getRevenueBreakdownData()} height={250} />

              {/* Top Sources */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-2">Nguồn thu hàng đầu:</p>
                {revenueBreakdown.data.byType.slice(0, 3).map((item, idx) => (
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
            {profitabilityTrends?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {profitabilityTrends ? (
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
            {expenseBreakdown?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {expenseBreakdown ? (
            <>
              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-slate-600">Tổng chi phí</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(expenseBreakdown.data.totalExpense)}
                </p>
              </div>

              {/* Expense Breakdown Chart */}
              <ExpenseBreakdownChart data={getExpenseBreakdownData()} height={250} />

              {/* Top Categories */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-2">Danh mục chi phí hàng đầu:</p>
                {expenseBreakdown.data.byCategory.slice(0, 3).map((item, idx) => (
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
      {monthlyPnL && (
        <div className="text-center text-sm text-slate-500">
          <p>
            Dữ liệu được tạo lúc {new Date(monthlyPnL.metadata.generatedAt).toLocaleTimeString('vi-VN')}
            {' '}({monthlyPnL.metadata.cacheHit ? 'Từ cache' : 'Truy vấn mới'})
            {' '}- Query time: {monthlyPnL.metadata.queryTimeMs}ms
          </p>
        </div>
      )}
    </div>
  );
}
