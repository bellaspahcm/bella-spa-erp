/**
 * Partner Portal - Inbox Module
 * Hộp thư thông báo & cập nhật dự án
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/services/user-actions';
import { fetchPartnerNotifications, markNotificationAsRead } from '@/services/partner-actions';

type NotificationType = 
  | 'booking_approved'
  | 'booking_rejected'
  | 'commission_approved'
  | 'commission_paid'
  | 'policy_update'
  | 'price_update'
  | 'system_announcement';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: {
    booking_id?: string;
    commission_id?: string;
    document_id?: string;
    amount?: number;
  };
}

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  booking_approved: '✅',
  booking_rejected: '❌',
  commission_approved: '💰',
  commission_paid: '🎉',
  policy_update: '📋',
  price_update: '💲',
  system_announcement: '📢',
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  booking_approved: 'bg-green-50 border-green-200',
  booking_rejected: 'bg-red-50 border-red-200',
  commission_approved: 'bg-yellow-50 border-yellow-200',
  commission_paid: 'bg-blue-50 border-blue-200',
  policy_update: 'bg-purple-50 border-purple-200',
  price_update: 'bg-orange-50 border-orange-200',
  system_announcement: 'bg-gray-50 border-gray-200',
};

export default function PartnerInboxPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      await loadNotifications(user.id);
    };
    void loadUser();
  }, [router]);

  const loadNotifications = async (userId: string) => {
    try {
      setLoading(true);
      const data = await fetchPartnerNotifications(userId);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.metadata?.booking_id) {
      router.push('/partner/bookings');
    } else if (notification.metadata?.commission_id) {
      router.push('/partner/commission');
    } else if (notification.metadata?.document_id) {
      router.push('/partner/documents');
    }
  };

  const filteredNotifications =
    filter === 'all'
      ? notifications
      : notifications.filter((n) => !n.is_read);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const formatTimeAgo = (date: string): string => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now.getTime() - notifDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return notifDate.toLocaleDateString('vi-VN');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">Hộp Thư</h1>
            {unreadCount > 0 && (
              <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg ${
                filter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="p-4 space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">
              {filter === 'all' ? 'Chưa có thông báo nào' : 'Không có thông báo chưa đọc'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => void handleNotificationClick(notif)}
              className={`
                rounded-lg border p-4 cursor-pointer transition-all
                ${NOTIFICATION_COLORS[notif.type]}
                ${notif.is_read ? 'opacity-60' : 'shadow-sm'}
              `}
            >
              {/* Notification Header */}
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl">{NOTIFICATION_ICONS[notif.type]}</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900">{notif.title}</h3>
                    {!notif.is_read && (
                      <span className="ml-2 w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5"></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                </div>
              </div>

              {/* Metadata */}
              {notif.metadata?.amount && (
                <div className="bg-white/50 rounded-lg px-3 py-2 mt-2">
                  <p className="text-sm font-medium text-gray-700">
                    Số tiền: {notif.metadata.amount.toLocaleString('vi-VN')} VNĐ
                  </p>
                </div>
              )}

              {/* Timestamp */}
              <p className="text-xs text-gray-500 mt-2">{formatTimeAgo(notif.created_at)}</p>
            </div>
          ))
        )}
      </div>

      {/* Mark All as Read Button */}
      {unreadCount > 0 && filter === 'unread' && (
        <div className="fixed bottom-24 left-0 right-0 px-4">
          <button
            onClick={async () => {
              const unreadNotifs = notifications.filter((n) => !n.is_read);
              await Promise.all(
                unreadNotifs.map((n) => markNotificationAsRead(n.id))
              );
              setNotifications((prev) =>
                prev.map((n) => ({ ...n, is_read: true }))
              );
            }}
            className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-lg hover:bg-blue-700"
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      )}
    </div>
  );
}
