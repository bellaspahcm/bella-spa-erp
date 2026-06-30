'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Plus, Minus, Calendar, User, FileText } from 'lucide-react';

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

interface AdjustmentDetailsModalProps {
  adjustment: SalaryAdjustment;
  onClose: () => void;
}

export function AdjustmentDetailsModal({ adjustment, onClose }: AdjustmentDetailsModalProps) {
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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white dark:bg-gray-900 shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4 rounded-t-[24px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Chi tiết điều chỉnh
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ID: {adjustment.id.substring(0, 8)}...
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Đóng"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${status.className}`}>
                {status.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Cập nhật: {new Date(adjustment.updated_at).toLocaleString('vi-VN')}
              </span>
            </div>

            {/* Main Info */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* KTV */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <User className="w-3.5 h-3.5" />
                  KTV
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {adjustment.ktv_name || 'N/A'}
                </p>
              </div>

              {/* Month */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5" />
                  Tháng áp dụng
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {adjustment.month_year.substring(0, 7)}
                </p>
              </div>

              {/* Type */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Loại
                </div>
                <div className="flex items-center gap-1.5">
                  {adjustment.adjustment_type === 'bonus' ? (
                    <>
                      <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        Thưởng
                      </span>
                    </>
                  ) : (
                    <>
                      <Minus className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-bold text-red-700 dark:text-red-300">
                        Phạt / Trừ lương
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Danh mục
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {adjustment.category}
                </span>
              </div>
            </div>

            {/* Amount */}
            <div className={`p-4 rounded-lg border-2 ${
              adjustment.adjustment_type === 'bonus'
                ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700'
                : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
            }`}>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                Số tiền
              </div>
              <p className={`text-2xl font-black ${
                adjustment.adjustment_type === 'bonus'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {adjustment.adjustment_type === 'bonus' ? '+' : '-'}
                {adjustment.amount.toLocaleString('vi-VN')} đ
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                Lý do
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                {adjustment.reason}
              </p>
            </div>

            {/* Notes (if any) */}
            {adjustment.notes && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ghi chú
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  {adjustment.notes}
                </p>
              </div>
            )}

            {/* Audit Trail */}
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Lịch sử
              </h3>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Người tạo:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {adjustment.created_by_name || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Ngày tạo:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(adjustment.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>

                {adjustment.approved_by_id && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Người duyệt/từ chối:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {adjustment.approved_by_name || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Ngày duyệt/từ chối:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {adjustment.approved_at
                          ? new Date(adjustment.approved_at).toLocaleString('vi-VN')
                          : 'N/A'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-semibold"
            >
              Đóng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
