'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List
} from 'lucide-react';

import { MOCK_BOOKINGS } from '@/constants/mock-data';

const mockBookings = MOCK_BOOKINGS.map(b => ({
  id: b.id,
  customer: b.customers?.name_mother || 'Khách hàng',
  package: b.package_name,
  time: '09:00 - 11:00', // Mock time
  ktv: 'Kỹ thuật viên',
  status: b.status === 'in_progress' ? 'in_progress' : b.status === 'booked' ? 'scheduled' : 'completed'
}));

export default function BookingsPage() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      return day;
    });
  };

  const weekDays = getWeekDays(selectedDate);
  const today = new Date();
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('vi-VN', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(date);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
  };

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Lịch hẹn</h1>
          <p className="text-slate-500 font-medium mt-1">Điều phối và theo dõi lịch chăm sóc</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-2xl border border-slate-200 flex">
            <button 
              onClick={() => setView('list')}
              className={`p-2 rounded-xl transition-all ${view === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setView('calendar')}
              className={`p-2 rounded-xl transition-all ${view === 'calendar' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          <button className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-slate-200">
            <Plus className="w-5 h-5" />
            <span>Tạo lịch mới</span>
          </button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                const prev = new Date(selectedDate);
                prev.setDate(prev.getDate() - 7);
                setSelectedDate(prev);
              }}
              className="p-2 hover:bg-slate-50 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-slate-400" />
            </button>
            <h2 className="text-xl font-extrabold text-slate-900 capitalize">{formatDate(selectedDate)}</h2>
            <button 
              onClick={() => {
                const next = new Date(selectedDate);
                next.setDate(next.getDate() + 7);
                setSelectedDate(next);
              }}
              className="p-2 hover:bg-slate-50 rounded-full transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-slate-400" />
            </button>
          </div>
          <button 
            onClick={() => setSelectedDate(new Date())}
            className="text-sm font-bold text-rose-500 bg-rose-50 px-4 py-2 rounded-full hover:bg-rose-100 transition-colors"
          >
            Hôm nay
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((dayName: string, i: number) => {
            const date = weekDays[i];
            const isToday = isSameDay(date, today);
            const isSelected = isSameDay(date, selectedDate);
            
            return (
              <div key={i} className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{dayName}</p>
                <div 
                  onClick={() => setSelectedDate(date)}
                  className={`w-10 h-14 mx-auto flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                      : isToday 
                        ? 'bg-rose-50 border border-rose-200 text-rose-500' 
                        : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="text-lg font-black">{date.getDate()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bookings Timeline */}
      <div className="space-y-4">
        {mockBookings.map((booking: any, idx: number) => (
          <motion.div 
            key={booking.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative pl-8 group"
          >
            {/* Timeline Line */}
            <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-slate-100 group-last:bottom-1/2"></div>
            {/* Timeline Dot */}
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 border-white shadow-md z-10 ${
              booking.status === 'completed' ? 'bg-emerald-500' : booking.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-300'
            }`}></div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm group-hover:shadow-xl group-hover:shadow-slate-200/40 transition-all flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5 text-slate-900 font-black">
                    <Clock className="w-4 h-4 text-rose-500" />
                    {booking.time}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    booking.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                    booking.status === 'in_progress' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                  }`}>
                    {booking.status === 'completed' ? 'Hoàn thành' : 
                     booking.status === 'in_progress' ? 'Đang thực hiện' : 'Sắp tới'}
                  </span>
                </div>
                
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">{booking.customer}</h3>
                <p className="text-slate-500 font-bold text-sm flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-slate-300" />
                  {booking.package}
                </p>
              </div>

              <div className="flex flex-col md:items-end gap-3 md:border-l md:pl-8 border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Kỹ thuật viên</p>
                    <p className="font-bold text-slate-900">{booking.ktv}</p>
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                    {booking.ktv.split(' ').pop()?.[0]}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-600 transition-colors">
                    Dời lịch
                  </button>
                  <button className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors">
                    Check-in
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
