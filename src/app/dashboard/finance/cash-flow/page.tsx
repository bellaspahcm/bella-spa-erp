'use client';

/**
 * Cash Flow Dashboard
 * 
 * Comprehensive cash flow analysis and forecasting dashboard showing:
 * 1. Cash Flow Analysis (inflows vs outflows by payment method)
 * 2. Burn Rate & Runway (monthly burn rate and runway health status)
 * 3. Cash Flow Forecast (future predictions with confidence bands)
 * 4. Payment Method Distribution (cash flow breakdown by payment method)
 * 
 * Data flows through Intelligence Layer with automatic caching via React Query hooks.
 * 
 * REFACTORED: 2026-06-22
 * - Replaced fetch() calls with React Query hooks
 * - Automatic cache management with proper staleTime
 * - Optimistic UI updates with loading/error states
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  LineChart,
  BarChart3,
  Calendar,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useCashFlowAnalysis,
  useRefreshFinanceData,
} from '@/hooks/intelligence';
import {
  CashFlowAnalysisChart,
  BurnRateChart,
  CashFlowForecastChart,
  RevenueBreakdownChart,
} from '@/components/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type ForecastMonthsType = 3 | 6 | 12;

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CashFlowDashboardPage() {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [forecastMonths, setForecastMonths] = useState<ForecastMonthsType>(6);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Fetch data using Intelligence Layer hooks
  // Note: Cash Flow Analysis includes both analysis and forecast data
  const cashFlowAnalysis = useCashFlowAnalysis(period, startDate, endDate);

  // Manual refresh mutation
  const { mutate: refreshData, isPending: isRefreshing } = useRefreshFinanceData();

  // Loading state
  const isLoading = cashFlowAnalysis.isLoading;

  // Handle manual refresh
  const handleRefresh = () => {
    refreshData('cash-flow-analysis', {
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

  // ───────────────────────────────────────────────────────────────────────────
  // Generate chart data from API responses
  // ───────────────────────────────────────────────────────────────────────────

  const getCashFlowBreakdownData = () => {
    if (!cashFlowAnalysis.data || !cashFlowAnalysis.data.data) return [];
    return cashFlowAnalysis.data.data.breakdown;
  };

  const getPaymentMethodDistributionData = () => {
    if (!cashFlowAnalysis.data || !cashFlowAnalysis.data.data) return [];

    return cashFlowAnalysis.data.data.breakdown.map(item => ({
      source: getPaymentMethodLabel(item.paymentMethod),
      revenue: item.inflows, // Using inflows as proxy for distribution
      percentage: cashFlowAnalysis.data.data.totalInflows > 0 
        ? Math.round((item.inflows / cashFlowAnalysis.data.data.totalInflows) * 100)
        : 0,
    }));
  };

  const getForecastChartData = () => {
    if (!cashFlowAnalysis.data || !cashFlowAnalysis.data.data || !cashFlowAnalysis.data.data.forecast) return [];
    return cashFlowAnalysis.data.data.forecast.projections;
  };

  const getBurnRateData = () => {
    if (!cashFlowAnalysis.data || !cashFlowAnalysis.data.data) return null;

    return {
      monthlyBurnRate: cashFlowAnalysis.data.data.burnRate,
      runwayMonths: cashFlowAnalysis.data.data.runway,
      currentCash: cashFlowAnalysis.data.data.currentCash,
      averageDailyCashFlow: cashFlowAnalysis.data.data.averageDailyCashFlow,
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Payment method label mapping
  // ───────────────────────────────────────────────────────────────────────────

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'cash': 'Tiền mặt',
      'bank_transfer': 'Chuyển khoản',
      'credit_card': 'Thẻ tín dụng',
      'qr_code': 'QR Code',
      'e_wallet': 'Ví điện tử',
    };
    return labels[method] || method;
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dòng Tiền & Dự Báo</h1>
          <p className="text-slate-600 mt-1">Phân tích dòng tiền và dự báo tài chính</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodType)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="day">Hôm nay</option>
            <option value="week">7 ngày</option>
            <option value="month">30 ngày</option>
            <option value="quarter">Quý</option>
            <option value="year">Năm</option>
          </select>

          {/* Forecast Months Selector */}
          <select
            value={forecastMonths}
            onChange={(e) => setForecastMonths(Number(e.target.value) as ForecastMonthsType)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={3}>3 tháng</option>
            <option value={6}>6 tháng</option>
            <option value={12}>12 tháng</option>
          </select>

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
        {/* Card 1: Cash Flow Analysis (col-span-2) */}
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
              <h3 className="text-lg font-semibold text-slate-900">Phân Tích Dòng Tiền</h3>
            </div>
            {cashFlowAnalysis.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {cashFlowAnalysis.data ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-slate-600">Dòng tiền vào</p>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(cashFlowAnalysis.data.data.totalInflows)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Dòng tiền ra</p>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(cashFlowAnalysis.data.data.totalOutflows)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Dòng tiền ròng</p>
                  <p className={`text-xl font-bold ${cashFlowAnalysis.data.data.netCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(cashFlowAnalysis.data.data.netCashFlow)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Tiền mặt tích lũy</p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(cashFlowAnalysis.data.data.cumulativeCash)}
                  </p>
                </div>
              </div>

              {/* Cash Flow Analysis Chart */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Biểu đồ dòng tiền theo phương thức</p>
                <CashFlowAnalysisChart data={getCashFlowBreakdownData()} height={300} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 2: Burn Rate & Runway (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Wallet className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Tốc Độ Đốt Tiền & Runway</h3>
            </div>
            {cashFlowAnalysis.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {getBurnRateData() ? (
            <BurnRateChart data={getBurnRateData()!} height={250} />
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 3: Cash Flow Forecast (col-span-2) */}
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
              <h3 className="text-lg font-semibold text-slate-900">Dự Báo Dòng Tiền</h3>
            </div>
            {cashFlowAnalysis.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {cashFlowAnalysis.data && cashFlowAnalysis.data.data.forecast ? (
            <>
              {/* Forecast Info */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <p className="text-sm text-slate-600">
                    Dự báo cho {cashFlowAnalysis.data.data.forecast.forecastMonths} tháng tới
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  Độ tin cậy: <span className="font-medium">{cashFlowAnalysis.data.data.forecast.confidence}%</span>
                </div>
              </div>

              {/* Cash Flow Forecast Chart */}
              <CashFlowForecastChart data={getForecastChartData()} height={300} />
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 4: Payment Method Distribution (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Phân Bổ Theo Phương Thức</h3>
            </div>
            {cashFlowAnalysis.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {cashFlowAnalysis.data ? (
            <>
              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-slate-600">Tổng dòng tiền vào</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(cashFlowAnalysis.data.data.totalInflows)}
                </p>
              </div>

              {/* Payment Method Distribution Chart */}
              <RevenueBreakdownChart data={getPaymentMethodDistributionData()} height={250} />

              {/* Top Payment Methods */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-2">Phương thức hàng đầu:</p>
                {cashFlowAnalysis.data.data.breakdown.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{getPaymentMethodLabel(item.paymentMethod)}</span>
                    <span className="font-medium text-green-600">
                      {cashFlowAnalysis.data.data.totalInflows > 0 
                        ? Math.round((item.inflows / cashFlowAnalysis.data.data.totalInflows) * 100)
                        : 0}%
                    </span>
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
      {cashFlowAnalysis.data && (
        <div className="text-center text-sm text-slate-500">
          <p>
            Dữ liệu được tạo lúc {new Date(cashFlowAnalysis.data.metadata.computedAt).toLocaleTimeString('vi-VN')}
            {' '}({cashFlowAnalysis.data.metadata.cached ? 'Từ cache' : 'Truy vấn mới'})
            {cashFlowAnalysis.data.metadata.executionTime && ` - Query time: ${cashFlowAnalysis.data.metadata.executionTime}ms`}
          </p>
        </div>
      )}
    </div>
  );
}
