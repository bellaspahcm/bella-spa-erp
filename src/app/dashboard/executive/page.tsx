'use client';

/**
 * Executive Dashboard - CEO Intelligence
 * 
 * High-level metrics for executive decision-making:
 * 1. Monthly Revenue Summary
 * 2. Operational Efficiency
 * 3. Customer Metrics
 * 4. Financial Health
 * 5. Growth Indicators
 * 
 * Data flows through Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Activity, 
  BarChart3,
  Calendar,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { 
  MonthlyRevenueSummary,
  OperationalEfficiency,
  CustomerMetrics,
  FinancialHealth,
  GrowthIndicators
} from '@/services/intelligence/executive';
import {
  RevenueTrendChart,
  OperationalEfficiencyChart,
  CustomerMetricsChart,
  FinancialHealthChart,
  GrowthIndicatorsChart,
} from '@/components/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface IntelligenceResponse<T> {
  data: T;
  metadata: {
    generatedAt: string;
    cacheHit: boolean;
    queryTimeMs: number;
    dataSourcesUsed: string[];
  };
}

type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Metric states
  const [revenueSummary, setRevenueSummary] = useState<IntelligenceResponse<MonthlyRevenueSummary> | null>(null);
  const [operationalEfficiency, setOperationalEfficiency] = useState<IntelligenceResponse<OperationalEfficiency> | null>(null);
  const [customerMetrics, setCustomerMetrics] = useState<IntelligenceResponse<CustomerMetrics> | null>(null);
  const [financialHealth, setFinancialHealth] = useState<IntelligenceResponse<FinancialHealth> | null>(null);
  const [growthIndicators, setGrowthIndicators] = useState<IntelligenceResponse<GrowthIndicators> | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // Initialize tenant
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

      // Check if user has executive role
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
      const baseUrl = `/api/intelligence/executive`;
      const params = new URLSearchParams({ tenantId, period });

      const [revenue, efficiency, customer, financial, growth] = await Promise.all([
        fetch(`${baseUrl}/monthly-revenue-summary?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/operational-efficiency?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/customer-metrics?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/financial-health?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/growth-indicators?${params}`).then(r => r.json()),
      ]);

      // Check for errors
      if (revenue.error) throw new Error(revenue.error);
      if (efficiency.error) throw new Error(efficiency.error);
      if (customer.error) throw new Error(customer.error);
      if (financial.error) throw new Error(financial.error);
      if (growth.error) throw new Error(growth.error);

      setRevenueSummary(revenue);
      setOperationalEfficiency(efficiency);
      setCustomerMetrics(customer);
      setFinancialHealth(financial);
      setGrowthIndicators(growth);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
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
  }, [tenantId, period]);

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
  // Generate mock historical data for charts (temporary until API provides historical data)
  // ───────────────────────────────────────────────────────────────────────────

  const generateRevenueTrendData = () => {
    if (!revenueSummary) return [];
    
    const current = revenueSummary.data.totalRevenue;
    const growth = revenueSummary.data.revenueGrowth / 100;
    
    // Generate last 7 days data
    return Array.from({ length: 7 }, (_, i) => {
      const daysAgo = 6 - i;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      // Calculate revenue with growth trend
      const revenue = current * (1 - growth * (daysAgo / 7));
      
      return {
        date: date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
        revenue: Math.round(revenue),
      };
    });
  };

  const generateCustomerTrendData = () => {
    if (!customerMetrics) return [];
    
    const newCustomers = customerMetrics.data.newCustomers;
    
    // Generate last 7 days data
    return Array.from({ length: 7 }, (_, i) => {
      const daysAgo = 6 - i;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      return {
        date: date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
        newCustomers: Math.round(newCustomers * (0.1 + Math.random() * 0.2)),
        returningCustomers: Math.round(newCustomers * (0.3 + Math.random() * 0.4)),
      };
    });
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
          <h1 className="text-3xl font-bold text-slate-900">Executive Dashboard</h1>
          <p className="text-slate-600 mt-1">Tổng quan chỉ số kinh doanh</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as TimePeriod)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="day">Hôm nay</option>
            <option value="week">7 ngày qua</option>
            <option value="month">30 ngày qua</option>
            <option value="quarter">Quý này</option>
            <option value="year">Năm này</option>
          </select>

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
        {/* Card 1: Monthly Revenue Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Doanh Thu</h3>
            </div>
            {revenueSummary?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {revenueSummary ? (
            <>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-3xl font-bold text-slate-900">
                    {formatCurrency(revenueSummary.data.totalRevenue)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {revenueSummary.data.revenueGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      revenueSummary.data.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatPercent(revenueSummary.data.revenueGrowth)}
                    </span>
                    <span className="text-sm text-slate-600">vs kỳ trước</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Top nguồn doanh thu:</p>
                  {revenueSummary.data.topRevenueSources.slice(0, 3).map((source, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{source.source}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(source.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue Trend Chart */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Xu hướng 7 ngày qua</p>
                <RevenueTrendChart data={generateRevenueTrendData()} height={200} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 2: Operational Efficiency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Hiệu Suất</h3>
            </div>
            {operationalEfficiency?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {operationalEfficiency ? (
            <>
              {/* Radial Chart */}
              <OperationalEfficiencyChart
                ktvUtilization={operationalEfficiency.data.ktvUtilizationRate}
                sessionRating={operationalEfficiency.data.averageSessionRating}
                completionRate={operationalEfficiency.data.serviceCompletionRate}
                height={250}
              />

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-xs text-slate-600 mb-1">Sử dụng</p>
                  <p className="text-lg font-bold text-cyan-600">
                    {formatNumber(operationalEfficiency.data.ktvUtilizationRate, 0)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-600 mb-1">Đánh giá</p>
                  <p className="text-lg font-bold text-purple-600">
                    {formatNumber(operationalEfficiency.data.averageSessionRating, 1)}⭐
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-600 mb-1">Hoàn thành</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatNumber(operationalEfficiency.data.serviceCompletionRate, 0)}%
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 3: Customer Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Khách Hàng</h3>
            </div>
            {customerMetrics?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {customerMetrics ? (
            <>
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <p className="text-sm text-slate-600">Khách hàng mới</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatNumber(customerMetrics.data.newCustomers)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Tỷ lệ giữ chân</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatNumber(customerMetrics.data.retentionRate, 1)}%
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Giá trị đơn hàng TB</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(customerMetrics.data.averageBookingValue)}
                  </p>
                </div>
              </div>

              {/* Customer Trend Chart */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Xu hướng khách hàng 7 ngày qua</p>
                <CustomerMetricsChart data={generateCustomerTrendData()} height={200} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 4: Financial Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Sức Khỏe Tài Chính</h3>
            </div>
            {financialHealth?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {financialHealth ? (
            <>
              {/* Financial Health Chart */}
              <FinancialHealthChart
                profitMargin={financialHealth.data.profitMargin}
                cashFlow={financialHealth.data.cashFlow}
                receivables={financialHealth.data.outstandingReceivables}
                height={250}
              />

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-xs text-slate-600 mb-1">Biên LN</p>
                  <p className="text-lg font-bold text-orange-600">
                    {formatNumber(financialHealth.data.profitMargin, 1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-600 mb-1">Dòng tiền</p>
                  <p className={`text-lg font-bold ${
                    financialHealth.data.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(financialHealth.data.cashFlow).replace('₫', '').trim()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-600 mb-1">Công nợ</p>
                  <p className="text-lg font-bold text-slate-900">
                    {formatCurrency(financialHealth.data.outstandingReceivables).replace('₫', '').trim()}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 5: Growth Indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-pink-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-pink-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Tăng Trưởng</h3>
            </div>
            {growthIndicators?.metadata.cacheHit && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {growthIndicators ? (
            <>
              {/* Growth Chart */}
              <GrowthIndicatorsChart
                momGrowth={growthIndicators.data.monthOverMonthGrowth}
                yoyGrowth={growthIndicators.data.yearOverYearGrowth}
                projectedGrowth={15} // Mock projected growth rate
                height={200}
              />

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Tăng trưởng MoM</p>
                  <p className={`text-xl font-bold ${
                    growthIndicators.data.monthOverMonthGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercent(growthIndicators.data.monthOverMonthGrowth)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-600 mb-1">Tăng trưởng YoY</p>
                  <p className={`text-xl font-bold ${
                    growthIndicators.data.yearOverYearGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercent(growthIndicators.data.yearOverYearGrowth)}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-600 mb-1">Dự báo doanh thu tháng tới</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(growthIndicators.data.projectedRevenue)}
                </p>
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
      {revenueSummary && (
        <div className="text-center text-sm text-slate-500">
          <p>
            Dữ liệu được tạo lúc {new Date(revenueSummary.metadata.generatedAt).toLocaleTimeString('vi-VN')} 
            {' '}({revenueSummary.metadata.cacheHit ? 'Từ cache' : 'Truy vấn mới'}) 
            {' '}- Query time: {revenueSummary.metadata.queryTimeMs}ms
          </p>
        </div>
      )}
    </div>
  );
}
