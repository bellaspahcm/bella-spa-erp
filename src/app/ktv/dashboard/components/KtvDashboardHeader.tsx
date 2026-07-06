'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  Megaphone,
  RefreshCw,
  User,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { formatCurrency } from '@bella/shared';;
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';

export type KtvDashboardNotification = {
  id: string;
  type?: string | null;
  isRead?: boolean | null;
  title?: string | null;
  message?: string | null;
  createdAt?: string | number | Date | null;
};

type KtvUserSummary = {
  full_name?: string | null;
} | null;

type KtvDashboardHeaderProps = {
  user: KtvUserSummary;
  earnings: {
    total: number;
    sessions: number;
  };
  systemTime: string;
  isOnline: boolean;
  pendingCount: number;
  isNotifOpen: boolean;
  notifications: KtvDashboardNotification[];
  unreadCount: number;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onOpenProfile: () => void;
  onRefresh: () => void;
  onTriggerSync: () => void | Promise<void>;
  onMarkAsRead: (notifId: string) => void | Promise<void>;
  onSelectNotification: (notification: KtvDashboardNotification) => void;
  tenantModuleKey: TenantModuleKey | null;
};

type NotificationMeta = {
  type: string;
  iconElement: ReactNode;
  badgeLabel: string;
  iconBgStyle: string;
  badgeStyle: string;
};

function getNotificationMeta(notification: KtvDashboardNotification): NotificationMeta {
  const type = notification.type || 'personal';

  if (type === 'booking') {
    return {
      type,
      iconElement: <CalendarIcon className="w-4 h-4" />,
      badgeLabel: 'Lịch ca mới',
      iconBgStyle: !notification.isRead
        ? 'bg-indigo-100 text-indigo-600 border border-indigo-200'
        : 'bg-indigo-50 text-indigo-400 border border-indigo-100',
      badgeStyle: 'bg-indigo-50 text-indigo-600',
    };
  }

  if (type === 'salary' || type === 'payroll') {
    return {
      type,
      iconElement: <DollarSign className="w-4 h-4" />,
      badgeLabel: 'Đối soát lương',
      iconBgStyle: !notification.isRead
        ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
        : 'bg-emerald-50 text-emerald-400 border border-emerald-100',
      badgeStyle: 'bg-emerald-50 text-emerald-600',
    };
  }

  if (type === 'system') {
    return {
      type,
      iconElement: <Megaphone className="w-4 h-4" />,
      badgeLabel: 'Hệ thống',
      iconBgStyle: !notification.isRead
        ? 'bg-amber-100 text-amber-600 border border-amber-200'
        : 'bg-amber-50 text-amber-400 border border-amber-100',
      badgeStyle: 'bg-amber-50 text-amber-600',
    };
  }

  return {
    type,
    iconElement: <User className="w-4 h-4" />,
    badgeLabel: 'Cá nhân',
    iconBgStyle: !notification.isRead
      ? 'bg-rose-100 text-rose-600 border border-rose-200'
      : 'bg-rose-50 text-rose-400 border border-rose-100',
    badgeStyle: 'bg-rose-50 text-rose-600',
  };
}

export function KtvDashboardHeader({
  user,
  earnings,
  systemTime,
  isOnline,
  pendingCount,
  isNotifOpen,
  notifications,
  unreadCount,
  onToggleNotifications,
  onCloseNotifications,
  onOpenProfile,
  onRefresh,
  onTriggerSync,
  onMarkAsRead,
  onSelectNotification,
  tenantModuleKey,
}: KtvDashboardHeaderProps) {
  const vocab = getModuleVocabulary(tenantModuleKey);
  
  return (
    <div className="bg-white px-6 pt-8 pb-6 rounded-b-[40px] shadow-sm border-b border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100/50">
            <Clock className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary uppercase tracking-wider">{systemTime}</span>
          </div>

          {isOnline ? (
            pendingCount > 0 ? (
              <button
                onClick={() => onTriggerSync()}
                className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100/50 hover:bg-blue-100 transition-all active:scale-95 animate-pulse"
                title="Nhấp để đồng bộ thủ công"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-spin" />
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">Đồng bộ ({pendingCount})</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Trực tuyến</span>
              </div>
            )
          ) : (
            <button
              onClick={() => onTriggerSync()}
              className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100/50 hover:bg-amber-100 transition-all active:scale-95"
              title="Đang lưu ngoại tuyến. Nhấp để thử đồng bộ lại"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Ngoại tuyến ({pendingCount})</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={onToggleNotifications}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all active:scale-95 relative ${
                isNotifOpen ? 'bg-primary text-white border-primary shadow-lg shadow-pink-100 dark:shadow-none' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={onCloseNotifications} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 z-50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-black uppercase tracking-widest text-xs text-slate-900">Thông báo</h3>
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-600 text-[9px] font-black rounded-full uppercase">
                        {unreadCount} Mới
                      </span>
                    </div>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => {
                          const meta = getNotificationMeta(notification);
                          const createdAt = notification.createdAt ? new Date(notification.createdAt) : null;

                          return (
                            <div
                              key={notification.id}
                              onClick={() => {
                                onMarkAsRead(notification.id);
                                onCloseNotifications();
                                onSelectNotification(notification);
                              }}
                              className={`p-3 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer text-left ${
                                !notification.isRead ? 'bg-rose-50/30 border-rose-100 font-bold' : 'bg-slate-50/50 border-slate-100 opacity-60'
                              }`}
                            >
                              <div className="flex gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.iconBgStyle}`}>
                                  {meta.iconElement}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <h4 className="font-bold text-xs text-slate-900 truncate">{notification.title || 'Thông báo'}</h4>
                                    <span className={`text-[8px] px-1.5 py-0.2 rounded-full font-black uppercase shrink-0 ${meta.badgeStyle}`}>
                                      {meta.badgeLabel}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-800 leading-normal line-clamp-2">{notification.message || ''}</p>
                                  <span className="text-[8px] text-slate-700 mt-1 block">
                                    {createdAt
                                      ? `${createdAt.toLocaleDateString('vi-VN')} ${createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                                      : 'Chưa có thời gian'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-8 text-center">
                          <span className="text-2xl mb-2 block">🔔</span>
                          <p className="text-slate-400 font-bold text-xs italic">Không có thông báo mới</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={onRefresh}
            className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 hover:text-primary transition-all active:scale-95"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenProfile}
            className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 hover:text-primary transition-all active:scale-95"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-slate-700 text-[10px] font-black uppercase tracking-widest mb-0.5">{vocab.worker.singular}</p>
        <h1 className="text-2xl font-black text-slate-900">{user?.full_name || vocab.worker.singular}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-3xl text-white shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Thu nhập tháng</p>
          <p className="text-lg font-black">{formatCurrency(earnings.total)}</p>
        </div>
        <div className="bg-rose-600 p-4 rounded-3xl text-white shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Số {vocab.workUnit.plural} đã xong</p>
          <p className="text-lg font-black">{earnings.sessions} {vocab.workUnit.singular}</p>
        </div>
      </div>
    </div>
  );
}
