'use client';

import React, { useState } from 'react';
import { Plus, Minus, Eye, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { approveAdjustment } from '@/modules/salary/actions/approve-adjustment';
import { rejectAdjustment } from '@/modules/salary/actions/reject-adjustment';
import { deleteAdjustment } from '@/modules/salary/actions/delete-adjustment';
import { AdjustmentDetailsModal } from './AdjustmentDetailsModal';

type SalaryAdjustment = {
  id: string;
  ktv_id: string;
  month_year: string;
  adjustment_type: 'bonus' | 'deduction';
  amount: number;
  category: string;
  reason: string;
  notes: string | null;
  status: 'draft' | 'approved' | 'rejected' | 'cancelled';
  approved_by_id: string | null;
  approved_at: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  ktv_name?: string;
  created_by_name?: string;
  approved_by_name?: string;
};

interface AdjustmentRowProps {
  adjustment: SalaryAdjustment;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function AdjustmentRow({
  adjustment,
  isSelected,
  onSelect,
  onRefresh,
}: AdjustmentRowProps) {
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleView = () => {
    setIsViewModalOpen(true);
  };

  const handleEdit = () => {
    alert('Edit adjustment (sẽ mở EditAdjustmentModal - tương tự AddAdjustmentModal nhưng pre-fill data)');
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa điều chỉnh này?')) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = await deleteAdjustment({ adjustmentId: adjustment.id });

      if (result.success) {
        alert('Đã xóa điều chỉnh');
        onRefresh();
      } else {
        alert(result.error || 'Không thể xóa điều chỉnh');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Lỗi hệ thống');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm(`Bạn có chắc muốn duyệt điều chỉnh này?\n\nSau khi duyệt, lương KTV sẽ được tự động tính lại.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = await approveAdjustment({ adjustmentId: adjustment.id });

      if (result.success) {
        alert('Đã duyệt điều chỉnh thành công!\n\nLương KTV đã được tính lại.');
        onRefresh();
      } else {
        alert(result.error || 'Không thể duyệt điều chỉnh');
      }
    } catch (error) {
      console.error('Approve error:', error);
      alert('Lỗi hệ thống');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Lý do từ chối (tối thiểu 10 ký tự):');
    if (!reason) return;

    if (reason.trim().length < 10) {
      alert('Lý do từ chối phải có ít nhất 10 ký tự');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await rejectAdjustment({
        adjustmentId: adjustment.id,
        rejectionReason: reason,
      });

      if (result.success) {
        alert('Đã từ chối điều chỉnh');
        onRefresh();
      } else {
        alert(result.error || 'Không thể từ chối điều chỉnh');
      }
    } catch (error) {
      console.error('Reject error:', error);
      alert('Lỗi hệ thống');
    } finally {
      setIsProcessing(false);
    }
  };

  const statusConfig = {
    draft: {
      label: 'Chờ duyệt',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    },
    approved: {
      label: 'Đã duyệt',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    rejected: {
      label: 'Từ chối',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    cancelled: {
      label: 'Đã hủy',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    },
  };

  const status = statusConfig[adjustment.status];

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(adjustment.id)}
            disabled={isProcessing}
            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
          />
        </td>
        
        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          {adjustment.month_year.substring(0, 7)}
        </td>
        
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          {adjustment.ktv_name}
        </td>
        
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {adjustment.adjustment_type === 'bonus' ? (
              <>
                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Thưởng
                </span>
              </>
            ) : (
              <>
                <Minus className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Phạt
                </span>
              </>
            )}
          </div>
        </td>
        
        <td className="px-4 py-3">
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {adjustment.category}
          </span>
        </td>
        
        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
          {adjustment.adjustment_type === 'bonus' ? '+' : '-'}
          {adjustment.amount.toLocaleString('vi-VN')} đ
        </td>
        
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate" title={adjustment.reason}>
          {adjustment.reason}
        </td>
        
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </td>
        
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          {adjustment.created_by_name}
        </td>
        
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {new Date(adjustment.created_at).toLocaleDateString('vi-VN')}
        </td>
        
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {adjustment.status === 'draft' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors disabled:opacity-50"
                  title="Duyệt"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                  title="Từ chối"
                >
                  <XCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={handleEdit}
                  disabled={isProcessing}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                  title="Sửa"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isProcessing}
                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                  title="Xóa"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={handleView}
              disabled={isProcessing}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
              title="Xem chi tiết"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* View Details Modal */}
      {isViewModalOpen && (
        <AdjustmentDetailsModal
          adjustment={adjustment}
          onClose={() => setIsViewModalOpen(false)}
        />
      )}
    </>
  );
}
