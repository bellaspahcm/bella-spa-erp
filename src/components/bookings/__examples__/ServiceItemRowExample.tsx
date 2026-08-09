'use client';

/**
 * ServiceItemRow Example Usage
 * 
 * Demonstrates how to use ServiceItemRow component with sample data.
 * This file is for testing and documentation purposes.
 */

import { useState } from 'react';
import { ServiceItemRow, ServiceItemData } from '../ServiceItemRow';

// Sample data from Task 10 testing
const SAMPLE_PACKAGES = [
  { id: 'pkg-1', name: 'Gội Massage Thu Giãn', price: 200000 },
  { id: 'pkg-2', name: 'Massage Bấm Huyệt', price: 300000 },
  { id: 'pkg-3', name: 'Chăm Sóc Da Mặt', price: 500000 },
];

const SAMPLE_COMMISSION_DEFAULTS = {
  type: 'fixed' as const,
  value: 150000,
};

export function ServiceItemRowExample() {
  const [items, setItems] = useState<ServiceItemData[]>([
    {
      id: '1',
      serviceName: 'Gội Massage Thu Giãn',
      packageId: 'pkg-1',
      quantity: 1,
      unitPrice: 200000,
      subtotal: 200000,
      overrideType: null,
      overrideValue: null,
    },
    {
      id: '2',
      serviceName: 'Massage Bấm Huyệt',
      packageId: 'pkg-2',
      quantity: 2,
      unitPrice: 300000,
      subtotal: 600000,
      overrideType: 'percentage',
      overrideValue: 20,
    },
  ]);

  const handleChange = (id: string, field: string, value: ServiceItemData[keyof ServiceItemData]) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddItem = () => {
    const newItem: ServiceItemData = {
      id: `${Date.now()}`,
      serviceName: '',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
      overrideType: null,
      overrideValue: null,
    };
    setItems((prev) => [...prev, newItem]);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">ServiceItemRow Component Test</h2>
        <p className="text-muted-foreground">
          Testing ServiceItemRow with Task 10 sample data
        </p>
      </div>

      {/* Service Items List */}
      <div className="space-y-4">
        {items.map((item) => (
          <ServiceItemRow
            key={item.id}
            item={item}
            packages={SAMPLE_PACKAGES}
            commissionDefaults={SAMPLE_COMMISSION_DEFAULTS}
            onChange={handleChange}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Add Item Button */}
      <button
        type="button"
        onClick={handleAddItem}
        className="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
      >
        + Thêm dịch vụ
      </button>

      {/* Summary */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <h3 className="mb-3 font-semibold">Tổng kết</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Tổng số dịch vụ:</span>
            <span className="font-bold">{items.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Tổng giá trị:</span>
            <span className="font-bold">
              {items.reduce((sum, item) => sum + item.subtotal, 0).toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>
      </div>

      {/* Debug: Current State */}
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-semibold">
          Debug: Current State (Click to expand)
        </summary>
        <pre className="mt-3 overflow-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(items, null, 2)}
        </pre>
      </details>
    </div>
  );
}
