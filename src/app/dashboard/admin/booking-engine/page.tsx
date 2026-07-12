'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import DecisionEngineHeader from '@/components/decision-engine/DecisionEngineHeader';

// ============================================================================
// Types
// ============================================================================

interface MetricsResponse {
  success: boolean;
  data: {
    assignment: {
      total_assignments: number;
      successful_assignments: number;
      success_rate_percent: number;
      avg_confidence: number;
      auto_assigned: number;
      manual_assigned: number;
      auto_assignment_rate_percent: number;
      avg_execution_time_ms: number;
      p95_execution_time_ms: number;
      p99_execution_time_ms: number;
    };
    conflict: {
      total_checks: number;
      conflicts_detected: number;
      conflict_rate_percent: number;
      blocking_conflicts: number;
      warning_conflicts: number;
      blocking_rate_percent: number;
      avg_execution_time_ms: number;
      top_conflict_types: Array<{
        type: string;
        count: number;
        percentage: number;
      }>;
    };
    capacity: {
      total_checks: number;
      capacity_available: number;
      capacity_full: number;
      capacity_full_rate_percent: number;
      avg_utilization_percent: number;
      avg_buffer_used_percent: number;
      avg_execution_time_ms: number;
    };
    performance: {
      total_operations: number;
      avg_execution_time_ms: number;
      median_execution_time_ms: number;
      p95_execution_time_ms: number;
      p99_execution_time_ms: number;
      max_execution_time_ms: number;
      by_provider: Record<
        string,
        {
          count: number;
          avg_ms: number;
          p95_ms: number;
        }
      >;
    };
    overrides: {
      capacity_checks_skipped: number;
      conflict_checks_skipped: number;
      assignments_skipped: number;
      total_overrides: number;
      override_rate_percent: number;
    };
    date_range: {
      start: string;
      end: string;
    };
  };
  meta: {
    tenantId: string;
    startDate: string;
    endDate: string;
    fetchedAt: string;
  };
}

type DateRange = '24h' | '7d' | '30d';

// ============================================================================
// Theme Utilities
// ============================================================================

const getThemeColors = (moduleKey: string | null) => {
  const normKey = moduleKey === 'babycare' ? 'baby_care' : (moduleKey || 'baby_care');
  if (normKey === 'beauty_spa') {
    return {
      primary: 'emerald',
      bgLight: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      border: 'border-emerald-100/50 dark:border-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-400',
      glow: 'shadow-emerald-100 dark:shadow-emerald-950/30',
      accentColor: '#10b981',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      progressBg: 'bg-emerald-200 dark:bg-emerald-800/40',
      gradient: 'from-emerald-500 to-teal-600',
      cardGradient: 'from-emerald-50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10',
      autoRefreshBtnActive: 'bg-emerald-50/80 border-emerald-200/50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400',
      iconContainer: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100/30',
    };
  } else if (normKey === 'industrial_cleaning') {
    return {
      primary: 'indigo',
      bgLight: 'bg-indigo-50/50 dark:bg-indigo-950/20',
      border: 'border-indigo-100/50 dark:border-indigo-900/30',
      text: 'text-indigo-700 dark:text-indigo-400',
      glow: 'shadow-indigo-100 dark:shadow-indigo-950/30',
      accentColor: '#6366f1',
      badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
      progressBg: 'bg-indigo-200 dark:bg-indigo-800/40',
      gradient: 'from-indigo-500 to-blue-600',
      cardGradient: 'from-indigo-50 to-blue-50/30 dark:from-indigo-950/20 dark:to-blue-950/10',
      autoRefreshBtnActive: 'bg-indigo-50/80 border-indigo-200/50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400',
      iconContainer: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30',
    };
  } else {
    // Default baby_care / babycare / pending
    return {
      primary: 'rose',
      bgLight: 'bg-rose-50/50 dark:bg-rose-950/20',
      border: 'border-rose-100/50 dark:border-rose-900/30',
      text: 'text-rose-700 dark:text-rose-400',
      glow: 'shadow-rose-100 dark:shadow-rose-950/30',
      accentColor: '#f43f5e',
      badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
      progressBg: 'bg-rose-200 dark:bg-rose-800/40',
      gradient: 'from-rose-500 to-pink-600',
      cardGradient: 'from-rose-50 to-pink-50/30 dark:from-rose-950/20 dark:to-pink-950/10',
      autoRefreshBtnActive: 'bg-rose-50/80 border-rose-200/50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400',
      iconContainer: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100/30',
    };
  }
};

