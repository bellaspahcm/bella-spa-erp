'use client';

import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';

export type KtvLeaveType = 'full_day' | 'morning' | 'afternoon';

export type KtvLeaveHistoryItem = {
  id: string;
  leave_date: string | number | Date;
  leave_type?: KtvLeaveType | string | null;
  reason?: string | null;
  status?: string | null;
  created_at?: string | number | Date | null;
  rejection_reason?: string | null;
};

type KtvLeaveRequestModalProps = {
  isOpen: boolean;
  leaveDate: string;
  leaveType: KtvLeaveType;
  leaveReason: string;
  isSubmitting: boolean;
  minLeaveDate: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  onLeaveDateChange: (value: string) => void;
  onLeaveTypeChange: (value: KtvLeaveType) => void;
  onLeaveReasonChange: (value: string) => void;
};

type KtvLeaveHistoryModalProps = {
  isOpen: boolean;
  leaveHistory: KtvLeaveHistoryItem[];
  isLoading: boolean;
  onClose: () => void;
};

function getLeaveTypeLabel(leaveType?: string | null) {
  if (leaveType === 'full_day') {
    return 'Cả ngày';
  }
  if (leaveType === 'morning') {
    return 'Sáng';
  }
  return 'Chiều';
}

function getLeaveStatusLabel(status?: string | null) {
  if (status === 'approved') {
    return 'Đã duyệt';
  }
  if (status === 'rejected') {
    return 'Từ chối';
  }
  return 'Chờ duyệt';
}

function getLeaveStatusClass(status?: string | null) {
  if (status === 'approved') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }
  if (status === 'rejected') {
    return 'bg-rose-50 text-rose-700 border-rose-100';
  }
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

