'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { DollarSign, AlertCircle, Clock, CheckCircle, FileText, TrendingUp } from 'lucide-react';

interface BookingStatsData {
  total: number;
  unpaid: number;
  partial: number;
  full: number;
  totalDepositReceived: number;
  totalDepositPending: number;
}

export function BookingStats({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BookingStatsData>({
    total: 0,
    unpaid: 0,
    partial: 0,
    full: 0,
    totalDepositReceived: 0,
    totalDepositPending: 0,
  });

  const loadStats = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Get all active bookings (not cancelled or completed)
      const { data: bookings, error } = await supabase
        .from('auto_bookings')
        .select('id, deposit_amount, deposit_paid, payment_status, status')
        .eq('tenant_id', tenantId)
        .not('status', 'in', '("cancelled","completed")');

      if (error) throw error;
      if (!bookings) return;

      const bookingsList = [...bookings]; // Create copy to avoid mutating original

      const total = bookingsList.length;
      const unpaid = bookingsList.filter(b => b.deposit_paid === 0).length;
      const partial = bookingsList.filter(b => 
        b.deposit_paid > 0 && b.deposit_paid < b.deposit_amount
      ).length;
      const full = bookingsList.filter(b => b.deposit_paid >= b.deposit_amount).length;
      
      const totalDepositReceived = bookingsList.reduce((sum, b) => sum + (b.deposit_paid || 0), 0);
      const totalDepositPending = bookingsList.reduce((sum, b) => 
        sum + ((b.deposit_amount || 0) - (b.deposit_paid || 0)), 0
      );

      setStats({ total, unpaid, partial, full, totalDepositReceived, totalDepositPending });
    } catch (error) {
      console.error('Load stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)} Tỷ`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(0)} Tr`;
    }
    return value.toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        icon={<FileText className="w-5 h-5" />}
        label="Tổng Booking"
        value={stats.total.toString()}
        color="blue"
      />
      <StatCard
        icon={<AlertCircle className="w-5 h-5" />}
        label="Chưa Cọc"
        value={stats.unpaid.toString()}
        color="red"
        alert={stats.unpaid > 0}
      />
      <StatCard
        icon={<Clock className="w-5 h-5" />}
        label="Cọc 1 Phần"
        value={stats.partial.toString()}
        color="yellow"
      />
      <StatCard
        icon={<CheckCircle className="w-5 h-5" />}
        label="Đã Cọc Đủ"
        value={stats.full.toString()}
        color="green"
      />
      <StatCard
        icon={<TrendingUp className="w-5 h-5" />}
        label="Đã Thu"
        value={formatCurrency(stats.totalDepositReceived)}
        suffix="VNĐ"
        color="green"
      />
      <StatCard
        icon={<DollarSign className="w-5 h-5" />}
        label="Chưa Thu"
        value={formatCurrency(stats.totalDepositPending)}
        suffix="VNĐ"
        color="red"
        alert={stats.totalDepositPending > 0}
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  color: 'blue' | 'red' | 'yellow' | 'green';
  alert?: boolean;
}

function StatCard({ icon, label, value, suffix, color, alert }: StatCardProps) {
  const colorClasses = {
    blue: 'from-cyan-50/90 to-blue-50/60 dark:from-cyan-950/40 dark:to-blue-950/30 border-cyan-300/80 dark:border-cyan-800/60 shadow-[0_4px_20px_rgba(6,182,212,0.12),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(6,182,212,0.22)]',
    red: 'from-red-50/90 to-rose-50/60 dark:from-red-950/40 dark:to-rose-950/30 border-rose-300/80 dark:border-rose-800/60 shadow-[0_4px_20px_rgba(244,63,94,0.12),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(244,63,94,0.22)]',
    yellow: 'from-amber-50/90 to-yellow-50/60 dark:from-amber-950/40 dark:to-yellow-950/30 border-amber-300/80 dark:border-amber-800/60 shadow-[0_4px_20px_rgba(245,158,11,0.12),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(245,158,11,0.22)]',
    green: 'from-emerald-50/90 to-green-50/60 dark:from-emerald-950/40 dark:to-green-950/30 border-emerald-300/80 dark:border-emerald-800/60 shadow-[0_4px_20px_rgba(16,185,129,0.12),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.22)]',
  };

  const iconColorClasses = {
    blue: 'text-cyan-600 dark:text-cyan-400 bg-white/90 dark:bg-slate-950/70 border-cyan-200/60 dark:border-cyan-900/40',
    red: 'text-red-600 dark:text-red-400 bg-white/90 dark:bg-slate-950/70 border-red-200/60 dark:border-red-900/40',
    yellow: 'text-amber-600 dark:text-amber-400 bg-white/90 dark:bg-slate-950/70 border-amber-200/60 dark:border-amber-900/40',
    green: 'text-emerald-600 dark:text-emerald-400 bg-white/90 dark:bg-slate-950/70 border-emerald-200/60 dark:border-emerald-900/40',
  };

  return (
    <div 
      className={`relative p-5 rounded-3xl bg-gradient-to-br border transition-all duration-300 hover:-translate-y-1 ${colorClasses[color]} ${
        alert ? 'ring-2 ring-red-400 dark:ring-red-600 animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-2xl shadow-xs border ${iconColorClasses[color]}`}>
          {icon}
        </div>
        {alert && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-red-100/90 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900/40 shadow-xs">
            Cần xử lý
          </span>
        )}
      </div>
      <p className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
        {suffix && (
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