// ============================================================================
// Main Component
// ============================================================================

export default function BookingEngineDashboardPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const { tenantModuleKey } = useTenantModuleKey();
  const vocab = useModuleVocabulary();
  const theme = getThemeColors(tenantModuleKey);

  // ========================================
  // Fetch Metrics
  // ========================================
  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const now = new Date();
      const startDate = new Date();
      switch (dateRange) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      });

      const response = await fetch(`/api/admin/booking-engine/metrics?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch metrics');
      }

      const data: MetricsResponse = await response.json();
      setMetrics(data);
      setLastRefreshAt(new Date());
    } catch (err) {
      console.error('[BookingEngineDashboard] Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!isAutoRefresh) return;

    const intervalId = setInterval(() => {
      void fetchMetrics();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [isAutoRefresh, fetchMetrics]);

  // ========================================
  // Render Error State
  // ========================================
  if (error && !metrics) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trung tâm Điều phối Đặt lịch</h1>
            <p className="text-sm text-slate-500 mt-1">Lỗi khi tải dữ liệu vận hành từ Decision Engine</p>
          </div>
        </div>

        <Alert variant="destructive" className="rounded-2xl border-red-200/50 bg-red-50/50 backdrop-blur">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <Button onClick={() => void fetchMetrics()} variant="outline" className="rounded-xl">
          <RefreshCw className="h-4 w-4 mr-2" />
          Thử lại
        </Button>
      </div>
    );
  }

  // ========================================
  // Render Loading State
  // ========================================
  if (isLoading && !metrics) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-48 mt-2 rounded-lg" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="rounded-2xl border-slate-100">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32 rounded" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-20 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ========================================
  // Main Render
  // ========================================
  const data = metrics?.data;
  if (!data) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <DecisionEngineHeader />
      <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
        {/* Control bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md border border-white/20 dark:border-white/5 p-4 rounded-2xl shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Bộ lọc & Chỉ số vận hành
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Phạm vi: {dateRange === '24h' ? '24 Giờ qua' : dateRange === '7d' ? '7 Ngày qua' : '30 Ngày qua'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Last Updated Badge */}
            {lastRefreshAt && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${theme.badgeBg} border ${theme.border}`}>
                <Clock className="h-3.5 w-3.5" />
                <span>Cập nhật lúc: {lastRefreshAt.toLocaleTimeString()}</span>
              </div>
            )}

            {/* Date Range Selector */}
            <div className="flex items-center bg-slate-100/80 dark:bg-slate-900/50 backdrop-blur border border-slate-200/50 dark:border-slate-800 p-1 rounded-xl">
              {(['24h', '7d', '30d'] as DateRange[]).map((range) => (
                <Button
                  key={range}
                  variant="ghost"
                  size="sm"
                  className={`rounded-lg px-3.5 py-1.5 h-8 text-xs font-medium transition-all ${
                    dateRange === range
                      ? `bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-bold`
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  onClick={() => setDateRange(range)}
                >
                  {range === '24h' ? '24 Giờ' : range === '7d' ? '7 Ngày' : '30 Ngày'}
                </Button>
              ))}
            </div>

            {/* Auto-refresh Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`h-9 px-3.5 rounded-xl border text-xs font-semibold transition-all ${
                isAutoRefresh
                  ? theme.autoRefreshBtnActive
                  : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Zap className={`h-3.5 w-3.5 mr-2 ${isAutoRefresh ? 'animate-bounce text-yellow-500' : ''}`} />
              Auto-refresh: {isAutoRefresh ? 'BẬT' : 'TẮT'}
            </Button>

            {/* Manual Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchMetrics()}
              disabled={isLoading}
              className="h-9 px-3.5 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>
        </div>


      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-red-200/50 bg-red-50/50 backdrop-blur">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Assignment Success */}
        <div className="relative overflow-hidden bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
          <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${theme.gradient} opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform duration-500`} />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Hiệu suất phân bổ
            </span>
            <div className={`p-2 rounded-xl ${theme.iconContainer}`}>
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {data.assignment.success_rate_percent || 0}%
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Điều phối thành công {data.assignment.successful_assignments}/{data.assignment.total_assignments} {vocab.booking.singular.toLowerCase()}
            </p>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${theme.gradient} transition-all duration-1000`} 
              style={{ width: `${data.assignment.success_rate_percent || 0}%` }}
            />
          </div>
        </div>

        {/* Card 2: Auto-Assignment Rate */}
        <div className="relative overflow-hidden bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500 to-indigo-600 opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Tỷ lệ Tự động hóa
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100/30">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {data.assignment.auto_assignment_rate_percent || 0}%
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tự động: {data.assignment.auto_assigned} | Thủ công: {data.assignment.manual_assigned}
            </p>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden flex">
            <div 
              className="h-full bg-blue-500 transition-all duration-1000" 
              style={{ width: `${data.assignment.auto_assignment_rate_percent || 0}%` }}
            />
            <div 
              className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-1000" 
              style={{ width: `${100 - (data.assignment.auto_assignment_rate_percent || 0)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Conflict Rate */}
        <div className="relative overflow-hidden bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-orange-500 to-red-600 opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Trùng lặp lịch
            </span>
            <div className={`p-2 rounded-xl ${
              data.conflict.conflict_rate_percent > 10 
                ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100/30' 
                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100/30'
            }`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {data.conflict.conflict_rate_percent || 0}%
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Trùng cứng: {data.conflict.blocking_conflicts} | Trùng nhẹ: {data.conflict.warning_conflicts}
            </p>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${data.conflict.conflict_rate_percent > 10 ? 'from-amber-500 to-red-500' : 'from-yellow-400 to-amber-500'} transition-all duration-1000`} 
              style={{ width: `${data.conflict.conflict_rate_percent || 0}%` }}
            />
          </div>
        </div>

        {/* Card 4: Capacity Full */}
        <div className="relative overflow-hidden bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500 to-indigo-600 opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Trạng thái Quá tải
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-100/30">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {data.capacity.capacity_full_rate_percent || 0}%
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Quá tải {data.capacity.capacity_full}/{data.capacity.total_checks} lần kiểm tra hệ thống
            </p>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000" 
              style={{ width: `${data.capacity.capacity_full_rate_percent || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Performance Breakdown */}
      <Card className="bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-500" />
            <div>
              <CardTitle className="text-lg font-bold">Hiệu năng xử lý (Execution Time)</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Thời gian xử lý trung bình của Decision Engine trong khoảng thời gian {dateRange === '24h' ? '24 Giờ qua' : dateRange === '7d' ? '7 Ngày qua' : '30 Ngày qua'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/40">
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Trung bình (Avg)</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-baseline gap-1">
                {data.performance.avg_execution_time_ms}
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">ms</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Trung vị (Median)</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-baseline gap-1">
                {data.performance.median_execution_time_ms}
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">ms</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mốc P95</div>
              <div className="text-2xl font-black text-orange-600 dark:text-orange-400 flex items-baseline gap-1">
                {data.performance.p95_execution_time_ms}
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">ms</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mốc P99</div>
              <div className="text-2xl font-black text-red-600 dark:text-red-400 flex items-baseline gap-1">
                {data.performance.p99_execution_time_ms}
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">ms</span>
              </div>
            </div>
          </div>

          {/* By Provider list */}
          {data.performance.by_provider && (
            <div className="mt-6 space-y-4">
              <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Phân tích chi tiết theo Engine Module</h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(data.performance.by_provider).map(([provider, stats]) => (
                  <div 
                    key={provider} 
                    className="flex flex-col justify-between border border-slate-100 dark:border-slate-800 p-4 rounded-xl hover:border-slate-200 dark:hover:border-slate-700 transition-all bg-white/20 dark:bg-slate-900/10 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-200 capitalize">
                          {provider.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {stats.count} lượt xử lý
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-slate-50/50 dark:bg-slate-950/20 text-slate-600 dark:text-slate-400 text-[10px] font-bold border-slate-200/50 dark:border-slate-800">
                        Active
                      </Badge>
                    </div>

                    <div className="flex justify-between items-end border-t border-slate-50 dark:border-slate-800/50 pt-3">
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Trung bình</div>
                        <div className="text-base font-extrabold text-slate-800 dark:text-slate-200">{stats.avg_ms} ms</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mốc P95</div>
                        <div className="text-sm font-extrabold text-orange-500 dark:text-orange-400">{stats.p95_ms} ms</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Conflict Types & Overrides Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Conflict Types */}
        {data.conflict.top_conflict_types && data.conflict.top_conflict_types.length > 0 ? (
          <Card className="bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden">
            <div>
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 pb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <div>
                    <CardTitle className="text-lg font-bold">Các xung đột lịch đặt</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Xung đột được phát hiện nhiều nhất khi quét lịch</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {data.conflict.top_conflict_types.map((conflict, index) => (
                  <div key={index} className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800/50 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800">
                          {index + 1}
                        </span>
                        <span className="capitalize">{conflict.type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 dark:text-slate-500">({conflict.count} lần)</span>
                        <span className="text-slate-900 dark:text-white font-extrabold">{conflict.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000" 
                        style={{ width: `${conflict.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </div>
          </Card>
        ) : (
          <Card className="bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-2xl shadow-sm flex items-center justify-center p-8 text-center">
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Không có xung đột lịch</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[250px] mx-auto">Hệ thống ghi nhận trạng thái vận hành ổn định không phát hiện trùng lặp.</p>
            </div>
          </Card>
        )}

        {/* Manager Overrides */}
        <Card className="bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <div>
                  <CardTitle className="text-lg font-bold">Lượt ghi đè quyền lực (Overrides)</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Số lần bỏ qua kiểm tra tự động do tác động thủ công</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className={`flex items-center justify-between p-4 rounded-xl ${theme.bgLight} border ${theme.border}`}>
                <div>
                  <div className={`text-xs font-semibold ${theme.text}`}>Tỷ lệ ghi đè thủ công</div>
                  <div className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
                    {data.overrides.override_rate_percent || 0}%
                  </div>
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${theme.gradient} text-white shadow-sm`}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Capacity Skip</div>
                  <div className="text-lg font-extrabold text-slate-800 dark:text-slate-200">{data.overrides.capacity_checks_skipped}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Conflict Skip</div>
                  <div className="text-lg font-extrabold text-slate-800 dark:text-slate-200">{data.overrides.conflict_checks_skipped}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Assign Skip</div>
                  <div className="text-lg font-extrabold text-slate-800 dark:text-slate-200">{data.overrides.assignments_skipped}</div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>

      {/* Additional Details Row */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Assignment Details */}
        <Card className="bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <div className="w-1.5 h-4 rounded-full bg-blue-500" />
              Chi tiết phân bổ {vocab.worker.short}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-400 dark:text-slate-500">Độ tin cậy TB (Confidence)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{data.assignment.avg_confidence || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-400 dark:text-slate-500">Thời gian TB (Average)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{data.assignment.avg_execution_time_ms} ms</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-400 dark:text-slate-500">Thời gian mốc P95</span>
              <span className="font-bold text-orange-500">{data.assignment.p95_execution_time_ms} ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 dark:text-slate-500">Thời gian mốc P99</span>
              <span className="font-bold text-red-500">{data.assignment.p99_execution_time_ms} ms</span>
            </div>
          </CardContent>
        </Card>

        {/* Conflict Details */}
        <Card className="bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <div className="w-1.5 h-4 rounded-full bg-amber-500" />
              Chi tiết kiểm tra xung đột
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-400 dark:text-slate-500">Tổng số lượt kiểm tra</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{data.conflict.total_checks}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-400 dark:text-slate-500">Xung đột được phát hiện</span>
              <span className="font-bold text-amber-500">{data.conflict.conflicts_detected}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-400 dark:text-slate-500">Tỷ lệ chặn xung đột</span>
              <span className="font-bold text-red-500">{data.conflict.blocking_rate_percent}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 dark:text-slate-500">Thời gian TB (Average)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{data.conflict.avg_execution_time_ms} ms</span>
            </div>
          </CardContent>
        </Card>

        {/* Capacity Details */}
        <Card className="bg-white/60 dark:bg-[#1c1b19]/60 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <div className="w-1.5 h-4 rounded-full bg-purple-500" />
              Chi tiết kiểm tra sức chứa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-400 dark:text-slate-500">Hiệu suất sử dụng (Avg Util)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{data.capacity.avg_utilization_percent || 'N/A'}%</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-400 dark:text-slate-500">Vùng đệm sử dụng (Avg Buffer)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{data.capacity.avg_buffer_used_percent || 'N/A'}%</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-400 dark:text-slate-500">Sức chứa khả dụng</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{data.capacity.capacity_available}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 dark:text-slate-500">Thời gian TB (Average)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{data.capacity.avg_execution_time_ms} ms</span>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
