'use client';

import Image from 'next/image';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { calculateBookingPaymentState } from '@/lib/business-rules/payment';
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { cn, formatNumberWithSeparator } from '@/lib/utils';
import { Calendar, ChevronRight, FileText, Image as ImageIcon, Loader2, MessageCircle, MoreHorizontal, Share2, Sparkles, User } from 'lucide-react';
import type { CustomerDetailBooking, KtvOption } from '../types';

export function ActiveBookingPanel({
  activeBooking,
  ktvs,
  tenantModuleKey,
  userRole,
  isDepositOnly,
  activeDepositAmount,
  activeNetPrice,
  isExportingQuotation,
  isExportingCombinedQuotation,
  isUpdatingKtv,
  isCombineMode,
  selectedBookingIds,
  onOpenBooking,
  onPayRemaining,
  onOpenZalo,
  onSharePortal,
  onExportQuotation,
  onExportContract,
  onEditBooking,
  onUpdateKtv,
  onOpenBookingSessions,
  onExportCombinedQuotation,
  onShareCombinedPortal,
}: {
  activeBooking: CustomerDetailBooking | null;
  ktvs: KtvOption[];
  tenantModuleKey: TenantModuleKey | null;
  userRole: 'admin' | 'ktv';
  isDepositOnly: boolean;
  activeDepositAmount: number;
  activeNetPrice: number;
  isExportingQuotation: boolean;
  isExportingCombinedQuotation?: boolean;
  isUpdatingKtv: boolean;
  isCombineMode?: boolean;
  selectedBookingIds?: Set<string>;
  onOpenBooking: () => void;
  onPayRemaining: (amount: number) => void;
  onOpenZalo: () => void;
  onSharePortal: () => void | Promise<void>;
  onExportQuotation: () => void | Promise<void>;
  onExportContract: () => void;
  onEditBooking: () => void;
  onUpdateKtv: (ktvId: string) => void;
  onOpenBookingSessions: () => void;
  onExportCombinedQuotation?: () => void | Promise<void>;
  onShareCombinedPortal?: () => void | Promise<void>;
}) {
  const vocab = getModuleVocabulary(tenantModuleKey);
  
  const paymentState = activeBooking
    ? calculateBookingPaymentState({
        fullPrice: activeBooking.full_price,
        discountPercent: activeBooking.discount_percent,
        depositAmount: activeBooking.deposit_amount,
        bookingStatus: activeBooking.status,
        revenues: activeBooking.revenue,
      })
    : null;
  const remainingBalance = paymentState?.remainingDebt || 0;
  const completedSessions = activeBooking?.completed_sessions || 0;
  const totalSessions = activeBooking?.total_sessions || 12;
  const progressPercent = Math.min(100, Math.round((completedSessions / Math.max(1, totalSessions)) * 100));

  // Mock AI KTV recommendation list matching Image 2
  const aiKtvs = [
    {
      id: ktvs[0]?.id || 'ktv-1',
      name: ktvs[0]?.full_name || 'KTV Demo Body',
      title: 'Kỹ thuật viên',
      score: 100,
      scoreColor: 'bg-emerald-100 text-emerald-700',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
      skillScore: '22/25',
      loadScore: '17/20',
      favScore: '9/10',
      isSelected: activeBooking?.assigned_ktv_id === (ktvs[0]?.id || 'ktv-1'),
    },
    {
      id: ktvs[1]?.id || 'ktv-2',
      name: ktvs[1]?.full_name || 'KTV Demo Facial',
      title: 'Kỹ thuật viên',
      score: 80.5,
      scoreColor: 'bg-blue-100 text-blue-700',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
      skillScore: '18/25',
      loadScore: '14/20',
      favScore: '7/10',
      isSelected: activeBooking?.assigned_ktv_id === (ktvs[1]?.id || 'ktv-2'),
    },
    {
      id: ktvs[2]?.id || 'ktv-3',
      name: ktvs[2]?.full_name || 'KTV Demo An',
      title: 'Kỹ thuật viên',
      score: 72,
      scoreColor: 'bg-slate-100 text-slate-700',
      avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=200&q=80',
      skillScore: '16/25',
      loadScore: '12/20',
      favScore: '7/10',
      isSelected: activeBooking?.assigned_ktv_id === (ktvs[2]?.id || 'ktv-3'),
    },
  ];

  return (
    <div className="space-y-6 mb-6">
      {/* ── Dark Navy Active Package Card ── */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-2xl shadow-slate-950/40 border border-slate-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
          {/* Header left */}
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700">
              <Image
                src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=300&q=80"
                alt="Package Thumbnail"
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest !text-indigo-300">
                  GÓI DỊCH VỤ HIỆN TẠI
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 !text-emerald-300 border border-emerald-500/30">
                  Đang thực hiện
                </span>
                <span className="text-[10px] font-medium !text-slate-300">
                  • Bắt đầu: {activeBooking?.start_date ? new Date(activeBooking.start_date).toLocaleDateString('vi-VN') : '24/07/2026'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black !text-white leading-tight">
                {activeBooking?.packages?.name || activeBooking?.package_name || 'Gội Đầu Dưỡng Sinh Demo'}
              </h2>
            </div>
          </div>

          {/* Progress Widget (Right Box) */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 min-w-[200px] w-full lg:w-auto">
            <div className="flex justify-between items-center text-xs font-black mb-1">
              <span className="text-slate-300 uppercase text-[10px] tracking-wider">TIẾN ĐỘ</span>
              <span className="text-white">{completedSessions} / {totalSessions} buổi</span>
            </div>
            <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-right font-bold text-emerald-300">{progressPercent}% hoàn thành</p>
          </div>
        </div>

        {/* 4 Metric Pills Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Giá gói</p>
            <p className="font-black text-base text-white">{formatNumberWithSeparator(activeBooking?.full_price || 4290000)}đ</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Đã thanh toán</p>
            <p className="font-black text-base text-emerald-400">{formatNumberWithSeparator(paymentState?.totalPaid || 4290000)}đ</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Còn lại</p>
            <p className="font-black text-base text-white">{remainingBalance > 0 ? `${formatNumberWithSeparator(remainingBalance)}đ` : '0đ'}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Ngày kết thúc dự kiến</p>
            <p className="font-black text-base text-white">15/09/2026</p>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-white/10">
          <button
            onClick={onOpenBookingSessions}
            className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span>Đặt lịch buổi tiếp theo</span>
          </button>

          {userRole === 'admin' && (
            <button
              onClick={onEditBooking}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-colors"
            >
              Sửa dịch vụ
            </button>
          )}

          <button
            onClick={onExportQuotation}
            disabled={isExportingQuotation}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-colors flex items-center gap-1.5"
          >
            {isExportingQuotation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            Xuất báo giá
          </button>

          {userRole === 'admin' && (
            <button
              onClick={onExportContract}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Xuất hợp đồng
            </button>
          )}

          <button className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/15 transition-colors ml-auto">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── AI ĐỀ XUẤT KTV PHÙ HỢP Matching Image 2 ── */}
      {userRole === 'admin' && (
        <div className="rounded-[2.5rem] bg-white p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                AI ĐỀ XUẤT KTV PHÙ HỢP
              </h3>
            </div>
            <button className="text-xs font-bold text-blue-600 hover:underline">
              Giải thích đánh giá &gt;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiKtvs.map((ktv) => (
              <div
                key={ktv.id}
                className={cn(
                  "rounded-2xl border p-4 transition-all relative space-y-3",
                  ktv.isSelected
                    ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-200"
                    : "border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md"
                )}
              >
                {/* Header info */}
                <div className="flex items-center gap-3">
                  <Image
                    src={ktv.avatar}
                    alt={ktv.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-xs text-slate-900 truncate">{ktv.name}</h4>
                    <p className="text-[10px] text-slate-500">{ktv.title}</p>
                  </div>
                  <span className={cn("px-2 py-1 rounded-full text-xs font-black shadow-sm", ktv.scoreColor)}>
                    {ktv.score}
                  </span>
                </div>

                {/* Score breakdown bars */}
                <div className="space-y-1.5 text-[10px] font-medium text-slate-600">
                  <div className="flex justify-between items-center">
                    <span>Độ phù hợp kỹ năng</span>
                    <span className="font-bold text-slate-800">{ktv.skillScore}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
                  </div>

                  <div className="flex justify-between items-center pt-0.5">
                    <span>Độ trống ca (cân bằng tải)</span>
                    <span className="font-bold text-slate-800">{ktv.loadScore}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '80%' }} />
                  </div>

                  <div className="flex justify-between items-center pt-0.5">
                    <span>Khách quen & yêu thích</span>
                    <span className="font-bold text-slate-800">{ktv.favScore}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '90%' }} />
                  </div>
                </div>

                {/* Select button */}
                <button
                  onClick={() => onUpdateKtv(ktv.id)}
                  disabled={isUpdatingKtv}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95",
                    ktv.isSelected
                      ? "bg-amber-500 text-slate-950 hover:bg-amber-600"
                      : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {ktv.isSelected ? '✓ Đã chọn KTV này' : 'Chọn KTV'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
