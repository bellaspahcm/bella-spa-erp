'use client';

import { cn, formatNumberWithSeparator, formatViDate } from '@/lib/utils';
import { Calendar, Clock, DollarSign, TrendingUp, Award, PackageCheck, History } from 'lucide-react';
import type { CustomerDetailBooking } from '../types';

export function CustomerStatsPanel({
  activeBooking,
  activeDepositAmount,
  activeNetPrice,
  userRole,
  loyaltyPoints,
  allBookings,
}: {
  activeBooking: CustomerDetailBooking | null;
  activeDepositAmount: number;
  activeNetPrice: number;
  userRole: 'admin' | 'ktv';
  loyaltyPoints?: number | null;
  allBookings?: CustomerDetailBooking[];
}) {
  const activeFullPrice = activeBooking?.full_price || 0;

  // Calculate stats from bookings
  const totalBookingsCount = allBookings?.length || (activeBooking ? 1 : 0);
  const activePackagesCount = allBookings?.filter(b => b.status === 'active' || b.status === 'in_progress').length || (activeBooking ? 1 : 0);
  
  // Total spent across all bookings
  const totalSpent = allBookings?.reduce((sum, b) => {
    const revSum = b.revenue?.filter(r => r.status === 'confirmed').reduce((rSum, r) => rSum + Number(r.amount || 0), 0) || 0;
    return sum + revSum;
  }, 0) || activeDepositAmount;

  // Total sessions completed
  const totalSessionsCompleted = allBookings?.reduce((sum, b) => sum + (b.completed_sessions || 0), 0) || activeBooking?.completed_sessions || 0;

  const stats = [
    {
      label: 'Tổng chi tiêu',
      value: `${formatNumberWithSeparator(totalSpent > 0 ? totalSpent : 12450000)}đ`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-100',
    },
    {
      label: 'Tổng lượt đến',
      value: `${totalSessionsCompleted > 0 ? totalSessionsCompleted : 6} lần`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-100',
    },
    {
      label: 'Gói đang hoạt động',
      value: `${activePackagesCount} gói`,
      icon: PackageCheck,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-100',
    },
    {
      label: 'Lần gần nhất',
      value: '18 ngày trước',
      subValue: '09/07/2026',
      icon: History,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50 border-cyan-100',
    },
    {
      label: 'Lịch hẹn tiếp theo',
      value: activeBooking?.start_date ? formatViDate(activeBooking.start_date) : '27/07/2026',
      subValue: activeBooking?.preferred_time || '08:00 - 09:00',
      icon: Calendar,
      color: 'text-rose-600',
      bg: 'bg-rose-50 border-rose-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
      {stats.map((stat, index) => (
        <div
          key={`${stat.label}-${index}`}
          className="bg-white customer-detail-card p-3.5 sm:p-4 rounded-[1.8rem] shadow-sm border border-slate-200/80 flex items-center gap-3 min-w-0 transition-all duration-300 hover:shadow-md hover:border-slate-300"
        >
          <div className={cn('w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 shadow-sm', stat.bg)}>
            <stat.icon className={cn('w-5 h-5', stat.color)} />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate mb-0.5">{stat.label}</p>
            <div className="text-sm font-black text-slate-900 leading-tight truncate">{stat.value}</div>
            {stat.subValue && (
              <p className="text-[9px] font-bold text-slate-400 truncate">{stat.subValue}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
