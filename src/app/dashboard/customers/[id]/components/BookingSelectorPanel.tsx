'use client';

import { cn } from '@/lib/utils';
import type { CustomerDetailBooking } from '../types';

export function BookingSelectorPanel({
  bookings,
  activeBooking,
  onSelectBooking,
}: {
  bookings: CustomerDetailBooking[];
  activeBooking: CustomerDetailBooking | null;
  onSelectBooking: (booking: CustomerDetailBooking) => void;
}) {
  return (
          <div className="bg-white rounded-[2.5rem] p-6 shadow-lg border border-primary/10 mb-8">
            <div className="flex items-center justify-between mb-2 px-2">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Chọn gói liệu trình đang xem</p>
              <span className="px-3 py-1 bg-primary/5 text-primary text-[9px] font-black rounded-full uppercase">
                Có {bookings.length} gói dịch vụ
              </span>
            </div>
            {activeBooking && (
              <p className="text-xs font-bold text-slate-500 mb-4 px-2">
                Hệ thống đang hiển thị thông tin và tiến độ của gói: <span className="text-primary font-black">{activeBooking.package_name || activeBooking.packages?.name || (activeBooking.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Dịch vụ lẻ')}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {bookings.length > 0 ? (
                bookings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onSelectBooking(b)}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                      activeBooking?.id === b.id
                        ? "bg-primary text-white border-primary shadow-lg shadow-pink-100 dark:shadow-none"
                        : "bg-slate-50 text-slate-400 border-slate-100 hover:border-primary/30"
                    )}
                  >
                    {b.package_name || (b.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Gói lẻ')}
                    <span className="ml-2 opacity-60">({b.status})</span>
                  </button>
                ))
              ) : (
                <div className="w-full py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Khách hàng chưa có gói liệu trình nào</p>
                </div>
              )}
            </div>
          </div>
  );
}
