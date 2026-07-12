'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Eye, Bell, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { WaitlistStatusBadge } from './WaitlistStatusBadge';
import type { WaitlistEntry } from '@/types/waitlist';

interface WaitlistTableRowProps {
  entry: WaitlistEntry;
  onRefresh: () => Promise<void>;
}

export function WaitlistTableRow({ entry, onRefresh }: WaitlistTableRowProps) {
  const router = useRouter();
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate wait time in human-readable format
  const getWaitTime = () => {
    const now = new Date();
    const created = new Date(entry.created_at);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} phút`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)} giờ`;
    } else {
      return `${Math.floor(diffMins / 1440)} ngày`;
    }
  };

  // Priority bar color based on score
  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  // Handle actions
  const handleNotify = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/waitlist/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'notified' }),
      });

      if (!response.ok) {
        throw new Error('Không thể gửi thông báo');
      }

      toast.success('Đã gửi thông báo đến khách hàng');
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi gửi thông báo');
    } finally {
      setIsProcessing(false);
      setIsActionsOpen(false);
    }
  };

  const handleConvert = async () => {
    // TODO: Implement booking creation flow
    toast.info('Chức năng chuyển đổi sang lịch hẹn đang được phát triển');
    setIsActionsOpen(false);
  };

  const handleCancel = async () => {
    const reason = prompt('Lý do hủy (tùy chọn):');
    
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/waitlist/${entry.id}?reason=${encodeURIComponent(reason || 'Không ghi rõ')}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể hủy');
      }

      toast.success('Đã xóa khỏi danh sách chờ');
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi hủy');
    } finally {
      setIsProcessing(false);
      setIsActionsOpen(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Position */}
      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
        {entry.position || '-'}
      </td>

      {/* Customer */}
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-gray-900">
          {entry.customer_name}
        </div>
        <div className="text-sm text-gray-600">
          {entry.customer_phone}
        </div>
      </td>

      {/* Service */}
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          {entry.package_name}
        </div>
        <div className="text-sm text-gray-600">
          {entry.duration_minutes} phút
        </div>
      </td>

      {/* Preferred Date */}
      <td className="px-6 py-4 text-sm text-gray-900">
        {new Date(entry.preferred_date).toLocaleDateString('vi-VN')}
      </td>

      {/* Preferred Time */}
      <td className="px-6 py-4 text-sm text-gray-900">
        {entry.preferred_time || '-'}
      </td>

      {/* Priority Score */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="h-2 w-24 rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full ${getPriorityColor(entry.priority_score)}`}
                style={{ width: `${entry.priority_score}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-gray-900">
            {entry.priority_score}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <WaitlistStatusBadge status={entry.status} />
      </td>

      {/* Wait Time */}
      <td className="px-6 py-4 text-sm text-gray-600">
        {getWaitTime()}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        <div className="relative">
          <button
            onClick={() => setIsActionsOpen(!isActionsOpen)}
            disabled={isProcessing}
            className="inline-flex items-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {/* Actions dropdown */}
          {isActionsOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsActionsOpen(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => {
                    setIsActionsOpen(false);
                    router.push(`/dashboard/waitlist/${entry.id}`);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4" />
                  Xem chi tiết
                </button>

                {entry.status === 'active' && (
                  <button
                    onClick={handleNotify}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Bell className="h-4 w-4" />
                    Gửi thông báo
                  </button>
                )}

                {(entry.status === 'active' || entry.status === 'notified') && (
                  <button
                    onClick={handleConvert}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Chuyển sang lịch hẹn
                  </button>
                )}

                {entry.status !== 'cancelled' && entry.status !== 'converted' && (
                  <button
                    onClick={handleCancel}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Hủy
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
