'use client';

/**
 * @fileoverview Commission Settings Tab - Admin configuration for commission defaults
 * @module app/dashboard/settings/components/CommissionSettingsTab
 * 
 * MVP implementation: Basic commission config UI for Beauty Spa module
 * Allows admin to configure:
 * - Service commission defaults (fixed amount OR percentage)
 * - Product sales commission defaults (fixed amount OR percentage)
 * - Position tier multipliers (junior/senior/lead)
 * - Seniority bonus rates (0-1y, 1-3y, 3-5y, 5+y)
 */

import { useState, useEffect } from 'react';
import { Loader2, Save, DollarSign, Percent, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { saveTenantSettings, getTenantSettings } from '@/services/tenant-actions';
import { cn } from '@/lib/utils';
import type { CommissionConfig } from '@/lib/business-rules/commission';
import { DEFAULT_COMMISSION_CONFIG } from '@/lib/business-rules/commission';

interface CommissionSettingsTabProps {
  className?: string;
}

type CommissionType = 'fixed' | 'percentage';

export default function CommissionSettingsTab({ className }: CommissionSettingsTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Service commission defaults
  const [serviceType, setServiceType] = useState<CommissionType>('fixed');
  const [serviceValue, setServiceValue] = useState<string>('150000');

  // Product sales commission defaults
  const [productType, setProductType] = useState<CommissionType>('percentage');
  const [productValue, setProductValue] = useState<string>('10');

  // Position multipliers
  const [juniorMultiplier, setJuniorMultiplier] = useState<string>('1.0');
  const [seniorMultiplier, setSeniorMultiplier] = useState<string>('1.2');
  const [leadMultiplier, setLeadMultiplier] = useState<string>('1.5');

  // Seniority bonus rates
  const [seniority0to1, setSeniority0to1] = useState<string>('0');
  const [seniority1to3, setSeniority1to3] = useState<string>('5');
  const [seniority3to5, setSeniority3to5] = useState<string>('10');
  const [seniority5plus, setSeniority5plus] = useState<string>('15');

  useEffect(() => {
    loadCommissionConfig();
  }, []);

  const loadCommissionConfig = async () => {
    setIsLoading(true);
    try {
      const settings = await getTenantSettings();
      const config = (settings as any)?.commission_config as CommissionConfig | null;

      if (config) {
        // Service commission
        if (config.service_commission_default) {
          setServiceType(config.service_commission_default.type);
          setServiceValue(String(config.service_commission_default.value));
        }

        // Product sales commission
        if (config.product_sales_commission_default) {
          setProductType(config.product_sales_commission_default.type);
          setProductValue(String(config.product_sales_commission_default.value));
        }

        // Position multipliers
        if (config.position_multipliers) {
          setJuniorMultiplier(String(config.position_multipliers.junior));
          setSeniorMultiplier(String(config.position_multipliers.senior));
          setLeadMultiplier(String(config.position_multipliers.lead));
        }

        // Seniority bonus rates
        if (config.seniority_bonus_rates) {
          setSeniority0to1(String(config.seniority_bonus_rates['0_to_1_year'] * 100));
          setSeniority1to3(String(config.seniority_bonus_rates['1_to_3_years'] * 100));
          setSeniority3to5(String(config.seniority_bonus_rates['3_to_5_years'] * 100));
          setSeniority5plus(String(config.seniority_bonus_rates['5_plus_years'] * 100));
        }
      }
    } catch (error) {
      console.error('Error loading commission config:', error);
      toast.error('Không thể tải cấu hình hoa hồng');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const commissionConfig: CommissionConfig = {
        service_commission_default: {
          type: serviceType,
          value: Number(serviceValue),
        },
        product_sales_commission_default: {
          type: productType,
          value: Number(productValue),
        },
        position_multipliers: {
          junior: Number(juniorMultiplier),
          senior: Number(seniorMultiplier),
          lead: Number(leadMultiplier),
        },
        seniority_bonus_rates: {
          '0_to_1_year': Number(seniority0to1) / 100,
          '1_to_3_years': Number(seniority1to3) / 100,
          '3_to_5_years': Number(seniority3to5) / 100,
          '5_plus_years': Number(seniority5plus) / 100,
        },
      };

      await saveTenantSettings({ commission_config: commissionConfig } as any);
      toast.success('Đã lưu cấu hình hoa hồng');
    } catch (error) {
      console.error('Error saving commission config:', error);
      toast.error('Lỗi khi lưu cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cấu hình hoa hồng</h2>
          <p className="text-sm text-slate-500 mt-1">
            Thiết lập mức hoa hồng mặc định cho Beauty Spa
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Lưu cấu hình
            </>
          )}
        </button>
      </div>

      {/* Service Commission Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">Hoa hồng dịch vụ</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Loại hoa hồng
            </label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as CommissionType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fixed">Số tiền cố định (VND)</option>
              <option value="percentage">Phần trăm (%)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Giá trị
            </label>
            <div className="relative">
              <input
                type="number"
                value={serviceValue}
                onChange={(e) => setServiceValue(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={serviceType === 'fixed' ? '150000' : '10'}
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">
                {serviceType === 'fixed' ? 'đ' : '%'}
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Ví dụ: {serviceType === 'fixed' 
            ? `${Number(serviceValue).toLocaleString('vi-VN')}đ mỗi dịch vụ` 
            : `${serviceValue}% trên giá trị dịch vụ`}
        </p>
      </div>

      {/* Product Sales Commission Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-slate-900">Hoa hồng bán sản phẩm</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Loại hoa hồng
            </label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as CommissionType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="fixed">Số tiền cố định (VND)</option>
              <option value="percentage">Phần trăm (%)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Giá trị
            </label>
            <div className="relative">
              <input
                type="number"
                value={productValue}
                onChange={(e) => setProductValue(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={productType === 'fixed' ? '50000' : '10'}
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">
                {productType === 'fixed' ? 'đ' : '%'}
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Ví dụ: {productType === 'fixed' 
            ? `${Number(productValue).toLocaleString('vi-VN')}đ mỗi sản phẩm` 
            : `${productValue}% trên doanh số bán hàng`}
        </p>
      </div>

      {/* Position Multipliers Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">Hệ số vị trí</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Junior (Nhân viên mới)
            </label>
            <input
              type="number"
              step="0.1"
              value={juniorMultiplier}
              onChange={(e) => setJuniorMultiplier(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Senior (Chính thức)
            </label>
            <input
              type="number"
              step="0.1"
              value={seniorMultiplier}
              onChange={(e) => setSeniorMultiplier(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Lead (Trưởng ca)
            </label>
            <input
              type="number"
              step="0.1"
              value={leadMultiplier}
              onChange={(e) => setLeadMultiplier(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Hệ số nhân hoa hồng theo vị trí. Junior: {juniorMultiplier}x, Senior: {seniorMultiplier}x (+{Math.round((Number(seniorMultiplier) - 1) * 100)}%), Lead: {leadMultiplier}x (+{Math.round((Number(leadMultiplier) - 1) * 100)}%)
        </p>
      </div>

      {/* Seniority Bonus Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-orange-600" />
          <h3 className="font-semibold text-slate-900">Thưởng thâm niên (%)</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              0-1 năm
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={seniority0to1}
                onChange={(e) => setSeniority0to1(e.target.value)}
                className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              1-3 năm
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={seniority1to3}
                onChange={(e) => setSeniority1to3(e.target.value)}
                className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              3-5 năm
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={seniority3to5}
                onChange={(e) => setSeniority3to5(e.target.value)}
                className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              5+ năm
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={seniority5plus}
                onChange={(e) => setSeniority5plus(e.target.value)}
                className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Thưởng thâm niên tính trên lương cơ bản. Áp dụng tự động theo số năm làm việc của KTV.
        </p>
      </div>
    </div>
  );
}
