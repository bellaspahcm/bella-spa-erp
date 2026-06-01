'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

interface CrmLoadErrorBannerProps {
  error: string;
  loading: boolean;
  onRetry: () => void;
}

export function CrmLoadErrorBanner({ error, loading, onRetry }: CrmLoadErrorBannerProps) {
  return (
    <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-rose-700">Lỗi tải dữ liệu CRM</h3>
          <p className="text-sm font-semibold text-rose-700/80 mt-1">{error}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        Thử lại
      </button>
    </div>
  );
}
