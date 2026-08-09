'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, BellOff, CheckCircle2, ChevronLeft, Loader2, 
  MessageSquare, Sparkles, Trash2, MailOpen
} from 'lucide-react';
import { getWorkforceNotifications, markWorkforceNotificationAsRead, WorkforceNotification } from '@/services/workforce-actions';
import { toast } from 'sonner';
import Link from 'next/link';

export default function InboxCenter() {
  const [notifications, setNotifications] = useState<WorkforceNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await getWorkforceNotifications();
      setNotifications(data);
    } catch (err: unknown) {
      console.error('[InboxCenter] Fetch failed:', err);
      toast.error('Lỗi khi tải thông báo');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  const handleMarkAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );

    try {
      const res = await markWorkforceNotificationAsRead(id);
      if (!res.success) {
        toast.error(res.error || 'Lỗi khi cập nhật trạng thái thông báo');
        fetchNotifs(); // rollback
      }
    } catch (err: unknown) {
      fetchNotifs(); // rollback
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'lead_assigned':
      case 'lead':
        return <Sparkles className="w-5 h-5 text-indigo-500 fill-indigo-100 dark:fill-none" />;
      case 'booking_approved':
      case 'booking':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Hộp Thư Thông Báo</h2>
        </div>
      </div>

      {/* NOTIFICATION LIST */}
      <div className="p-5 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải thông báo...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <BellOff className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Không có thông báo mới nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div 
                key={notif.id}
                onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-3.5 shadow-sm ${notif.is_read ? 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-850 opacity-70' : 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 font-black hover:border-primary/25'}`}
              >
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl flex-shrink-0 self-start">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-xs text-slate-850 dark:text-slate-150 leading-snug">{notif.title}</h4>
                    {!notif.is_read && (
                      <span className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[9px] font-bold text-slate-350 dark:text-slate-500 uppercase tracking-wider block pt-1">
                    {new Date(notif.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
