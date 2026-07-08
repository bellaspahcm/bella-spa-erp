'use client';

/**
 * Add Service Item Form Component
 * 
 * Form to add a new service item with commission calculation
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createServiceItem } from '@/modules/bookings/actions/service-items-actions';
import { Loader2 } from 'lucide-react';
import { BeautySpaSelect } from '@/components/ui/BeautySpaSelect';

interface Package {
  id: string;
  name: string;
  price: number | null;
}

interface KTV {
  id: string;
  full_name: string;
}

interface AddServiceItemFormProps {
  bookingId: string;
  tenantId: string;
  packages: Package[];
  ktvList?: KTV[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddServiceItemForm({
  bookingId,
  tenantId,
  packages,
  ktvList = [],
  onSuccess,
  onCancel,
}: AddServiceItemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    serviceName: '',
    quantity: 1,
    unitPrice: 0,
    ktvId: '',
    completedDate: new Date().toISOString().split('T')[0],
    hasOverride: false,
    overrideType: 'fixed' as 'fixed' | 'percentage',
    overrideValue: 0,
  });

  // Update unit price when service selected
  const handleServiceChange = (packageId: string) => {
    const selectedPackage = packages.find((p) => p.id === packageId);
    if (selectedPackage) {
      setFormData((prev) => ({
        ...prev,
        serviceName: selectedPackage.name,
        unitPrice: selectedPackage.price || 0,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createServiceItem({
        bookingId,
        tenantId,
        serviceName: formData.serviceName,
        quantity: formData.quantity,
        unitPrice: formData.unitPrice,
        ktvId: formData.ktvId || null,
        completedDate: formData.completedDate,
        overrideType: formData.hasOverride ? formData.overrideType : null,
        overrideValue: formData.hasOverride ? formData.overrideValue : null,
      });

      if (result.success) {
        router.refresh();
        onSuccess();
      } else {
        setError(result.error || 'Không thể thêm dịch vụ');
      }
    } catch (err) {
      console.error('Error creating service item:', err);
      setError('Lỗi hệ thống');
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtotal = formData.quantity * formData.unitPrice;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Service Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Dịch vụ *</label>
          <BeautySpaSelect
            options={packages.map(pkg => ({
              value: pkg.id,
              label: `${pkg.name} (${(pkg.price || 0).toLocaleString('vi-VN')}đ)`
            }))}
            value={formData.serviceName ? packages.find(p => p.name === formData.serviceName)?.id || '' : ''}
            onChange={(packageId) => handleServiceChange(packageId)}
            placeholder="-- Chọn dịch vụ --"
          />
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Số lượng *</label>
          <input
            type="number"
            min="1"
            required
            value={formData.quantity}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))
            }
            className="w-full rounded-lg border bg-background px-3 py-2"
          />
        </div>

        {/* Unit Price */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Đơn giá *</label>
          <input
            type="text"
            required
            value={formData.unitPrice === 0 ? '' : formData.unitPrice.toLocaleString('vi-VN')}
            onChange={(e) => {
              const value = e.target.value.replace(/[^\d]/g, '');
              setFormData((prev) => ({ ...prev, unitPrice: parseInt(value) || 0 }));
            }}
            placeholder="0"
            className="w-full rounded-lg border bg-background px-3 py-2"
          />
        </div>

        {/* Subtotal (readonly) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Thành tiền</label>
          <input
            type="text"
            readOnly
            value={`${subtotal.toLocaleString('vi-VN')}đ`}
            className="w-full rounded-lg border bg-muted px-3 py-2 text-muted-foreground"
          />
        </div>

        {/* Completed Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Ngày hoàn thành *</label>
          <input
            type="date"
            required
            value={formData.completedDate}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, completedDate: e.target.value }))
            }
            className="w-full rounded-lg border bg-background px-3 py-2"
          />
        </div>

        {/* KTV Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">ID KTV (tùy chọn)</label>
          <BeautySpaSelect
            options={[
              { value: '', label: '-- Chọn KTV --' },
              ...ktvList.map(ktv => {
                // Build display label with available identifiers
                let label = ktv.full_name;
                
                if (ktv.employee_code) {
                  label += ` (${ktv.employee_code})`;
                } else if (ktv.email) {
                  label += ` (${ktv.email})`;
                } else {
                  label += ` (ID: ${ktv.id.slice(0, 8)})`;
                }
                
                return {
                  value: ktv.id,
                  label,
                };
              })
            ]}
            value={formData.ktvId}
            onChange={(ktvId) => setFormData(prev => ({ ...prev, ktvId }))}
            placeholder="-- Chọn KTV --"
          />
        </div>
      </div>

      {/* Commission Override Section */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="hasOverride"
            checked={formData.hasOverride}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, hasOverride: e.target.checked }))
            }
            className="h-4 w-4"
          />
          <label htmlFor="hasOverride" className="text-sm font-medium">
            Tùy chỉnh hoa hồng (override)
          </label>
        </div>

        {formData.hasOverride && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Loại</label>
              <BeautySpaSelect
                options={[
                  { value: 'fixed', label: 'Cố định (đ)' },
                  { value: 'percentage', label: 'Phần trăm (%)' }
                ]}
                value={formData.overrideType}
                onChange={(type) => setFormData(prev => ({ ...prev, overrideType: type as 'fixed' | 'percentage' }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Giá trị</label>
              <input
                type="text"
                value={formData.overrideValue === 0 ? '' : formData.overrideValue.toLocaleString('vi-VN')}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d]/g, '');
                  setFormData((prev) => ({
                    ...prev,
                    overrideValue: parseFloat(value) || 0,
                  }));
                }}
                placeholder="0"
                className="w-full rounded-lg border bg-background px-3 py-2"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border px-4 py-2 hover:bg-muted disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !formData.serviceName}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Đang lưu...' : 'Thêm dịch vụ'}
        </button>
      </div>
    </form>
  );
}
