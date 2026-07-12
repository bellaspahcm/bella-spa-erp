import type { WaitlistStatus } from '@/types/waitlist';

interface WaitlistStatusBadgeProps {
  status: WaitlistStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<WaitlistStatus, { label: string; color: string }> = {
  active: { label: 'Đang chờ', color: 'bg-blue-100 text-blue-700' },
  notified: { label: 'Đã thông báo', color: 'bg-green-100 text-green-700' },
  reserved: { label: 'Đã giữ chỗ', color: 'bg-yellow-100 text-yellow-700' },
  converted: { label: 'Đã đặt lịch', color: 'bg-emerald-100 text-emerald-700' },
  expired: { label: 'Hết hạn', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-700' },
};

export function WaitlistStatusBadge({ status, size = 'sm' }: WaitlistStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.active;
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClass}`}
    >
      {config.label}
    </span>
  );
}
