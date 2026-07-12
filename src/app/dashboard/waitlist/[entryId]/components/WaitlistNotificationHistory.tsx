import { Bell } from 'lucide-react';
import type { WaitlistNotificationLog } from '@/types/waitlist';

interface WaitlistNotificationHistoryProps {
  notifications: WaitlistNotificationLog[];
}

const channelLabels: Record<string, string> = {
  zalo: 'Zalo',
  sms: 'SMS',
  email: 'Email',
  push: 'Push',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Đang chờ', color: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Đã gửi', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Thất bại', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Đã hủy', color: 'bg-gray-100 text-gray-600' },
};

const typeLabels: Record<string, string> = {
  slot_available: 'Có chỗ trống',
  position_updated: 'Cập nhật vị trí',
  expiring_soon: 'Sắp hết hạn',
  expired: 'Đã hết hạn',
  reserved: 'Giữ chỗ thành công',
};

export function WaitlistNotificationHistory({
  notifications,
}: WaitlistNotificationHistoryProps) {
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Thông báo</h2>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-lg bg-gray-50 p-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Bell className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900">Chưa có thông báo</p>
          <p className="text-xs text-gray-600">
            Thông báo sẽ được gửi khi có chỗ trống hoặc vị trí thay đổi
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const statusConfig = statusLabels[notification.status] || statusLabels.pending;

            return (
              <div
                key={notification.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {channelLabels[notification.channel] || notification.channel}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-600">
                    {formatTimestamp(notification.sent_at || notification.created_at)}
                  </span>
                </div>

                <div className="mb-2 text-sm text-gray-700">
                  <span className="font-medium">
                    {typeLabels[notification.notification_type] || notification.notification_type}
                  </span>
                </div>

                {notification.message_content && (
                  <div className="mb-2 rounded bg-white p-2 text-xs text-gray-600">
                    "{notification.message_content}"
                  </div>
                )}

                {notification.status === 'sent' && notification.delivered_at && (
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>Gửi: {formatTimestamp(notification.sent_at)}</span>
                    <span>Đã nhận: {formatTimestamp(notification.delivered_at)}</span>
                    {notification.read_at && (
                      <span>Đã đọc: {formatTimestamp(notification.read_at)}</span>
                    )}
                  </div>
                )}

                {notification.status === 'failed' && notification.error_message && (
                  <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
                    ⚠️ Lỗi: {notification.error_message}
                    {notification.retry_count > 0 && (
                      <span className="ml-2">
                        (Đã thử {notification.retry_count}/{notification.max_retries} lần)
                      </span>
                    )}
                  </div>
                )}

                {notification.customer_response && (
                  <div className="mt-2 rounded bg-emerald-50 p-2 text-xs text-emerald-700">
                    ✅ Phản hồi: {notification.customer_response} ({formatTimestamp(notification.customer_response_at)})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
