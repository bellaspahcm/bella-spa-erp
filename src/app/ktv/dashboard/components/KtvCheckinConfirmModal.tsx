'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Play, RefreshCw } from 'lucide-react';

import type { KtvDashboardSession } from './KtvSessionSections';

type KtvCheckinConfirmModalProps = {
  session: KtvDashboardSession | null;
  isActionLoading: string | null;
  onClose: () => void;
  onConfirm: (session: KtvDashboardSession) => void | Promise<void>;
};

export function KtvCheckinConfirmModal({
  session,
  isActionLoading,
  onClose,
  onConfirm,
}: KtvCheckinConfirmModalProps) {
  return (
    <AnimatePresence>
      {session && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (isActionLoading === null) {
                onClose();
              }
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 flex items-end justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="pointer-events-auto w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-primary/5 px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Play className="w-5 h-5 text-primary fill-current" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Xác nhận Check-in</p>
                    <p className="text-xs text-slate-400">Buổi {session.session_number}</p>
                  </div>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-2">{session.bookings?.customers?.name_mother}</h3>
                <p className="text-xs text-slate-500 truncate">{session.bookings?.package_name}</p>
              </div>

              <div className="px-6 py-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Bạn xác nhận bắt đầu buổi chăm sóc này? Hệ thống sẽ ghi nhận giờ check-in ngay bây giờ.
                </p>
              </div>

              <div className="px-6 pb-6 flex flex-col gap-2">
                <button
                  onClick={() => onConfirm(session)}
                  disabled={isActionLoading !== null}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isActionLoading !== null ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Bắt đầu buổi chăm sóc
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={isActionLoading !== null}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                >
                  Quay lại
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
