'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Baby, CheckCircle2, Clock, RefreshCw, X } from 'lucide-react';

import type { KtvDashboardSession } from './KtvSessionSections';

type KtvCheckoutConfirmModalProps = {
  session: KtvDashboardSession | null;
  checkoutNotes: string;
  ktvCheckoutNote: string;
  isActionLoading: string | null;
  onClose: () => void;
  onCheckoutNotesChange: (value: string) => void;
  onKtvCheckoutNoteChange: (value: string) => void;
  onConfirm: (session: KtvDashboardSession, notes: string, ktvCheckoutNote: string) => void | Promise<void>;
};

function getCheckoutTiming(session: KtvDashboardSession | null) {
  let elapsedMinutes = 0;
  let standardDuration = 60;
  let timeDeviation = 0;

  if (session) {
    const startTime = session.start_time ? new Date(session.start_time) : null;
    if (startTime) {
      elapsedMinutes = Math.round((new Date().getTime() - startTime.getTime()) / 60000);
    }

    const durationStr = session.bookings?.packages?.duration;
    if (durationStr) {
      const match = durationStr.match(/(\d+)/);
      if (match) {
        standardDuration = parseInt(match[1], 10);
      }
    }

    timeDeviation = elapsedMinutes - standardDuration;
  }

  return {
    elapsedMinutes,
    standardDuration,
    timeDeviation,
    isUnderTime: timeDeviation < 0 && Math.abs(timeDeviation) > 5,
    isOverTime: timeDeviation > 0,
  };
}

function formatStartTime(value?: string | number | Date | null) {
  if (!value) {
    return '--:--';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function KtvCheckoutConfirmModal({
  session,
  checkoutNotes,
  ktvCheckoutNote,
  isActionLoading,
  onClose,
  onCheckoutNotesChange,
  onKtvCheckoutNoteChange,
  onConfirm,
}: KtvCheckoutConfirmModalProps) {
  const timing = getCheckoutTiming(session);
  const isCheckoutDisabled = timing.isUnderTime && !ktvCheckoutNote.trim();

  return (
    <AnimatePresence>
      {session && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (isActionLoading === null) {
                onClose();
              }
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-slate-100 pointer-events-auto flex flex-col relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />

              <button
                onClick={onClose}
                disabled={isActionLoading !== null}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mt-4 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-md shadow-emerald-50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <span className="text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest mb-3 bg-emerald-50 text-emerald-600 border border-emerald-100">
                  Xác nhận hoàn thành
                </span>

                <h3 className="text-lg font-black text-slate-900 leading-tight mb-4 px-2">
                  Hoàn thành buổi chăm sóc?
                </h3>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 w-full text-left space-y-3 mb-5">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-block mb-1">
                        {session.bookings?.package_name}
                      </span>
                      <div className="font-black text-sm text-slate-800 truncate">{session.bookings?.customers?.name_mother}</div>
                      <div className="text-xs text-rose-500 font-bold mt-0.5 flex items-center gap-1">
                        <Baby className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Bé: {session.bookings?.customers?.name_baby || 'Chưa sinh/Chưa có'}</span>
                      </div>
                    </div>
                    <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ml-2">
                      Buổi {session.session_number}/{session.bookings?.total_sessions || '--'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Bắt đầu: {formatStartTime(session.start_time)}
                    </span>
                    <span>Hôm nay ({timing.elapsedMinutes} phút)</span>
                  </div>
                </div>

                {timing.isUnderTime && (
                  <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 text-left mb-5">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-1">⚠️ Cảnh báo thiếu thời gian</p>
                    <p className="text-xs text-rose-600 font-bold leading-normal">
                      Bạn làm chưa đủ thời gian tiêu chuẩn của gói liệu trình ({timing.standardDuration} phút). Thực tế chỉ mới thực hiện được {timing.elapsedMinutes} phút (thiếu {Math.abs(timing.timeDeviation)} phút).
                    </p>
                    <p className="text-[10px] text-rose-500 italic mt-2">
                      * Vui lòng nhập lý do cụ thể ở phần phản hồi bắt buộc dưới đây.
                    </p>
                  </div>
                )}

                {timing.isOverTime && (
                  <div className="w-full bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left mb-5">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-1">⏰ Cảnh báo quá giờ</p>
                    <p className="text-xs text-amber-600 font-bold leading-normal">
                      Bạn đã làm quá thời gian quy định của gói ({timing.standardDuration} phút). Hãy sắp xếp nhanh để kịp ca chăm khách theo lịch phía sau!
                    </p>
                  </div>
                )}

                {timing.isUnderTime && (
                  <div className="w-full text-left mb-4">
                    <label className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-2 block">
                      Lý do làm thiếu thời gian (Bắt buộc)
                    </label>
                    <textarea
                      value={ktvCheckoutNote}
                      onChange={(event) => onKtvCheckoutNoteChange(event.target.value)}
                      placeholder="Nhập lý do vì sao buổi chăm sóc kết thúc sớm (ví dụ: Bé quấy khóc, Khách yêu cầu dừng sớm...)"
                      disabled={isActionLoading !== null}
                      className="w-full border border-rose-200 focus:ring-rose-500 rounded-2xl p-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all min-h-[80px] resize-none"
                    />
                  </div>
                )}

                <div className="w-full text-left mb-6">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">
                    Ghi chú chăm sóc (không bắt buộc)
                  </label>
                  <textarea
                    value={checkoutNotes}
                    onChange={(event) => onCheckoutNotesChange(event.target.value)}
                    placeholder="Nhập tình trạng của bé, sữa bé uống, lưu ý cho buổi sau..."
                    disabled={isActionLoading !== null}
                    className="w-full border border-slate-200 rounded-2xl p-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[80px] resize-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => onConfirm(session, checkoutNotes, ktvCheckoutNote)}
                  disabled={isActionLoading !== null || isCheckoutDisabled}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-100 disabled:opacity-50"
                >
                  {isActionLoading !== null ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Xác nhận & Check-out
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={isActionLoading !== null}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                >
                  Quay lại
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
