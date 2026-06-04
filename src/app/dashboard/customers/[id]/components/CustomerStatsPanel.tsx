'use client';

import { cn, formatNumberWithSeparator } from '@/lib/utils';
import { Clock, DollarSign, TrendingUp } from 'lucide-react';
import type { CustomerDetailBooking } from '../types';

export function CustomerStatsPanel({
  activeBooking,
  activeDepositAmount,
  activeNetPrice,
  userRole,
}: {
  activeBooking: CustomerDetailBooking | null;
  activeDepositAmount: number;
  activeNetPrice: number;
  userRole: 'admin' | 'ktv';
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
              <div className="flex flex-col gap-1 leading-tight mt-0.5">
                <span className="text-xl font-black text-slate-900">
                  {formatNumberWithSeparator(activeDepositAmount)}đ
                </span>
                {activeFullPrice > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-400">
                      Giá gốc: <span className="line-through">{formatNumberWithSeparator(activeFullPrice)}đ</span>
                    </span>
                    {activeDiscountPercent > 0 ? (
                      <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider">
                        Đã giảm {activeDiscountPercent}%
                      </span>
                    ) : null}
                    {activeDepositAmount < activeNetPrice && (
                      <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">
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
      value: activeBooking?.start_date || 'Chưa có',
      icon: Clock,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat, index) => (
        <div
          key={`${stat.label}-${index}`}
          className="bg-white p-6 rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-5"
        >
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', stat.bg)}>
            <stat.icon className={cn('w-7 h-7', stat.color)} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <div className="text-xl font-black text-slate-900 leading-tight">{stat.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
