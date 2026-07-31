'use client';

import React, { useState } from 'react';
import { Database } from '@/types/database.types';

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

interface UnitDetailModalProps {
  product: ProductRow | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (
    productId: string,
    targetStatus: ProductRow['status'],
    ownerName?: string | null
  ) => Promise<void>;
}

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  available: { label: 'Tự Do', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  booked: { label: 'Giữ Chỗ', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  deposited: { label: 'Đã Cọc', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' },
  contracted: { label: 'Đã Ký HĐMB', badgeClass: 'bg-purple-100 text-purple-800 border-purple-300' },
  paid: { label: 'Đã Thanh Toán', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  handed_over: { label: 'Đã Bàn Giao', badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  cancelled: { label: 'Đã Hủy', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' },
};

export const UnitDetailModal: React.FC<UnitDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onUpdateStatus,
}) => {
  const [ownerInput, setOwnerInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const currentStatus = product.status || 'available';
  const statusInfo = STATUS_LABELS[currentStatus] || {
    label: currentStatus,
    badgeClass: 'bg-slate-100 text-slate-800',
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(val);
  };

  const handleAction = async (targetStatus: ProductRow['status']) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onUpdateStatus(product.id, targetStatus, ownerInput || product.owner_name);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Chi Tiết Sản Phẩm Căn Hộ
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              Căn {product.product_code}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Grid Specs */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-500">Trạng Thái Hiện Tại</span>
            <div className="mt-1">
              <span
                className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${statusInfo.badgeClass}`}
              >
                {statusInfo.label}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-500">Loại Sản Phẩm</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 capitalize">
              {product.product_type || 'Căn hộ'}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-500">Phân Khu / Tầng</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
              Block {product.block || 'A1'} - Tầng {product.floor || '1'}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-500">Diện Tích Thông Thủy</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
              {product.area} m²
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-500">Đơn Giá / m²</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
              {formatCurrency(product.unit_price)}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-500">Tổng Giá Căn</span>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1">
              {formatCurrency(product.area * product.unit_price)}
            </p>
          </div>
        </div>

        {/* Owner Input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tên Khách Hàng / Chủ Hộ Sau Khi Chốt
          </label>
          <input
            type="text"
            placeholder={product.owner_name || 'Nhập tên khách hàng...'}
            value={ownerInput}
            onChange={(e) => setOwnerInput(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
          />
        </div>

        {/* Action Buttons Based on Allowed State Transitions */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-400 block mb-2">
            Thao Tác Chuyển Đổi Trạng Thái (State Machine):
          </span>

          <div className="flex flex-wrap gap-2">
            {currentStatus === 'available' && (
              <>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('booked')}
                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors disabled:opacity-50"
                >
                  🟡 Giữ Chỗ (Book)
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('deposited')}
                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  🔴 Đặt Cọc (Deposit)
                </button>
              </>
            )}

            {currentStatus === 'booked' && (
              <>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('deposited')}
                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  🔴 Chốt Cọc (Deposit)
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('available')}
                  className="px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  🟢 Hủy Giữ Chỗ (Release)
                </button>
              </>
            )}

            {currentStatus === 'deposited' && (
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('contracted')}
                className="w-full px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors disabled:opacity-50"
              >
                🟣 Ký Hợp Đồng Mua Bán (HĐMB)
              </button>
            )}

            {currentStatus === 'contracted' && (
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('paid')}
                className="w-full px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
              >
                🔵 Xác Nhận Đã Thanh Toán Đủ
              </button>
            )}

            {currentStatus === 'paid' && (
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('handed_over')}
                className="w-full px-4 py-2 text-sm font-bold text-slate-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-colors disabled:opacity-50"
              >
                🏆 Bàn Giao Chìa Khóa Căn Hộ
              </button>
            )}

            {currentStatus === 'handed_over' && (
              <p className="text-xs text-center font-medium text-emerald-600 dark:text-emerald-400 w-full py-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200">
                ✅ Căn hộ đã bàn giao thành công cho chủ sở hữu. Quy trình hoàn tất!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
