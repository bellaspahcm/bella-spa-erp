'use client';

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
  Bell
} from 'lucide-react';

const stats = [
  { label: 'Tổng khách hàng', value: '1,284', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Lịch hẹn hôm nay', value: '42', icon: Calendar, color: 'text-rose-600', bg: 'bg-rose-50' },
  { label: 'Doanh thu tháng', value: '428M', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Đánh giá KTV', value: '4.9', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
];

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
  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 font-medium mt-1">Chào buổi sáng, Bella Spa Admin!</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors w-4 h-4" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhanh..." 
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all w-64"
            />
          </div>
          <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors relative">
            <Bell className="w-5 h-5 text-slate-600" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
          </button>
          <button className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-slate-200">
            <PlusCircle className="w-4 h-4" />
            <span>Tạo Booking</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10"
      >
        {stats.map((stat, idx) => (
          <motion.div 
            key={idx}
            variants={item}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </motion.div>

      {/* Bento Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Schedule - Large Span */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-500" />
              Lịch làm việc sắp tới
            </h2>
            <button className="text-sm font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors">
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                <div className="w-12 h-12 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                  <div className="w-full h-full bg-rose-200 flex items-center justify-center text-rose-700 font-bold">NV</div>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 group-hover:text-rose-600 transition-colors">Chị Mai Lan - Gói Bầu VIP</h4>
                  <p className="text-sm text-slate-500 font-medium">KTV: Nguyễn Thị Hoa • 14:00 - 16:00</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
                    Sắp tới
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Small Module - Revenue Chart Placeholder */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden"
        >
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-4 opacity-90">Hiệu suất tháng</h2>
            <p className="text-4xl font-black mb-6">+18.4%</p>
            <div className="h-32 flex items-end gap-2 mb-6">
              {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div key={i} className="flex-1 bg-white/20 rounded-t-lg transition-all hover:bg-rose-500 cursor-pointer" style={{ height: `${h}%` }}></div>
              ))}
            </div>
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-bold transition-all backdrop-blur-sm">
              Xem báo cáo chi tiết
            </button>
          </div>
          {/* Background decoration */}
          <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-rose-500/20 rounded-full blur-3xl"></div>
        </motion.div>
      </div>
    </div>
  );
}
