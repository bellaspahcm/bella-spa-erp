/**
 * Inventory Forecast Panel
 * 
 * Displays projected inventory shortages based on upcoming bookings.
 * Shows detailed breakdown per product with urgency indicators.
 */

import { AlertTriangle, TrendingDown, Calendar, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ForecastItem } from '../hooks/useInventoryForecast';

interface InventoryForecastPanelProps {
  forecast: ForecastItem[];
  loading: boolean;
  error: string | null;
  metadata: { totalBookings: number; forecastPeriodDays: number } | null;
}

export function InventoryForecastPanel({
  forecast,
  loading,
  error,
  metadata,
}: InventoryForecastPanelProps) {
  if (loading) {
    return (
      <div className="bg-white customer-detail-card rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <TrendingDown className="w-5 h-5 text-slate-400 animate-pulse" />
          <h2 className="text-lg font-black text-slate-900">Dự Báo Tồn Kho (30 ngày)</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 animate-pulse" />
            <p className="text-sm font-bold text-slate-400">Đang tính toán dự báo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-red-100">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-black text-red-900">Lỗi Dự Báo</h2>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (forecast.length === 0) {
    return (
      <div className="bg-white customer-detail-card rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <TrendingDown className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-black text-slate-900">Dự Báo Tồn Kho (30 ngày)</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <Package className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-emerald-700">✅ Tồn kho đủ dùng</p>
          <p className="text-sm text-slate-500 text-center max-w-md">
            Không có mặt hàng nào dự kiến thiếu trong {metadata?.forecastPeriodDays || 30} ngày tới
            {metadata && metadata.totalBookings > 0 && (
              <> (dựa trên {metadata.totalBookings} booking đang hoạt động)</>
            )}
          </p>
        </div>
      </div>
    );
  }

  const urgencyConfig = {
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      badge: 'bg-red-500 text-white',
      icon: 'text-red-500',
      label: 'KHẨN CẤP',
    },
    high: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
      badge: 'bg-orange-500 text-white',
      icon: 'text-orange-500',
      label: 'CAO',
    },
    medium: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      badge: 'bg-amber-500 text-white',
      icon: 'text-amber-500',
      label: 'TRUNG BÌNH',
    },
    low: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
      badge: 'bg-yellow-500 text-white',
      icon: 'text-yellow-500',
      label: 'THẤP',
    },
  };

  return (
    <div className="bg-white customer-detail-card rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingDown className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-black text-slate-900">Dự Báo Tồn Kho ({metadata?.forecastPeriodDays || 30} ngày)</h2>
        </div>
        {metadata && (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Calendar className="w-4 h-4" />
            <span>{metadata.totalBookings} booking</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {forecast.map((item) => {
          const config = urgencyConfig[item.urgency];
          return (
            <div
              key={item.productId}
              className={cn(
                'p-5 rounded-[1.5rem] border-2 transition-all hover:shadow-md',
                config.bg,
                config.border,
                item.urgency === 'critical' && 'animate-pulse'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={cn('w-5 h-5 flex-shrink-0', config.icon)} />
                    <h3 className="text-base font-black text-slate-900 truncate">
                      {item.productName}
                    </h3>
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider',
                        config.badge
                      )}
                    >
                      {config.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500 font-bold mb-0.5">Hiện tại</p>
                      <p className="font-black text-slate-900">{item.currentStock} cái</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold mb-0.5">Dự kiến dùng</p>
                      <p className="font-black text-slate-900">{item.projectedUsage} cái</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold mb-0.5">Thiếu</p>
                      <p className={cn('font-black', config.text)}>{item.shortage} cái</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold mb-0.5">Hết sau</p>
                      <p className={cn('font-black', config.text)}>
                        {item.daysUntilShortage} ngày
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 text-center">
          💡 Dự báo dựa trên số ca còn lại của các booking đang hoạt động trong {metadata?.forecastPeriodDays || 30} ngày tới
        </p>
      </div>
    </div>
  );
}
