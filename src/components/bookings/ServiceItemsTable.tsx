'use client';

/**
 * Service Items Table Component
 * 
 * Displays booking service items with commission breakdown in booking detail modal.
 * Shows service name, quantity, pricing, commission type, and calculated commission.
 * 
 * Part of Commission System (Task 13)
 */

import { ShoppingBag, AlertCircle, Edit } from 'lucide-react';
import { motion } from 'framer-motion';

export interface ServiceItemData {
  id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  override_commission_type?: 'fixed' | 'percentage' | null;
  override_commission_value?: number | null;
  calculated_commission: number;
  status: 'completed' | 'pending' | 'cancelled';
  completed_date?: string | null;
  ktv_name?: string | null;
}

interface ServiceItemsTableProps {
  items: ServiceItemData[];
  isLoading?: boolean;
  showEditButton?: boolean;
  onEditClick?: () => void;
  className?: string;
}

export function ServiceItemsTable({
  items,
  isLoading = false,
  showEditButton = false,
  onEditClick,
  className = '',
}: ServiceItemsTableProps) {
  // Calculate totals
  const totalRevenue = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalCommission = items.reduce((sum, item) => sum + item.calculated_commission, 0);

  // Format currency
  const formatMoney = (value: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);

  // Format commission type
  const formatCommissionType = (
    type?: 'fixed' | 'percentage' | null,
    value?: number | null
  ): string => {
    if (!type || value === null || value === undefined) {
      return 'Mặc định';
    }
    if (type === 'fixed') {
      return `Cố định: ${formatMoney(value)}`;
    }
    return `${value}%`;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const badges = {
      completed: (
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-600">
          Hoàn thành
        </span>
      ),
      pending: (
        <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-600">
          Chờ xử lý
        </span>
      ),
      cancelled: (
        <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-red-600">
          Đã hủy
        </span>
      ),
    };
    return badges[status as keyof typeof badges] || null;
  };

  if (isLoading) {
    return (
      <div className={`rounded-[24px] border border-emerald-100 bg-emerald-50/50 p-4 sm:rounded-[32px] sm:p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4 text-emerald-400">
          <ShoppingBag className="w-5 h-5 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest">Dịch vụ bổ sung</span>
        </div>
        <div className="py-6 text-center">
          <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic animate-pulse">
            Đang tải dịch vụ...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className={`rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:rounded-[32px] sm:p-6 ${className}`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 text-slate-400">
            <ShoppingBag className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Dịch vụ bổ sung</span>
          </div>
          {showEditButton && onEditClick && (
            <button
              onClick={onEditClick}
              className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100"
            >
              <Edit className="h-3 w-3" />
              <span>Thêm dịch vụ</span>
            </button>
          )}
        </div>
        <div className="py-6 text-center">
          <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic">
            Chưa có dịch vụ bổ sung
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-[24px] border border-emerald-100 bg-emerald-50/50 p-4 sm:rounded-[32px] sm:p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 text-emerald-600">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">
            Dịch vụ bổ sung
            <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] text-white">
              {items.length}
            </span>
          </span>
        </div>
        {showEditButton && onEditClick && (
          <button
            onClick={onEditClick}
            className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-emerald-600 shadow-sm transition-all hover:bg-emerald-50 active:scale-95"
          >
            <Edit className="h-3 w-3" />
            <span>Quản lý</span>
          </button>
        )}
      </div>

      {/* Table for desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-emerald-100">
              <th className="pb-3 text-left font-black uppercase tracking-wider text-emerald-600">
                Dịch vụ
              </th>
              <th className="pb-3 text-center font-black uppercase tracking-wider text-emerald-600">
                SL
              </th>
              <th className="pb-3 text-right font-black uppercase tracking-wider text-emerald-600">
                Đơn giá
              </th>
              <th className="pb-3 text-right font-black uppercase tracking-wider text-emerald-600">
                Tổng
              </th>
              <th className="pb-3 text-center font-black uppercase tracking-wider text-emerald-600">
                Hoa hồng
              </th>
              <th className="pb-3 text-right font-black uppercase tracking-wider text-emerald-600">
                Thực nhận
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-emerald-50/50 last:border-0"
              >
                <td className="py-3">
                  <div>
                    <p className="font-bold text-slate-900">{item.service_name}</p>
                    {item.ktv_name && (
                      <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                        KTV: {item.ktv_name}
                      </p>
                    )}
                  </div>
                </td>
                <td className="py-3 text-center font-bold text-slate-700">
                  {item.quantity}
                </td>
                <td className="py-3 text-right font-bold text-slate-700">
                  {formatMoney(item.unit_price)}
                </td>
                <td className="py-3 text-right font-bold text-slate-900">
                  {formatMoney(item.subtotal)}
                </td>
                <td className="py-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-emerald-600">
                      {formatCommissionType(
                        item.override_commission_type,
                        item.override_commission_value
                      )}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>
                </td>
                <td className="py-3 text-right">
                  <span className="font-black text-emerald-700">
                    {formatMoney(item.calculated_commission)}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card layout for mobile */}
      <div className="sm:hidden space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="break-words font-bold text-slate-900">{item.service_name}</p>
                {item.ktv_name && (
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    KTV: {item.ktv_name}
                  </p>
                )}
              </div>
              {getStatusBadge(item.status)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400">Số lượng</p>
                <p className="font-bold text-slate-700">{item.quantity}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400">Đơn giá</p>
                <p className="font-bold text-slate-700">{formatMoney(item.unit_price)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">Tổng tiền</p>
                <p className="font-bold text-slate-900">{formatMoney(item.subtotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-emerald-600">Hoa hồng</p>
                <p className="font-black text-emerald-700">
                  {formatMoney(item.calculated_commission)}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2">
              <p className="text-center text-[10px] font-bold text-emerald-600">
                {formatCommissionType(
                  item.override_commission_type,
                  item.override_commission_value
                )}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-500">Tổng doanh thu dịch vụ:</span>
          <span className="font-black text-slate-900">{formatMoney(totalRevenue)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-emerald-100 pt-2 text-sm">
          <span className="font-black uppercase tracking-wider text-emerald-600">
            Tổng hoa hồng:
          </span>
          <span className="font-black text-emerald-700">{formatMoney(totalCommission)}</span>
        </div>
      </div>

      {/* Info note */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3">
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
        <p className="text-[10px] font-bold leading-relaxed text-emerald-700">
          Hoa hồng dịch vụ bổ sung sẽ được tính vào lương tháng của KTV phụ trách.
          Trạng thái &quot;Hoàn thành&quot; mới được tính vào báo cáo lương.
        </p>
      </div>
    </div>
  );
}
