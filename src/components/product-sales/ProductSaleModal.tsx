'use client';

/**
 * Product Sale Modal Component
 * 
 * Modal form to record product sales with commission calculation.
 * Supports flexible commission input (fixed amount or percentage).
 * 
 * @module components/product-sales/ProductSaleModal
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, ShoppingCart, Plus, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createProductSale } from '@/modules/product-sales/actions/product-sales-actions';
import { BeautySpaSelect } from '@/components/ui/BeautySpaSelect';
import { CommissionOverrideInput } from '@/components/bookings/CommissionOverrideInput';
import { calculateProductSalesCommission } from '@/lib/business-rules/commission';
import type { CommissionType } from '@/lib/business-rules/commission';

interface KTV {
  id: string;
  full_name: string;
}

interface Customer {
  id: string;
  full_name: string;
}

interface CommissionDefaults {
  type: CommissionType;
  value: number;
}

interface ProductSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  tenantId: string;
  ktvList: KTV[];
  customers?: Customer[];
  commissionDefaults?: CommissionDefaults;
}

interface FormData {
  ktvId: string;
  customerId: string;
  productName: string;
  productCategory: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  totalSalesAmount: number;
  overrideType: CommissionType | null;
  overrideValue: number | null;
  paymentMethod: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo' | 'card';
  saleDate: string;
  notes: string;
}

export function ProductSaleModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  ktvList,
  customers = [],
  commissionDefaults = { type: 'percentage', value: 10 },
}: ProductSaleModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    ktvId: '',
    customerId: '',
    productName: '',
    productCategory: '',
    productSku: '',
    quantity: 1,
    unitPrice: 0,
    totalSalesAmount: 0,
    overrideType: null,
    overrideValue: null,
    paymentMethod: 'cash',
    saleDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Calculate total sales amount when quantity or unit price changes
  useEffect(() => {
    const total = formData.quantity * formData.unitPrice;
    setFormData((prev) => ({ ...prev, totalSalesAmount: total }));
  }, [formData.quantity, formData.unitPrice]);

  // Calculate commission preview
  const calculatedCommission = calculateProductSalesCommission({
    totalSalesAmount: formData.totalSalesAmount,
    overrideType: formData.overrideType,
    overrideValue: formData.overrideValue,
    defaultType: commissionDefaults.type,
    defaultValue: commissionDefaults.value,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createProductSale({
        tenantId,
        ktvId: formData.ktvId,
        customerId: formData.customerId || null,
        productName: formData.productName,
        productCategory: formData.productCategory || null,
        productSku: formData.productSku || null,
        quantity: formData.quantity,
        unitPrice: formData.unitPrice,
        totalSalesAmount: formData.totalSalesAmount,
        overrideCommissionType: formData.overrideType,
        overrideCommissionValue: formData.overrideValue,
        paymentMethod: formData.paymentMethod,
        saleDate: formData.saleDate,
        notes: formData.notes || null,
      });

      if (result.success) {
        router.refresh();
        onSuccess?.();
        onClose();
        // Reset form
        setFormData({
          ktvId: '',
          customerId: '',
          productName: '',
          productCategory: '',
          productSku: '',
          quantity: 1,
          unitPrice: 0,
          totalSalesAmount: 0,
          overrideType: null,
          overrideValue: null,
          paymentMethod: 'cash',
          saleDate: new Date().toISOString().split('T')[0],
          notes: '',
        });
      } else {
        setError(result.error || 'Không thể lưu bán hàng');
      }
    } catch (err) {
      console.error('Error creating product sale:', err);
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
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-[24px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Ghi nhận bán hàng</h2>
                <p className="text-xs text-slate-500">Thêm giao dịch bán sản phẩm</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-full p-2 hover:bg-slate-100 disabled:opacity-50"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4"
              >
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Lỗi</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </motion.div>
            )}

            {/* Section 1: KTV & Customer */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600">
                Người bán & Khách hàng
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {/* KTV Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    KTV phụ trách <span className="text-red-500">*</span>
                  </label>
                  <BeautySpaSelect
                    options={[
                      { value: '', label: '-- Chọn KTV --' },
                      ...ktvList.map((ktv) => ({
                        value: ktv.id,
                        label: ktv.full_name,
                      })),
                    ]}
                    value={formData.ktvId}
                    onChange={(ktvId) => setFormData((prev) => ({ ...prev, ktvId }))}
                    placeholder="-- Chọn KTV --"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Customer Selection (Optional) */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    Khách hàng <span className="text-slate-400 font-normal">(tùy chọn)</span>
                  </label>
                  <BeautySpaSelect
                    options={[
                      { value: '', label: '-- Chọn khách hàng --' },
                      ...customers.map((customer) => ({
                        value: customer.id,
                        label: customer.full_name,
                      })),
                    ]}
                    value={formData.customerId}
                    onChange={(customerId) =>
                      setFormData((prev) => ({ ...prev, customerId }))
                    }
                    placeholder="-- Chọn khách hàng --"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Product Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600">
                Thông tin sản phẩm
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Product Name */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700">
                    Tên sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.productName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, productName: e.target.value }))
                    }
                    placeholder="Nhập tên sản phẩm"
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                  />
                </div>

                {/* Product Category */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    Danh mục <span className="text-slate-400 font-normal">(tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.productCategory}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, productCategory: e.target.value }))
                    }
                    placeholder="VD: Mỹ phẩm, Sữa tắm..."
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                  />
                </div>

                {/* Product SKU */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    Mã SKU <span className="text-slate-400 font-normal">(tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.productSku}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, productSku: e.target.value }))
                    }
                    placeholder="VD: PRD-001"
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    Số lượng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        quantity: parseFloat(e.target.value) || 1,
                      }))
                    }
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                  />
                </div>

                {/* Unit Price */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    Đơn giá <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={
                      formData.unitPrice === 0
                        ? ''
                        : formData.unitPrice.toLocaleString('vi-VN')
                    }
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setFormData((prev) => ({
                        ...prev,
                        unitPrice: parseInt(value) || 0,
                      }));
                    }}
                    placeholder="0"
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                  />
                </div>

                {/* Total Sales Amount (readonly) */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Tổng tiền</label>
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                    <span className="text-lg font-black text-emerald-700">
                      {formData.totalSalesAmount.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Commission Override */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600">
                Cài đặt hoa hồng
              </h3>
              <CommissionOverrideInput
                enabled={formData.overrideType !== null}
                overrideType={formData.overrideType || 'fixed'}
                overrideValue={formData.overrideValue || 0}
                onToggle={(enabled) => {
                  if (enabled) {
                    setFormData((prev) => ({
                      ...prev,
                      overrideType: 'percentage',
                      overrideValue: 10,
                    }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      overrideType: null,
                      overrideValue: null,
                    }));
                  }
                }}
                onTypeChange={(type) =>
                  setFormData((prev) => ({ ...prev, overrideType: type }))
                }
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, overrideValue: value }))
                }
                disabled={isSubmitting}
              />

              {/* Commission Preview */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-900">
                    Hoa hồng dự kiến:
                  </span>
                  <span className="text-lg font-black text-emerald-700">
                    {calculatedCommission.toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-emerald-700">
                  Hoa hồng này sẽ được tính vào lương tháng của KTV.
                  {formData.overrideType
                    ? ' Đang sử dụng cài đặt tùy chỉnh.'
                    : ` Đang sử dụng mặc định hệ thống (${
                        commissionDefaults.type === 'fixed'
                          ? `${commissionDefaults.value.toLocaleString('vi-VN')}đ`
                          : `${commissionDefaults.value}%`
                      }).`}
                </p>
              </div>
            </div>

            {/* Section 4: Payment & Date */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600">
                Thanh toán
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Payment Method */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    Phương thức <span className="text-red-500">*</span>
                  </label>
                  <BeautySpaSelect
                    options={[
                      { value: 'cash', label: 'Tiền mặt' },
                      { value: 'bank_transfer', label: 'Chuyển khoản' },
                      { value: 'zalo_pay', label: 'ZaloPay' },
                      { value: 'momo', label: 'MoMo' },
                      { value: 'card', label: 'Thẻ' },
                    ]}
                    value={formData.paymentMethod}
                    onChange={(method) =>
                      setFormData((prev) => ({
                        ...prev,
                        paymentMethod: method as FormData['paymentMethod'],
                      }))
                    }
                    disabled={isSubmitting}
                  />
                </div>

                {/* Sale Date */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    Ngày bán <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.saleDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, saleDate: e.target.value }))
                    }
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Notes */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">
                Ghi chú <span className="text-slate-400 font-normal">(tùy chọn)</span>
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Thêm ghi chú về giao dịch..."
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.ktvId || !formData.productName}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Lưu bán hàng
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
