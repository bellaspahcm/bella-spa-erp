'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Flower2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  TrendingUp, 
  AlertCircle, 
  UserCircle, 
  MessageSquare, 
  History, 
  ChevronRight 
} from 'lucide-react';
import { cn, resolvePackageName } from '@/lib/utils';
import { toast } from 'sonner';
import { SessionBooking } from '../types';

interface SessionCardProps {
  booking: SessionBooking;
  idx: number;
  userRole: 'KTV' | 'admin' | '';
  updatingId: string | null;
  isReusingId: string | null;
  onSelect: () => void;
  onUpdateProgress: (bookingId: string, quickNote: string) => Promise<void>;
  onReusePackage: (bookingId: string, customerName: string) => Promise<void>;
}

export function SessionCard({
  booking,
  idx,
  userRole,
  updatingId,
  isReusingId,
  onSelect,
  onUpdateProgress,
  onReusePackage
}: SessionCardProps) {
  const [quickNote, setQuickNote] = useState('');
  
  const completedCount = Number(booking.completed_sessions) || 0;
  const totalCount = Number(booking.total_sessions) || 15;
  const progress = (completedCount / Math.max(1, totalCount)) * 100;
  const isUpdating = updatingId === booking.id;
  const isFullyCompleted = completedCount >= totalCount;
  
  const today = new Date().toLocaleDateString('sv-SE');
  const alreadyDoneToday = booking.last_updated_date === today;
  const isScheduledForToday = booking.next_session_date === today;
  const hasKtv = !!booking.assigned_ktv_id;

  const handleUpdateClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // UI Hard Lock: Block if no KTV assigned
    if (!booking.assigned_ktv_id) {
      toast.error('⚠️ Chưa phân công KTV. Vui lòng vào trang Chi tiết khách hàng để phân KTV trước!');
      return;
    }
    
    if (alreadyDoneToday && userRole !== 'admin') {
      toast.warning('Bạn đã cập nhật buổi tập hôm nay rồi. Chỉ Admin mới có quyền điều chỉnh thêm!');
      return;
    }

    if (!isScheduledForToday && userRole !== 'admin') {
      toast.warning(`Buổi này được hẹn vào ngày ${booking.next_session_date || 'chưa xác định'}. Chỉ có thể cập nhật vào đúng ngày hẹn!`);
      return;
    }

    await onUpdateProgress(booking.id, quickNote);
    setQuickNote(''); // Clear quick note on success
  };

  const handleReuseClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const customerLabel = `Mẹ ${booking.customers?.name_mother || ''}${booking.customers?.name_baby ? ` & Bé ${booking.customers.name_baby}` : ''}`;
    await onReusePackage(booking.id, customerLabel);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      onClick={onSelect}
      className="group luxury-card-white p-6 rounded-[2.5rem] transition-all flex flex-col md:flex-row md:items-center gap-8 relative cursor-pointer border border-slate-100 hover:shadow-lg"
    >
      {/* Background blur container with overflow-hidden */}
      <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="w-16 h-16 bg-gradient-to-br from-pink-50 to-white rounded-2xl flex items-center justify-center flex-shrink-0 border border-pink-100 shadow-inner group-hover:scale-110 transition-transform relative z-10">
        <Flower2 className="text-primary w-8 h-8" />
      </div>
      
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h3 className="text-xl font-black text-slate-900 truncate tracking-tight uppercase">
            Mẹ {booking.customers?.name_mother} {booking.customers?.name_baby ? `& Bé ${booking.customers.name_baby}` : ''}
          </h3>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-rose-50 text-primary rounded-lg text-[9px] font-black uppercase tracking-[0.05em] border border-primary/10">
              {resolvePackageName(booking)}
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
              {booking.booking_number}
            </span>
          </div>
          <span className={cn(
            "px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border",
            isFullyCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-primary/5 text-primary border-primary/10'
          )}>
            {isFullyCompleted ? 'Hoàn thành' : 'Đang chăm sóc'}
          </span>
          {/* Badge cảnh báo chưa phân KTV */}
          {!hasKtv && !isFullyCompleted && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200">
              <AlertCircle className="w-3 h-3" />
              Chưa phân KTV
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap gap-y-3 gap-x-8 text-sm font-bold text-slate-500 mb-5">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-primary/60" />
            Tiến độ: <span className="text-slate-900 font-black">{completedCount}/{totalCount} buổi</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-primary/60" />
            Bắt đầu: <span className="text-slate-900 font-black tracking-tighter">{booking.start_date || '---'}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <UserCircle className="w-4 h-4 text-primary/60" />
            KTV: <span className={cn("font-black", hasKtv ? "text-slate-900" : "text-amber-500")}>
              {booking.assigned_ktv_name || 'Chưa phân công'}
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner relative">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full relative", isFullyCompleted ? 'bg-emerald-500' : 'bg-primary')}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:items-end md:border-l md:pl-8 border-slate-100 min-w-[280px] justify-center relative z-10">
        {/* Continuity Context: Show last session's note before the new update */}
        {(() => {
          const completedLogs = (booking.session_logs || [])
            .filter((l) => l.status === 'completed')
            .sort((a, b2) => (b2.session_number || 0) - (a.session_number || 0));
          const lastLog = completedLogs[0];
          if (lastLog && lastLog.notes && !isFullyCompleted && !alreadyDoneToday) {
            return (
              <div className="w-full mb-1 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <History className="w-3 h-3 text-amber-500" />
                  <span className="text-[9px] font-black text-amber-700 uppercase tracking-tighter">Ghi chú buổi {lastLog.session_number}</span>
                </div>
                <p className="text-[10px] font-medium text-slate-600 line-clamp-2 leading-tight italic">"{lastLog.notes}"</p>
              </div>
            );
          }
          return null;
        })()}
        
        {!isFullyCompleted && !alreadyDoneToday && (
          <div className="relative w-full">
            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input 
              type="text"
              placeholder="Ghi chú nhanh buổi này..."
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border-none rounded-xl text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
        )}
        
        {!isFullyCompleted ? (
          !hasKtv ? (
            // Hard Lock UI: Chưa phân KTV
            <div className="w-full flex flex-col gap-2">
              <div className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 font-black text-[10px] uppercase tracking-widest justify-center">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Chưa phân công KTV</span>
              </div>
              <p className="text-center text-[9px] font-bold text-slate-400 leading-snug">
                Vào <Link href={`/dashboard/customers/${booking.customers?.id}?bookingId=${booking.id}`} className="text-primary hover:underline font-black cursor-pointer underline-offset-2" onClick={(e) => e.stopPropagation()}>Chi tiết khách hàng</Link> để phân KTV trước khi cập nhật buổi
              </p>
            </div>
          ) : (
            <button 
              onClick={handleUpdateClick}
              disabled={isUpdating}
              className={cn(
                "w-full flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all text-[10px] uppercase tracking-widest justify-center shadow-lg active:scale-95",
                (alreadyDoneToday || (!isScheduledForToday && userRole !== 'admin')) 
                  ? "bg-slate-100 text-slate-400 shadow-none cursor-not-allowed" 
                  : "bg-primary text-white shadow-pink-100 dark:shadow-none hover:bg-primary-hover"
              )}
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : alreadyDoneToday && userRole !== 'admin' ? (
                <><CheckCircle2 className="w-4 h-4" /> Đã xong hôm nay</>
              ) : !isScheduledForToday && userRole !== 'admin' ? (
                <><Clock className="w-4 h-4" /> Chưa đến ngày ({booking.next_session_date || '---'})</>
              ) : (
                <><ChevronRight className="w-4 h-4" /> Cập nhật buổi {(booking.completed_sessions || 0) + 1}</>
              )}
            </button>
          )
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3 text-emerald-500 font-black uppercase tracking-widest text-[10px] bg-emerald-50 px-6 py-4 rounded-2xl border border-emerald-200 justify-center">
              <CheckCircle2 className="w-4 h-4" /> Đã hoàn tất
            </div>
            <button 
              onClick={handleReuseClick}
              disabled={isReusingId === booking.id}
              className="w-full flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md active:scale-95 justify-center"
            >
              {isReusingId === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              Tái sử dụng gói nhanh
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
