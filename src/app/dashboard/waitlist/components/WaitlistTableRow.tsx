'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Eye, Bell, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { WaitlistStatusBadge } from './WaitlistStatusBadge';
import { TableRow, TableCell } from '@/components/ui/table';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { WaitlistEntry } from '@/types/waitlist';

interface WaitlistTableRowProps {
  entry: WaitlistEntry;
  onRefresh: () => Promise<void>;
}

export function WaitlistTableRow({ entry, onRefresh }: WaitlistTableRowProps) {
  const router = useRouter();
  const vocab = useModuleVocabulary();
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
    }
  };

  const handleConvert = async () => {
    toast.info(`Chức năng chuyển đổi sang ${vocab.booking.singular.toLowerCase()} đang được phát triển`);
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
    }
  };

  return (
    <TableRow className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
      {/* Position */}
      <TableCell className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {entry.position || '-'}
      </TableCell>

      {/* Customer */}
      <TableCell className="px-6 py-4">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {entry.customer_name}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {entry.customer_phone}
        </div>
      </TableCell>

      {/* Service */}
      <TableCell className="px-6 py-4">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {entry.package_name}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {entry.duration_minutes} phút
        </div>
      </TableCell>

      {/* Preferred Date */}
      <TableCell className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
        {new Date(entry.preferred_date).toLocaleDateString('vi-VN')}
      </TableCell>

      {/* Preferred Time */}
      <TableCell className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-mono">
        {entry.preferred_start_time || '-'}
      </TableCell>

      {/* Priority Score */}
      <TableCell className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2 w-24 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/30 dark:border-slate-700/30">
              <div
                className={`h-full rounded-full ${getPriorityColor(entry.priority_score)}`}
                style={{ width: `${entry.priority_score}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
            {entry.priority_score}
          </span>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell className="px-6 py-4">
        <WaitlistStatusBadge status={entry.status} />
      </TableCell>

      {/* Wait Time */}
      <TableCell className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
        {getWaitTime()}
      </TableCell>

      {/* Actions */}
      <TableCell className="px-6 py-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isProcessing}
            className="inline-flex items-center rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-50 transition-colors"
          >
            <MoreVertical className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-[#1c1b19] border border-slate-200/60 dark:border-slate-800 shadow-lg">
            <DropdownMenuItem
              onClick={() => router.push(`/dashboard/waitlist/${entry.id}`)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
            >
              <Eye className="h-4 w-4 text-slate-400" />
              Xem chi tiết
            </DropdownMenuItem>

            {entry.status === 'active' && (
              <DropdownMenuItem
                onClick={handleNotify}
                disabled={isProcessing}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors disabled:opacity-50"
              >
                <Bell className="h-4 w-4 text-slate-400" />
                Gửi thông báo
              </DropdownMenuItem>
            )}

            {(entry.status === 'active' || entry.status === 'notified') && (
              <DropdownMenuItem
                onClick={handleConvert}
                disabled={isProcessing}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors disabled:opacity-50"
              >
                <Check className="h-4 w-4 text-slate-400" />
                Chuyển sang {vocab.booking.singular.toLowerCase()}
              </DropdownMenuItem>
            )}

            {entry.status !== 'cancelled' && entry.status !== 'converted' && (
              <DropdownMenuItem
                onClick={handleCancel}
                disabled={isProcessing}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4 text-red-400" />
                Hủy
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
