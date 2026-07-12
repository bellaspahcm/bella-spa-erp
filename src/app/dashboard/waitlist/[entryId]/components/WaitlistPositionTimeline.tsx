import { Clock } from 'lucide-react';
import type { WaitlistEntry } from '@/types/waitlist';

interface WaitlistPositionTimelineProps {
  entry: WaitlistEntry;
}

interface TimelineEvent {
  timestamp: string;
  label: string;
  icon: string;
  color: string;
}

export function WaitlistPositionTimeline({ entry }: WaitlistPositionTimelineProps) {
  // Build timeline from entry data
  const events: TimelineEvent[] = [];

  // Created event
  events.push({
    timestamp: entry.created_at,
    label: `Thêm vào hàng (vị trí #${entry.position || '?'})`,
    icon: '➕',
    color: 'bg-blue-500',
  });

  // Notified event
  if (entry.notified_at) {
    events.push({
      timestamp: entry.notified_at,
      label: 'Đã gửi thông báo',
      icon: '📢',
      color: 'bg-green-500',
    });
  }

  // Reserved event
  if (entry.reserved_at) {
    events.push({
      timestamp: entry.reserved_at,
      label: 'Giữ chỗ thành công',
      icon: '✅',
      color: 'bg-yellow-500',
    });
  }

  // Converted event
  if (entry.converted_at) {
    events.push({
      timestamp: entry.converted_at,
      label: 'Chuyển đổi sang lịch hẹn',
      icon: '🎉',
      color: 'bg-emerald-500',
    });
  }

  // Removed event
  if (entry.removed_at) {
    events.push({
      timestamp: entry.removed_at,
      label: `Đã hủy (${entry.removal_reason || 'Không ghi rõ'})`,
      icon: '❌',
      color: 'bg-red-500',
    });
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const formatTimestamp = (timestamp: string) => {
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
        <Clock className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-gray-600">Chưa có sự kiện nào</p>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={index} className="flex gap-4">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${event.color} text-white text-xs`}
                >
                  {event.icon}
                </div>
                {index < events.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200 mt-2" />
                )}
              </div>

              {/* Event content */}
              <div className="flex-1 pb-4">
                <p className="text-sm font-medium text-gray-900">{event.label}</p>
                <p className="text-xs text-gray-600">{formatTimestamp(event.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wait Time Summary */}
      <div className="mt-6 border-t border-gray-200 pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Thời gian chờ thực tế</p>
            <p className="text-lg font-semibold text-gray-900">
              {entry.wait_minutes > 60
                ? `${Math.floor(entry.wait_minutes / 60)} giờ ${entry.wait_minutes % 60} phút`
                : `${entry.wait_minutes} phút`}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Dự kiến chờ</p>
            <p className="text-lg font-semibold text-gray-900">
              {entry.estimated_wait_minutes > 60
                ? `${Math.floor(entry.estimated_wait_minutes / 60)} giờ`
                : `${entry.estimated_wait_minutes} phút`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
