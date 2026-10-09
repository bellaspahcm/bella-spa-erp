'use client';

import { Loader2, Megaphone, RefreshCw, Send } from 'lucide-react';

interface CrmHeaderProps {
  loading: boolean;
  scanning: boolean;
  onRefresh: () => void;
  onManualScan: () => void;
}

export function CrmHeader({ loading, scanning, onRefresh, onManualScan }: CrmHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white/60 p-4 shadow-xs backdrop-blur-md md:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          <Megaphone className="h-8 w-8 shrink-0 text-primary" />
          CRM & Zalo Marketing
        </h1>
        <p className="mt-1 text-xs font-medium text-slate-500 md:text-sm">
          Hệ thống gửi tin Zalo ZNS tự động, quản lý tệp khách hàng và chiến dịch khuyến mãi
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:border-primary/20 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
        <button
          onClick={onManualScan}
          disabled={scanning || loading}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-md transition-all hover:bg-primary-hover disabled:opacity-75"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Quét lịch hẹn hôm nay
        </button>
      </div>
    </div>
  );
}
