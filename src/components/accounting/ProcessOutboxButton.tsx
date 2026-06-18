'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Database, Clock } from 'lucide-react';
import { useAccountingOutbox } from '@/hooks/useAccountingOutbox';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

/**
 * Button to manually process pending accounting entries
 * 
 * Features:
 * - Shows count of pending entries
 * - Manual trigger processing
 * - Shows last processed timestamp
 * - Toast notifications for results
 * 
 * Usage:
 * ```tsx
 * <ProcessOutboxButton />
 * ```
 */
export function ProcessOutboxButton() {
  const { status, isProcessing, processNow, refreshStatus } = useAccountingOutbox();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load status on mount
    refreshStatus();
  }, [refreshStatus]);

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    if (!mounted) return;
    
    const interval = setInterval(() => {
      refreshStatus();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [mounted, refreshStatus]);

  if (!mounted) {
    return null;
  }

  const hasPending = (status?.pending || 0) > 0;
  const lastProcessed = status?.last_processed_at 
    ? formatDistanceToNow(new Date(status.last_processed_at), { 
        addSuffix: true, 
        locale: vi 
      })
    : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Main Button */}
      <button
        onClick={processNow}
        disabled={isProcessing}
        className={`
          group relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-bold
          transition-all duration-200 shadow-sm
          ${hasPending 
            ? 'bg-rose-600 text-white hover:bg-rose-700 dark:bg-[#5D1C34] dark:hover:bg-[#7D1C44]' 
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#11100F] dark:text-[#CDBCAB] dark:hover:bg-[#1C1B19]'
          }
          ${isProcessing ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title={hasPending ? 'Click để xử lý bút toán kế toán đang chờ' : 'Không có bút toán cần xử lý'}
      >
        <Database className={`w-4 h-4 ${isProcessing ? 'animate-pulse' : ''}`} />
        <span className="whitespace-nowrap">
          {isProcessing ? 'Đang xử lý...' : 'Cập nhật số liệu kế toán'}
        </span>
        {hasPending && !isProcessing && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-2xs font-black">
            {status.pending}
          </span>
        )}
        {isProcessing && (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        )}
      </button>

      {/* Status Info */}
      {hasPending && !isProcessing && (
        <div className="flex items-center gap-1.5 px-1 text-2xs text-rose-600 dark:text-[#A67D44]">
          <Clock className="w-3 h-3" />
          <span>
            {status.pending} bút toán chờ xử lý
            {lastProcessed && ` • Lần cuối: ${lastProcessed}`}
          </span>
        </div>
      )}

      {!hasPending && lastProcessed && !isProcessing && (
        <div className="flex items-center gap-1.5 px-1 text-2xs text-slate-400 dark:text-[#CDBCAB]/60">
          <Clock className="w-3 h-3" />
          <span>Cập nhật {lastProcessed}</span>
        </div>
      )}
    </div>
  );
}
