'use client';

/**
 * ServiceItemRow Component
 * 
 * Reusable component for displaying and editing a single service item row.
 * Supports auto-calculation, commission override, and accessibility features.
 * 
 * Part of Commission System (Task 11)
 */

import { useState } from 'react';
import { BeautySpaSelect } from '@/components/ui/BeautySpaSelect';
import { CommissionOverrideInput } from './CommissionOverrideInput';
import { calculateServiceCommission } from '@/lib/business-rules/commission';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Package {
  id: string;
  name: string;
  price: number | null;
}

interface CommissionConfig {
  type: 'fixed' | 'percentage';
  value: number;
}

export interface ServiceItemData {
  id: string;
  serviceName: string;
  packageId?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  overrideType: 'fixed' | 'percentage' | null;
  overrideValue: number | null;
}

interface ServiceItemRowProps {
  item: ServiceItemData;
  packages: Package[];
  commissionDefaults: CommissionConfig;
  onChange: (id: string, field: string, value: any) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  showRemoveButton?: boolean;
  className?: string;
}

export function ServiceItemRow({
  item,
  packages,
  commissionDefaults,
  onChange,
  onRemove,
  disabled = false,
  showRemoveButton = true,
  className,
}: ServiceItemRowProps) {
  const [showOverride, setShowOverride] = useState(
    item.overrideType !== null && item.overrideValue !== null
  );

  // Auto-calculate subtotal
  const subtotal = item.quantity * item.unitPrice;

  // Update subtotal if changed
  if (subtotal !== item.subtotal) {
    onChange(item.id, 'subtotal', subtotal);
  }

  // Calculate commission preview
  const calculatedCommission = calculateServiceCommission({
    subtotal,
    overrideType: item.overrideType,
    overrideValue: item.overrideValue,
    defaultType: commissionDefaults.type,
    defaultValue: commissionDefaults.value,
  });

  // Handle service selection
  const handleServiceChange = (packageId: string) => {
    const selectedPackage = packages.find((p) => p.id === packageId);
    if (selectedPackage) {
      onChange(item.id, 'serviceName', selectedPackage.name);
      onChange(item.id, 'packageId', packageId);
      onChange(item.id, 'unitPrice', selectedPackage.price || 0);
    }
  };

  // Handle override toggle
  const handleOverrideToggle = (enabled: boolean) => {
    setShowOverride(enabled);
    if (!enabled) {
      onChange(item.id, 'overrideType', null);
      onChange(item.id, 'overrideValue', null);
    } else {
      // Initialize with default values
      onChange(item.id, 'overrideType', 'fixed');
      onChange(item.id, 'overrideValue', 0);
    }
  };

  return (
    <div
      className={cn(
        'space-y-4 rounded-lg border p-4 transition-colors',
        disabled && 'opacity-50',
        className
      )}
      role="group"
      aria-label={`Service item: ${item.serviceName || 'New service'}`}
    >
      {/* Header with Remove Button */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          {item.serviceName || 'Dịch vụ mới'}
        </h4>
        {showRemoveButton && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={disabled}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Remove ${item.serviceName || 'service'}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main Fields Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Service Selection */}
        <div className="space-y-2">
          <label htmlFor={`service-${item.id}`} className="text-sm font-medium">
            Dịch vụ *
          </label>
          <BeautySpaSelect
            options={packages.map((pkg) => ({
              value: pkg.id,
              label: `${pkg.name} (${(pkg.price || 0).toLocaleString('vi-VN')}đ)`,
            }))}
            value={item.packageId || ''}
            onChange={handleServiceChange}
            placeholder="-- Chọn dịch vụ --"
            disabled={disabled}
            aria-required="true"
          />
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <label htmlFor={`quantity-${item.id}`} className="text-sm font-medium">
            Số lượng *
          </label>
          <input
            id={`quantity-${item.id}`}
            type="number"
            min="1"
            required
            value={item.quantity}
            onChange={(e) => onChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
            disabled={disabled}
            className="w-full rounded-lg border bg-background px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-required="true"
          />
        </div>

        {/* Unit Price */}
        <div className="space-y-2">
          <label htmlFor={`unitPrice-${item.id}`} className="text-sm font-medium">
            Đơn giá *
          </label>
          <input
            id={`unitPrice-${item.id}`}
            type="text"
            required
            value={item.unitPrice === 0 ? '' : item.unitPrice.toLocaleString('vi-VN')}
            onChange={(e) => {
              const value = e.target.value.replace(/[^\d]/g, '');
              onChange(item.id, 'unitPrice', parseInt(value) || 0);
            }}
            disabled={disabled}
            placeholder="0"
            className="w-full rounded-lg border bg-background px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-required="true"
          />
        </div>

        {/* Subtotal (readonly) */}
        <div className="space-y-2">
          <label htmlFor={`subtotal-${item.id}`} className="text-sm font-medium">
            Thành tiền
          </label>
          <input
            id={`subtotal-${item.id}`}
            type="text"
            readOnly
            value={`${subtotal.toLocaleString('vi-VN')}đ`}
            className="w-full rounded-lg border bg-muted px-3 py-2 text-muted-foreground"
            aria-readonly="true"
            tabIndex={-1}
          />
        </div>
      </div>

      {/* Commission Preview Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Hoa hồng dự kiến:</span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
          {calculatedCommission.toLocaleString('vi-VN')}đ
        </span>
        {item.overrideType && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Tùy chỉnh
          </span>
        )}
      </div>

      {/* Commission Override Section */}
      <CommissionOverrideInput
        enabled={showOverride}
        overrideType={item.overrideType || 'fixed'}
        overrideValue={item.overrideValue || 0}
        onToggle={handleOverrideToggle}
        onTypeChange={(type) => onChange(item.id, 'overrideType', type)}
        onValueChange={(value) => onChange(item.id, 'overrideValue', value)}
        disabled={disabled}
      />
    </div>
  );
}
