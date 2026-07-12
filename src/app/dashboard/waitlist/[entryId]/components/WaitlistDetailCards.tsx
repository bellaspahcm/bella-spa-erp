import { User, Package, Calendar, Clock, UserCheck } from 'lucide-react';
import type { WaitlistEntry } from '@/types/waitlist';

interface WaitlistDetailCardsProps {
  entry: WaitlistEntry;
}

const tierLabels: Record<string, string> = {
  vip: 'VIP',
  loyal: 'Khách Thân Thiết',
  new: 'Khách Mới',
};

const tierColors: Record<string, string> = {
  vip: 'bg-yellow-100 text-yellow-800',
  loyal: 'bg-blue-100 text-blue-800',
  new: 'bg-gray-100 text-gray-800',
};

export function WaitlistDetailCards({ entry }: WaitlistDetailCardsProps) {
  return (
    <>
      {/* Customer & Service Cards Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Khách hàng</h2>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xl font-bold text-gray-900">{entry.customer_name}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">SĐT:</span>
              <span className="text-sm font-medium text-gray-900">
                {/* Phone not in entry, would need to fetch from customers table */}
                (Xem trong hệ thống)
              </span>
            </div>

            <div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  tierColors[entry.customer_tier] || tierColors.new
                }`}
              >
                {tierLabels[entry.customer_tier] || 'Khách Mới'}
              </span>
            </div>
          </div>
        </div>

        {/* Service Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Dịch vụ</h2>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xl font-bold text-gray-900">{entry.package_name}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Giá:</span>
              <span className="text-sm font-medium text-gray-900">
                {entry.booking_value.toLocaleString('vi-VN')} VNĐ
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Thời lượng:</span>
              <span className="text-sm font-medium text-gray-900">
                {entry.duration_minutes} phút
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Lịch mong muốn</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-1 text-sm text-gray-600">Ngày</p>
            <p className="text-base font-medium text-gray-900">
              {new Date(entry.preferred_date).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>

          <div>
            <p className="mb-1 text-sm text-gray-600">Giờ</p>
            <p className="text-base font-medium text-gray-900">
              {entry.preferred_start_time || 'Không chỉ định'}
            </p>
          </div>

          <div>
            <p className="mb-1 text-sm text-gray-600">KTV ưu tiên</p>
            <p className="text-base font-medium text-gray-900">
              {entry.preferred_ktv_name || 'Không chỉ định'}
            </p>
          </div>

          <div>
            <p className="mb-1 text-sm text-gray-600">Linh hoạt</p>
            <p className="text-base font-medium text-gray-900">
              {entry.is_flexible ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <UserCheck className="h-4 w-4" />
                  Có
                </span>
              ) : (
                'Không'
              )}
            </p>
          </div>
        </div>

        {entry.notes && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="mb-1 text-sm text-gray-600">Ghi chú</p>
            <p className="text-sm text-gray-900">{entry.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
