'use client';

/**
 * Attendance & Payroll Dashboard
 * 
 * Comprehensive HR attendance and payroll analysis showing:
 * 1. Attendance rates and on-time metrics by KTV
 * 2. Salary breakdown and top earners
 * 3. Bonus distribution and deductions
 * 4. KTV performance leaderboard
 * 
 * Data flows through HR Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Award,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Users,
  BarChart3,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { 
  AttendanceReport, 
  PayrollSummary 
} from '@/services/intelligence/hr/queries';
import {
  AttendanceRateChart,
  SalaryDistributionChart,
  TopEarnersChart,
} from '@/components/intelligence/hr';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'attendance' | 'payroll' | 'combined';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function AttendancePayrollDashboard() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Response states
  const [attendanceData, setAttendanceData] = useState<IntelligenceResponse<AttendanceReport[]> | null>(null);
  const [payrollData, setPayrollData] = useState<IntelligenceResponse<PayrollSummary[]> | null>(null);

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
      const baseUrl = `/api/intelligence/hr`;
      
      // Convert month (YYYY-MM) to date range for custom period
      const startDate = `${month}-01`;
      const lastDay = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
      
      const attendanceParams = new URLSearchParams({ 
        tenantId,
        period: 'custom',
        startDate,
        endDate
      });
      const payrollParams = new URLSearchParams({ 
        tenantId, 
        month 
      });

      const [attendance, payroll] = await Promise.all([
        fetch(`${baseUrl}/attendance-report?${attendanceParams}`).then(r => r.json()),
        fetch(`${baseUrl}/payroll-summary?${payrollParams}`).then(r => r.json()),
      ]);

      // Check for errors
      if (attendance.error) throw new Error(attendance.error);
      if (payroll.error) throw new Error(payroll.error);

      setAttendanceData(attendance);
      setPayrollData(payroll);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch attendance/payroll metrics:', error);
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
  }, [tenantId, month]);

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

  const formatPercent = (value: number, decimals = 1) => {
    return `${formatNumber(value, decimals)}%`;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Calculate aggregate metrics
  // ───────────────────────────────────────────────────────────────────────────

  const getAggregateAttendance = () => {
    if (!attendanceData || !attendanceData.data || attendanceData.data.length === 0) {
      return {
        avgAttendanceRate: 0,
        avgOnTimeRate: 0,
        totalAbsences: 0,
        totalLate: 0,
      };
    }

    const total = attendanceData.data.length;
    return {
      avgAttendanceRate: attendanceData.data.reduce((sum, ktv) => sum + ktv.attendanceRatePct, 0) / total,
      avgOnTimeRate: attendanceData.data.reduce((sum, ktv) => sum + ktv.onTimeRatePct, 0) / total,
      totalAbsences: attendanceData.data.reduce((sum, ktv) => sum + ktv.daysAbsent, 0),
      totalLate: attendanceData.data.reduce((sum, ktv) => sum + ktv.daysLate, 0),
    };
  };

  const getAggregatePayroll = () => {
    if (!payrollData || !payrollData.data || payrollData.data.length === 0) {
      return {
        totalSalary: 0,
        totalBonus: 0,
        totalDeductions: 0,
        avgSalary: 0,
        ktvCount: 0,
      };
    }

    const data = payrollData.data;
    const totalSalary = data.reduce((sum, ktv) => sum + ktv.totalSalary, 0);
    const totalBonus = data.reduce((sum, ktv) => sum + ktv.sessionBonus + ktv.kpiBonus + ktv.ratingBonus, 0);
    const totalDeductions = data.reduce((sum, ktv) => sum + ktv.violationsDeduction, 0);

    return {
      totalSalary,
      totalBonus,
      totalDeductions,
      avgSalary: totalSalary / data.length,
      ktvCount: data.length,
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Generate chart data
  // ───────────────────────────────────────────────────────────────────────────

  const getAttendanceRateData = () => {
    if (!attendanceData || !attendanceData.data) return [];

    return attendanceData.data
      .sort((a, b) => b.attendanceRatePct - a.attendanceRatePct)
      .slice(0, 10)
      .map(ktv => ({
        name: ktv.ktvName,
        attendanceRate: ktv.attendanceRatePct,
        onTimeRate: ktv.onTimeRatePct,
      }));
  };

  const getTopEarnersData = () => {
    if (!payrollData || !payrollData.data) return [];

    return payrollData.data
      .sort((a, b) => b.totalSalary - a.totalSalary)
      .slice(0, 10)
      .map(ktv => ({
        name: ktv.ktvName,
        baseSalary: ktv.baseSalary,
        bonus: ktv.sessionBonus + ktv.kpiBonus + ktv.ratingBonus,
        totalSalary: ktv.totalSalary,
      }));
  };

  const getSalaryDistributionData = () => {
    if (!payrollData || !payrollData.data) return [];

    const aggregates = getAggregatePayroll();
    
    return [
      { component: 'Lương cơ bản', amount: payrollData.data.reduce((sum, ktv) => sum + ktv.baseSalary, 0), color: '#3b82f6' },
      { component: 'Thưởng ca', amount: payrollData.data.reduce((sum, ktv) => sum + ktv.sessionBonus, 0), color: '#10b981' },
      { component: 'Thưởng KPI', amount: payrollData.data.reduce((sum, ktv) => sum + ktv.kpiBonus, 0), color: '#f59e0b' },
      { component: 'Thưởng sao', amount: payrollData.data.reduce((sum, ktv) => sum + ktv.ratingBonus, 0), color: '#8b5cf6' },
      { component: 'Trừ vi phạm', amount: -payrollData.data.reduce((sum, ktv) => sum + ktv.violationsDeduction, 0), color: '#ef4444' },
    ].filter(item => Math.abs(item.amount) > 0);
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

  const attendanceMetrics = getAggregateAttendance();
  const payrollMetrics = getAggregatePayroll();

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Chấm Công & Lương</h1>
          <p className="text-slate-600 mt-1">Theo dõi chấm công, tính lương và hiệu suất KTV</p>
        </div>

        <div className="flex items-center gap-4">
          {/* View Mode Selector */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('attendance')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'attendance'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chấm công
            </button>
            <button
              onClick={() => setViewMode('payroll')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'payroll'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lương
            </button>
            <button
              onClick={() => setViewMode('combined')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'combined'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tổng hợp
            </button>
          </div>

          {/* Month Selector */}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* Leave Requests Link */}
          <Link
            href="/dashboard/hr/leave-requests"
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 font-medium transition-all shadow-xs"
          >
            <CalendarDays className="h-4 w-4" />
            Duyệt nghỉ phép
          </Link>

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

      {/* Key Metrics Cards */}
      {(viewMode === 'combined' || viewMode === 'attendance') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Attendance Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tỷ Lệ Đi Làm TB</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {formatPercent(attendanceMetrics.avgAttendanceRate)}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  {payrollMetrics.ktvCount} KTV
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </motion.div>

          {/* On-Time Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tỷ Lệ Đúng Giờ TB</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {formatPercent(attendanceMetrics.avgOnTimeRate)}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  {attendanceMetrics.totalLate} lượt muộn
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </motion.div>

          {/* Total Absences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tổng Ngày Nghỉ</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {formatNumber(attendanceMetrics.totalAbsences)}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  ngày trong tháng
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </motion.div>

          {/* Average Salary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Lương TB/KTV</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {formatCurrency(payrollMetrics.avgSalary)}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Tổng: {formatCurrency(payrollMetrics.totalSalary)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Top 10 Attendance Performance */}
        {(viewMode === 'combined' || viewMode === 'attendance') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Top 10 Chấm Công Tốt Nhất</h3>
              </div>
              {attendanceData?.metadata.cacheHit && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
              )}
            </div>

            {attendanceData && attendanceData.data.length > 0 ? (
              <AttendanceRateChart data={getAttendanceRateData()} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Chart 2: Top 10 Earners */}
        {(viewMode === 'combined' || viewMode === 'payroll') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Award className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Top 10 Thu Nhập Cao Nhất</h3>
              </div>
              {payrollData?.metadata.cacheHit && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
              )}
            </div>

            {payrollData && payrollData.data.length > 0 ? (
              <TopEarnersChart data={payrollData.data} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Chart 3: Salary Distribution */}
        {(viewMode === 'combined' || viewMode === 'payroll') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Phân Bổ Quỹ Lương</h3>
              </div>
            </div>

            {payrollData && payrollData.data.length > 0 ? (
              <>
                <SalaryDistributionChart data={payrollData.data} />
                
                {/* Summary Table */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Lương cơ bản</p>
                    <p className="text-lg font-bold text-blue-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.baseSalary, 0))}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Thưởng ca</p>
                    <p className="text-lg font-bold text-green-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.sessionBonus, 0))}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-600 font-medium">Thưởng KPI</p>
                    <p className="text-lg font-bold text-amber-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.kpiBonus, 0))}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">Thưởng sao</p>
                    <p className="text-lg font-bold text-purple-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.ratingBonus, 0))}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">Trừ vi phạm</p>
                    <p className="text-lg font-bold text-red-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.violationsDeduction, 0))}
                    </p>
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
        )}
      </div>

      {/* Cache Info Footer */}
      {attendanceData && payrollData && (
        <div className="text-center text-sm text-slate-500">
          <p>
            Dữ liệu được tạo lúc {new Date(attendanceData.metadata.generatedAt).toLocaleTimeString('vi-VN')}
            {' '}(Chấm công: {attendanceData.metadata.cacheHit ? 'Cache' : 'Mới'}, 
            {' '}Lương: {payrollData.metadata.cacheHit ? 'Cache' : 'Mới'})
          </p>
        </div>
      )}
    </div>
  );
}

// Wrap with ErrorBoundary to prevent full page crashes
export default function AttendancePayrollDashboardWrapper() {
  return (
    <ErrorBoundary>
      <AttendancePayrollDashboard />
    </ErrorBoundary>
  );
}
