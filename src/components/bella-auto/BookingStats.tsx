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
    blue: 'from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/20 border-cyan-200 dark:border-cyan-900/50',
    red: 'from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 border-red-200 dark:border-red-900/50',
    yellow: 'from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-200 dark:border-amber-900/50',
    green: 'from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 border-emerald-200 dark:border-emerald-900/50',
  };

  const iconColorClasses = {
    blue: 'text-cyan-600 dark:text-cyan-400',
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-amber-600 dark:text-amber-400',
    green: 'text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div 
      className={`relative p-5 rounded-2xl bg-gradient-to-br border shadow-sm ${colorClasses[color]} ${
        alert ? 'ring-2 ring-red-400 dark:ring-red-600 animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl bg-white/80 dark:bg-slate-950/60 ${iconColorClasses[color]}`}>
          {icon}
        </div>
        {alert && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            Cần xử lý
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {value}
        </p>
        {suffix && (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
