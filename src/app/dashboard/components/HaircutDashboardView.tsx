'use client';

import { KtvPerformanceTable } from '@/components/features/dashboard/KtvPerformanceTable';
import { RevenueChart } from '@/components/features/dashboard/RevenueChart';
import AdminNotificationBell from '@/components/common/AdminNotificationBell';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { getTenantModulePresentationOrNeutral } from '@/lib/business-rules/tenant-module-presentation';
import { createClient } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';
import {
  getDashboardPrimaryData,
  getDashboardSecondaryData,
  getImportantAlerts
} from '@/core/services/analytics/dashboard-actions';
import type {
  DashboardStatsViewModel,
  DashboardSessionViewModel,
  KtvPerformanceViewModel,
  PerformanceDataPointViewModel,
  InventorySummaryViewModel,
  DashboardAlert
} from '@/core/services/analytics/dashboard-actions';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  Package,
  Search,
  Sparkles as SparklesIcon,
  TrendingUp,
  User,
  X
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';

const BookingModal = dynamic(
  () => import('@/components/features/BookingModal').then(m => ({ default: m.BookingModal })),
  { ssr: false }
);
const OnboardingTour = dynamic(
  () => import('@/components/features/dashboard/OnboardingTour'),
  { ssr: false }
);

interface StatCardViewModel {
  label: string;
  value: string;
  trend: number;
  subtitle?: string;
  iconName: 'Users' | 'Calendar' | 'DollarSign' | 'Star';
  color: string;
  bg: string;
}

