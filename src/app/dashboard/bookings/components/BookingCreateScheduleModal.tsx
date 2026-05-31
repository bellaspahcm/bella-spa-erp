'use client';

import { type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { getLocalDateString } from '@/lib/utils';

export type BookingOption = {
  id: string;
  customers?: {
    name_mother?: string | null;
  } | null;
  packages?: {
    name?: string | null;
  } | null;
  package_name?: string | null;
};

type TimeRange = {
  start: string;
  end: string;
};

type BookingCreateScheduleModalProps = {
  isOpen: boolean;
  allBookings: BookingOption[];
  selectedBookingId: string;
  defaultDate: string;
  createTimeRange: TimeRange;
  isUpdating: boolean;
  onClose: () => void;
  onSelectedBookingChange: (bookingId: string) => void;
  onCreateTimeRangeChange: (timeRange: TimeRange) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function BookingCreateScheduleModal({
  isOpen,
  allBookings,
  selectedBookingId,
  defaultDate,
  createTimeRange,
  isUpdating,
  onClose,
  onSelectedBookingChange,
  onCreateTimeRangeChange,
  onSubmit,
}: BookingCreateScheduleModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-900">Tạo lịch chăm sóc mới</h3>
              <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    Chọn Hợp đồng / Khách hàng
                  </label>
                  <input type="hidden" name="booking_id" value={selectedBookingId} />
                  <PremiumSelect
                    value={selectedBookingId}
                    options={allBookings.map((booking) => ({
                      value: booking.id,
                      label: `${booking.customers?.name_mother} - ${
                        booking.packages?.name || booking.package_name || 'Gói liệu trình'
                      }`,
                    }))}
                    onChange={onSelectedBookingChange}
                    placeholder="Chọn hợp đồng..."
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Ngày thực hiện
                    </label>
                    <input
                      name="date"
                      type="date"
                      defaultValue={defaultDate || getLocalDateString()}
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Giờ bắt đầu
                    </label>
                    <input
                      type="time"
                      value={createTimeRange.start}
                      onChange={(event) => onCreateTimeRangeChange({ ...createTimeRange, start: event.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Giờ kết thúc
                    </label>
                    <input
                      type="time"
                      value={createTimeRange.end}
                      onChange={(event) => onCreateTimeRangeChange({ ...createTimeRange, end: event.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ghi chú</label>
                  <textarea
                    name="notes"
                    placeholder="Nhập yêu cầu đặc biệt..."
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1 h-24 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-200 dark:shadow-none disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Xác nhận lịch hẹn'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                >
                  Hủy bỏ
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
