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
  const activeBookingName = activeBooking?.package_name || activeBooking?.packages?.name || (activeBooking?.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Dịch vụ lẻ');

  return (
          <div className="relative mb-8 overflow-hidden rounded-[2.5rem] border-2 border-primary/20 bg-white p-6 shadow-[0_18px_45px_rgba(190,24,93,0.13)] ring-4 ring-primary/5">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-1.5 rounded-b-full bg-gradient-to-r from-primary/20 via-primary to-primary/20 animate-pulse" />
            <div className="flex flex-col gap-3 px-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Chọn gói liệu trình đang xem</p>
                {activeBooking && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                    Đang áp dụng cho dữ liệu bên dưới
                  </div>
                )}
              </div>
              <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-[9px] font-black uppercase text-primary">
                Có {bookings.length} gói dịch vụ
              </span>
            </div>
            {activeBooking && (
              <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
                <p className="text-xs font-bold text-slate-600">
                  Hệ thống đang hiển thị thông tin và tiến độ của gói: <span className="text-primary font-black">{activeBookingName}</span>
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {bookings.length > 0 ? (
                bookings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onSelectBooking(b)}
                    aria-current={activeBooking?.id === b.id ? 'true' : undefined}
                    className={cn(
                      "rounded-2xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
                      activeBooking?.id === b.id
                        ? "bg-primary text-white border-primary shadow-xl shadow-pink-200 ring-4 ring-primary/15 dark:shadow-none"
                        : "bg-slate-50 text-slate-400 border-slate-100 hover:border-primary/30 hover:bg-white hover:text-primary"
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
