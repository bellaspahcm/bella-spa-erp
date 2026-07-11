'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, DollarSign, Plus, Minus, AlertCircle, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createAdjustment } from '@/modules/salary/actions/create-adjustment';
import { BeautySpaSelect } from '@/components/ui/BeautySpaSelect';

interface AddAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  ktvList: Array<{ id: string; full_name: string; email?: string | null }>;
}

interface FormData {
  ktvId: string;
  month: string;
  type: 'bonus' | 'deduction';
  category: string;
  amount: number;
  reason: string;
  notes: string;
}

const BONUS_CATEGORIES = [
  'Thưởng hiệu suất',
  'Thưởng lễ tết',
  'Thưởng hoàn thành mục tiêu',
  'Khác',
];

const DEDUCTION_CATEGORIES = [
  'Phạt vi phạm nội quy',
  'Phạt làm hỏng trang thiết bị',
  'Trừ tạm ứng',
  'Khác',
];

export function AddAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  ktvList,
}: AddAdjustmentModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    ktvId: '',
    month: new Date().toISOString().substring(0, 7), // YYYY-MM
    type: 'bonus',
    category: '',
    amount: 0,
    reason: '',
    notes: '',
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        ktvId: '',
        month: new Date().toISOString().substring(0, 7),
        type: 'bonus',
        category: '',
        amount: 0,
        reason: '',
        notes: '',
      });
      setError(null);
    }
  }, [isOpen]);

  // Get categories based on type
  const categories = formData.type === 'bonus' ? BONUS_CATEGORIES : DEDUCTION_CATEGORIES;

  // Reset category when type changes
  useEffect(() => {
    setFormData((prev) => ({ ...prev, category: '' }));
  }, [formData.type]);

  // Validation
  const isValid =
    formData.ktvId &&
    formData.month &&
    formData.category &&
    formData.amount > 0 &&
    formData.reason.length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createAdjustment({
        tenantId,
        ktvId: formData.ktvId,
        month: formData.month,
        adjustmentType: formData.type,
        category: formData.category,
        amount: formData.amount,
        reason: formData.reason,
        notes: formData.notes || null,
      });

      if (result.success) {
        router.refresh();
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Không thể tạo điều chỉnh');
      }
    } catch (err) {
      console.error('[AddAdjustmentModal] Error creating adjustment:', err);
      setError('Lỗi hệ thống');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white dark:bg-gray-900 shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4 rounded-t-[24px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Thêm điều chỉnh lương
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Thưởng hoặc phạt cho KTV
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              aria-label="Đóng"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4"
              >
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-300">Lỗi</p>
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              </motion.div>
            )}

            {/* Section 1: KTV & Month */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Thông tin cơ bản
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {/* KTV Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    KTV <span className="text-red-500">*</span>
                  </label>
                  <BeautySpaSelect
                    options={[
                      { value: '', label: '-- Chọn KTV --' },
                      ...ktvList.map((ktv) => ({
                        value: ktv.id,
                        label: ktv.email ? `${ktv.full_name} (${ktv.email})` : ktv.full_name,
                      })),
                    ]}
                    value={formData.ktvId}
                    onChange={(ktvId) => setFormData((prev) => ({ ...prev, ktvId }))}
                    placeholder="-- Chọn KTV --"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Month */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    Tháng áp dụng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    required
                    value={formData.month}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, month: e.target.value }))
                    }
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Type & Category */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Loại điều chỉnh
              </h3>
              
              {/* Type Radio Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, type: 'bonus' }))}
                  disabled={isSubmitting}
                  className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    formData.type === 'bonus'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300'
                  } disabled:opacity-50`}
                >
                  <Plus className={`w-5 h-5 ${
                    formData.type === 'bonus'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-400'
                  }`} />
                  <span className={`font-bold ${
                    formData.type === 'bonus'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    Thưởng
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, type: 'deduction' }))}
                  disabled={isSubmitting}
                  className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    formData.type === 'deduction'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-red-300'
                  } disabled:opacity-50`}
                >
                  <Minus className={`w-5 h-5 ${
                    formData.type === 'deduction'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-400'
                  }`} />
                  <span className={`font-bold ${
                    formData.type === 'deduction'
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    Phạt / Trừ lương
                  </span>
                </button>
              </div>

              {/* Category Dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Danh mục <span className="text-red-500">*</span>
                </label>
                <BeautySpaSelect
                  options={[
                    { value: '', label: '-- Chọn danh mục --' },
                    ...categories.map((cat) => ({ value: cat, label: cat })),
                  ]}
                  value={formData.category}
                  onChange={(category) => setFormData((prev) => ({ ...prev, category }))}
                  placeholder="-- Chọn danh mục --"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.type === 'bonus'
                    ? 'Loại thưởng: Hiệu suất, lễ tết, hoàn thành dự án...'
                    : 'Loại phạt: Vi phạm nội quy, làm hỏng thiết bị, trừ tạm ứng...'}
                </p>
              </div>
            </div>

            {/* Section 3: Amount */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Số tiền
              </h3>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Số tiền điều chỉnh <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.amount === 0 ? '' : formData.amount.toLocaleString('vi-VN')}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setFormData((prev) => ({
                        ...prev,
                        amount: parseInt(value) || 0,
                      }));
                    }}
                    placeholder="0"
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 pr-12 text-lg font-bold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">
                    đ
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Nhập số tiền tối thiểu 1,000đ
                </p>
              </div>
            </div>

            {/* Section 4: Reason & Notes */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Lý do & Ghi chú
              </h3>
              
              {/* Reason */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Lý do điều chỉnh <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={3}
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Mô tả ngắn gọn lý do điều chỉnh (tối thiểu 10 ký tự)..."
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.reason.length}/10 ký tự tối thiểu
                </p>
              </div>

              {/* Notes (Optional) */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Ghi chú thêm <span className="text-gray-400 font-normal">(tùy chọn)</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Thông tin chi tiết khác (tùy chọn)..."
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 resize-none"
                />
              </div>
            </div>

            {/* Estimated Impact Preview */}
            {formData.amount > 0 && (
              <div className={`rounded-lg border-2 p-4 ${
                formData.type === 'bonus'
                  ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700'
                  : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
              }`}>
                <div className="flex items-start gap-3">
                  <TrendingUp className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    formData.type === 'bonus'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`} />
                  <div className="flex-1">
                    <p className={`text-sm font-bold mb-1 ${
                      formData.type === 'bonus'
                        ? 'text-emerald-900 dark:text-emerald-100'
                        : 'text-red-900 dark:text-red-100'
                    }`}>
                      Ảnh hưởng đến lương tháng {formData.month}
                    </p>
                    <p className={`text-xs leading-relaxed ${
                      formData.type === 'bonus'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {formData.type === 'bonus'
                        ? `Lương KTV sẽ TĂNG ${formData.amount.toLocaleString('vi-VN')}đ sau khi điều chỉnh này được duyệt.`
                        : `Lương KTV sẽ GIẢM ${formData.amount.toLocaleString('vi-VN')}đ sau khi điều chỉnh này được duyệt.`}
                    </p>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-2">
                      <strong>Lưu ý:</strong> Điều chỉnh sẽ ở trạng thái <span className="font-bold">Chờ duyệt</span> và chỉ ảnh hưởng lương khi được Admin/HR phê duyệt.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isValid}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Tạo điều chỉnh
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
