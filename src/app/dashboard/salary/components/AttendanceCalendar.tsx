'use client';

import { cn } from '@/lib/utils';
import { adminOverrideAttendance } from '@/services/attendance-actions';
import { KtvAttendanceLog,KtvAttendanceSummary } from '@/types/domain';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';

interface AttendanceCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKtv: KtvAttendanceSummary | null;
  onSaveSuccess: () => Promise<void>;
}

export default function AttendanceCalendar({
  isOpen,
  onClose,
  selectedKtv,
  onSaveSuccess,
}: AttendanceCalendarProps) {
  const [selectedDayLog, setSelectedDayLog] = useState<{
    date: string;
    log: KtvAttendanceLog | null;
  } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'present' | 'late' | 'absent' | 'half_day'>('present');
  const [overrideCheckin, setOverrideCheckin] = useState('');
  const [overrideCheckout, setOverrideCheckout] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !selectedKtv) return null;

  const now = new Date();
  const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  // Vietnam Timezone helper functions
  const toLocalISOString = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const tzOffset = 7 * 60; // Vietnam +7 hours in minutes
    const localTime = new Date(date.getTime() + tzOffset * 60 * 1000);
    return localTime.toISOString().substring(0, 16);
  };

  const formatTimeVN = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return 'Chưa ghi nhận';
    const date = new Date(dateInput);
    return date.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleDayClick = (dateStr: string, log: KtvAttendanceLog | undefined) => {
    setSelectedDayLog({
      date: dateStr,
      log: log || null
    });
    setOverrideStatus(log?.status || 'present');
    setOverrideCheckin(log?.checkin_time ? toLocalISOString(log.checkin_time) : '');
    setOverrideCheckout(log?.checkout_time ? toLocalISOString(log.checkout_time) : '');
  };

  const handleSaveOverride = async () => {
    if (!selectedKtv || !selectedDayLog) return;
    setIsSaving(true);
    const res = await adminOverrideAttendance({
      ktvId: selectedKtv.id,
      date: selectedDayLog.date,
      status: overrideStatus,
      checkinTime: overrideCheckin || undefined,
      checkoutTime: overrideCheckout || undefined
    });

    if (res.success) {
      toast.success('Cập nhật chấm công thành công!');
      await onSaveSuccess();
      setSelectedDayLog(null);
    } else {
      toast.error('Lỗi: ' + res.error);
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[600px]"
      >
        {/* Left Panel: Calendar Grid */}
        <div className="flex-1 p-8 overflow-y-auto border-r border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-black text-slate-900">Chấm công: {selectedKtv.name}</h3>
            <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-widest">{currentMonthYear}</span>
          </div>

          <div className="grid grid-cols-7 gap-3">
            {/* Headers */}
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(h => (
              <div key={h} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">{h}</div>
            ))}
            
            {/* Generate Calendar Days */}
            {(() => {
              const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const firstDayIndex = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7; // Align Monday as 0
              
              const cells = [];
              for (let i = 0; i < firstDayIndex; i++) {
                cells.push(<div key={`empty-${i}`} className="aspect-square bg-slate-50/50 rounded-xl"></div>);
              }

              for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const log = selectedKtv.logs?.find((a) => a.date === dateStr);
                
                let bgClass = "bg-slate-50 hover:bg-slate-100 text-slate-700";
                let dotColor = "";
                
                if (log?.status === 'present') { bgClass = "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"; dotColor = "bg-emerald-500"; }
                else if (log?.status === 'late') { bgClass = "bg-amber-50 text-amber-700 hover:bg-amber-100"; dotColor = "bg-amber-500"; }
                else if (log?.status === 'absent') { bgClass = "bg-rose-50 text-rose-700 hover:bg-rose-100"; dotColor = "bg-rose-500"; }
                else if (log?.status === 'half_day') { bgClass = "bg-blue-50 text-blue-700 hover:bg-blue-100"; dotColor = "bg-blue-500"; }

                const isToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) === dateStr;

                cells.push(
                  <button
                    key={day}
                    onClick={() => handleDayClick(dateStr, log)}
                    className={cn(
                      "aspect-square rounded-2xl flex flex-col justify-between p-3 transition-all relative font-black",
                      bgClass,
                      isToday && "ring-2 ring-primary"
                    )}
                  >
                    <span className="text-xs">{day}</span>
                    {log?.status && (
                      <div className="flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)}></span>
                        <span className="text-[8px] uppercase tracking-tighter hidden md:inline">
                          {log.status === 'present' ? 'Đúng giờ' : log.status === 'late' ? 'Muộn' : log.status === 'half_day' ? 'Nửa ngày' : 'Nghỉ'}
                        </span>
                      </div>
                    )}
                  </button>
                );
              }
              return cells;
            })()}
          </div>
        </div>

        {/* Right Panel: Detail & Override Form */}
        <div className="w-full md:w-80 bg-slate-50 p-8 flex flex-col justify-between">
          <div>
            <h4 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-wider text-xs text-slate-400">Chi tiết ngày chọn</h4>
            
            {selectedDayLog ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Ngày</p>
                  <p className="text-sm font-bold text-slate-800">{new Date(selectedDayLog.date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                {selectedDayLog.log && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Thời gian KTV đã kích hoạt</p>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Thực tế vào:</span>
                        <span className="text-slate-800">{formatTimeVN(selectedDayLog.log.checkin_time)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Thực tế ra:</span>
                        <span className="text-slate-800">{formatTimeVN(selectedDayLog.log.checkout_time)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Trạng thái chấm công</label>
                  <select
                    value={overrideStatus}
                    onChange={e => setOverrideStatus(e.target.value as 'present' | 'late' | 'absent' | 'half_day')}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none"
                  >
                    <option value="present">Đúng giờ (Có mặt)</option>
                    <option value="late">Đi muộn</option>
                    <option value="absent">Vắng mặt (Nghỉ)</option>
                    <option value="half_day">Nửa ngày</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Thời gian vào ca</label>
                  <input
                    type="datetime-local"
                    value={overrideCheckin}
                    onChange={e => setOverrideCheckin(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Thời gian ra ca</label>
                  <input
                    type="datetime-local"
                    value={overrideCheckout}
                    onChange={e => setOverrideCheckout(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 font-medium italic">Chọn một ngày trong lịch để xem chi tiết hoặc thay đổi dữ liệu chấm công</p>
            )}
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              Đóng
            </button>
            {selectedDayLog && (
              <button
                onClick={handleSaveOverride}
                disabled={isSaving}
                className="flex-1 py-3 bg-primary text-white font-black rounded-xl text-xs uppercase tracking-wider hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu công'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
