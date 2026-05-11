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
  getDashboardStats, 
  getUpcomingSessions, 
  getTopTechnicians, 
  getImportantAlerts 
} from '@/services/dashboard-actions';

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
  const [stats, setStats] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [topKTVs, setTopKTVs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsData, sessionsData, ktvsData, alertsData] = await Promise.all([
          getDashboardStats(),
          getUpcomingSessions(),
          getTopTechnicians(),
          getImportantAlerts()
        ]);

        setStats([
          { label: 'Tổng khách hàng', value: statsData.totalCustomers.toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Lịch hẹn hôm nay', value: statsData.todayBookings.toString(), icon: Calendar, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Doanh thu tháng', value: statsData.totalRevenue, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Đánh giá KTV', value: statsData.avgRating, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
        ]);
        setSessions(sessionsData || []);
        setTopKTVs(ktvsData || []);
        setAlerts(alertsData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background/30">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight uppercase">Dashboard</h1>
          <p className="text-muted-foreground font-bold mt-1 flex items-center gap-2">
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
          <button className="flex items-center gap-3 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-pink-200 active:scale-95 uppercase tracking-wider">
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
        {stats.map((stat, idx) => (
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
              <div className="flex items-center gap-1 text-emerald-500 font-black text-sm bg-emerald-50 px-3 py-1 rounded-full">
                <TrendingUp className="w-4 h-4" />
                12%
              </div>
            </div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.15em] mb-1">{stat.label}</p>
            <h3 className="text-4xl font-black text-foreground tracking-tight">{stat.value}</h3>
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
            <h2 className="text-2xl font-black text-foreground flex items-center gap-3 uppercase tracking-tight">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              Lịch làm việc sắp tới
            </h2>
            <button className="text-sm font-black text-primary hover:text-accent flex items-center gap-2 transition-all group uppercase tracking-widest">
              Xem tất cả <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="space-y-6">
            {sessions.length > 0 ? (
              sessions.map((session, i) => (
                <div key={session.id} className="flex items-center gap-6 p-6 rounded-3xl hover:bg-white/60 transition-all border border-transparent hover:border-pink-50 group shadow-sm hover:shadow-lg hover:shadow-pink-100/50">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center text-primary font-black text-lg border-2 border-white shadow-inner group-hover:scale-105 transition-transform">
                    {session.bookings?.customers?.name_mother?.substring(0, 2).toUpperCase() || 'BS'}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-lg text-foreground group-hover:text-primary transition-colors">
                      {session.bookings?.customers?.name_mother} - Buổi {session.session_number}
                    </h4>
                    <p className="text-sm text-muted-foreground font-bold flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      Ngày: {new Date(session.assigned_date).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-4 py-2 rounded-2xl text-xs font-black bg-accent/10 text-accent border border-accent/20 uppercase tracking-widest">
                      {session.status}
                    </span>
                  </div>
                </div>
              ))
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
          className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl group"
        >
          <div className="relative z-10">
            <h2 className="text-xl font-black mb-2 opacity-80 uppercase tracking-widest">Hiệu suất tháng</h2>
            <div className="flex items-baseline gap-2 mb-8">
              <p className="text-5xl font-black">+18.4%</p>
              <TrendingUp className="text-emerald-400 w-6 h-6 animate-bounce" />
            </div>
            
            <div className="h-40 flex items-end gap-3 mb-10">
              {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div key={i} className="flex-1 relative group/bar">
                  <div 
                    className="w-full bg-white/10 rounded-t-xl transition-all duration-700 hover:bg-primary cursor-pointer relative z-10" 
                    style={{ height: `${h}%` }}
                  />
                  <div className="absolute bottom-0 left-0 w-full bg-primary/20 blur-md transition-all h-0 group-hover/bar:h-full" />
                </div>
              ))}
            </div>
            
            <button className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black transition-all backdrop-blur-md uppercase tracking-widest text-sm active:scale-95 flex items-center justify-center gap-3">
              Chi tiết báo cáo
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          {/* Background decoration */}
          <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-primary/20 rounded-full blur-[100px] group-hover:bg-primary/30 transition-colors"></div>
          <div className="absolute bottom-[-20%] left-[-20%] w-64 h-64 bg-secondary/10 rounded-full blur-[80px]"></div>
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
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Top KTV Xuất Sắc</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-pink-100">
                  <th className="pb-4 font-black text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" /> Tên KTV
                  </th>
                  <th className="pb-4 font-black text-xs uppercase tracking-widest text-muted-foreground">
                    <Clock className="w-4 h-4 inline mr-2" /> Buổi
                  </th>
                  <th className="pb-4 font-black text-xs uppercase tracking-widest text-muted-foreground">
                    <Star className="w-4 h-4 inline mr-2" /> Rating
                  </th>
                  <th className="pb-4 font-black text-xs uppercase tracking-widest text-muted-foreground text-center">Status</th>
                  <th className="pb-4 font-black text-xs uppercase tracking-widest text-muted-foreground text-right">
                    <Diamond className="w-4 h-4 inline mr-2" /> Bonus
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-50">
                {topKTVs.map((ktv, idx) => (
                  <tr key={idx} className="group hover:bg-white/40 transition-colors">
                    <td className="py-6 font-black text-foreground">{ktv.name}</td>
                    <td className="py-6 font-bold text-muted-foreground">{ktv.sessions} buổi</td>
                    <td className="py-6 font-bold text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {ktv.rating} <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      </div>
                    </td>
                    <td className="py-6 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        ktv.status === 'Xuất Sắc' 
                          ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' 
                          : 'bg-blue-100 text-blue-600 border border-blue-200'
                      }`}>
                        {ktv.status}
                      </span>
                    </td>
                    <td className="py-6 text-right font-black text-primary">{ktv.bonus}</td>
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
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Cảnh báo quan trọng</h2>
          </div>
          
          <div className="space-y-4">
            {alerts.map((alert, idx) => (
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
                  <h3 className={`font-black text-lg ${alert.type === 'warning' ? 'text-amber-900' : 'text-blue-900'}`}>
                    {alert.title}
                  </h3>
                  <p className={`font-bold opacity-80 ${alert.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>
                    {alert.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
