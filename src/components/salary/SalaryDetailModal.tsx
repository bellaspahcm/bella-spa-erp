'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, DollarSign, Award, TrendingUp, Users, Calendar, Plus, Minus, Star, Briefcase } from 'lucide-react';
import { SalaryComponentCard } from './SalaryComponentCard';
import { AdjustmentsBreakdown } from './AdjustmentsBreakdown';
import { createClient } from '@/lib/supabase-client';
import type { KtvSalaryRecord } from '@/types/domain';

interface SalaryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  salary: KtvSalaryRecord;
  tenantId: string;
  currentMonth: string; // YYYY-MM format
}

interface ServiceItem {
  service_name: string;
  quantity: number;
  calculated_commission: number;
}

interface ProductSale {
  product_name: string;
  quantity: number;
  calculated_commission: number;
}

export function SalaryDetailModal({
  isOpen,
  onClose,
  salary,
  tenantId,
  currentMonth,
}: SalaryDetailModalProps) {
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [productSales, setProductSales] = useState<ProductSale[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Fetch service items
  useEffect(() => {
    if (!isOpen) return;

    async function fetchServiceItems() {
      setIsLoadingServices(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('booking_service_items')
          .select('service_name, quantity, calculated_commission')
          .eq('ktv_id', salary.id)
          .eq('tenant_id', tenantId)
          .gte('completed_date', `${currentMonth}-01`)
          .lt('completed_date', `${currentMonth}-32`)
          .eq('status', 'completed');

        if (!error && data) {
          setServiceItems(data);
        }
      } catch (err: unknown) {
        console.error('[SalaryDetailModal] Error fetching service items:', err);
      } finally {
        setIsLoadingServices(false);
      }
    }

    fetchServiceItems();
  }, [isOpen, salary.id, tenantId, currentMonth]);

  // Fetch product sales
  useEffect(() => {
    if (!isOpen) return;

    async function fetchProductSales() {
      setIsLoadingProducts(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('product_sales')
          .select('product_name, quantity, calculated_commission')
          .eq('ktv_id', salary.id)
          .eq('tenant_id', tenantId)
          .gte('sale_date', `${currentMonth}-01`)
          .lt('sale_date', `${currentMonth}-32`)
          .in('status', ['completed', 'pending']);

        if (!error && data) {
          setProductSales(data);
        }
      } catch (err: unknown) {
        console.error('[SalaryDetailModal] Error fetching product sales:', err);
      } finally {
        setIsLoadingProducts(false);
      }
    }

    fetchProductSales();
  }, [isOpen, salary.id, tenantId, currentMonth]);

  if (!isOpen) return null;

  // TODO: Position and Seniority bonus features are not yet implemented in backend
  // These fields will be added to KtvSalaryRecord type when implemented:
  // - positionTier: 'junior' | 'senior' | 'lead'
  // - yearsOfService: number
  // - serviceCommission: number (from booking_service_items)
  // - productSalesCommission: number (from product_sales)
  // - positionBonus: number
  // - seniorityBonus: number

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="flex flex-col max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white dark:bg-gray-900 shadow-2xl sm:rounded-[32px]"
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 sm:p-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-gray-100">
              Chi Tiết Lương
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {salary.name} • Tháng {currentMonth}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Total Salary Card */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-6 border-2 border-primary/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Tổng Lương Thực Nhận
                </p>
                <p className="text-4xl font-black text-primary">
                  {salary.totalSalary.toLocaleString('vi-VN')} đ
                </p>
              </div>
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
            </div>
          </div>

          {/* Base Salary */}
          <SalaryComponentCard
            title="Lương Cứng"
            amount={salary.baseSalary}
            icon={<Briefcase className="w-5 h-5 text-gray-600" />}
            variant="neutral"
            tooltip="Lương cơ bản theo hợp đồng lao động"
            badge={salary.actualDays ? `${salary.actualDays}/26 ngày` : undefined}
          >
            {salary.actualDays && salary.actualDays < 26 && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                <p className="font-medium mb-1">Pro-rata:</p>
                <p>Làm {salary.actualDays} ngày / 26 ngày chuẩn</p>
                <p className="text-xs text-gray-500 mt-1">
                  Lương đã được tính theo tỷ lệ ngày công thực tế
                </p>
              </div>
            )}
          </SalaryComponentCard>

          {/* Session Bonus (Legacy Baby Care) */}
          {salary.sessionBonus > 0 && (
            <SalaryComponentCard
              title="Hoa Hồng Ca (Legacy)"
              amount={salary.sessionBonus}
              icon={<Calendar className="w-5 h-5 text-emerald-600" />}
              variant="income"
              tooltip="Hoa hồng tính theo số ca làm việc (dành cho Baby Care module)"
              badge={`${salary.sessions} ca`}
            />
          )}

          {/* Service Commission */}
          {/* TODO: Service commission not yet tracked in salary_records table */}
          {/* Will display service-level commission breakdown when backend is ready */}
          <SalaryComponentCard
            title="Hoa Hồng Dịch Vụ"
            amount={0}
            icon={<Award className="w-5 h-5 text-gray-400" />}
            variant="neutral"
            tooltip="Hoa hồng từ các dịch vụ spa (chưa có dữ liệu)"
            badge="Chưa có dữ liệu"
          >
            <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
              Tính năng đang được phát triển
            </div>
          </SalaryComponentCard>

          {/* Product Sales Commission */}
          {(salary.productSalesCommission || 0) > 0 && (
            <SalaryComponentCard
              title="Hoa Hồng Bán Hàng"
              amount={salary.productSalesCommission || 0}
              icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
              variant="income"
              tooltip="Hoa hồng từ bán sản phẩm"
            >
              {productSales.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Chi Tiết Bán Hàng
                  </p>
                  {isLoadingProducts ? (
                    <p className="text-sm text-gray-500">Đang tải...</p>
                  ) : (
                    <div className="space-y-1.5">
                      {productSales.map((product, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <span className="flex-1 truncate">
                            {product.product_name} × {product.quantity}
                          </span>
                          <span className="font-medium text-emerald-600">
                            {product.calculated_commission.toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </SalaryComponentCard>
          )}

          {/* Position Bonus - TODO: Not yet implemented */}
          {/* Will show position-based bonus (Junior/Senior/Lead) when backend is ready */}

          {/* Seniority Bonus - TODO: Not yet implemented */}
          {/* Will show years-of-service bonus when backend is ready */}

          {/* Rating Bonus */}
          {(salary.ratingBonus || 0) > 0 && (
            <SalaryComponentCard
              title="Thưởng Chất Lượng"
              amount={salary.ratingBonus || 0}
              icon={<Star className="w-5 h-5 text-amber-500" />}
              variant="income"
              tooltip="Thưởng dựa trên đánh giá sao từ khách hàng"
              badge={salary.avgRating ? `${salary.avgRating.toFixed(1)} ⭐` : undefined}
            >
              {salary.avgRating && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  <p>Đánh giá trung bình: <span className="font-bold text-amber-600">{salary.avgRating.toFixed(1)}/5.0 ⭐</span></p>
                  <p className="text-xs text-gray-500 mt-1">
                    Thưởng tính dựa trên số sao đạt được
                  </p>
                </div>
              )}
            </SalaryComponentCard>
          )}

          {/* KPI Bonus */}
          {salary.kpiBonus > 0 && (
            <SalaryComponentCard
              title="Thưởng KPI"
              amount={salary.kpiBonus}
              icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
              variant="income"
              tooltip="Thưởng hiệu suất theo chỉ tiêu KPI"
            />
          )}

          {/* Manual Adjustments */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <AdjustmentsBreakdown
              ktvId={salary.id}
              month={currentMonth}
              tenantId={tenantId}
            />
          </div>

          {/* Deductions */}
          {salary.deductions > 0 && (
            <SalaryComponentCard
              title="Phạt"
              amount={salary.deductions}
              icon={<Minus className="w-5 h-5 text-red-600" />}
              variant="deduction"
              tooltip="Các khoản phạt vi phạm nội quy, làm hỏng thiết bị, etc."
            />
          )}

          {/* Advances */}
          {salary.advances > 0 && (
            <SalaryComponentCard
              title="Tạm Ứng"
              amount={salary.advances}
              icon={<Minus className="w-5 h-5 text-red-600" />}
              variant="deduction"
              tooltip="Các khoản tạm ứng lương đã nhận trước"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 sm:p-6">
          <button
            onClick={onClose}
            className="w-full py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover transition-all"
          >
            Đóng
          </button>
        </div>
      </motion.div>
    </div>
  );
}
