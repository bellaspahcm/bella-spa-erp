'use client';

import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, LayoutGrid, Loader2, QrCode } from 'lucide-react';

import type { TimelineSession } from './BookingsTimelineGrid';

type BookingsDayTimelineListProps = {
  sessions: TimelineSession[];
  selectedDate: Date;
  isSyncing: boolean;
  isSameDay: (d1: Date | string, d2: Date | string) => boolean;
  onSessionSelect: (session: TimelineSession) => void;
  onQrClick: (bookingId: string) => void;
  onCareClick: (session: TimelineSession) => void;
};

export function BookingsDayTimelineList({
  sessions,
  selectedDate,
  isSyncing,
  isSameDay,
  onSessionSelect,
  onQrClick,
  onCareClick,
}: BookingsDayTimelineListProps) {
  const daySessions = sessions
    .filter((session) => isSameDay(new Date(session.assigned_date || 0), selectedDate))
    .sort((a, b) => new Date(b.assigned_date).getTime() - new Date(a.assigned_date).getTime());

  return (
    <div id="bookings-timeline" className="space-y-4 scroll-mt-8">
      {isSyncing && sessions.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
        </div>
      ) : daySessions.length > 0 ? (
        daySessions.map((session, idx) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative pl-8 group"
          >
            <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-slate-100 group-last:bottom-1/2" />
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 border-white shadow-md z-10 ${
                session.status === 'completed'
                  ? 'bg-emerald-500'
                  : session.status === 'in_progress'
                    ? 'bg-blue-500'
                    : session.status === 'scheduled'
                      ? 'bg-amber-500'
                      : 'bg-slate-300'
              }`}
            />

            <div
              onClick={() => onSessionSelect(session)}
              className="luxury-card-white p-6 rounded-3xl transition-all flex flex-col md:flex-row md:items-center gap-6 cursor-pointer hover:shadow-xl hover:border-primary/20"
            >
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5 text-slate-900 font-black">
                    <Clock className="w-4 h-4 text-rose-500" />
                    {session.assigned_time || '09:00 - 11:00'}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      session.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-600'
                        : session.status === 'scheduled'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    {session.status === 'completed'
                      ? 'Hoàn thành'
                      : session.status === 'scheduled'
                        ? 'Sắp tới'
                        : 'Khác'}
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                  Mẹ: {session.bookings?.customers?.name_mother}
                  {session.bookings?.customers?.name_baby && (
                    <span className="text-rose-400 ml-2 font-medium">
                      {' '}
                      - Bé: {session.bookings.customers.name_baby}
                    </span>
                  )}
                </h3>
                <p className="text-slate-500 font-bold text-sm flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-slate-300" />
                  {session.bookings?.packages?.name || session.bookings?.package_name || 'Gói liệu trình'}
                </p>
              </div>

              <div className="flex flex-col md:items-end gap-3 md:border-l md:pl-8 border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Kỹ thuật viên</p>
                    <p className="font-bold text-slate-900">
                      {session.bookings?.assigned_ktv?.full_name || 'Chưa phân công'}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                    {session.bookings?.assigned_ktv?.full_name?.[0] || 'K'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onQrClick(session.booking_id);
                    }}
                    className="p-2 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-500 hover:text-rose-600 transition-colors flex items-center justify-center border border-rose-100/50 active:scale-95"
                    title="Thanh toán VietQR"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSessionSelect(session);
                    }}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-600 transition-colors"
                  >
                    Dời lịch
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCareClick(session);
                    }}
                    className="px-4 py-2 bg-primary hover:bg-rose-600 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1 shadow-lg shadow-rose-100 dark:shadow-none"
                  >
                    Chăm sóc
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))
      ) : (
        <div className="bg-white/50 border border-dashed border-slate-200 rounded-[32px] p-12 text-center">
          <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-bold">Không có lịch hẹn nào cho ngày này</p>
        </div>
      )}
    </div>
  );
}
