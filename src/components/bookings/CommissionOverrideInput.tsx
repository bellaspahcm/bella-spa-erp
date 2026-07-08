'use client';

/**
 * CommissionOverrideInput Component
 * 
 * Reusable component for commission override UI with smooth animations.
 * Supports Fixed amount (VND) or Percentage (%) input.
 * 
 * Part of Commission System (Task 11)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn } from '@/lib/utils';

interface CommissionOverrideInputProps {
  enabled: boolean;
  overrideType: 'fixed' | 'percentage';
  overrideValue: number;
  onToggle: (enabled: boolean) => void;
  onTypeChange: (type: 'fixed' | 'percentage') => void;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export function CommissionOverrideInput({
  enabled,
  overrideType,
  overrideValue,
  onToggle,
  onTypeChange,
  onValueChange,
  disabled = false,
  className,
}: CommissionOverrideInputProps) {
  return (
    <div
      className={cn('space-y-4 rounded-2xl border border-slate-100 bg-slate-50/30 p-5 dark:border-[#3E3A35]/30 dark:bg-[#1C1B19]/20 transition-all duration-300 overflow-visible', className)}
      role="group"
      aria-label="Commission override settings"
    >
      {/* Toggle Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="commission-override-toggle"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Enable commission override"
        />
        <label
          htmlFor="commission-override-toggle"
          className={cn(
            'text-sm font-medium',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          Tùy chỉnh hoa hồng (override)
        </label>
      </div>

      {/* Override Fields (animated) */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-visible relative z-10"
          >
            <div className="grid gap-4 pt-2 md:grid-cols-2">
              {/* Type Selector */}
              <div className="space-y-2">
                <label htmlFor="override-type" className="text-sm font-medium">
                  Loại hoa hồng
                </label>
                <PremiumSelect
                  options={[
                    { value: 'fixed', label: 'Cố định (đ)' },
                    { value: 'percentage', label: 'Phần trăm (%)' },
                  ]}
                  value={overrideType}
                  onChange={(type) => onTypeChange(type as 'fixed' | 'percentage')}
                  disabled={disabled}
                  placeholder="Chọn loại hoa hồng"
                />
              </div>

              {/* Value Input */}
              <div className="space-y-2">
                <label htmlFor="override-value" className="text-sm font-medium">
                  {overrideType === 'fixed' ? 'Số tiền (đ)' : 'Tỷ lệ (%)'}
                </label>
                <div className="relative">
                  <input
                    id="override-value"
                    type="text"
                    value={overrideValue === 0 ? '' : overrideValue.toLocaleString('vi-VN')}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d.]/g, '');
                      onValueChange(parseFloat(value) || 0);
                    }}
                    disabled={disabled}
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-10 font-bold text-slate-800 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Commission override value in ${overrideType === 'fixed' ? 'VND' : 'percentage'}`}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                    {overrideType === 'fixed' ? 'đ' : '%'}
                  </span>
                </div>
                {overrideType === 'percentage' && overrideValue > 100 && (
                  <p className="text-xs text-amber-600" role="alert">
                    ⚠️ Tỷ lệ hoa hồng vượt quá 100%
                  </p>
                )}
              </div>
            </div>

            {/* Helper Text */}
            <div className="mt-3 rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                {overrideType === 'fixed' ? (
                  <>
                    <strong>Hoa hồng cố định:</strong> Nhân viên nhận số tiền cố định bất kể giá trị
                    dịch vụ. VD: 150,000đ cho mỗi dịch vụ.
                  </>
                ) : (
                  <>
                    <strong>Hoa hồng phần trăm:</strong> Nhân viên nhận % của tổng giá trị dịch vụ. VD:
                    20% của 500,000đ = 100,000đ.
                  </>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
