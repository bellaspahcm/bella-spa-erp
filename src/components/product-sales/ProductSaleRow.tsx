'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  User,
  Calendar,
  DollarSign,
  Package,
  CreditCard,
  FileText,
  ChevronDown,
  Pencil,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Inline types to avoid build errors before migration
type ProductSaleStatus = 'pending' | 'completed' | 'cancelled' | 'refunded';
type PaymentMethod = 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo' | 'card';

interface ProductSale {
  id: string;
  ktv_id: string;
  customer_id: string | null;
  product_name: string;
  product_category: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  commission_amount: number;
  override_commission_enabled: boolean;
  override_commission_type: 'fixed' | 'percentage' | null;
  override_commission_value: number | null;
  payment_method: PaymentMethod;
  sale_date: string;
  status: ProductSaleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  ktv_name?: string;
  customer_name?: string;
}

interface ProductSaleRowProps {
  sale: ProductSale;
  onEdit?: (sale: ProductSale) => void;
  onDelete?: (saleId: string) => void;
  disabled?: boolean;
}

const statusConfig: Record<
  ProductSaleStatus,
  { label: string; colorClass: string }
> = {
  completed: { label: 'Hoàn thành', colorClass: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Chờ xử lý', colorClass: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Đã hủy', colorClass: 'bg-red-100 text-red-700' },
  refunded: { label: 'Đã hoàn tiền', colorClass: 'bg-slate-100 text-slate-700' },
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  zalo_pay: 'ZaloPay',
  momo: 'MoMo',
  card: 'Thẻ',
};

export function ProductSaleRow({
  sale,
  onEdit,
  onDelete,
  disabled = false,
}: ProductSaleRowProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const statusInfo = statusConfig[sale.status];
  const paymentLabel = paymentMethodLabels[sale.payment_method];

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onEdit) {
      onEdit(sale);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onDelete) {
      if (
        window.confirm(
          `Bạn có chắc muốn xóa bản ghi bán sản phẩm "${sale.product_name}"?`
        )
      ) {
        onDelete(sale.id);
      }
    }
  };

  return (
    <div
      className={cn(
        'border rounded-lg bg-white transition-all duration-200',
        'hover:shadow-md',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Main Row - Desktop Layout */}
      <div
        className="hidden md:grid md:grid-cols-7 gap-4 p-4 items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Chi tiết bán sản phẩm ${sale.product_name}`}
      >
        {/* Product Info */}
        <div className="col-span-2 flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{sale.product_name}</p>
            {sale.product_category && (
              <p className="text-sm text-gray-500 truncate">{sale.product_category}</p>
            )}
            {sale.product_sku && (
              <p className="text-xs text-gray-400 font-mono">SKU: {sale.product_sku}</p>
            )}
          </div>
        </div>

        {/* Quantity & Amount */}
        <div className="text-center">
          <p className="text-sm text-gray-500">Số lượng</p>
          <p className="font-semibold text-gray-900">{sale.quantity}</p>
          <p className="text-xs text-gray-400">
            {(sale.unit_price || 0).toLocaleString('vi-VN')} đ/sp
          </p>
        </div>

        {/* Total Amount */}
        <div className="text-right">
          <p className="text-sm text-gray-500">Tổng tiền</p>
          <p className="font-semibold text-gray-900">
            {(sale.total_amount || 0).toLocaleString('vi-VN')} đ
          </p>
        </div>

        {/* Commission */}
        <div className="text-right">
          <p className="text-sm text-gray-500">Hoa hồng</p>
          <p className="font-semibold text-emerald-600">
            {(sale.commission_amount || 0).toLocaleString('vi-VN')} đ
          </p>
          {sale.override_commission_enabled && (
            <p className="text-xs text-amber-600">Tùy chỉnh</p>
          )}
        </div>

        {/* Status */}
        <div className="flex justify-center">
          <span
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              statusInfo.colorClass
            )}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleEdit}
            className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            aria-label="Chỉnh sửa"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Xóa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </div>
      </div>

      {/* Main Row - Mobile Layout */}
      <div
        className="md:hidden p-4 space-y-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Chi tiết bán sản phẩm ${sale.product_name}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{sale.product_name}</p>
              {sale.product_category && (
                <p className="text-sm text-gray-500 truncate">{sale.product_category}</p>
              )}
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Số lượng</p>
            <p className="font-semibold text-gray-900">{sale.quantity}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Tổng tiền</p>
            <p className="font-semibold text-gray-900">
              {(sale.total_amount || 0).toLocaleString('vi-VN')} đ
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Hoa hồng</p>
            <p className="font-semibold text-emerald-600">
              {(sale.commission_amount || 0).toLocaleString('vi-VN')} đ
            </p>
          </div>
          <div className="text-right">
            <span
              className={cn(
                'inline-block px-2 py-1 rounded-full text-xs font-medium',
                statusInfo.colorClass
              )}
            >
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            onClick={handleEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
            <span>Sửa</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xóa</span>
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t"
          >
            <div className="p-4 bg-gray-50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* KTV Info */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {sale.ktv_name || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">Kỹ thuật viên</p>
                  </div>
                </div>

                {/* Customer Info */}
                {sale.customer_name && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{sale.customer_name}</p>
                      <p className="text-xs text-gray-500">Khách hàng</p>
                    </div>
                  </div>
                )}

                {/* Sale Date */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(sale.sale_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </p>
                    <p className="text-xs text-gray-500">Ngày bán</p>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{paymentLabel}</p>
                    <p className="text-xs text-gray-500">Phương thức thanh toán</p>
                  </div>
                </div>

                {/* Product Details */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {sale.quantity} x {(sale.unit_price || 0).toLocaleString('vi-VN')} đ
                    </p>
                    <p className="text-xs text-gray-500">Đơn giá x Số lượng</p>
                  </div>
                </div>

                {/* Commission Details */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-600">
                      {(sale.commission_amount || 0).toLocaleString('vi-VN')} đ
                    </p>
                    {sale.override_commission_enabled && sale.override_commission_type && (
                      <p className="text-xs text-amber-600">
                        Tùy chỉnh:{' '}
                        {sale.override_commission_type === 'fixed'
                          ? `${(sale.override_commission_value || 0).toLocaleString('vi-VN')} đ`
                          : `${sale.override_commission_value}%`}
                      </p>
                    )}
                    {!sale.override_commission_enabled && (
                      <p className="text-xs text-gray-500">Hoa hồng mặc định</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {sale.notes && (
                <div className="flex items-start gap-3 pt-3 border-t">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Ghi chú</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{sale.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