function formatLeaveDate(value: string | number | Date) {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCreatedDate(value?: string | number | Date | null) {
  if (!value) {
    return 'Chưa có';
  }

  return new Date(value).toLocaleDateString('vi-VN');
}

export function KtvLeaveRequestModal({
  isOpen,
  leaveDate,
  leaveType,
  leaveReason,
  isSubmitting,
  minLeaveDate,
  onClose,
  onSubmit,
  onLeaveDateChange,
  onLeaveTypeChange,
  onLeaveReasonChange,
}: KtvLeaveRequestModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-[#1C1B19] rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-[#3E3A35] pointer-events-auto flex flex-col relative overflow-hidden max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 dark:from-[#5D1C34] dark:via-[#4D1328] dark:to-[#A67D44]" />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-[#292623] hover:bg-slate-200 dark:hover:bg-[#3E3A35] flex items-center justify-center text-slate-500 dark:text-[#D4C5B6] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mt-2 mb-6">
                <h3 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider">Đăng ký nghỉ phép</h3>
                <p className="text-xs text-rose-600 dark:text-[#A67D44] font-medium">Gửi yêu cầu nghỉ phép đến Quản trị viên</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4 flex-shrink overflow-y-auto pr-1 max-h-[calc(90vh-200px)]">
                <div>
                  <label className="text-[10px] font-black text-slate-900 dark:text-[#D4C5B6] uppercase tracking-wider mb-1.5 block">
                    Chọn ngày nghỉ phép
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveDate}
                    onChange={(event) => onLeaveDateChange(event.target.value)}
                    min={minLeaveDate}
                    className="w-full border border-slate-200 dark:border-[#3E3A35] dark:bg-[#292623] focus:ring-rose-500 dark:focus:ring-[#A67D44] focus:border-transparent rounded-2xl p-4 min-h-[56px] text-[16px] text-slate-800 dark:text-[#EFE9E1] placeholder-slate-600 dark:placeholder-[#D4C5B6]/60 focus:outline-none focus:ring-2 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-900 dark:text-[#D4C5B6] uppercase tracking-wider mb-1.5 block">
                    Thời gian nghỉ
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['full_day', 'morning', 'afternoon'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onLeaveTypeChange(option)}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 transition-all ${
                          leaveType === option
                            ? 'bg-rose-500 dark:bg-[#5D1C34] text-white border-rose-500 dark:border-[#A67D44] shadow-md shadow-rose-100 dark:shadow-none'
                            : 'bg-white dark:bg-[#292623] text-slate-700 dark:text-[#D4C5B6] border-slate-300 dark:border-[#3E3A35] hover:bg-slate-50 dark:hover:bg-[#3E3A35] hover:border-slate-400'
                        }`}
                      >
                        {getLeaveTypeLabel(option)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-900 dark:text-[#D4C5B6] uppercase tracking-wider mb-1.5 block">
                    Lý do xin nghỉ
                  </label>
                  <textarea
                    required
                    value={leaveReason}
                    onChange={(event) => onLeaveReasonChange(event.target.value)}
                    placeholder="Nêu rõ lý do cụ thể để quản lý duyệt..."
                    rows={3}
                    className="w-full border border-slate-200 dark:border-[#3E3A35] dark:bg-[#292623] focus:ring-rose-500 dark:focus:ring-[#A67D44] focus:border-transparent rounded-2xl p-4 text-[16px] text-slate-800 dark:text-[#EFE9E1] placeholder-slate-600 dark:placeholder-[#D4C5B6]/60 focus:outline-none focus:ring-2 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-rose-500 dark:bg-[#5D1C34] hover:bg-rose-600 dark:hover:bg-[#4D1328] text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-100 dark:shadow-none disabled:opacity-50 mt-4 animate-pulse"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    'Gửi đơn xin nghỉ'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function KtvLeaveHistoryModal({
  isOpen,
  leaveHistory,
  isLoading,
  onClose,
}: KtvLeaveHistoryModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-[#1C1B19] rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-[#3E3A35] pointer-events-auto flex flex-col relative overflow-hidden max-h-[80vh]"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 dark:from-[#3E3A35] dark:via-[#5D1C34] dark:to-[#A67D44]" />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-[#292623] hover:bg-slate-200 dark:hover:bg-[#3E3A35] flex items-center justify-center text-slate-500 dark:text-[#D4C5B6] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mt-2 mb-6">
                <h3 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider">Lịch sử nghỉ phép</h3>
                <p className="text-xs text-slate-700 dark:text-[#D4C5B6] font-medium">Danh sách đơn xin nghỉ phép của bạn</p>
              </div>

              <div className="flex-grow overflow-y-auto space-y-3 pr-1 max-h-[50vh]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-slate-700 dark:text-[#D4C5B6] animate-spin mb-2" />
                    <p className="text-xs text-slate-700 dark:text-[#D4C5B6] font-bold animate-pulse">Đang tải lịch sử...</p>
                  </div>
                ) : leaveHistory.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-xs text-slate-700 dark:text-[#D4C5B6] font-bold">Bạn chưa gửi đơn xin nghỉ phép nào</p>
                  </div>
                ) : (
                  leaveHistory.map((leave) => (
                    <div key={leave.id} className="bg-slate-50 dark:bg-[#292623] p-4 rounded-2xl border border-slate-100 dark:border-[#3E3A35] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-800 dark:text-[#EFE9E1]">{formatLeaveDate(leave.leave_date)}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${getLeaveStatusClass(leave.status)}`}>
                          {getLeaveStatusLabel(leave.status)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-700 dark:text-[#D4C5B6] font-bold flex gap-3">
                        <span>Ca: <strong className="text-slate-700 dark:text-[#EFE9E1] uppercase">{getLeaveTypeLabel(leave.leave_type)}</strong></span>
                        <span>Gửi ngày: {formatCreatedDate(leave.created_at)}</span>
                      </div>
                      <div className="text-xs text-slate-700 dark:text-[#D4C5B6] bg-white dark:bg-[#1C1B19] p-2.5 rounded-xl border border-slate-100 dark:border-[#3E3A35] leading-relaxed">
                        {leave.reason}
                      </div>
                      {leave.status === 'rejected' && leave.rejection_reason && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-500/10 p-2.5 rounded-xl border border-rose-100/50 dark:border-rose-500/30 leading-relaxed font-medium">
                          <strong>Lý do từ chối:</strong> {leave.rejection_reason}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
