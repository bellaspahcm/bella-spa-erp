'use client';

import { KtvPerformanceTable } from '@/components/features/dashboard/KtvPerformanceTable';
import { RevenueChart } from '@/components/features/dashboard/RevenueChart';
import AdminNotificationBell from '@/components/common/AdminNotificationBell';
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

export function HaircutDashboardView() {
  const router = useRouter();
  const { tenantModuleKey, isTenantModuleLoading } = useTenantModuleKey({ forceFresh: true });
  const [stats, setStats] = useState<DashboardStatsViewModel[]>([]);
  const [sessions, setSessions] = useState<DashboardSessionViewModel[]>([]);
  const [topKTVs, setTopKTVs] = useState<KtvPerformanceViewModel[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  const buildDashboardStats = useCallback((statsData: Awaited<ReturnType<typeof getDashboardPrimaryData>>['statsData']) => {
    return [
      { label: 'Tổng khách hàng', value: String(statsData.totalCustomers?.value || '1.284'), trend: Number(statsData.totalCustomers?.trend || 12), iconName: 'Users' as const, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Lịch hẹn hôm nay', value: String(statsData.todayBookings?.value || '28'), trend: Number(statsData.todayBookings?.trend || 27), iconName: 'Calendar' as const, color: 'text-rose-600', bg: 'bg-rose-50' },
      ...(userRole === 'admin' ? [{ label: 'Doanh thu tháng', value: String(statsData.totalRevenue?.value || '68,5M'), trend: Number(statsData.totalRevenue?.trend || 18), iconName: 'DollarSign' as const, color: 'text-emerald-600', bg: 'bg-emerald-50' }] : []),
      { label: `Đánh giá ${vocab.worker.short}`, value: String(statsData.avgRating?.value || '4.9/5'), trend: Number(statsData.avgRating?.trend || 0.2), iconName: 'Star' as const, color: 'text-amber-600', bg: 'bg-amber-50' },
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
  }, [tenantId, isTenantModuleLoading]);

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
            className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#074E44] via-emerald-400 to-[#074E44] origin-left z-[100]"
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
                  className="pl-10 pr-4 py-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#074E44] w-64 shadow-xs"
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
          {/* Card 1: Khách hàng (Tất cả) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#074E44] flex items-center justify-center text-white shrink-0 shadow-md">
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Khách hàng <span className="text-[10px] text-slate-400 font-normal">(Tất cả)</span></p>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stats[0]?.value || '1.284'}</h2>
                <span className="inline-flex items-center text-xs font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  ↗ 12%
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">+138 khách so với tháng trước</p>
            </div>
          </div>

          {/* Card 2: Lịch hẹn hôm nay */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#074E44] flex items-center justify-center text-white shrink-0 shadow-md">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lịch hẹn hôm nay</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stats[1]?.value || '28'}</h2>
                <span className="inline-flex items-center text-xs font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  ↗ 27%
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">20 đã phục vụ · 8 sắp tới</p>
            </div>
          </div>

          {/* Card 3: Doanh thu tháng */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#074E44] flex items-center justify-center text-white shrink-0 shadow-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Doanh thu tháng</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stats[2]?.value || '68,5M'} <span className="text-sm text-slate-400 font-bold">VND</span></h2>
                <span className="inline-flex items-center text-xs font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  ↗ 18%
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">Đạt 78% mục tiêu tháng</p>
            </div>
          </div>

          {/* Card 4: Đánh giá trung bình */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex items-start gap-4 relative">
            <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-md">
              <SparklesIcon className="w-6 h-6 fill-white text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đánh giá trung bình</p>
                <ChevronRight className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600" />
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stats[3]?.value || '4.9/5'}</h2>
                <span className="inline-flex items-center text-xs font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  ↗ 0.2
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">Từ 642 lượt đánh giá</p>
            </div>
          </div>
        </div>

        {/* ROW 2: 3-COLUMN BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          {/* COLUMN 1 (5 cols): Lịch hẹn hôm nay */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#074E44]" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Lịch hẹn hôm nay</h2>
              </div>
              <Link href="/dashboard/bookings" className="text-xs font-bold text-[#074E44] hover:underline flex items-center gap-1">
                Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
              <button className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#074E44] text-white shadow-xs">
                Tất cả <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">8</span>
              </button>
              <button className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200">
                Sắp tới <span className="ml-1 text-slate-400 text-[10px]">8</span>
              </button>
              <button className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200">
                Đang phục vụ <span className="ml-1 text-slate-400 text-[10px]">3</span>
              </button>
              <button className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200">
                Đã xong <span className="ml-1 text-slate-400 text-[10px]">20</span>
              </button>
            </div>

            {/* List of appointments */}
            <div className="space-y-4 flex-1">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl" />
                ))
              ) : (() => {
                const displayList = [
                  { time: '09:30', status: 'Đang phục vụ', statusColor: 'bg-emerald-500', name: 'Nguyễn Hoàng Anh', service: 'Cắt tóc nam · 45 phút', ktv: 'KTV Minh', avatar: 'M', ktvBg: 'bg-[#074E44]' },
                  { time: '10:00', status: 'Sắp tới', statusColor: 'bg-blue-500', name: 'Trần Thị Mai', service: 'Uốn + Phục hồi · 90 phút', ktv: 'KTV Linh', avatar: 'L', ktvBg: 'bg-purple-600' },
                  { time: '10:30', status: 'Sắp tới', statusColor: 'bg-blue-500', name: 'Lê Quốc Bảo', service: 'Cắt + Tạo kiểu · 45 phút', ktv: 'KTV Nam', avatar: 'N', ktvBg: 'bg-blue-600' },
                  { time: '11:00', status: 'Sắp tới', statusColor: 'bg-blue-500', name: 'Phạm Thu Hà', service: 'Nhuộm thời trang · 120 phút', ktv: 'KTV An', avatar: 'A', ktvBg: 'bg-rose-600' },
                  { time: '11:30', status: 'Sắp tới', statusColor: 'bg-blue-500', name: 'Vũ Minh Đức', service: 'Cắt tóc nam · 45 phút', ktv: 'KTV Huy', avatar: 'H', ktvBg: 'bg-amber-600' },
                ];

                return displayList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-[#074E44]/30 transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white min-w-[42px]">{item.time}</span>
                      <span className={`w-2 h-2 rounded-full ${item.statusColor}`} />
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs shrink-0">
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{item.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{item.service}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className={`w-5 h-5 rounded-full ${item.ktvBg} text-white text-[9px] font-bold flex items-center justify-center`}>
                          {item.avatar}
                        </div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{item.ktv}</span>
                      </div>
                      <button className="p-1 text-slate-400 hover:text-slate-600">⋮</button>
                    </div>
                  </div>
                ));
              })()}
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
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cảnh báo & cần chú ý <span className="text-rose-500 font-extrabold">(3)</span></h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-xs p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200">2 lịch hẹn sắp trễ</p>
                    <p className="text-slate-400 text-[11px]">Cần liên hệ khách hàng</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="flex items-start gap-3 text-xs p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200">3 sản phẩm sắp hết</p>
                    <p className="text-slate-400 text-[11px] truncate">Dầu gội phục hồi, Thuốc nhuộm nâu, Sáp vuốt tóc</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="flex items-start gap-3 text-xs p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200">1 kỹ thuật viên chưa check-in</p>
                    <p className="text-slate-400 text-[11px]">KTV Huy (Ca sáng)</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Card 3: Vật tư & Tồn kho */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Vật tư & Tồn kho</h3>
                </div>
                <Link href="/dashboard/inventory" className="text-xs font-bold text-[#074E44] hover:underline flex items-center gap-0.5">
                  Xem chi tiết <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl text-center border border-rose-100 dark:border-rose-900">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-1 text-xs font-bold">3</div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Sản phẩm sắp hết</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl text-center border border-emerald-100 dark:border-emerald-900">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-1 text-xs font-bold">248</div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Tổng mặt hàng</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl text-center border border-blue-100 dark:border-blue-900">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-1 text-xs font-bold text-[9px]">42,5M</div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Giá trị tồn kho</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM BANNER WITH GOLDEN SCISSORS BACKGROUND */}
        <div className="relative overflow-hidden rounded-3xl bg-[#074E44] p-6 text-white shadow-md border border-[#C8A97A]/40 flex flex-col md:flex-row items-center justify-between gap-4 mb-8 group">
          <div 
            className="absolute inset-y-0 left-0 w-full md:w-1/2 bg-cover bg-left opacity-90 transition-transform duration-700 group-hover:scale-105 pointer-events-none"
            style={{ backgroundImage: "url('/images/haircut_bottom.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#03211D]/80 via-[#074E44]/95 to-[#0A665A] z-0 pointer-events-none" />

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
