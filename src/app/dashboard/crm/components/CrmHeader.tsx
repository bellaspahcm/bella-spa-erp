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
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <Megaphone className="w-10 h-10 text-primary" />
          CRM & Zalo Marketing
        </h1>
        <p className="text-slate-400 font-medium mt-1">Hệ thống gửi tin Zalo ZNS tự động, quản lý tệp khách hàng và chiến dịch khuyến mãi</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-3 bg-white hover:bg-rose-50 text-slate-600 hover:text-primary rounded-2xl transition-all border border-rose-100 flex items-center gap-2 shadow-sm font-black text-xs uppercase tracking-widest disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          LÀM MỚI
        </button>
        <button
          onClick={onManualScan}
          disabled={scanning || loading}
          className="px-6 py-3 bg-gradient-to-r from-primary to-rose-500 hover:from-primary/95 hover:to-rose-600 text-white rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-rose-200 dark:shadow-none font-black text-xs uppercase tracking-widest disabled:opacity-75"
        >
          {scanning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          QUÉT LỊCH HẸN HÔM NAY
        </button>
      </div>
    </div>
  );
}
