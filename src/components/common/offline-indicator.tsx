'use client';

import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineIndicator() {
  const { isOnline, pendingCount, triggerSync } = useOfflineSync();

  return (
    <AnimatePresence>
      {(!isOnline || pendingCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl px-4.5 py-3 rounded-2xl max-w-sm"
        >
          <div className="flex items-center justify-center">
            {isOnline ? (
              <div className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </div>
            ) : (
              <div className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
              </div>
            )}
          </div>

          <div className="flex-1 text-xs">
            <p className="font-bold text-slate-850 dark:text-slate-100 flex items-center gap-1.5">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  Đang trực tuyến
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  Chế độ ngoại tuyến (Offline)
                </>
              )}
            </p>
            {pendingCount > 0 ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Có <strong>{pendingCount}</strong> hành động đang chờ đồng bộ.
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Dữ liệu tạm được lưu trữ an toàn.
              </p>
            )}
          </div>

          {isOnline && pendingCount > 0 && (
            <button
              onClick={triggerSync}
              className="flex items-center gap-1 bg-pink-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-md hover:bg-pink-700 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '2s' }} />
              Đồng bộ ngay
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
