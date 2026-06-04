'use client';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn, formatNumberWithSeparator } from '@/lib/utils';
import { ChevronRight, FileText, Image as ImageIcon, Loader2, MessageCircle, Share2, Sparkles, User } from 'lucide-react';
import type { CustomerDetailBooking, KtvOption } from '../types';

export function ActiveBookingPanel({
  activeBooking,
  ktvs,
  userRole,
  isDepositOnly,
  activeDepositAmount,
  activeNetPrice,
  isExportingQuotation,
  isUpdatingKtv,
  onOpenBooking,
  onPayRemaining,
  onOpenZalo,
  onSharePortal,
  onExportQuotation,
  onExportContract,
  onEditBooking,
  onUpdateKtv,
  onOpenBookingSessions,
}: {
  activeBooking: CustomerDetailBooking | null;
  ktvs: KtvOption[];
  userRole: 'admin' | 'ktv';
  isDepositOnly: boolean;
  activeDepositAmount: number;
  activeNetPrice: number;
  isExportingQuotation: boolean;
  isUpdatingKtv: boolean;
  onOpenBooking: () => void;
  onPayRemaining: (amount: number) => void;
  onOpenZalo: () => void;
  onSharePortal: () => void | Promise<void>;
  onExportQuotation: () => void | Promise<void>;
  onExportContract: () => void;
  onEditBooking: () => void;
  onUpdateKtv: (ktvId: string) => void;
  onOpenBookingSessions: () => void;
}) {
  const remainingBalance = ((activeBooking?.full_price || 0) * (1 - (activeBooking?.discount_percent || 0) / 100)) - (activeBooking?.deposit_amount || 0);

  return (
          <div className="luxury-card-pink rounded-[3rem] p-8 relative shadow-2xl group">
            {/* Background Decorative Layer - Clipped */}
            <div className="absolute inset-0 overflow-hidden rounded-[3rem] pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 transition-transform duration-700 group-hover:scale-110" />
            </div>

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div>
                        <p className="text-rose-200 text-[10px] font-black uppercase tracking-[0.3em] mb-1">
                          {isDepositOnly ? 'Trạng thái: Chờ chọn gói' : 'Gói dịch vụ hiện tại'}
                        </p>
                        <h2 className="text-3xl font-black text-white">
                          {isDepositOnly ? 'Đã đặt cọc (Chưa chọn gói)' : (activeBooking?.packages?.name || activeBooking?.package_name || 'Chưa có gói liệu trình')}
                        </h2>
                      </div>

                      {!isDepositOnly && activeBooking?.preferred_time && (
                        <div className="bg-white px-5 py-2.5 rounded-2xl shadow-xl shadow-rose-900/20 dark:shadow-none border border-white flex flex-col items-center justify-center min-w-[120px] self-start md:self-center mt-2 md:mt-0">
                          <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">GIỜ MẶC ĐỊNH</span>
                          <span className="text-2xl font-black text-slate-900 leading-none">{activeBooking.preferred_time}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-4">
                    <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-[1.5rem] border border-white/20">
                      <p className="text-[9px] text-rose-100/80 font-bold uppercase tracking-[0.2em] mb-1">Tổng cộng (Giá gốc)</p>
                      <p className="font-black text-lg text-white">
                        {isDepositOnly ? '---' : formatNumberWithSeparator(activeBooking?.full_price || 0) + 'đ'}
                      </p>
                    </div>

                    {!isDepositOnly && (activeBooking?.discount_percent || 0) > 0 && (
                      <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-[1.5rem] border border-white/20">
                        <p className="text-[9px] text-rose-100/80 font-bold uppercase tracking-[0.2em] mb-1">Khuyến mãi ({activeBooking?.discount_percent}%)</p>
                        <p className="font-black text-lg text-rose-200">
                          -{formatNumberWithSeparator((activeBooking?.full_price || 0) * (activeBooking?.discount_percent || 0) / 100)}đ
                        </p>
                      </div>
                    )}

                    {(!activeBooking || isDepositOnly || ((activeBooking.full_price || 0) * (1 - (activeBooking.discount_percent || 0)/100)) > (activeBooking.deposit_amount || 0)) && (
                      <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-[1.5rem] border border-white/20">
                        <p className="text-[9px] text-rose-100/80 font-bold uppercase tracking-[0.2em] mb-1">Đã cọc</p>
                        <p className="font-black text-lg text-white">
                          {formatNumberWithSeparator(activeBooking?.deposit_amount || 0)}đ
                        </p>
                      </div>
                    )}

                    <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-[1.5rem] border border-white/20 flex items-center gap-4">
                      <div>
                        <p className="text-[9px] text-rose-100/80 font-bold uppercase tracking-[0.2em] mb-1">Còn lại</p>
                        <p className="font-black text-lg text-white">
                          {isDepositOnly ? '---' : (
                            ((activeBooking?.full_price || 0) > 0 || (activeBooking?.deposit_amount || 0) > 0) && Math.max(0, ((activeBooking?.full_price || 0) * (1 - (activeBooking?.discount_percent || 0)/100)) - (activeBooking?.deposit_amount || 0)) === 0
                              ? <span className="text-emerald-300">Đã thanh toán đủ</span>
                              : formatNumberWithSeparator(Math.max(0, ((activeBooking?.full_price || 0) * (1 - (activeBooking?.discount_percent || 0)/100)) - (activeBooking?.deposit_amount || 0))) + 'đ'
                          )}
                        </p>
                      </div>
                      {!isDepositOnly && ((activeBooking?.full_price || 0) * (1 - (activeBooking?.discount_percent || 0)/100)) - (activeBooking?.deposit_amount || 0) > 0 && (
                        <button
                          onClick={() => onPayRemaining(remainingBalance)}
                          className="bg-white text-rose-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all shadow-md active:scale-95 border border-white ml-2"
                        >
                          Thanh toán nốt
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 min-w-[200px]">
                  {isDepositOnly ? (
                    <button
                      onClick={onOpenBooking}
                      className="col-span-2 flex items-center justify-center gap-2 bg-white text-rose-500 px-4 py-2.5 rounded-xl font-bold transition-all hover:scale-105 shadow-md"
                    >
                      CHỌN GÓI NGAY
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={onOpenZalo}
                        className="flex items-center justify-center gap-2 bg-white text-slate-900 px-4 py-2.5 rounded-xl font-bold transition-all hover:bg-slate-50 uppercase tracking-wider text-[9.5px] shadow-md border border-slate-100"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Zalo
                      </button>

                      <button
                        onClick={onSharePortal}
                        className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-md text-white px-4 py-2.5 rounded-xl font-bold transition-all hover:bg-white/30 uppercase tracking-wider text-[9.5px] border border-white/20 shadow-md"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Link Portal
                      </button>

                      <button
                        onClick={onExportQuotation}
                        disabled={isExportingQuotation}
                        className={cn(
                          "flex items-center justify-center gap-2 bg-white text-slate-900 px-4 py-2.5 rounded-xl font-bold transition-all hover:bg-slate-50 uppercase tracking-wider text-[9.5px] shadow-md border border-slate-100 disabled:opacity-50",
                          userRole !== 'admin' ? "col-span-2" : ""
                        )}
                      >
                        {isExportingQuotation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                        Xuất báo giá
                      </button>

                      {userRole === 'admin' && (
                        <>
                          <button
                            disabled={activeDepositAmount < activeNetPrice}
                            onClick={onExportContract}
                            className={cn(
                              "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all uppercase tracking-wider text-[9.5px]",
                              activeDepositAmount >= activeNetPrice
                                ? "bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 shadow-md"
                                : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
                            )}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Xuất hợp đồng
                          </button>

                          <button
                            onClick={onEditBooking}
                            className="col-span-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all uppercase tracking-wider text-[9.5px] shadow-lg shadow-amber-500/20 active:scale-95 hover:scale-105"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Sửa dịch vụ
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {activeBooking && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-white/10">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-white/60">
                      <User className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">KTV Phụ trách chính</span>
                    </div>
                    <div className="relative">
                      <PremiumSelect
                        value={activeBooking.assigned_ktv_id || ''}
                        options={[
                          { value: '', label: 'Chưa phân công' },
                          ...ktvs.map(k => ({ value: k.id, label: k.full_name }))
                        ]}
                        onChange={onUpdateKtv}
                        disabled={isUpdatingKtv}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-3xl p-5 border border-white/10 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Tiến độ buổi</span>
                      <span className="text-white font-black text-sm">{activeBooking.completed_sessions || 0}/{activeBooking.total_sessions || 0}</span>
                      <button
                        onClick={onOpenBookingSessions}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors group/btn"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover/btn:text-primary transition-colors" />
                      </button>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-1000"
                        style={{ width: `${((activeBooking.completed_sessions || 0) / Math.max(1, activeBooking.total_sessions || 15)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
  );
}
