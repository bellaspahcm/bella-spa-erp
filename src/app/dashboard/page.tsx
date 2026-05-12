'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
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
  Diamond 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  Tooltip, 
  XAxis,
  YAxis
} from 'recharts';
import { toast } from 'sonner';
import { BookingModal } from '@/components/features/BookingModal';
import { 
  getDashboardStats, 
  getUpcomingSessions, 
  getTopTechnicians, 
  getImportantAlerts,
  getMonthlyPerformance
} from '@/services/dashboard-actions';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
    { label: 'Tổng khách hàng', value: MOCK_DASHBOARD_STATS.totalCustomers.toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Lịch hẹn hôm nay', value: MOCK_DASHBOARD_STATS.todayBookings.toString(), icon: Calendar, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Doanh thu tháng', value: MOCK_DASHBOARD_STATS.totalRevenue, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Đánh giá KTV', value: MOCK_DASHBOARD_STATS.avgRating, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]);
  const [sessions, setSessions] = useState<any[]>(MOCK_BOOKINGS.map(b => ({
    id: b.id,
    session_number: b.completed_sessions + 1,
    assigned_date: b.start_date,
    status: b.status,
    bookings: {
      customers: {
        name_mother: b.customers?.name_mother
      }
    }
  })));
  const [topKTVs, setTopKTVs] = useState<any[]>(MOCK_TOP_KTVS);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsData, sessionsData, ktvsData, alertsData, perfData] = await Promise.all([
          getDashboardStats(),
          getUpcomingSessions(),
          getTopTechnicians(),
          getImportantAlerts(),
          getMonthlyPerformance()
        ]);

        if (statsData.totalCustomers > 0) {
          setStats([
            { label: 'Tổng khách hàng', value: statsData.totalCustomers.toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Lịch hẹn hôm nay', value: statsData.todayBookings.toString(), icon: Calendar, color: 'text-rose-600', bg: 'bg-rose-50' },
            { label: 'Doanh thu tháng', value: statsData.totalRevenue, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Đánh giá KTV', value: statsData.avgRating, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
          ]);
        }
        
        if (sessionsData && sessionsData.length > 0) setSessions(sessionsData);
        if (ktvsData && ktvsData.length > 0) setTopKTVs(ktvsData);
        if (perfData && perfData.length > 0) setPerformanceData(perfData);
        setAlerts(alertsData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    }
    fetchData();
  }, []);

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight uppercase">Dashboard</h1>
          <p className="text-muted-foreground font-semibold mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            Chào buổi sáng, Bella Spa Admin!
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors w-5 h-5" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhanh..." 
              className="pl-12 pr-6 py-4 bg-white/80 border border-border rounded-[1.5rem] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all w-80 shadow-sm font-medium"
            />
          </div>
          <button className="p-4 bg-white/80 border border-border rounded-2xl hover:bg-white transition-all shadow-sm relative group active:scale-95">
            <Bell className="w-6 h-6 text-foreground group-hover:text-primary transition-colors" />
            <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-accent rounded-full border-2 border-white shadow-[0_0_8px_rgba(255,133,162,0.5)]"></span>
          </button>
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
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12"
      >
        {stats.map((stat: any, idx: number) => (
          <motion.div 
            key={idx}
            variants={item}
            whileHover={{ y: -5 }}
            className="bg-white/80 backdrop-blur p-8 rounded-[2.5rem] border border-white shadow-sm hover:shadow-2xl hover:shadow-pink-200/50 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" />
            
            <div className="flex items-center justify-between mb-6 relative">
              <div className={`p-4 rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${stat.bg} ${stat.color} shadow-inner`}>
                <stat.icon className="w-7 h-7" />
              </div>
              <div className="flex items-center gap-1 text-emerald-500 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full">
                <TrendingUp className="w-4 h-4" />
                12%
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-1">{stat.label}</p>
            <h3 className="text-4xl font-bold text-foreground tracking-tight">{stat.value}</h3>
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
          className="lg:col-span-2 glass-pink rounded-[3rem] p-10 shadow-sm border border-white relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30" />
          
          <div className="flex items-center justify-between mb-10 relative">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3 uppercase tracking-tight">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              Lịch làm việc sắp tới
            </h2>
            <button 
              onClick={() => window.location.href = '/dashboard/calendar'}
              className="text-sm font-semibold text-primary hover:text-accent flex items-center gap-2 transition-all group uppercase tracking-widest"
            >
              Xem tất cả <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="space-y-6">
            {sessions.length > 0 ? (
              sessions.map((session: any, i: number) => {
                const statusInfo = getStatusInfo(session.status);
                const dateObj = new Date(session.assigned_date);
                const formattedDate = isNaN(dateObj.getTime()) ? session.assigned_date : dateObj.toLocaleDateString('vi-VN');

                return (
                  <div key={session.id || i} className="flex items-center gap-6 p-6 rounded-3xl hover:bg-white/60 transition-all border border-transparent hover:border-pink-50 group shadow-sm hover:shadow-lg hover:shadow-pink-100/50">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center text-primary font-bold text-lg border-2 border-white shadow-inner group-hover:scale-105 transition-transform">
                      {session.bookings?.customers?.name_mother?.substring(0, 2).toUpperCase() || 'BS'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                        {session.bookings?.customers?.name_mother} - Buổi {session.session_number}
                      </h4>
                      <p className="text-sm text-muted-foreground font-semibold flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4" />
                        Ngày: {formattedDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "inline-flex items-center px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] border",
                        statusInfo.color
                      )}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center">
                <Calendar className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground font-bold italic">Không có lịch hẹn sắp tới</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Small Module - Revenue Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="luxury-card-pink rounded-[3rem] p-10 relative overflow-hidden shadow-2xl group flex flex-col justify-between"
        >
          <div className="relative z-10">
            <h2 className="text-xs font-semibold mb-1 text-white/70 uppercase tracking-[0.2em]">Hiệu suất tháng</h2>
            <div className="flex items-center gap-3 mb-8">
              <p className="text-4xl font-bold text-white tracking-tighter">+18.4%</p>
              <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
                <TrendingUp className="text-white w-4 h-4" />
              </div>
            </div>
            
            {/* Luxury Line Chart with Recharts */}
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
          
          <button 
            onClick={() => window.location.href = '/dashboard/finance'}
            className="w-full py-4 bg-white/10 hover:bg-white text-white hover:text-primary border border-white/20 hover:border-white rounded-2xl font-black transition-all duration-300 backdrop-blur-md uppercase tracking-widest text-[10px] active:scale-95 flex items-center justify-center gap-3 shadow-lg group/btn"
          >
            <span>Chi tiết báo cáo</span>
            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </button>
          
          <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-[100px]"></div>
        </motion.div>
      </div>

      {/* New Sections: Top KTV & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 mt-12">
        {/* Top KTV Xuất Sắc */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-pink rounded-[3rem] p-10 shadow-sm border border-white"
        >
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
          className="glass-pink rounded-[3rem] p-10 shadow-sm border border-white"
        >
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
