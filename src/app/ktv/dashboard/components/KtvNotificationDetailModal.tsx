'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  Megaphone,
  User,
  X,
} from 'lucide-react';

import type { KtvDashboardNotification } from './KtvDashboardHeader';

type KtvNotificationDetailModalProps = {
  notification: KtvDashboardNotification | null;
  onClose: () => void;
  onShowTodayScheduleHint: () => void;
};

function isSalaryNotification(type?: string | null) {
  return type === 'salary' || type === 'payroll';
}

function getNotificationLabel(type?: string | null) {
  if (type === 'booking') {
    return 'Lịch ca mới';
  }
  if (isSalaryNotification(type)) {
    return 'Đối soát lương';
  }
  if (type === 'system') {
    return 'Hệ thống';
  }
  return 'Cá nhân';
}

function formatNotificationTime(value?: string | number | Date | null) {
  if (!value) {
    return 'Chưa có thời gian';
  }

  const createdAt = new Date(value);
  return `${createdAt.toLocaleDateString('vi-VN')} ${createdAt.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function KtvNotificationDetailModal({
  notification,
  onClose,
  onShowTodayScheduleHint,
}: KtvNotificationDetailModalProps) {
  const type = notification?.type;

  return (
    <AnimatePresence>
      {notification && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-slate-100 pointer-events-auto flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500" />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mt-4 flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-md ${
                  type === 'booking' ? 'bg-indigo-100 text-indigo-600 border border-indigo-200/50 shadow-indigo-100' :
                  isSalaryNotification(type) ? 'bg-emerald-100 text-emerald-600 border border-emerald-200/50 shadow-emerald-100' :
                  type === 'system' ? 'bg-amber-100 text-amber-600 border border-amber-200/50 shadow-amber-100' :
                  'bg-rose-100 text-rose-600 border border-rose-200/50 shadow-rose-100 dark:shadow-none'
                }`}>
                  {type === 'booking' && <CalendarIcon className="w-8 h-8" />}
                  {isSalaryNotification(type) && <DollarSign className="w-8 h-8" />}
                  {type === 'system' && <Megaphone className="w-8 h-8" />}
                  {type !== 'booking' && !isSalaryNotification(type) && type !== 'system' && <User className="w-8 h-8" />}
                </div>

                <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest mb-3 ${
                  type === 'booking' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                  isSalaryNotification(type) ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                  type === 'system' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                  'bg-rose-50 text-rose-600 border border-rose-100'
                }`}>
                  {getNotificationLabel(type)}
                </span>

                <h3 className="text-lg font-black text-slate-900 leading-tight mb-2 px-2">
                  {notification.title || 'Thông báo'}
                </h3>

                <span className="text-[10px] text-slate-400 font-bold mb-4 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                  {formatNotificationTime(notification.createdAt)}
                </span>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 w-full text-left text-sm text-slate-600 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar mb-6 font-medium">
                  {notification.message || ''}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {type === 'booking' && (
                  <button
                    onClick={onShowTodayScheduleHint}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-100"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    Xem lịch hôm nay
                  </button>
                )}
                {isSalaryNotification(type) && (
                  <Link
                    href="/ktv/earnings"
                    onClick={onClose}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-100 text-center"
                  >
                    <DollarSign className="w-4 h-4" />
                    Xem đối soát thu nhập
                  </Link>
                )}
                <button
                  onClick={onClose}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-slate-200"
                >
                  Đã hiểu
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
