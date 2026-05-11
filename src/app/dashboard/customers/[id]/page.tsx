'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight,
  Phone, 
  MapPin, 
  Baby, 
  Calendar, 
  ClipboardList, 
  DollarSign, 
  Clock, 
  MessageCircle,
  Heart,
  History,
  TrendingUp,
  FileText
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { MOCK_CUSTOMERS, MOCK_BOOKINGS, MOCK_SESSIONS } from '@/constants/mock-data';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const baseCustomer = MOCK_CUSTOMERS.find(c => c.id === id) || MOCK_CUSTOMERS[0];
  const booking = MOCK_BOOKINGS.find(b => b.customer_id === id) || {
    id: 'none',
    package_name: baseCustomer.package_name || 'Chưa đăng ký',
    total_sessions: 0,
    completed_sessions: 0,
    start_date: baseCustomer.status === 'deposit' ? 'Dự kiến sau sinh' : 'Chưa có',
    deposit_amount: baseCustomer.deposit_amount || '0đ',
    full_price: '0đ'
  };

  const sessions = MOCK_SESSIONS.filter(s => s.booking_id === booking.id);

  const customer = {
    ...baseCustomer,
    baby: { 
      name: baseCustomer.name_baby || 'Chưa có', 
      dob: baseCustomer.dob_baby || baseCustomer.dob_expected || 'Chưa cập nhật',
      gender: 'Chưa xác định'
    },
    booking: {
      package: booking.package_name,
      total_sessions: booking.total_sessions,
      completed_sessions: booking.completed_sessions,
      start_date: booking.start_date,
      deposit: booking.deposit_amount,
      remaining: booking.full_price
    },
    sessions: sessions
  };

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      {/* Back Button */}
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold transition-all mb-8 group"
      >
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 group-hover:bg-primary group-hover:text-white transition-all">
          <ChevronLeft className="w-5 h-5" />
        </div>
        Quay lại danh sách
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Profile Card */}
        <div className="xl:col-span-1 space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden"
          >
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-32 h-32 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl shadow-rose-100 border-4 border-white">
                <Heart className="text-primary w-14 h-14" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">{customer.name_mother}</h1>
              <span className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8",
                customer.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              )}>
                {customer.status === 'active' ? 'Đang chăm sóc' : 'Chờ sinh (Đã cọc)'}
              </span>

              <div className="w-full space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Điện thoại</p>
                    <p className="font-bold text-slate-700">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Địa chỉ</p>
                    <p className="font-bold text-slate-700 truncate max-w-[150px]">{customer.address}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100"
          >
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <Baby className="text-primary w-6 h-6" />
              Thông tin Bé
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                <span className="text-sm font-bold text-slate-500">Tên của bé</span>
                <span className="font-black text-slate-900">{customer.baby.name}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-sm font-bold text-slate-500">Ngày sinh / Dự sinh</span>
                <span className="font-black text-slate-900">{customer.baby.dob}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-sm font-bold text-slate-500">Giới tính</span>
                <span className="font-black text-slate-900">{customer.baby.gender}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Dashboard Details */}
        <div className="xl:col-span-2 space-y-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Tiến độ', value: `${customer.booking.completed_sessions}/${customer.booking.total_sessions}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { label: 'Đã thanh toán', value: customer.booking.deposit, icon: DollarSign, color: 'text-primary', bg: 'bg-rose-50' },
              { label: 'Ngày bắt đầu', value: customer.booking.start_date, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="bg-white p-6 rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-5"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", stat.bg)}>
                  <stat.icon className={cn("w-7 h-7", stat.color)} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-xl font-black text-slate-900">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Package Details */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32" />
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-2">Gói dịch vụ hiện tại</p>
                  <h2 className="text-3xl font-black">{customer.booking.package}</h2>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                    <p className="text-[10px] opacity-60 font-bold uppercase mb-1">Tổng cộng</p>
                    <p className="font-black text-lg">15,500,000đ</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                    <p className="text-[10px] opacity-60 font-bold uppercase mb-1">Còn lại</p>
                    <p className="font-black text-lg text-primary">{customer.booking.remaining}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-end gap-3">
                <button className="flex items-center justify-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black transition-all hover:bg-primary hover:text-white uppercase tracking-widest text-xs">
                  <MessageCircle className="w-4 h-4" />
                  Gửi báo cáo Zalo
                </button>
                <button className="flex items-center justify-center gap-3 bg-white/10 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-2xl font-black transition-all hover:bg-white/20 uppercase tracking-widest text-xs">
                  <FileText className="w-4 h-4" />
                  Xuất hợp đồng
                </button>
              </div>
            </div>
          </motion.div>

          {/* Session History */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <History className="text-primary w-6 h-6" />
                Lịch sử chăm sóc
              </h3>
              <button className="text-sm font-bold text-primary hover:underline">Xem tất cả</button>
            </div>

            <div className="space-y-4">
              {customer.sessions.length > 0 ? (
                customer.sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{session.type}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">KTV: {session.ktv} • {session.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Hoàn thành</span>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold italic">Chưa có dữ liệu liệu trình</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">Khách hàng đang trong trạng thái chờ sinh</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
