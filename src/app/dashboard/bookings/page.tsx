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

const mockBookings = [
  { id: '1', customer: 'Nguyễn Thu Thủy', package: 'Gói Thông Tắc Tia Sữa', time: '09:00 - 11:00', ktv: 'Nguyễn Thị Hoa', status: 'completed' },
  { id: '2', customer: 'Trần Thị Mai', package: 'Gói Bầu VIP (21 Buổi)', time: '14:00 - 16:00', ktv: 'Lê Thu Hà', status: 'in_progress' },
  { id: '3', customer: 'Lê Diệu Linh', package: 'Gói Sau Sinh Basic', time: '16:30 - 18:30', ktv: 'Phạm Minh Tuyết', status: 'scheduled' },
];

export default function BookingsPage() {
  const [view, setView] = useState<'list' | 'calendar'>('list');

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
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-slate-400" />
            </button>
            <h2 className="text-xl font-extrabold text-slate-900">Thứ Hai, 11 Tháng 5, 2026</h2>
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <ChevronRight className="w-6 h-6 text-slate-400" />
            </button>
          </div>
          <button className="text-sm font-bold text-rose-500 bg-rose-50 px-4 py-2 rounded-full">
            Hôm nay
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, i) => (
            <div key={i} className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{day}</p>
              <div className={`w-10 h-14 mx-auto flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer ${
                i === 1 ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'hover:bg-slate-50 text-slate-600'
              }`}>
                <span className="text-lg font-black">{10 + i}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bookings Timeline */}
      <div className="space-y-4">
        {mockBookings.map((booking, idx) => (
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
