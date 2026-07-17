'use client';

import { cn } from '@/lib/utils';
import type { CustomerDetailBooking } from '../types';
import { useModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { Trash2 } from 'lucide-react';

// Vietnamese status labels
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'active': { label: 'Đang thực hiện', color: 'text-emerald-600' },
  'in_progress': { label: 'Đang thực hiện', color: 'text-emerald-600' },
  'booked': { label: 'Đã đặt', color: 'text-blue-600' },
  'deposit_pending': { label: 'Chờ đặt cọc', color: 'text-amber-600' },
  'completed': { label: 'Hoàn thành', color: 'text-slate-500' },
  'cancelled': { label: 'Đã hủy', color: 'text-red-600' },
  'refunded': { label: 'Đã hoàn tiền', color: 'text-red-600' },
};

function getStatusDisplay(status: string) {
  return STATUS_LABELS[status] || { label: status, color: 'text-slate-400' };
}

export function BookingSelectorPanel({
  bookings,
  activeBooking,
  onSelectBooking,
  onDeleteBooking,
  tenantModuleKey,
  userRole,
  selectedBookingIds,
  onToggleBookingSelection,
  isCombineMode,
  onToggleCombineMode,
}: {
  bookings: CustomerDetailBooking[];
  activeBooking: CustomerDetailBooking | null;
  onSelectBooking: (booking: CustomerDetailBooking) => void;
  onDeleteBooking?: (bookingId: string) => void;
  tenantModuleKey: TenantModuleKey | null;
  userRole: 'admin' | 'ktv';
  selectedBookingIds?: Set<string>;
  onToggleBookingSelection?: (id: string) => void;
  isCombineMode?: boolean;
  onToggleCombineMode?: () => void;
}) {
  const vocab = useModuleVocabulary(tenantModuleKey);
  
  // Show ALL bookings (including cancelled) so admin can delete them
  const visibleBookings = bookings;
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;
  const selectedCount = selectedBookingIds?.size ?? 0;

  return (
          <div className="relative mb-8 overflow-hidden rounded-[2.5rem] border-2 border-primary/20 bg-white p-6 shadow-[0_18px_45px_rgba(190,24,93,0.13)] ring-4 ring-primary/5">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-1.5 rounded-b-full bg-gradient-to-r from-primary/20 via-primary to-primary/20 animate-pulse" />
            <div className="flex flex-col gap-3 px-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                  Chọn {vocab.booking.singular.toLowerCase()} đang xem
                </p>
                {activeBooking && !isCombineMode && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                    Đang áp dụng cho dữ liệu bên dưới
                  </div>
                )}
                {isCombineMode && selectedCount >= 2 && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-indigo-600">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                    Đã chọn {selectedCount} gói để gộp báo giá
                  </div>
                )}
                {isCombineMode && selectedCount < 2 && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-amber-600">
                    Chọn tối thiểu 2 gói để gộp báo giá
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-[9px] font-black uppercase text-primary">
                  Có {visibleBookings.length} {vocab.package.singular.toLowerCase()}
                </span>
                {cancelledCount > 0 && (
                  <span className="w-fit rounded-full bg-red-100 px-3 py-1 text-[9px] font-black uppercase text-red-600">
                    {cancelledCount} đã hủy
                  </span>
                )}
                {/* Combine mode toggle — only show for admin with 2+ bookings */}
                {userRole === 'admin' && visibleBookings.length >= 2 && onToggleCombineMode && (
                  <button
                    onClick={onToggleCombineMode}
                    className={cn(
                      'rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all border',
                      isCombineMode
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
                    )}
                  >
                    {isCombineMode ? '✓ Đang gộp' : '⊞ Chọn gộp'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleBookings.length > 0 ? (
                visibleBookings.map((b) => {
                  const statusDisplay = getStatusDisplay(b.status || '');
                  const status = b.status || '';
                  const isActive = activeBooking?.id === b.id;
                  const isInProgress = status === 'in_progress' || status === 'active';
                  const isUpcoming = status === 'booked' || status === 'deposit_pending';
                  const isCancelled = status === 'cancelled';
                  const isSelected = selectedBookingIds?.has(b.id) ?? false;

                  let btnClasses = "rounded-2xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2";

                  if (isCombineMode) {
                    // In combine mode: highlight selected items with indigo
                    if (isSelected) {
                      btnClasses = cn(btnClasses, "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-200 ring-4 ring-indigo-200/50");
                    } else {
                      btnClasses = cn(btnClasses, "bg-slate-50 text-slate-500 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600");
                    }
                  } else {
                    if (isActive) {
                      btnClasses = cn(btnClasses, "bg-primary text-white border-primary shadow-xl shadow-pink-200 ring-4 ring-primary/15 dark:shadow-none");
                    } else if (isInProgress) {
                      btnClasses = cn(btnClasses, "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300");
                    } else if (isUpcoming) {
                      if (status === 'deposit_pending') {
                        btnClasses = cn(btnClasses, "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300");
                      } else {
                        btnClasses = cn(btnClasses, "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 hover:border-blue-300");
                      }
                    } else {
                      // completed, cancelled, refunded
                      btnClasses = cn(
                        btnClasses,
                        isCancelled
                          ? "bg-red-50/50 text-red-400 border-red-100 opacity-40 hover:opacity-80"
                          : "bg-slate-50 text-slate-400 border-slate-100 opacity-40 hover:opacity-80"
                      );
                    }
                  }

                  return (
                    <div key={b.id} className="relative group">
                      <button
                        onClick={() => {
                          if (isCombineMode && onToggleBookingSelection) {
                            onToggleBookingSelection(b.id);
                          } else {
                            onSelectBooking(b);
                          }
                        }}
                        aria-current={isActive ? 'true' : undefined}
                        className={btnClasses}
                      >
                        {/* Checkbox indicator in combine mode */}
                        {isCombineMode && (
                          <span className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                            isSelected
                              ? 'bg-white border-white'
                              : 'bg-transparent border-current'
                          )}>
                            {isSelected && <span className="text-indigo-600 text-[10px] font-black">✓</span>}
                          </span>
                        )}
                        <span className="text-left flex flex-col gap-0.5">
                          <span className="font-black block">
                            {b.package_name || (b.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Gói lẻ')}
                          </span>
                          <span className={cn(
                            "text-[8.5px] tracking-normal normal-case font-bold block",
                            isCombineMode
                              ? isSelected
                                ? "text-indigo-200"
                                : "text-slate-400 group-hover:text-indigo-400"
                              : isActive
                              ? "text-white/80"
                              : isInProgress
                              ? "text-emerald-600"
                              : statusDisplay.color
                          )}>
                            {statusDisplay.label} • {b.completed_sessions || 0}/{b.total_sessions || 15} ca
                            {b.created_at && ` • Đăng ký: ${new Date(b.created_at).toLocaleDateString('vi-VN')}`}
                          </span>
                        </span>
                      </button>
                      
                      {/* Delete button - only for admin and cancelled/deposit_pending bookings */}
                      {!isCombineMode && userRole === 'admin' && onDeleteBooking && (isCancelled || b.status === 'deposit_pending') && (
                        <button
                          onClick={() => {
                            if (confirm(`Xác nhận XÓA VĨNH VIỄN gói "${b.package_name || 'Gói lẻ'}"?\n\nThao tác này KHÔNG THỂ HOÀN TÁC!`)) {
                              onDeleteBooking(b.id);
                            }
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 hover:scale-110 active:scale-95 shadow-lg"
                          title="Xóa gói (VĨNH VIỄN)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="w-full py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {vocab.customer.singular} chưa có {vocab.package.singular.toLowerCase()} nào
                  </p>
                </div>
              )}
            </div>
          </div>
  );
}