export function HaircutDashboardView() {
  const router = useRouter();
  const { tenantModuleKey, isTenantModuleLoading } = useTenantModuleKey({ forceFresh: true });
  const [stats, setStats] = useState<StatCardViewModel[]>([]);
  const [sessions, setSessions] = useState<DashboardSessionViewModel[]>([]);
  const [topKTVs, setTopKTVs] = useState<KtvPerformanceViewModel[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'in_progress' | 'completed'>('all');
  const [performanceData, setPerformanceData] = useState<PerformanceDataPointViewModel[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummaryViewModel>({ totalItems: 0, lowStockCount: 0, totalValue: 0 });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isAllNotificationsOpen, setIsAllNotificationsOpen] = useState(false);
  const [notifSearch, setNotifSearch] = useState('');
  const [notifTab, setNotifTab] = useState('all');
  const [userRole, setUserRole] = useState<'admin' | 'ktv' | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const dashboardRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboardAlertsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerLabels = getTenantModulePresentationOrNeutral(tenantModuleKey);
  const vocab = useModuleVocabulary();
  const { user: profile, product } = useUser();

  const businessLabel = product?.displayName ?? 'Bella Haircut Shop';

  const greetingText = !product || userRole === null
    ? 'Chào buổi sáng!'
    : userRole === 'admin'
      ? `Chào buổi sáng, ${businessLabel} admin!`
      : `Chào buổi sáng, ${businessLabel} ${vocab.worker.short}!`;

  useEffect(() => {
    if (isTenantModuleLoading) return;
    if (!profile) return;
    setTenantId(profile.tenant_id || null);
    const role = profile.role?.toLowerCase();
    if (role === 'ktv') {
      router.replace('/ktv/dashboard');
      return;
    }
    setUserRole(role === 'admin' ? 'admin' : 'ktv');
  }, [profile, router, isTenantModuleLoading]);

  const getMonthRange = (month: number, year: number) => {
    const startMonth = String(month + 1).padStart(2, '0');
    const startDate = `${year}-${startMonth}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${startMonth}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  };

  const buildDashboardStats = useCallback((statsData: Awaited<ReturnType<typeof getDashboardPrimaryData>>['statsData']): StatCardViewModel[] => {
    const custTrend = Number(statsData.totalCustomers?.trend || 0);
    const bookTrend = Number(statsData.todayBookings?.trend || 0);
    const revTrend = Number(statsData.totalRevenue?.trend || 0);
    const rateTrend = Number(statsData.avgRating?.trend || 0);

    return [
      {
        label: 'Tổng khách hàng',
        value: String(statsData.totalCustomers?.value ?? '0'),
        trend: custTrend,
        subtitle: custTrend !== 0 ? `${custTrend >= 0 ? '+' : ''}${custTrend}% so với tháng trước` : 'Tổng số khách hàng',
        iconName: 'Users' as const,
        color: 'text-blue-600',
        bg: 'bg-blue-50'
      },
      {
        label: 'Lịch hẹn hôm nay',
        value: String(statsData.todayBookings?.value ?? '0'),
        trend: bookTrend,
        subtitle: bookTrend !== 0 ? `${bookTrend >= 0 ? '+' : ''}${bookTrend}% so với hôm qua` : 'Lịch hẹn trong ngày',
        iconName: 'Calendar' as const,
        color: 'text-rose-600',
        bg: 'bg-rose-50'
      },
      ...(userRole === 'admin' ? [{
        label: 'Doanh thu tháng',
        value: String(statsData.totalRevenue?.value ?? '0M'),
        trend: revTrend,
        subtitle: revTrend !== 0 ? `${revTrend >= 0 ? '+' : ''}${revTrend}% so với tháng trước` : 'Doanh thu trong tháng',
        iconName: 'DollarSign' as const,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50'
      }] : []),
      {
        label: `Đánh giá ${vocab.worker.short}`,
        value: String(statsData.avgRating?.value ?? '—'),
        trend: rateTrend,
        subtitle: 'Đánh giá trung bình KTV',
        iconName: 'Star' as const,
        color: 'text-amber-600',
        bg: 'bg-amber-50'
      },
    ];
  }, [userRole, vocab.worker.short]);

  const fetchPrimaryData = useCallback(async () => {
    if (isTenantModuleLoading || userRole === null || !tenantId) return;

    setIsRefreshing(true);
    try {
      const { startDate, endDate } = getMonthRange(selectedMonth, selectedYear);
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const { statsData, sessionsData, inventorySummary: nextInventorySummary } =
        await getDashboardPrimaryData(startDate, endDate, localToday);

      setStats(buildDashboardStats(statsData));
      setSessions(sessionsData || []);
      setInventorySummary(nextInventorySummary || { totalItems: 0, lowStockCount: 0, totalValue: 0 });
    } catch (error) {
      console.error('Error fetching dashboard primary data:', error);
      toast.error('Lỗi cập nhật dữ liệu');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [buildDashboardStats, selectedMonth, selectedYear, tenantId, userRole, isTenantModuleLoading]);

  const fetchSecondaryData = useCallback(async () => {
    if (isTenantModuleLoading || userRole === null || !tenantId) return;

    setIsSecondaryLoading(true);
    try {
      const { ktvsData, alertsData, perfData } = await getDashboardSecondaryData();
      setTopKTVs((ktvsData || []).map((ktv) => ({
        ...ktv,
        rating: Number(ktv.rating) || 0,
      })));
      setPerformanceData(perfData || []);
      setAlerts(alertsData || []);
    } catch (error) {
      console.error('Error fetching dashboard secondary data:', error);
      toast.error('Không thể tải dữ liệu phân tích dashboard');
    } finally {
      setIsSecondaryLoading(false);
    }
  }, [tenantId, userRole, isTenantModuleLoading]);

  const fetchAlertsData = useCallback(async () => {
    if (isTenantModuleLoading || userRole === null || !tenantId) return;

    try {
      const alertsData = await getImportantAlerts();
      setAlerts(alertsData || []);
    } catch (error) {
      console.error('Error fetching dashboard alerts:', error);
    }
  }, [tenantId, userRole, isTenantModuleLoading]);

  const fetchData = useCallback(async () => {
    setIsSecondaryLoading(true);
    await Promise.all([fetchPrimaryData(), fetchSecondaryData()]);
  }, [fetchPrimaryData, fetchSecondaryData]);

  usePageRefresh(fetchData);

  useEffect(() => {
    if (isTenantModuleLoading) return;
    void fetchPrimaryData();
    const t = setTimeout(() => { void fetchSecondaryData(); }, 200);
    return () => clearTimeout(t);
  }, [tenantId, isTenantModuleLoading, fetchPrimaryData, fetchSecondaryData]);

  const scheduleDashboardRefresh = useCallback(() => {
    if (dashboardRefreshTimerRef.current) {
      clearTimeout(dashboardRefreshTimerRef.current);
    }

    dashboardRefreshTimerRef.current = setTimeout(() => {
      dashboardRefreshTimerRef.current = null;
      void Promise.all([fetchPrimaryData(), fetchSecondaryData()]);
    }, 500);
  }, [fetchPrimaryData, fetchSecondaryData]);

  const scheduleDashboardAlertsRefresh = useCallback(() => {
    if (dashboardAlertsRefreshTimerRef.current) {
      clearTimeout(dashboardAlertsRefreshTimerRef.current);
    }

    dashboardAlertsRefreshTimerRef.current = setTimeout(() => {
      dashboardAlertsRefreshTimerRef.current = null;
      void fetchAlertsData();
    }, 500);
  }, [fetchAlertsData]);

  useEffect(() => {
    if (isTenantModuleLoading) return;
    const supabase = createClient();
    const channel = supabase
      .channel('dashboard-realtime-haircut')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => scheduleDashboardRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => scheduleDashboardRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue' }, () => scheduleDashboardRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_reviews' }, () => scheduleDashboardRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, () => scheduleDashboardAlertsRefresh())
      .subscribe();

    return () => {
      if (dashboardRefreshTimerRef.current) clearTimeout(dashboardRefreshTimerRef.current);
      if (dashboardAlertsRefreshTimerRef.current) clearTimeout(dashboardAlertsRefreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [scheduleDashboardAlertsRefresh, scheduleDashboardRefresh, isTenantModuleLoading]);

  // Compute tab counts from real DB sessions
  const allCount = sessions.length;
  const upcomingCount = sessions.filter(s => s.status !== 'completed' && s.status !== 'in_progress').length;
  const inProgressCount = sessions.filter(s => s.status === 'in_progress').length;
  const completedCount = sessions.filter(s => s.status === 'completed').length;

  const filteredSessions = sessions.filter(session => {
    const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
    const customerName = booking?.customers?.name_mother || '';
    const packageName = booking?.package_name || booking?.packages?.name || '';

    const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         packageName.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesTab = true;
    if (activeTab === 'upcoming') {
      matchesTab = session.status !== 'completed' && session.status !== 'in_progress';
    } else if (activeTab === 'in_progress') {
      matchesTab = session.status === 'in_progress';
    } else if (activeTab === 'completed') {
      matchesTab = session.status === 'completed';
    }

    return matchesTab && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-auto bg-[#F4F5F7] dark:bg-slate-950 p-6 md:p-8 min-h-screen relative">
      {/* VIEWPORT SALON INTERIOR BACKGROUND - FULL WIDTH & EXPANDED HEIGHT */}
      <div 
        className="absolute top-0 left-0 right-0 w-full h-[440px] md:h-[500px] bg-cover bg-center md:bg-top bg-no-repeat pointer-events-none opacity-90 dark:opacity-40 z-0"
        style={{ backgroundImage: "url('/images/haircut_header.webp')" }}
      />
      <div className="absolute top-0 left-0 right-0 h-[440px] md:h-[500px] bg-gradient-to-b from-white/10 via-[#F4F5F7]/40 to-[#F4F5F7] dark:from-transparent dark:via-slate-950/70 dark:to-slate-950 pointer-events-none z-0" />

      <AnimatePresence>
        {isRefreshing && (
          <motion.div 
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-400 to-primary origin-left z-[100]"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* MAIN CONTENT WRAPPER */}
      <div className="relative z-10">
        {/* TOP ROW: Greeting & Header Controls */}
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-16 md:mb-24 gap-6 relative">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif text-slate-900 dark:text-white tracking-tight">
              {greetingText}
            </h1>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">
              Hôm nay là một ngày tuyệt vời để tạo nên những kiểu tóc ấn tượng ✨
            </p>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 italic mt-0.5">
              “Khách hàng hạnh phúc là thành công lớn nhất của chúng ta.”
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center flex-wrap gap-3">
              {/* Month Dropdown */}
              <div className="flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-xs text-sm font-semibold text-slate-700 dark:text-slate-200 gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <select 
                  value={selectedMonth.toString()} 
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="bg-transparent outline-none cursor-pointer font-bold"
                >
                  {['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'].map((m, i) => (
                    <option key={i} value={i.toString()}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Year Dropdown */}
              <div className="flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-xs text-sm font-semibold text-slate-700 dark:text-slate-200 gap-2">
                <select 
                  value={selectedYear.toString()} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-transparent outline-none cursor-pointer font-bold"
                >
                  {[2024, 2025, 2026].map(y => (
                    <option key={y} value={y.toString()}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Quick Search Input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm khách hàng, lịch hẹn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary w-64 shadow-xs"
                />
              </div>

              {/* Admin Notification Bell */}
              <AdminNotificationBell position="bottom" className="shrink-0" />
            </div>

            {/* Cursive "Style Your Day" watermark text under controls */}
            <div className="hidden lg:block select-none mt-1 mr-2">
              <span className="font-serif italic text-3xl md:text-4xl text-slate-700/80 dark:text-white/80 font-light tracking-wide">
                Style Your Day
              </span>
            </div>
          </div>
        </div>

        {/* ROW 1: 4 STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex items-start gap-4 animate-pulse">
                <SkeletonLoader variant="circular" width={48} height={48} className="shrink-0" />
                <div className="flex-1 space-y-2">
                  <SkeletonLoader variant="text" width={100} height={12} />
                  <SkeletonLoader variant="text" width={120} height={28} />
                  <SkeletonLoader variant="text" width={140} height={12} />
                </div>
              </div>
            ))
          ) : (
            stats.map((stat, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex items-start gap-4 relative">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 shadow-md",
                  stat.iconName === 'Star' ? 'bg-amber-500' : 'bg-primary'
                )}>
                  {stat.iconName === 'Users' && <User className="w-6 h-6" />}
                  {stat.iconName === 'Calendar' && <Calendar className="w-6 h-6" />}
                  {stat.iconName === 'DollarSign' && <TrendingUp className="w-6 h-6" />}
                  {stat.iconName === 'Star' && <SparklesIcon className="w-6 h-6 fill-white text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    {stat.iconName === 'Star' && <ChevronRight className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600" />}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stat.value}</h2>
                    {stat.trend !== 0 && (
                      <span className={cn(
                        "inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full",
                        stat.trend >= 0 ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400" : "text-rose-700 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-400"
                      )}>
                        {stat.trend >= 0 ? '↗' : '↘'} {Math.abs(stat.trend)}%
                      </span>
                    )}
                  </div>
                  {stat.subtitle && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">{stat.subtitle}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ROW 2: 3-COLUMN BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          {/* COLUMN 1 (5 cols): Lịch hẹn hôm nay */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Lịch hẹn hôm nay</h2>
              </div>
              <Link href="/dashboard/bookings" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'Tất cả', count: allCount },
                { id: 'upcoming', label: 'Sắp tới', count: upcomingCount },
                { id: 'in_progress', label: 'Đang phục vụ', count: inProgressCount },
                { id: 'completed', label: 'Đã xong', count: completedCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px]",
                    activeTab === tab.id ? "bg-white/20 text-white" : "text-slate-400"
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* List of appointments */}
            <div className="space-y-4 flex-1">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 animate-pulse">
                    <div className="flex items-center gap-3">
                      <SkeletonLoader variant="text" width={40} height={14} />
                      <SkeletonLoader variant="circular" width={8} height={8} />
                      <SkeletonLoader variant="circular" width={36} height={36} />
                      <div className="space-y-1">
                        <SkeletonLoader variant="text" width={120} height={14} />
                        <SkeletonLoader variant="text" width={80} height={12} />
                      </div>
                    </div>
                    <SkeletonLoader variant="rectangular" width={80} height={28} className="rounded-xl" />
                  </div>
                ))
              ) : filteredSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-bold text-sm">Không có lịch hẹn nào</p>
                  <p className="text-xs mt-1">Vui lòng chọn bộ lọc khác hoặc tạo lịch hẹn mới</p>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
                  const customerName = booking?.customers?.name_mother || customerLabels.customerPrefix;
                  const serviceName = booking?.package_name || booking?.packages?.name || 'Cắt tóc nam';
                  const technicianName = booking?.assigned_ktv?.full_name || 'Chưa phân công';
                  const timeStr = session.assigned_time || booking?.preferred_time || 'Chưa xếp';

                  const isDone = session.status === 'completed';
                  const isInProgress = session.status === 'in_progress';
                  const statusColor = isDone ? 'bg-emerald-500' : isInProgress ? 'bg-emerald-500' : 'bg-blue-500';

                  return (
                    <div key={session.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white min-w-[42px]">{timeStr}</span>
                        <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs shrink-0">
                          {customerName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{customerName}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{serviceName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                            {technicianName.charAt(0)}
                          </div>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{technicianName}</span>
                        </div>
                        <Link href={`/dashboard/customers/${booking?.customers?.id}?bookingId=${booking?.id}`} className="p-1 text-slate-400 hover:text-slate-600">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 2 (4 cols): Revenue 7-Day & Top KTV */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <RevenueChart performanceData={performanceData} userRole={userRole} isLoading={isSecondaryLoading} />
            <KtvPerformanceTable topKTVs={topKTVs} isLoading={isSecondaryLoading} />
          </div>

          {/* COLUMN 3 (3 cols): Promo Banner, Alerts & Inventory */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* Card 1: Promo Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-[#141210] p-6 text-white shadow-md border border-slate-800/80 min-h-[210px] flex flex-col justify-between group">
              <div 
                className="absolute inset-0 w-full h-full bg-cover bg-center md:bg-right transition-transform duration-700 group-hover:scale-105 pointer-events-none z-0"
                style={{ backgroundImage: "url('/images/haircut_banner.png')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#141210]/95 via-[#141210]/80 to-transparent z-0 pointer-events-none" />

              <div className="relative z-10">
                <h3 className="text-2xl md:text-3xl font-serif text-white tracking-tight leading-snug drop-shadow-md">
                  <span className="block text-white font-serif">Tóc đẹp</span>
                  <span className="block text-white/95 font-serif">Cuộc sống đẹp hơn</span>
                </h3>
                <p className="text-[11px] font-bold text-[#D4AF37] tracking-[0.2em] uppercase mt-2.5 drop-shadow-sm">
                  BELLA HAIRCUT SHOP
                </p>
              </div>

              <button 
                onClick={() => setIsBookingModalOpen(true)}
                className="relative z-10 self-start px-6 py-2.5 bg-gradient-to-r from-[#EFE3C3] via-[#E4D1AC] to-[#CBB48A] hover:from-[#f5ebd7] hover:to-[#dfcaa4] rounded-full text-xs font-black uppercase tracking-wider text-[#1c1917] shadow-lg active:scale-95 flex items-center gap-2 transition-all mt-4"
              >
                <span>TẠO LỊCH NGAY</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#1c1917]" />
              </button>
            </div>

            {/* Card 2: Cảnh báo & cần chú ý */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cảnh báo & cần chú ý <span className="text-rose-500 font-extrabold">({alerts.length})</span>
                  </h3>
                </div>
                {alerts.length > 0 && (
                  <button onClick={() => setIsAllNotificationsOpen(true)} className="text-[10px] font-bold text-primary hover:underline">
                    Xem tất cả
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {isSecondaryLoading ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                  ))
                ) : alerts.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                    Không có cảnh báo mới
                  </div>
                ) : (
                  alerts.slice(0, 4).map((alert, idx) => (
                    <div
                      key={idx}
                      onClick={() => alert.link && router.push(alert.link)}
                      className="flex items-start gap-3 text-xs p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                    >
                      <span className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        alert.type === 'warning' ? "bg-amber-500" :
                        alert.type === 'danger' ? "bg-rose-500" : "bg-blue-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{alert.title}</p>
                        <p className="text-slate-400 text-[11px] truncate mt-0.5">{alert.message}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card 3: Vật tư & Tồn kho */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Vật tư & Tồn kho</h3>
                </div>
                <Link href="/dashboard/inventory" className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5">
                  Xem chi tiết <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl text-center border border-rose-100 dark:border-rose-900">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-1 text-xs font-bold">
                    {inventorySummary.lowStockCount}
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Sản phẩm sắp hết</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl text-center border border-emerald-100 dark:border-emerald-900">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-1 text-xs font-bold">
                    {inventorySummary.totalItems}
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Tổng mặt hàng</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl text-center border border-blue-100 dark:border-blue-900">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-1 text-xs font-bold text-[9px]">
                    {inventorySummary.totalValue > 0 ? (inventorySummary.totalValue / 1_000_000).toFixed(1) + 'M' : '0M'}
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Giá trị tồn kho</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM BANNER WITH GOLDEN SCISSORS BACKGROUND */}
        <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-white shadow-md border border-[#C8A97A]/40 flex flex-col md:flex-row items-center justify-between gap-4 mb-8 group">
          <div 
            className="absolute inset-y-0 left-0 w-full md:w-1/2 bg-cover bg-left opacity-90 transition-transform duration-700 group-hover:scale-105 pointer-events-none"
            style={{ backgroundImage: "url('/images/haircut_bottom.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-primary/95 to-primary z-0 pointer-events-none" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-sm">
              <SparklesIcon className="w-6 h-6 text-[#C8A97A]" />
            </div>
            <div>
              <h4 className="text-xl font-serif font-bold text-white tracking-tight drop-shadow-xs">Bella Haircut Shop</h4>
              <p className="text-xs text-slate-200 mt-0.5 font-medium">Không chỉ là cắt tóc, mà là trải nghiệm.</p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-5">
            <span className="font-serif italic text-xl md:text-2xl text-[#E4D1AC] font-light tracking-wide select-none drop-shadow-sm">
              Be Your Best Version
            </span>
            <div className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center text-white cursor-pointer hover:scale-105 transition-transform shadow-md active:scale-95">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Modals */}
        <BookingModal 
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
        />

        {/* Xem tất cả thông báo Modal */}
        <AnimatePresence>
          {isAllNotificationsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAllNotificationsOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-md"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] shadow-2xl border border-pink-100 p-8 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden relative z-10"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Tất cả thông báo</h2>
                      <p className="text-xs text-muted-foreground font-semibold mt-0.5">Tìm kiếm và đối soát nhanh các sự kiện</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAllNotificationsOpen(false)}
                    className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center active:scale-95"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Bar & Tabs */}
                <div className="space-y-4 mb-6 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm nội dung thông báo..." 
                      value={notifSearch}
                      onChange={(e) => setNotifSearch(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'all', label: 'Tất cả' },
                      { id: 'success', label: 'Hoàn thành ca' },
                      { id: 'warning', label: 'Buổi quá hạn' },
                      { id: 'info', label: 'Gói sắp hết' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setNotifTab(tab.id)}
                        className={cn(
                          "px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all active:scale-95 border",
                          notifTab === tab.id 
                            ? "bg-primary text-white border-primary shadow-lg shadow-pink-100 dark:shadow-none" 
                            : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification list (Scrollable) */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-2">
                  {alerts.filter(alert => {
                    const matchesSearch = (alert.title + ' ' + alert.message).toLowerCase().includes(notifSearch.toLowerCase());
                    const matchesTab = notifTab === 'all' || alert.type === notifTab;
                    return matchesSearch && matchesTab;
                  }).length > 0 ? (
                    alerts.filter(alert => {
                      const matchesSearch = (alert.title + ' ' + alert.message).toLowerCase().includes(notifSearch.toLowerCase());
                      const matchesTab = notifTab === 'all' || alert.type === notifTab;
                      return matchesSearch && matchesTab;
                    }).map((alert, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          if (alert.link) {
                            router.push(alert.link);
                            setIsAllNotificationsOpen(false);
                          }
                        }}
                        className={cn(
                          "p-5 rounded-3xl border transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex gap-4 hover:shadow-md",
                          alert.type === 'warning' ? 'bg-amber-50/50 border-amber-100 hover:border-amber-200' :
                          alert.type === 'success' ? 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200' :
                          'bg-blue-50/50 border-blue-100 hover:border-blue-200'
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                          alert.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                          alert.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                          'bg-blue-100 text-blue-600'
                        )}>
                          {alert.icon === 'alert' ? <AlertTriangle className="w-6 h-6" /> :
                           alert.icon === 'checkCircle' ? <CheckCircle2 className="w-6 h-6" /> :
                           <Lightbulb className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <h4 className="font-extrabold text-sm text-foreground truncate">{alert.title}</h4>
                            {alert.timestamp && alert.timestamp > 0 && (
                              <span className="text-[10px] text-muted-foreground shrink-0 font-bold italic">
                                {new Date(alert.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                                {new Date(alert.timestamp).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed font-semibold">{alert.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center">
                      <Bell className="w-16 h-16 text-slate-200 mx-auto mb-4 animate-bounce" />
                      <p className="text-slate-400 font-extrabold italic text-sm">Không tìm thấy thông báo nào</p>
                      <p className="text-slate-300 text-xs mt-1">Vui lòng thay đổi từ khóa hoặc bộ lọc</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Premium Interactive Onboarding Tour */}
      <OnboardingTour brandName={businessLabel} tenantModuleKey={tenantModuleKey} />
    </div>
  );
}
