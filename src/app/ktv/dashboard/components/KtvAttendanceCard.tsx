'use client';

import { Calendar as CalendarIcon, Clock } from 'lucide-react';

export type KtvTodayAttendance = {
  status?: string | null;
  checkin_time?: string | number | Date | null;
  checkout_time?: string | number | Date | null;
} | null;

type KtvAttendanceCardProps = {
  todayAttendance: KtvTodayAttendance;
  isAttendanceLoading: boolean;
  onCheckIn: () => void | Promise<void>;
  onCheckOut: () => void | Promise<void>;
  onOpenLeaveModal: () => void;
  onOpenLeaveHistory: () => void;
};

function formatAttendanceTime(value?: string | number | Date | null) {
  if (!value) {
    return '--:--';
  }

  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAttendanceStatusLabel(status?: string | null) {
  if (status === 'present') {
    return 'Đúng giờ';
  }
  if (status === 'late') {
    return 'Đi trễ';
  }
  if (status === 'half_day') {
    return 'Nửa ngày';
  }
  return 'Vắng mặt';
}

function getAttendanceStatusClass(status?: string | null) {
  if (status === 'present') {
    return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
  }
  if (status === 'late') {
    return 'bg-amber-50 text-amber-600 border border-amber-100';
  }
  if (status === 'half_day') {
    return 'bg-blue-50 text-blue-600 border border-blue-100';
  }
  return 'bg-rose-50 text-rose-600 border border-rose-100';
}

export function KtvAttendanceCard({
  todayAttendance,
  isAttendanceLoading,
  onCheckIn,
  onCheckOut,
  onOpenLeaveModal,
  onOpenLeaveHistory,
}: KtvAttendanceCardProps) {
  return (
    <div className="px-6 mt-6">
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100/50 relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Điểm danh hôm nay</h4>
            <p className="text-sm font-bold text-slate-700 mt-0.5">Thời gian vào ca tiêu chuẩn: 08:30 sáng</p>
          </div>

          {todayAttendance && (
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getAttendanceStatusClass(todayAttendance.status)}`}>
              {getAttendanceStatusLabel(todayAttendance.status)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-100 rounded-2xl p-4 text-center border border-slate-200">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-1">Giờ Check-in</span>
            <span className="text-lg font-black text-slate-900">
              {formatAttendanceTime(todayAttendance?.checkin_time)}
            </span>
          </div>
          <div className="bg-slate-100 rounded-2xl p-4 text-center border border-slate-200">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-1">Giờ Check-out</span>
            <span className="text-lg font-black text-slate-900">
              {formatAttendanceTime(todayAttendance?.checkout_time)}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          {!todayAttendance ? (
            <button
              onClick={() => onCheckIn()}
              disabled={isAttendanceLoading}
              className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all shadow-lg shadow-slate-200 dark:shadow-none text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAttendanceLoading ? 'Đang gửi...' : 'Đầu ca: CHECK-IN'}
            </button>
          ) : !todayAttendance.checkout_time ? (
            <button
              onClick={() => onCheckOut()}
              disabled={isAttendanceLoading}
              className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all shadow-lg shadow-slate-200 text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAttendanceLoading ? 'Đang gửi...' : 'Cuối ca: CHECK-OUT'}
            </button>
          ) : (
            <div className="flex-1 py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 font-black rounded-2xl text-xs uppercase tracking-widest text-center">
              🎉 Bạn đã hoàn thành chấm công hôm nay
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onOpenLeaveModal}
            className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
          >
            <CalendarIcon className="w-4 h-4" />
            Đăng ký nghỉ
          </button>
          <button
            onClick={onOpenLeaveHistory}
            className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
          >
            <Clock className="w-4 h-4" />
            Lịch sử nghỉ
          </button>
        </div>
      </div>
    </div>
  );
}
