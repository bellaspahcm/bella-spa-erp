'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Flower2,
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  Loader2,
  TrendingUp,
  ChevronDown
} from 'lucide-react';
import { getSessionsWithDetails, completeSession, getSessionLogs } from '@/services/booking-actions';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái');

  const statusOptions = ['Tất cả trạng thái', 'Đang chăm sóc', 'Hoàn thành'];

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const data = await getSessionsWithDetails();
    setSessions(data);
    setLoading(false);
  };

  const handleUpdateProgress = async (bookingId: string) => {
    setUpdatingId(bookingId);
    try {
      // 1. Get logs to find the next scheduled session
      const logs = await getSessionLogs(bookingId);
      const nextSession = logs.find((log: any) => log.status === 'scheduled');
      
      if (nextSession) {
        await completeSession(nextSession.id, bookingId);
        await loadSessions();
      } else {
        alert('Tất cả buổi đã hoàn thành!');
      }
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto" onClick={() => setIsFilterOpen(false)}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Thẻ liệu trình</h1>
          <p className="text-slate-500 font-medium mt-1">Theo dõi tiến độ chăm sóc khách hàng</p>
        </div>
        <div className="flex items-center gap-3 bg-emerald-50 px-5 py-3 rounded-2xl border border-emerald-100">
          <TrendingUp className="text-emerald-500 w-5 h-5" />
          <span className="text-emerald-700 font-bold text-sm">Hiệu suất: +12% tháng này</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tìm tên khách hàng hoặc mã hợp đồng..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-slate-700"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto relative">
          <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-slate-600 text-sm">
            <Filter className="w-4 h-4" />
            Bộ lọc
          </button>
          
          {/* Custom Premium Select */}
          <div className="relative min-w-[200px]">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
              className="w-full flex items-center justify-between px-5 py-3 bg-white border border-slate-200 rounded-2xl hover:border-primary/30 transition-all font-bold text-slate-600 text-sm outline-none"
            >
              <span>{statusFilter}</span>
              <motion.div
                animate={{ rotate: isFilterOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 4, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden p-1.5"
                >
                  {statusOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => { setStatusFilter(option); setIsFilterOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                        statusFilter === option 
                          ? "bg-primary text-white shadow-lg shadow-pink-100" 
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">Đang tải dữ liệu...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-20 text-center border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Flower2 className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Chưa có thẻ liệu trình nào</h3>
          <p className="text-slate-500">Hãy tạo hợp đồng mới để bắt đầu theo dõi tiến độ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {sessions.map((booking: any, idx: number) => {
            const progress = ((booking.completed_sessions || 0) / (booking.total_sessions || 21)) * 100;
            const isUpdating = updatingId === booking.id;
            const isFullyCompleted = (booking.completed_sessions || 0) >= (booking.total_sessions || 21);

            return (
              <motion.div 
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-pink-100/40 transition-all flex flex-col md:flex-row md:items-center gap-8 relative overflow-hidden"
              >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="w-20 h-20 bg-gradient-to-br from-pink-50 to-white rounded-3xl flex items-center justify-center flex-shrink-0 border border-pink-100 shadow-inner group-hover:scale-110 transition-transform">
                  <Flower2 className="text-primary w-10 h-10" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-slate-900 truncate">
                      {booking.customers?.name_mother}
                    </h3>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                      {booking.booking_number}
                    </span>
                    <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                      isFullyCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-primary/10 text-primary border border-primary/10'
                    }`}>
                      {isFullyCompleted ? 'Hoàn thành' : 'Đang chăm sóc'}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-y-3 gap-x-8 text-sm font-medium text-slate-500 mb-5">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-primary/60" />
                      Tiến độ: <span className="text-slate-900 font-black">{booking.completed_sessions || 0}/{booking.total_sessions || 21} buổi</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-primary/60" />
                      Bắt đầu: <span className="text-slate-900 font-black">{booking.start_date || '---'}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full relative ${isFullyCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </motion.div>
                  </div>
                </div>

                <div className="flex items-center gap-4 md:border-l md:pl-8 border-slate-100">
                  {!isFullyCompleted ? (
                    <button 
                      onClick={() => handleUpdateProgress(booking.id)}
                      disabled={isUpdating}
                      className="flex items-center gap-3 bg-primary hover:bg-primary-hover disabled:bg-slate-200 text-white px-8 py-4 rounded-2xl font-black transition-all text-sm uppercase tracking-widest shadow-lg shadow-pink-100 active:scale-95 min-w-[200px] justify-center"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Đang lưu...
                        </>
                      ) : (
                        <>
                          Cập nhật buổi { (booking.completed_sessions || 0) + 1 }
                          <ChevronRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 text-emerald-500 font-black uppercase tracking-widest text-sm bg-emerald-50 px-6 py-4 rounded-2xl border border-emerald-200">
                      <CheckCircle2 className="w-5 h-5" />
                      Đã hoàn tất
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
