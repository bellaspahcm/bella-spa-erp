'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  Star,
  ChevronRight,
  PlusCircle,
  Search,
  Bell,
  Award,
  AlertTriangle,
  Lightbulb,
  Trophy,
  Diamond,
  CheckCircle2,
  Loader2,
  Activity,
  MessageSquare
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  Tooltip, 
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { toast } from 'sonner';
import { BookingModal } from '@/components/features/BookingModal';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { 
  getDashboardStats, 
  getUpcomingSessions, 
  getTopTechnicians, 
  getImportantAlerts,
  getMonthlyPerformance,
  getFullDashboardData
} from '@/services/dashboard-actions';
import { completeSession, saveSessionNote } from '@/services/booking-actions';
import { createClient } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

import { 
  MOCK_DASHBOARD_STATS, 
  MOCK_TOP_KTVS, 
  MOCK_BOOKINGS 
} from '@/constants/mock-data';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export default function DashboardPage() {
  const [stats, setStats] = useState<any[]>([
    { label: 'Tổng khách hàng', value: '0', trend: 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Lịch hẹn hôm nay', value: '0', trend: 0, icon: Calendar, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Doanh thu tháng', value: '0M', trend: 0, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Đánh giá KTV', value: '0.0', trend: 0, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [topKTVs, setTopKTVs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [performanceData, setPerformanceData] = useState<any[]>([
    { name: 'T12', customers: 45, revenue: 85, expense: 65, rating: 4.8 },
    { name: 'T1', customers: 52, revenue: 92, expense: 70, rating: 4.9 },
    { name: 'T2', customers: 48, revenue: 88, expense: 68, rating: 4.7 },
    { name: 'T3', customers: 61, revenue: 105, expense: 75, rating: 4.9 },
    { name: 'T4', customers: 55, revenue: 98, expense: 72, rating: 5.0 },
    { name: 'T5', customers: 67, revenue: 110, expense: 78, rating: 4.9 },
  ]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [quickNoteId, setQuickNoteId] = useState<string | null>(null);
  const [quickNoteValue, setQuickNoteValue] = useState('');

  const getMonthRange = (month: number, year: number) => {
    // Manually construct YYYY-MM-DD to avoid timezone shifts from .toISOString()
    const startMonth = String(month + 1).padStart(2, '0');
    const startDate = `${year}-${startMonth}-01`;
    
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${startMonth}-${String(lastDay).padStart(2, '0')}`;
    
    return { startDate, endDate };
  };

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { startDate, endDate } = getMonthRange(selectedMonth, selectedYear);
      
      const { statsData, sessionsData, ktvsData, alertsData, perfData } = await getFullDashboardData(startDate, endDate);

      setStats([
        { label: 'Tổng khách hàng', value: statsData.totalCustomers.value, trend: statsData.totalCustomers.trend, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Lịch hẹn hôm nay', value: statsData.todayBookings.value, trend: statsData.todayBookings.trend, icon: Calendar, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Doanh thu tháng', value: statsData.totalRevenue.value, trend: statsData.totalRevenue.trend, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Đánh giá KTV', value: statsData.avgRating.value, trend: statsData.avgRating.trend, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
      ]);
      
      setSessions(sessionsData || []);
      setTopKTVs(ktvsData || []);
      setPerformanceData(perfData || []);
      setAlerts(alertsData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Lỗi cập nhật dữ liệu');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // REALTIME SUBSCRIPTION
    const supabase = createClient() as any;
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_reviews' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleCompleteSession = async (sessionId: string, bookingId: string, note: string) => {
    setUpdatingId(sessionId);
    try {
      if (note.trim()) {
        await saveSessionNote(sessionId, note);
      }
      const result = await completeSession(sessionId, bookingId);
      if (result.success) {
        toast.success('Đã cập nhật tiến độ buổi tập!');
        fetchData();
      }
    } catch (error) {
      console.error('Update failed:', error);
      toast.error('Cập nhật thất bại');
    } finally {
      setUpdatingId(null);
      setQuickNoteId(null);
      setQuickNoteValue('');
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return { label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
      case 'in_progress': return { label: 'Đang thực hiện', color: 'bg-amber-50 text-amber-600 border-amber-100' };
      case 'scheduled': return { label: 'Chờ thực hiện', color: 'bg-blue-50 text-blue-600 border-blue-100' };
      case 'booked': return { label: 'Đã đặt lịch', color: 'bg-rose-50 text-rose-600 border-rose-100' };
      default: return { label: status, color: 'bg-slate-50 text-slate-600 border-slate-100' };
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-6 md:p-10">
      <AnimatePresence>
        {isRefreshing && (
          <motion.div 
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-rose-400 to-primary origin-left z-[100]"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight uppercase">Dashboard</h1>
          <p className="text-muted-foreground font-semibold mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            Chào buổi sáng, Bella Spa Admin!
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* Month Selector */}
          <div className="flex items-center bg-white/80 border border-border p-1 rounded-2xl shadow-sm gap-2">
            <PremiumSelect 
              value={selectedMonth.toString()}
              options={['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'].map((m, i) => ({
                value: i.toString(),
                label: m
              }))}
              onChange={(val) => setSelectedMonth(parseInt(val))}
              className="w-40"
            />
            <PremiumSelect 
              value={selectedYear.toString()}
              options={[2024, 2025, 2026].map(y => ({
                value: y.toString(),
                label: y.toString()
              }))}
              onChange={(val) => setSelectedYear(parseInt(val))}
              className="w-32"
            />
          </div>

          <div className="relative group hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors w-5 h-5" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhanh..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-4 bg-white/80 border border-border rounded-[1.5rem] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all w-60 shadow-sm font-medium"
            />
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`p-4 rounded-2xl transition-all shadow-sm relative group active:scale-95 border ${
                isNotificationsOpen ? 'bg-primary text-white border-primary shadow-lg shadow-pink-100' : 'bg-white/80 border-border text-foreground hover:bg-white'
              }`}
            >
              <Bell className={`w-6 h-6 transition-colors ${isNotificationsOpen ? 'text-white' : 'group-hover:text-primary'}`} />
              {alerts.length > 0 && !isNotificationsOpen && (
                <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-accent rounded-full border-2 border-white shadow-[0_0_8px_rgba(255,133,162,0.5)] animate-pulse"></span>
              )}
            </button>

            {/* Notifications Popover */}
            <AnimatePresence>
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-96 bg-white rounded-[2rem] shadow-2xl shadow-pink-200/50 border border-pink-100 p-6 z-50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-black uppercase tracking-widest text-sm text-foreground">Thông báo</h3>
                      <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase">
                        {alerts.length} Mới
                      </span>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {alerts.length > 0 ? (
                        alerts.map((alert: any, idx: number) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                              alert.type === 'warning' ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100'
                            }`}
                          >
                            <div className="flex gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                alert.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                              }`}>
                                {alert.icon === 'alert' ? <AlertTriangle className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-foreground mb-1">{alert.title}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center">
                          <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                          <p className="text-slate-400 font-bold italic">Không có thông báo mới</p>
                        </div>
                      )}
                    </div>
                    <button className="w-full mt-6 py-3 text-xs font-black uppercase text-primary hover:bg-primary/5 rounded-xl transition-all tracking-widest">
                      Xem tất cả thông báo
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          
          <button 
            onClick={() => setIsBookingModalOpen(true)}
            className="flex items-center gap-3 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-pink-200 active:scale-95 uppercase tracking-wider"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Tạo Booking</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
      >
        {stats.map((stat, idx) => (
          <motion.div 
            key={idx}
            variants={item}
            className="glass-pink p-8 rounded-[2.5rem] group relative overflow-hidden border border-white/50 shadow-lg hover:shadow-2xl transition-all duration-500"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-primary/5 transition-colors" />
            
            <div className="flex items-center justify-between mb-6 relative">
              <div className={`p-4 rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 ${stat.bg} ${stat.color} shadow-sm border border-white/50`}>
                <stat.icon className="w-7 h-7" />
              </div>
              <div className={`flex items-center gap-1 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest ${
                stat.trend >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
              }`}>
                {stat.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(stat.trend)}%
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1">{stat.label}</p>
            <h3 className="text-4xl font-black text-foreground tracking-tighter">{stat.value}</h3>
          </motion.div>
        ))}
      </motion.div>

      {/* Bento Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Schedule - Large Span */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-pink luxury-box-hover rounded-[3.5rem] p-8 md:p-12 shadow-2xl border border-white/50 relative overflow-hidden"
        >
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-primary/20 via-rose-300/30 to-primary/20" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 relative gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white shadow-xl shadow-pink-200/50 transform -rotate-3 hover:rotate-0 transition-transform">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground uppercase tracking-tighter">Sắp tới trong hôm nay</h2>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Lịch trình liệu trình trực tuyến
                </p>
              </div>
            </div>
            <Link 
              href="/dashboard/bookings"
              className="px-8 py-4 bg-white/80 backdrop-blur-md text-primary border border-primary/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg shadow-pink-100/50 flex items-center gap-3 group/link"
            >
              Xem tất cả <ChevronRight className="w-5 h-5 group-hover/link:translate-x-1.5 transition-transform" />
            </Link>
          </div>
          
          <div className="max-h-[1150px] overflow-y-auto pr-4 custom-scrollbar space-y-6">
            {(() => {
              const filteredSessions = sessions.filter(session => {
                const customerName = session.bookings?.customers?.name_mother || '';
                const packageName = session.bookings?.package_id || '';
                const isNotCompleted = session.status !== 'completed';
                const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                     packageName.toLowerCase().includes(searchQuery.toLowerCase());
                return isNotCompleted && matchesSearch;
              });

              if (filteredSessions.length > 0) {
                return filteredSessions.map((session, idx) => {
                  const statusInfo = getStatusInfo(session.status);
                  const customerName = session.bookings?.customers?.name_mother || 'Khách hàng';
                  const technicianName = session.bookings?.assigned_ktv?.full_name || 'Chưa phân công';
                  const packageName = session.bookings?.package_id || 'Gói dịch vụ';
                  
                  return (
                    <div 
                      key={session.id}
                      className="group bg-white/30 hover:bg-white/60 p-6 md:p-7 rounded-[2.5rem] transition-all border border-white/40 hover:border-primary/10 shadow-sm hover:shadow-2xl hover:shadow-pink-100/30 relative mb-5 last:mb-0 backdrop-blur-md"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
                        <div className="flex flex-1 items-start gap-5 md:gap-7">
                          {/* Avatar Section */}
                          <div className="relative shrink-0">
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white shadow-inner flex items-center justify-center text-primary font-black text-xl md:text-2xl border-2 border-pink-50 relative group-hover:scale-105 transition-transform duration-500">
                              {customerName.charAt(0)}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col mb-4">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Khách hàng</span>
                              <h3 className="font-bold text-xl md:text-2xl text-foreground group-hover:text-primary transition-colors tracking-tight truncate">
                                {customerName}
                              </h3>
                              <div className="mt-1.5 flex items-center gap-3">
                                <span className="text-[9px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
                                  KTV
                                </span>
                                <span className={cn(
                                  "text-sm font-bold truncate",
                                  session.bookings?.assigned_ktv?.full_name ? "text-slate-500" : "text-amber-600 italic"
                                )}>
                                  {technicianName}
                                </span>
                              </div>
                            </div>

                            {/* Badge Row - More compact but luxury */}
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                              <div className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border shadow-sm",
                                session.assigned_time 
                                  ? "bg-slate-50/50 text-slate-600 border-slate-100" 
                                  : "bg-amber-50/80 text-amber-700 border-amber-100/50 animate-pulse"
                              )}>
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                {session.assigned_time || 'Chưa có giờ'}
                              </div>

                              <div className="flex items-center gap-2 bg-pink-50/50 text-primary border border-pink-100/50 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-sm">
                                <Diamond className="w-3.5 h-3.5" />
                                {packageName}
                              </div>

                              <div className="flex items-center gap-2 bg-emerald-50/50 text-emerald-600 border border-emerald-100/50 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-sm">
                                <Activity className="w-3.5 h-3.5" />
                                Buổi {session.session_number || (session.bookings?.completed_sessions || 0) + 1}
                              </div>
                            </div>

                            {!session.assigned_time && (
                              <div className="mb-4 inline-flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-50/80 to-orange-50/80 backdrop-blur-sm border border-amber-100/50 rounded-2xl text-[10px] font-bold text-amber-800 uppercase tracking-widest shadow-sm">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span>Xác nhận giờ đặt lịch</span>
                              </div>
                            )}

                            {/* Progress Section - Refined labels */}
                            <div className="max-w-[320px]">
                              <div className="flex items-center justify-between mb-2 px-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiến độ liệu trình</span>
                                <span className="text-[10px] font-black text-primary bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10">
                                  {session.bookings?.completed_sessions || 0} / {session.bookings?.total_sessions || 21} Buổi
                                </span>
                              </div>
                              <div className="h-2.5 w-full bg-slate-100/40 rounded-full overflow-hidden p-0.5 border border-white shadow-inner">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${((session.bookings?.completed_sessions || 0) / (session.bookings?.total_sessions || 21)) * 100}%` }}
                                  className="h-full bg-gradient-to-r from-primary via-rose-400 to-accent rounded-full shadow-[0_0_10px_rgba(219,39,119,0.3)]"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Status & Actions - Side Layout */}
                        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6 lg:gap-8 shrink-0">
                          {/* Circular Status Badge */}
                          <div className={cn(
                            "w-20 h-20 md:w-24 md:h-24 rounded-full flex flex-col items-center justify-center text-center p-3 text-[10px] font-black uppercase tracking-tighter border-4 shadow-xl transition-all duration-500 group-hover:rotate-6",
                            statusInfo.color.replace('bg-', 'bg-opacity-40 bg-').replace('text-', 'text-opacity-100 text-'),
                            "border-white/60 shadow-pink-100/20"
                          )}>
                            <div className="mb-1">●</div>
                            {statusInfo.label}
                          </div>

                          <div className="flex flex-col gap-3 min-w-[200px] w-full sm:w-auto">
                            <AnimatePresence mode="wait">
                              {quickNoteId === session.id ? (
                                <motion.div 
                                  key="note-input"
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="relative"
                                >
                                  <input 
                                    autoFocus
                                    type="text"
                                    placeholder="Thêm ghi chú buổi..."
                                    className="w-full pl-4 pr-12 py-4 bg-white border-2 border-primary/20 rounded-[1.25rem] text-sm font-bold focus:border-primary outline-none shadow-xl shadow-pink-100/20"
                                    value={quickNoteValue}
                                    onChange={(e) => setQuickNoteValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCompleteSession(session.id, session.booking_id, quickNoteValue);
                                      if (e.key === 'Escape') setQuickNoteId(null);
                                    }}
                                  />
                                  <button 
                                    onClick={() => handleCompleteSession(session.id, session.booking_id, quickNoteValue)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-primary text-white rounded-xl shadow-lg hover:scale-105 transition-transform"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                </motion.div>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setQuickNoteId(session.id);
                                    setQuickNoteValue('');
                                  }}
                                  className="flex items-center justify-center gap-3 px-6 py-4 bg-white/50 hover:bg-white text-slate-500 hover:text-primary border-2 border-dashed border-slate-200 hover:border-primary/40 rounded-[1.25rem] transition-all text-xs font-black uppercase tracking-widest group/note shadow-sm hover:shadow-lg"
                                >
                                  <MessageSquare className="w-4 h-4 group-hover/note:scale-125 transition-transform duration-300" />
                                  Thêm ghi chú
                                </button>
                              )}
                            </AnimatePresence>

                            <button 
                              onClick={() => handleCompleteSession(session.id, session.booking_id, quickNoteValue)}
                              disabled={updatingId === session.id}
                              className="w-full px-8 py-5 bg-gradient-to-br from-primary to-[#831843] text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-[0.15em] hover:shadow-2xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 relative overflow-hidden group/btn"
                            >
                              <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover/btn:translate-x-0 transition-transform duration-500" />
                              {updatingId === session.id ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                  <span>Hoàn thành buổi {(session.bookings?.completed_sessions || 0) + 1}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              }

              return (
                <div className="py-20 text-center">
                  <Calendar className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground font-bold italic">
                    {searchQuery ? `Không tìm thấy kết quả cho "${searchQuery}"` : 'Không có lịch hẹn sắp tới'}
                  </p>
                </div>
              );
            })()}
          </div>
        </motion.div>
        
        {/* Sidebar Analytics Stack */}
        <div className="lg:col-span-1 space-y-8">
          {/* Performance Chart */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="luxury-card-pink rounded-[3rem] p-10 relative overflow-hidden shadow-2xl group flex flex-col justify-between h-[450px]"
          >
            <div className="relative z-10">
              <h2 className="text-xs font-semibold mb-1 text-white/70 uppercase tracking-[0.2em]">Hiệu suất tháng</h2>
              <div className="flex items-center gap-3 mb-8">
                <p className="text-4xl font-bold text-white tracking-tighter">
                  {(() => {
                    if (performanceData.length < 2) return '+0%';
                    const current = performanceData[performanceData.length - 1].customers;
                    const previous = performanceData[performanceData.length - 2].customers;
                    if (previous === 0) return current > 0 ? '+100%' : '0%';
                    const trend = ((current - previous) / previous) * 100;
                    return (trend >= 0 ? '+' : '') + trend.toFixed(1) + '%';
                  })()}
                </p>
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
                  <TrendingUp className="text-white w-4 h-4" />
                </div>
              </div>
              
              <div className="h-40 w-full relative mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                        borderRadius: '1rem', 
                        border: 'none',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                        color: '#9D174D',
                        fontWeight: '800'
                      }}
                      itemStyle={{ color: '#9D174D' }}
                    />
                    <XAxis 
                      dataKey="name" 
                      axisLine={{ stroke: '#7d123e', strokeWidth: 2 }}
                      tickLine={false}
                      tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10, fontWeight: 800 }}
                      dy={10}
                    />
                    <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                    <Area 
                      type="monotone" 
                      dataKey="customers" 
                      stroke="#ffffff" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPerf)" 
                      animationDuration={2000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <Link 
              href="/dashboard/finance"
              className="w-full py-4 bg-white/10 hover:bg-white text-white hover:text-primary border border-white/20 hover:border-white rounded-2xl font-black transition-all duration-300 backdrop-blur-md uppercase tracking-widest text-[10px] active:scale-95 flex items-center justify-center gap-3 shadow-lg group/btn"
            >
              <span>Chi tiết báo cáo</span>
              <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
            
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-[100px]"></div>
          </motion.div>

          {/* Revenue & Expense Chart (Moved to Sidebar) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-pink luxury-box-hover rounded-[3rem] p-8 shadow-sm border border-white relative overflow-hidden h-[400px]"
          >
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400/30 via-primary/30 to-rose-400/30" />
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Tài chính</h2>
              </div>
            </div>
            
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }}
                    unit="tr"
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      borderRadius: '1rem', 
                      border: 'none',
                      boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.1)',
                      fontSize: '10px'
                    }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Rating Chart (Moved to Sidebar) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="glass-pink luxury-box-hover rounded-[3rem] p-8 shadow-sm border border-white relative overflow-hidden h-[350px] flex flex-col"
          >
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400/30 to-orange-400/30" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Đánh giá</h2>
            </div>
            
            <div className="flex-1 flex flex-col justify-between">
              <div className="mb-4">
                <p className="text-4xl font-black text-foreground tracking-tighter">
                  {performanceData[performanceData.length - 1]?.rating || '5.0'}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-3 h-3 ${s <= Math.round(performanceData[performanceData.length - 1]?.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                  ))}
                </div>
              </div>

              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={[4, 5]} />
                    <Area type="monotone" dataKey="rating" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRating)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        </div>
      </div>


      {/* New Sections: Top KTV & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 mt-12">
        {/* Top KTV Xuất Sắc */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-pink luxury-box-hover rounded-[3rem] p-10 shadow-sm border border-white relative overflow-hidden"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30" />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">Top KTV Xuất Sắc</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-pink-100">
                  <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" /> Tên KTV
                  </th>
                  <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                    <Clock className="w-4 h-4 inline mr-2" /> Buổi
                  </th>
                  <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                    <Star className="w-4 h-4 inline mr-2" /> Rating
                  </th>
                  <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-center">Status</th>
                  <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-right">
                    <Diamond className="w-4 h-4 inline mr-2" /> Bonus
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-50">
                {topKTVs.map((ktv: any, idx: number) => (
                  <tr key={idx} className="group hover:bg-white/40 transition-colors">
                    <td className="py-6 font-bold text-foreground">{ktv.name}</td>
                    <td className="py-6 font-bold text-muted-foreground">{ktv.sessions} buổi</td>
                    <td className="py-6 font-bold text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {ktv.rating} <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      </div>
                    </td>
                    <td className="py-6 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        ktv.status === 'Xuất Sắc' 
                          ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' 
                          : 'bg-blue-100 text-blue-600 border border-blue-200'
                      }`}>
                        {ktv.status}
                      </span>
                    </td>
                    <td className="py-6 text-right font-bold text-primary">{ktv.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Cảnh báo quan trọng */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-pink luxury-box-hover rounded-[3rem] p-10 shadow-sm border border-white relative overflow-hidden"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30" />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-rose-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">Cảnh báo quan trọng</h2>
          </div>
          
          <div className="space-y-4">
            {alerts.map((alert: any, idx: number) => (
              <div 
                key={idx} 
                className={`p-6 rounded-3xl flex items-center gap-6 border ${
                  alert.type === 'warning' 
                    ? 'bg-amber-50 border-amber-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                  alert.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {alert.icon === 'alert' ? <AlertTriangle className="w-6 h-6" /> : <Lightbulb className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <h3 className={`font-bold text-lg ${alert.type === 'warning' ? 'text-amber-900' : 'text-blue-900'}`}>
                    {alert.title}
                  </h3>
                  <p className={`font-semibold opacity-80 ${alert.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>
                    {alert.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <BookingModal 
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
      />
    </div>
  );
}
