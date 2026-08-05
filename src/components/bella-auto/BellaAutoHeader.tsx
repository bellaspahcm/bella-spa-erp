'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AdminNotificationBell from '@/components/common/AdminNotificationBell';

interface BellaAutoHeaderProps {
  monogram: string;
  fullName: string;
  tenantName: string;
}

export function BellaAutoHeader({ monogram, fullName, tenantName }: BellaAutoHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 shadow-sm transition-all">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-lg border border-cyan-500/20 shadow-sm select-none">
          {monogram}
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Chào mừng trở lại, <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">{fullName}</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Hệ thống quản lý ô tô <span className="font-semibold text-slate-700 dark:text-slate-200">{tenantName}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end md:self-center">
        {/* Nút Load dữ liệu */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-sm"
          title="Tải lại dữ liệu"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Notification Bell - Using AdminNotificationBell component */}
        <AdminNotificationBell position="bottom" className="shrink-0" />
      </div>
    </div>
  );
}
