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

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  CheckCircle,
  Clock,
  Activity, 
  RefreshCw,
  Star,
  Award,
  Zap,
  ArrowLeft,
  ChevronRight
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

  const fetchAnalytics = useCallback(async (refresh = false) => {
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
  }, [tenantId, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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

  const totals = analytics?.data.reduce((acc, day) => {
    const totalSessions = day.totalSessions || 0;
    const completedSessions = day.completedSessions || 0;
    const cancelledSessions = day.cancelledSessions || 0;
    const noShowSessions = day.noShowSessions || 0;
    const totalRevenue = day.totalRevenue || 0;
    const totalRatings = day.totalRatings || 0;
    const avgSatisfactionRating = isNaN(day.avgSatisfactionRating) || !day.avgSatisfactionRating ? 0 : day.avgSatisfactionRating;
    const morningSessions = day.morningSessions || 0;
    const afternoonSessions = day.afternoonSessions || 0;
    const eveningSessions = day.eveningSessions || 0;
    const basicPackageSessions = day.basicPackageSessions || 0;
    const premiumPackageSessions = day.premiumPackageSessions || 0;
    const vipPackageSessions = day.vipPackageSessions || 0;

    return {
      totalSessions: acc.totalSessions + totalSessions,
      completedSessions: acc.completedSessions + completedSessions,
      cancelledSessions: acc.cancelledSessions + cancelledSessions,
      noShowSessions: acc.noShowSessions + noShowSessions,
      totalRevenue: acc.totalRevenue + totalRevenue,
      totalRatings: acc.totalRatings + totalRatings,
      avgSatisfactionRating: acc.avgSatisfactionRating + avgSatisfactionRating,
      morningSessions: acc.morningSessions + morningSessions,
      afternoonSessions: acc.afternoonSessions + afternoonSessions,
      eveningSessions: acc.eveningSessions + eveningSessions,
      basicPackageSessions: acc.basicPackageSessions + basicPackageSessions,
      premiumPackageSessions: acc.premiumPackageSessions + premiumPackageSessions,
      vipPackageSessions: acc.vipPackageSessions + vipPackageSessions,
    };
  }, {
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

  const ratedDaysCount = analytics?.data.filter(day => (day.avgSatisfactionRating || 0) > 0).length || 0;
  const avgRating = totals && ratedDaysCount > 0 
    ? totals.avgSatisfactionRating / ratedDaysCount 
    : 0;

  const peakTimeSlot = totals && (totals.morningSessions > 0 || totals.afternoonSessions > 0 || totals.eveningSessions > 0)
    ? (Math.max(totals.morningSessions, totals.afternoonSessions, totals.eveningSessions) === totals.morningSessions 
      ? 'Buổi sáng (8-11h)' 
      : Math.max(totals.morningSessions, totals.afternoonSessions, totals.eveningSessions) === totals.afternoonSessions
      ? 'Buổi chiều (12-16h)'
      : 'Buổi tối (17-21h)')
    : 'Chưa có dữ liệu';

  // ───────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ───────────────────────────────────────────────────────────────────────────

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0 đ';
    }
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const formatNumber = (value: number | null | undefined, decimals = 0) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }
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
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-8">
      {/* Breadcrumbs & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-950/5 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
          <Link href="/dashboard" className="hover:text-emerald-800 transition-colors">
            Tổng quan
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <Link href="/dashboard/operations" className="hover:text-emerald-800 transition-colors">
            Phân tích vận hành
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <span className="text-emerald-800 font-bold">Phân Tích Phiên Dịch Vụ</span>
        </div>
        
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-800/30 group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          <span>Trở về trang gần nhất</span>
        </button>
      </div>

      {/* Header & Period Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest block">
            Báo cáo vận hành
          </span>
          <h1 className="font-serif text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Phân Tích Phiên Dịch Vụ
          </h1>
          <p className="text-sm text-slate-600 font-medium max-w-xl">
            Thống kê tỷ lệ hoàn thành, giờ cao điểm, và đánh giá khách hàng
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 bg-slate-200/60 p-1 rounded-2xl border border-slate-200/20">
            {(['week', 'month', 'quarter'] as TimePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ${
                  period === p
                    ? 'bg-emerald-800 text-white shadow-md shadow-emerald-800/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {p === 'week' && 'Tuần này'}
                {p === 'month' && 'Tháng này'}
                {p === 'quarter' && 'Quý này'}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cache Status */}
      {analytics?.metadata && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50/50 border border-emerald-100/50 px-5 py-3 text-xs font-medium text-emerald-800 backdrop-blur-sm shadow-sm shadow-emerald-50/10">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {analytics.metadata.cacheHit ? '✓ Dữ liệu được tải từ bộ nhớ đệm (Cache Hit)' : '⚡ Dữ liệu mới được tổng hợp thời gian thực'}
            </span>
          </div>
          <div className="opacity-80">
            Thời gian phản hồi: <span className="font-bold">{analytics.metadata.queryTimeMs}ms</span>
          </div>
        </div>
      )}

      {/* Metrics Overview Cards */}
      <div className="grid gap-5 md:grid-cols-4">
        {/* Total Sessions */}
        <div className="group relative overflow-hidden rounded-[2rem] bg-white border border-slate-200/50 p-6 shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-800/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng phiên</p>
              <p className="font-serif mt-3 text-4xl font-extrabold text-slate-900">
                {formatNumber(totals?.totalSessions || 0)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-110">
              <Activity className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-300 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Completion Rate */}
        <div className="group relative overflow-hidden rounded-[2rem] bg-white border border-slate-200/50 p-6 shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-800/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ hoàn thành</p>
              <p className="font-serif mt-3 text-4xl font-extrabold text-emerald-800">
                {formatNumber(avgCompletionRate, 1)}%
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition-transform group-hover:scale-110">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-350 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Avg Rating */}
        <div className="group relative overflow-hidden rounded-[2rem] bg-white border border-slate-200/50 p-6 shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-800/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đánh giá TB</p>
              <div className="mt-3 flex items-baseline gap-1">
                <p className="font-serif text-4xl font-extrabold text-amber-500">
                  {avgRating > 0 ? formatNumber(avgRating, 1) : '—'}
                </p>
                {avgRating > 0 && <span className="text-xs font-bold text-slate-400">/ 5.0</span>}
              </div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition-transform group-hover:scale-110">
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-300 to-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Peak Hour */}
        <div className="group relative overflow-hidden rounded-[2rem] bg-white border border-slate-200/50 p-6 shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-800/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Giờ cao điểm</p>
              <p className="mt-3 text-lg font-bold text-slate-900 line-clamp-1">
                {peakTimeSlot}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 transition-transform group-hover:scale-110">
              <Zap className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-300 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Peak Hours Distribution */}
      <div className="rounded-[2rem] bg-white border border-slate-200/50 p-8 shadow-sm shadow-slate-100/50">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800">
            <Clock className="h-5 w-5" />
          </div>
          <h2 className="font-serif text-xl font-bold text-slate-900">Phân bố theo giờ</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Morning */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition-all duration-200 hover:border-emerald-800/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Buổi sáng (8-11h)</p>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {totals && totals.totalSessions > 0 ? Math.round((totals.morningSessions / totals.totalSessions) * 100) : 0}%
              </span>
            </div>
            <p className="font-serif text-3xl font-extrabold text-slate-900">
              {formatNumber(totals?.morningSessions || 0)} <span className="text-xs font-normal text-slate-400">phiên</span>
            </p>
            <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-500"
                style={{ 
                  width: `${totals && totals.totalSessions > 0 ? (totals.morningSessions / totals.totalSessions) * 100 : 0}%` 
                }}
              />
            </div>
          </div>

          {/* Afternoon */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition-all duration-200 hover:border-emerald-800/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Buổi chiều (12-16h)</p>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {totals && totals.totalSessions > 0 ? Math.round((totals.afternoonSessions / totals.totalSessions) * 100) : 0}%
              </span>
            </div>
            <p className="font-serif text-3xl font-extrabold text-slate-900">
              {formatNumber(totals?.afternoonSessions || 0)} <span className="text-xs font-normal text-slate-400">phiên</span>
            </p>
            <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                style={{ 
                  width: `${totals && totals.totalSessions > 0 ? (totals.afternoonSessions / totals.totalSessions) * 100 : 0}%` 
                }}
              />
            </div>
          </div>

          {/* Evening */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition-all duration-200 hover:border-emerald-800/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Buổi tối (17-21h)</p>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                {totals && totals.totalSessions > 0 ? Math.round((totals.eveningSessions / totals.totalSessions) * 100) : 0}%
              </span>
            </div>
            <p className="font-serif text-3xl font-extrabold text-slate-900">
              {formatNumber(totals?.eveningSessions || 0)} <span className="text-xs font-normal text-slate-400">phiên</span>
            </p>
            <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-500 transition-all duration-500"
                style={{ 
                  width: `${totals && totals.totalSessions > 0 ? (totals.eveningSessions / totals.totalSessions) * 100 : 0}%` 
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Package Distribution */}
      <div className="rounded-[2rem] bg-white border border-slate-200/50 p-8 shadow-sm shadow-slate-100/50">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800">
            <Award className="h-5 w-5" />
          </div>
          <h2 className="font-serif text-xl font-bold text-slate-900">Phân bố theo gói dịch vụ</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Basic */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition-all duration-200 hover:border-emerald-800/10">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gói Tiết Kiệm</p>
            <p className="font-serif mt-3 text-3xl font-extrabold text-slate-900">
              {formatNumber(totals?.basicPackageSessions || 0)} <span className="text-xs font-normal text-slate-400">phiên</span>
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Tỷ lệ thị phần</span>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                {totals && totals.totalSessions > 0 
                  ? formatNumber((totals.basicPackageSessions / totals.totalSessions) * 100, 1) 
                  : 0}%
              </span>
            </div>
          </div>

          {/* Premium */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition-all duration-200 hover:border-emerald-800/10">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gói Hạnh Phúc</p>
            <p className="font-serif mt-3 text-3xl font-extrabold text-slate-900">
              {formatNumber(totals?.premiumPackageSessions || 0)} <span className="text-xs font-normal text-slate-400">phiên</span>
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Tỷ lệ thị phần</span>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                {totals && totals.totalSessions > 0 
                  ? formatNumber((totals.premiumPackageSessions / totals.totalSessions) * 100, 1) 
                  : 0}%
              </span>
            </div>
          </div>

          {/* VIP */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition-all duration-200 hover:border-emerald-800/10">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gói VIP Toàn Diện</p>
            <p className="font-serif mt-3 text-3xl font-extrabold text-slate-900">
              {formatNumber(totals?.vipPackageSessions || 0)} <span className="text-xs font-normal text-slate-400">phiên</span>
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Tỷ lệ thị phần</span>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                {totals && totals.totalSessions > 0 
                  ? formatNumber((totals.vipPackageSessions / totals.totalSessions) * 100, 1) 
                  : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="overflow-hidden rounded-[2rem] bg-white border border-slate-200/50 shadow-sm shadow-slate-100/50">
        <div className="border-b border-slate-100 px-8 py-5 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-serif text-lg font-bold text-slate-900">Chi tiết theo ngày</h2>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {formatNumber(analytics?.data.length || 0)} ngày ghi nhận
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-8 py-4">Ngày</th>
                <th className="px-6 py-4 text-right">Tổng ca</th>
                <th className="px-6 py-4 text-right">Hoàn thành</th>
                <th className="px-6 py-4 text-right">Tỷ lệ hoàn thành</th>
                <th className="px-6 py-4 text-right">Đánh giá trung bình</th>
                <th className="px-8 py-4 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              {analytics?.data.map((day) => {
                const completionRate = isNaN(day.completionRatePct) || day.completionRatePct === null ? 0 : day.completionRatePct;
                const avgSatisfaction = isNaN(day.avgSatisfactionRating) || !day.avgSatisfactionRating ? 0 : day.avgSatisfactionRating;
                const totalRev = isNaN(day.totalRevenue) || day.totalRevenue === null ? 0 : day.totalRevenue;

                return (
                  <motion.tr
                    key={day.date}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-8 py-4">
                      <div className="font-semibold text-slate-900">{formatDate(day.date)}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {formatNumber(day.totalSessions)}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>{formatNumber(day.completedSessions)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        completionRate >= 90 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : completionRate >= 70 
                          ? 'bg-amber-50 text-amber-700' 
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {formatNumber(completionRate, 1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {avgSatisfaction > 0 ? (
                        <div className="inline-flex items-center gap-1 justify-end text-amber-600 font-bold">
                          <Star className="h-3.5 w-3.5 fill-current animate-pulse" />
                          <span>{formatNumber(avgSatisfaction, 1)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="px-8 py-4 text-right font-semibold text-slate-900">
                      {formatCurrency(totalRev)}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {(!analytics || analytics.data.length === 0) && (
          <div className="py-16 text-center">
            <Activity className="mx-auto h-12 w-12 text-slate-300 stroke-1" />
            <p className="mt-4 text-sm text-slate-400 font-medium">Không tìm thấy dữ liệu vận hành trong khoảng thời gian này</p>
          </div>
        )}
      </div>
    </div>
  );
}
