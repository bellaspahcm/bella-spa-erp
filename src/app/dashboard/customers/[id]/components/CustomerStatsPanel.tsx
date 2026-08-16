'use client';

import { cn, formatNumberWithSeparator, formatViDate } from '@/lib/utils';
import { Clock, DollarSign, TrendingUp, Award } from 'lucide-react';
import type { CustomerDetailBooking } from '../types';

export function CustomerStatsPanel({
  activeBooking,
  activeDepositAmount,
  activeNetPrice,
  userRole,
  loyaltyPoints,
}: {
  activeBooking: CustomerDetailBooking | null;
  activeDepositAmount: number;
  activeNetPrice: number;
  userRole: 'admin' | 'ktv';
  loyaltyPoints?: number | null;
}) {
  const activeFullPrice = activeBooking?.full_price || 0;
  const activeDiscountPercent = activeBooking?.discount_percent || 0;

  const stats = [
    {
      label: 'Tiến độ',
      value: activeBooking ? `${activeBooking.completed_sessions || 0}/${activeBooking.total_sessions || 0}` : '0/0',
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
    },
    ...(userRole === 'admin'
      ? [
          {
            label:
              activeBooking &&
              (activeFullPrice > 0 || activeDepositAmount > 0) &&
              activeDepositAmount >= activeNetPrice
                ? 'Đã thanh toán đủ'
                : 'Đã cọc',
            value: activeBooking ? (
              <div className="flex flex-col gap-1 leading-tight mt-0.5 whitespace-nowrap">
                <span className="text-xl font-black text-slate-900">
                  {formatNumberWithSeparator(activeDepositAmount)}đ
                </span>
                {activeFullPrice > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                      Giá gốc: <span className="line-through">{formatNumberWithSeparator(activeFullPrice)}đ</span>
                    </span>
                    {activeDiscountPercent > 0 ? (
                      <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider whitespace-nowrap">
                        Đã giảm {activeDiscountPercent}%
                      </span>
                    ) : null}
                    {activeDepositAmount < activeNetPrice && (
                      <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider whitespace-nowrap">
                        Còn nợ: {formatNumberWithSeparator(Math.max(0, activeNetPrice - activeDepositAmount))}đ
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              '0đ'
            ),
            icon: DollarSign,
            color: 'text-primary',
            bg: 'bg-rose-50',
          },
        ]
      : []),
    {
      label: 'Ngày bắt đầu',
      value: activeBooking?.start_date ? formatViDate(activeBooking.start_date) : 'Chưa có',
      icon: Clock,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
    {
      label: 'Điểm tích lũy',
      value: loyaltyPoints !== undefined && loyaltyPoints !== null ? `${loyaltyPoints} điểm` : '0 điểm',
      icon: Award,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6">
      {stats.map((stat, index) => (
        <div
          key={`${stat.label}-${index}`}
          className="bg-white customer-detail-card p-3.5 sm:p-5 md:p-6 rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-3 sm:gap-4 md:gap-5 min-w-0"
        >
          <div className={cn('w-10 h-10 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0', stat.bg)}>
            <stat.icon className={cn('w-5 h-5 sm:w-7 sm:h-7', stat.color)} />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{stat.label}</p>
            <div className="text-sm sm:text-xl font-black text-slate-900 leading-tight whitespace-nowrap">{stat.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
