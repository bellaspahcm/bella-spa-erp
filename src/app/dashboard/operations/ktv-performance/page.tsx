'use client';

/**
 * KTV Performance Dashboard - Operations Manager Intelligence
 * 
 * Operational metrics for KTV management:
 * 1. KTV Leaderboard (Top performers ranked by revenue/sessions/rating)
 * 2. Individual KTV Detail Panel (Sessions, ratings, revenue, attendance)
 * 3. Performance Trends (Weekly/monthly comparisons)
 * 4. Attendance Summary
 * 
 * Data flows through Operational Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Star,
  Users, 
  Activity, 
  BarChart3,
  Calendar,
  RefreshCw,
  AlertCircle,
  Award,
  DollarSign,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface KtvLeaderboardEntry {
  rank: number;
  ktvId: string;
  ktvName: string;
  metricValue: number;
  totalSessionsCompleted: number;
  avgRating: number;
  totalRevenue: number;
  attendanceRatePct: number;
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
type LeaderboardMetric = 'revenue' | 'sessions' | 'rating';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function KtvPerformanceDashboardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [metric, setMetric] = useState<LeaderboardMetric>('revenue');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedKtvId, setSelectedKtvId] = useState<string | null>(null);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<IntelligenceResponse<KtvLeaderboardEntry[]> | null>(null);

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
  // Fetch leaderboard
  // ───────────────────────────────────────────────────────────────────────────

  const fetchLeaderboard = async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ 
        tenantId, 
        period, 
        metric,
        limit: '10'
      });

      const response = await fetch(`/api/intelligence/operational/ktv-leaderboard?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setLeaderboard(data);
      
      if (refresh) {
        toast.success('Đã làm mới dữ liệu');
      }
    } catch (error) {
      console.error('Failed to fetch KTV leaderboard:', error);
      toast.error('Không thể tải dữ liệu KTV');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchLeaderboard();
    }
  }, [tenantId, period, metric]);

  // ───────────────────────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    fetchLeaderboard(true);
  };

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
  };

  const handleMetricChange = (newMetric: LeaderboardMetric) => {
    setMetric(newMetric);
  };

  const handleKtvClick = (ktvId: string) => {
    setSelectedKtvId(selectedKtvId === ktvId ? null : ktvId);
  };

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

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-amber-500 text-white';
    if (rank === 2) return 'bg-gray-400 text-white';
    if (rank === 3) return 'bg-orange-600 text-white';
    return 'bg-slate-200 text-slate-700';
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return <Award className="h-4 w-4" />;
    return null;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render Loading State
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-slate-600">Đang tải dữ liệu KTV...</p>
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
        <h1 className="text-3xl font-bold text-slate-900">Bảng Xếp Hạng KTV</h1>
        <p className="mt-2 text-slate-600">
          Top 10 KTV hàng đầu theo doanh thu, số ca, hoặc đánh giá
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

        {/* Metric Selector */}
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">Xếp hạng theo:</span>
          <div className="flex gap-2">
            {(['revenue', 'sessions', 'rating'] as LeaderboardMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => handleMetricChange(m)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  metric === m
                    ? 'bg-primary text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {m === 'revenue' && 'Doanh thu'}
                {m === 'sessions' && 'Số ca'}
                {m === 'rating' && 'Đánh giá'}
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
      {leaderboard?.metadata && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">
          <AlertCircle className="h-4 w-4" />
          <span>
            {leaderboard.metadata.cacheHit ? '✓ Dữ liệu từ cache' : '⚡ Dữ liệu mới'}
            {' • '}
            Thời gian truy vấn: {leaderboard.metadata.queryTimeMs}ms
          </span>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                  Hạng
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                  Tên KTV
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Số ca
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Đánh giá TB
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Doanh thu
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Điểm danh
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  {metric === 'revenue' && 'Doanh thu'}
                  {metric === 'sessions' && 'Số ca'}
                  {metric === 'rating' && 'Đánh giá'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leaderboard?.data.map((ktv) => (
                <motion.tr
                  key={ktv.ktvId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => handleKtvClick(ktv.ktvId)}
                  className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                    selectedKtvId === ktv.ktvId ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* Rank */}
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${getRankBadgeColor(ktv.rank)}`}>
                      {getRankIcon(ktv.rank)}
                      #{ktv.rank}
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {ktv.ktvName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{ktv.ktvName}</div>
                      </div>
                    </div>
                  </td>

                  {/* Sessions */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Activity className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-900">
                        {formatNumber(ktv.totalSessionsCompleted)}
                      </span>
                    </div>
                  </td>

                  {/* Rating */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.round(ktv.avgRating)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-medium text-slate-900">
                        {formatNumber(ktv.avgRating, 1)}
                      </span>
                    </div>
                  </td>

                  {/* Revenue */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <DollarSign className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-900">
                        {formatCurrency(ktv.totalRevenue)}
                      </span>
                    </div>
                  </td>

                  {/* Attendance */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-slate-900">
                        {formatNumber(ktv.attendanceRatePct, 0)}%
                      </span>
                    </div>
                  </td>

                  {/* Metric Value */}
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-primary">
                      {metric === 'revenue' && formatCurrency(ktv.metricValue)}
                      {metric === 'sessions' && formatNumber(ktv.metricValue)}
                      {metric === 'rating' && formatNumber(ktv.metricValue, 1)}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {leaderboard && leaderboard.data.length === 0 && (
          <div className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-4 text-slate-600">Không có dữ liệu KTV</p>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {leaderboard && leaderboard.data.length > 0 && (
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {/* Top Performer */}
          <div className="rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8" />
              <div>
                <p className="text-sm font-medium opacity-90">KTV Xuất Sắc Nhất</p>
                <p className="text-2xl font-bold">{leaderboard.data[0].ktvName}</p>
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {metric === 'revenue' && formatCurrency(leaderboard.data[0].metricValue)}
                {metric === 'sessions' && `${formatNumber(leaderboard.data[0].metricValue)} ca`}
                {metric === 'rating' && `${formatNumber(leaderboard.data[0].metricValue, 1)} ⭐`}
              </span>
            </div>
          </div>

          {/* Average Performance */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-slate-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Trung Bình</p>
                <p className="text-2xl font-bold text-slate-900">
                  {metric === 'revenue' && formatCurrency(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0) / leaderboard.data.length
                  )}
                  {metric === 'sessions' && `${formatNumber(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0) / leaderboard.data.length
                  )} ca`}
                  {metric === 'rating' && `${formatNumber(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0) / leaderboard.data.length, 1
                  )} ⭐`}
                </p>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Tổng Cộng</p>
                <p className="text-2xl font-bold text-slate-900">
                  {metric === 'revenue' && formatCurrency(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0)
                  )}
                  {metric === 'sessions' && `${formatNumber(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0)
                  )} ca`}
                  {metric === 'rating' && `${leaderboard.data.length} KTV`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
