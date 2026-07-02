'use client';

/**
 * Session Analytics Dashboard - Operations Manager Intelligence
 * 
 * Session analytics metrics:
 * 1. Session Metrics Overview Cards (Total, Completion Rate, Avg Rating, Peak Hour)
 * 2. Session Status Table (Daily breakdown)
 * 3. Peak Hours Distribution
 * 4. Package Type Distribution
 * 
 * Data flows through Operational Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle,
  XCircle,
  Clock,
  Activity, 
  BarChart3,
  Calendar,
  RefreshCw,
  AlertCircle,
  Star,
  Users,
  Award,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SessionAnalytics {
  tenantId: string;
  date: string;
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  noShowSessions: number;
  scheduledSessions: number;
  inProgressSessions: number;
  completionRatePct: number;
  cancellationRatePct: number;
  noShowRatePct: number;
  basicPackageSessions: number;
  premiumPackageSessions: number;
  vipPackageSessions: number;
  morningSessions: number;
  afternoonSessions: number;
  eveningSessions: number;
  peakHour: number;
  avgSatisfactionRating: number;
  highSatisfactionCount: number;
  mediumSatisfactionCount: number;
  lowSatisfactionCount: number;
  totalRatings: number;
  avgDurationMinutes: number;
  maxDurationMinutes: number | null;
  minDurationMinutes: number | null;
  totalRevenue: number;
  avgRevenuePerSession: number;
  uniqueCustomers: number;
  uniqueKtvs: number;
  successfulQualitySessions: number;
  qualitySuccessRatePct: number;
  computedAt: string;
}

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

export default function SessionAnalyticsDashboardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Session analytics data
  const [analytics, setAnalytics] = useState<IntelligenceResponse<SessionAnalytics[]> | null>(null);

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

      // Check if user has operations manager or admin role
      if (!['admin', 'manager'].includes(profile.role)) {
        toast.error('Bạn không có quyền truy cập trang này');
        router.push('/dashboard');
        return;
      }

      setTenantId(profile.tenant_id);
    }

    initTenant();
  }, [router]);

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch session analytics
  // ───────────────────────────────────────────────────────────────────────────

  const fetchAnalytics = async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ tenantId, period });

      const response = await fetch(`/api/intelligence/operational/session-analytics?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalytics(data);
      
      if (refresh) {
        toast.success('Đã làm mới dữ liệu');
      }
    } catch (error) {
      console.error('Failed to fetch session analytics:', error);
      toast.error('Không thể tải dữ liệu phiên dịch vụ');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchAnalytics();
    }
  }, [tenantId, period]);

  // ───────────────────────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Computed values
  // ───────────────────────────────────────────────────────────────────────────

  const totals = analytics?.data.reduce((acc, day) => ({
    totalSessions: acc.totalSessions + day.totalSessions,
    completedSessions: acc.completedSessions + day.completedSessions,
    cancelledSessions: acc.cancelledSessions + day.cancelledSessions,
    noShowSessions: acc.noShowSessions + day.noShowSessions,
    totalRevenue: acc.totalRevenue + day.totalRevenue,
    totalRatings: acc.totalRatings + day.totalRatings,
    avgSatisfactionRating: acc.avgSatisfactionRating + day.avgSatisfactionRating,
    morningSessions: acc.morningSessions + day.morningSessions,
    afternoonSessions: acc.afternoonSessions + day.afternoonSessions,
    eveningSessions: acc.eveningSessions + day.eveningSessions,
    basicPackageSessions: acc.basicPackageSessions + day.basicPackageSessions,
    premiumPackageSessions: acc.premiumPackageSessions + day.premiumPackageSessions,
    vipPackageSessions: acc.vipPackageSessions + day.vipPackageSessions,
  }), {
    totalSessions: 0,
    completedSessions: 0,
    cancelledSessions: 0,
    noShowSessions: 0,
    totalRevenue: 0,
    totalRatings: 0,
    avgSatisfactionRating: 0,
    morningSessions: 0,
    afternoonSessions: 0,
    eveningSessions: 0,
    basicPackageSessions: 0,
    premiumPackageSessions: 0,
    vipPackageSessions: 0,
  });

  const avgCompletionRate = totals && totals.totalSessions > 0 
    ? (totals.completedSessions / totals.totalSessions) * 100 
    : 0;

  const avgRating = totals && analytics?.data.length 
    ? totals.avgSatisfactionRating / analytics.data.length 
    : 0;

  const peakTimeSlot = totals && Math.max(totals.morningSessions, totals.afternoonSessions, totals.eveningSessions) === totals.morningSessions 
    ? 'Buổi sáng (8-11h)' 
    : totals && Math.max(totals.morningSessions, totals.afternoonSessions, totals.eveningSessions) === totals.afternoonSessions
    ? 'Buổi chiều (12-16h)'
    : 'Buổi tối (17-21h)';

  // ───────────────────────────────────────────────────────────────────────────
  // Render helpers
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render Loading State
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-slate-600">Đang tải dữ liệu phiên dịch vụ...</p>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Phân Tích Phiên Dịch Vụ</h1>
        <p className="mt-2 text-slate-600">
          Thống kê tỷ lệ hoàn thành, giờ cao điểm, và đánh giá khách hàng
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">Thời gian:</span>
          <div className="flex gap-2">
            {(['week', 'month', 'quarter'] as TimePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-primary text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {p === 'week' && 'Tuần này'}
                {p === 'month' && 'Tháng này'}
                {p === 'quarter' && 'Quý này'}
              </button>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="ml-auto rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Cache Status */}
      {analytics?.metadata && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">
          <AlertCircle className="h-4 w-4" />
          <span>
            {analytics.metadata.cacheHit ? '✓ Dữ liệu từ cache' : '⚡ Dữ liệu mới'}
            {' • '}
            Thời gian truy vấn: {analytics.metadata.queryTimeMs}ms
          </span>
        </div>
      )}

      {/* Metrics Overview Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {/* Total Sessions */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Tổng phiên</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {formatNumber(totals?.totalSessions || 0)}
              </p>
            </div>
            <Activity className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        {/* Completion Rate */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Tỷ lệ hoàn thành</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {formatNumber(avgCompletionRate, 1)}%
              </p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>

        {/* Avg Rating */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Đánh giá TB</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-3xl font-bold text-amber-500">
                  {formatNumber(avgRating, 1)}
                </p>
                <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
              </div>
            </div>
            <Award className="h-10 w-10 text-amber-500" />
          </div>
        </div>

        {/* Peak Hour */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Giờ cao điểm</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {peakTimeSlot}
              </p>
            </div>
            <Zap className="h-10 w-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Peak Hours Distribution */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Phân bố theo giờ</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Morning */}
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Buổi sáng (8-11h)</p>
              <Clock className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {formatNumber(totals?.morningSessions || 0)}
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div 
                className="h-2 rounded-full bg-blue-500"
                style={{ 
                  width: `${totals && totals.totalSessions > 0 ? (totals.morningSessions / totals.totalSessions) * 100 : 0}%` 
                }}
              />
            </div>
          </div>

          {/* Afternoon */}
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Buổi chiều (12-16h)</p>
              <Clock className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {formatNumber(totals?.afternoonSessions || 0)}
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div 
                className="h-2 rounded-full bg-green-500"
                style={{ 
                  width: `${totals && totals.totalSessions > 0 ? (totals.afternoonSessions / totals.totalSessions) * 100 : 0}%` 
                }}
              />
            </div>
          </div>

          {/* Evening */}
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Buổi tối (17-21h)</p>
              <Clock className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {formatNumber(totals?.eveningSessions || 0)}
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div 
                className="h-2 rounded-full bg-purple-500"
                style={{ 
                  width: `${totals && totals.totalSessions > 0 ? (totals.eveningSessions / totals.totalSessions) * 100 : 0}%` 
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Package Distribution */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Phân bố theo gói dịch vụ</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Basic */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-600">Gói Tiết Kiệm</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatNumber(totals?.basicPackageSessions || 0)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {totals && totals.totalSessions > 0 
                ? formatNumber((totals.basicPackageSessions / totals.totalSessions) * 100, 1) 
                : 0}% tổng số
            </p>
          </div>

          {/* Premium */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-600">Gói Hạnh Phúc</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatNumber(totals?.premiumPackageSessions || 0)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {totals && totals.totalSessions > 0 
                ? formatNumber((totals.premiumPackageSessions / totals.totalSessions) * 100, 1) 
                : 0}% tổng số
            </p>
          </div>

          {/* VIP */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-600">Gói VIP Toàn Diện</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatNumber(totals?.vipPackageSessions || 0)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {totals && totals.totalSessions > 0 
                ? formatNumber((totals.vipPackageSessions / totals.totalSessions) * 100, 1) 
                : 0}% tổng số
            </p>
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="rounded-lg bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Chi tiết theo ngày</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                  Ngày
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Tổng ca
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Hoàn thành
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Tỷ lệ
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Đánh giá
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Doanh thu
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {analytics?.data.map((day) => (
                <motion.tr
                  key={day.date}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="transition-colors hover:bg-slate-50"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{formatDate(day.date)}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-slate-900">{formatNumber(day.totalSessions)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-slate-900">{formatNumber(day.completedSessions)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-medium ${
                      day.completionRatePct >= 90 
                        ? 'text-green-600' 
                        : day.completionRatePct >= 70 
                        ? 'text-yellow-600' 
                        : 'text-red-600'
                    }`}>
                      {formatNumber(day.completionRatePct, 1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="text-slate-900">{formatNumber(day.avgSatisfactionRating, 1)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-slate-900">
                      {formatCurrency(day.totalRevenue)}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {analytics && analytics.data.length === 0 && (
          <div className="py-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-4 text-slate-600">Không có dữ liệu</p>
          </div>
        )}
      </div>
    </div>
  );
}
