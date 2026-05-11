'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Flower2,
  Calendar,
  ChevronRight,
  Clock,
  User,
  CheckCircle2
} from 'lucide-react';

const mockSessions = [
  { 
    id: '1', 
    customerName: 'Nguyễn Thu Thủy', 
    serviceName: 'Chăm sóc mẹ sau sinh - VIP', 
    totalSessions: 15, 
    usedSessions: 8, 
    lastSession: '2024-05-10',
    status: 'in_progress'
  },
  { 
    id: '2', 
    customerName: 'Trần Thị Mai', 
    serviceName: 'Massage bầu chuyên sâu', 
    totalSessions: 10, 
    usedSessions: 10, 
    lastSession: '2024-05-01',
    status: 'completed'
  },
  { 
    id: '3', 
    customerName: 'Lê Diệu Linh', 
    serviceName: 'Tắm bé & Massage', 
    totalSessions: 20, 
    usedSessions: 5, 
    lastSession: '2024-05-11',
    status: 'in_progress'
  },
];

export default function SessionsPage() {
  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Thẻ liệu trình</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý quá trình thực hiện dịch vụ của khách hàng</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tìm theo tên khách hàng, mã thẻ..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-slate-700"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-slate-600 text-sm">
            <Filter className="w-4 h-4" />
            Bộ lọc
          </button>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 gap-6">
        {mockSessions.map((session: any, idx: number) => (
          <motion.div 
            key={session.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-pink-100/50 transition-all flex flex-col md:flex-row md:items-center gap-8"
          >
            <div className="w-20 h-20 bg-pink-50 rounded-3xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform border border-pink-100 shadow-inner">
              <Flower2 className="text-primary w-10 h-10" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-slate-900 truncate">{session.customerName}</h3>
                <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                  session.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/10 text-primary'
                }`}>
                  {session.status === 'completed' ? 'Đã hoàn thành' : 'Đang thực hiện'}
                </span>
              </div>
              <p className="text-slate-600 font-bold mb-4">{session.serviceName}</p>
              
              <div className="flex flex-wrap gap-y-3 gap-x-8 text-sm font-medium text-slate-500">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-primary/60" />
                  Tiến độ: <span className="text-slate-900 font-black">{session.usedSessions}/{session.totalSessions} buổi</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-primary/60" />
                  Buổi gần nhất: <span className="text-slate-900 font-black">{session.lastSession}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-5 w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(session.usedSessions / session.totalSessions) * 100}%` }}
                  className={`h-full ${session.status === 'completed' ? 'bg-emerald-500' : 'bg-primary'}`}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 md:border-l md:pl-8 border-slate-100">
              <button className="flex items-center gap-3 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black transition-all text-sm uppercase tracking-widest shadow-lg shadow-slate-200">
                {session.status === 'completed' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Xem hồ sơ
                  </>
                ) : (
                  <>
                    Chi tiết
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
