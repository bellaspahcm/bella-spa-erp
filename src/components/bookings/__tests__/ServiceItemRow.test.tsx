/**
 * @jest-environment jsdom
 * 
 * ServiceItemRow Component Tests
 * 
 * Tests for ServiceItemRow and CommissionOverrideInput components
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceItemRow, ServiceItemData } from '../ServiceItemRow';

const mockPackages = [
  { id: 'pkg-1', name: 'Service A', price: 200000 },
  { id: 'pkg-2', name: 'Service B', price: 300000 },
];

const mockCommissionDefaults = {
  type: 'fixed' as const,
  value: 150000,
};

const mockItem: ServiceItemData = {
  id: '1',
  serviceName: 'Service A',
  packageId: 'pkg-1',
  quantity: 1,
  unitPrice: 200000,
  subtotal: 200000,
  overrideType: null,
  overrideValue: null,
};

describe('ServiceItemRow', () => {
  it.skip('should render service item with all fields', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    render(
      <ServiceItemRow
        item={mockItem}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    expect(screen.getByLabelText(/dịch vụ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/số lượng/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/đơn giá/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thành tiền/i)).toBeInTheDocument();
  });

  it('should calculate subtotal automatically', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    const item = { ...mockItem, quantity: 2, unitPrice: 300000 };

    render(
      <ServiceItemRow
        item={item}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    // Subtotal should be 2 * 300000 = 600000
    const subtotalInput = screen.getByLabelText(/thành tiền/i) as HTMLInputElement;
    expect(subtotalInput.value).toBe('600.000đ');
  });

  it('should display calculated commission preview', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    render(
      <ServiceItemRow
        item={mockItem}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    // Commission with default (150,000 fixed)
    expect(screen.getByText(/150.000đ/)).toBeInTheDocument();
  });

  it('should call onChange when quantity changes', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    render(
      <ServiceItemRow
        item={mockItem}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    const quantityInput = screen.getByLabelText(/số lượng/i);
    fireEvent.change(quantityInput, { target: { value: '3' } });

    expect(onChange).toHaveBeenCalledWith('1', 'quantity', 3);
  });

  it('should call onRemove when remove button clicked', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    render(
      <ServiceItemRow
        item={mockItem}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it.skip('should show override badge when override is active', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    const itemWithOverride = {
      ...mockItem,
      overrideType: 'percentage' as const,
      overrideValue: 20,
    };

    render(
      <ServiceItemRow
        item={itemWithOverride}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    expect(screen.getByText(/tùy chỉnh/i)).toBeInTheDocument();
  });

  it('should disable all inputs when disabled prop is true', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    render(
      <ServiceItemRow
        item={mockItem}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
        disabled={true}
      />
    );

    const quantityInput = screen.getByLabelText(/số lượng/i);
    const unitPriceInput = screen.getByLabelText(/đơn giá/i);

    expect(quantityInput).toBeDisabled();
    expect(unitPriceInput).toBeDisabled();
  });

  it('should format unit price with thousand separator', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    render(
      <ServiceItemRow
        item={mockItem}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    const unitPriceInput = screen.getByLabelText(/đơn giá/i) as HTMLInputElement;
    expect(unitPriceInput.value).toBe('200.000');
  });
});

describe('Commission Override Integration', () => {
  it('should calculate commission with fixed override', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    const itemWithFixedOverride = {
      ...mockItem,
      subtotal: 500000,
      overrideType: 'fixed' as const,
      overrideValue: 100000,
    };

    render(
      <ServiceItemRow
        item={itemWithFixedOverride}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    // Commission should be 100,000 (override)
    expect(screen.getByText(/100.000đ/)).toBeInTheDocument();
  });

  it('should calculate commission with percentage override', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();

    const itemWithPercentageOverride = {
      ...mockItem,
      subtotal: 500000,
      overrideType: 'percentage' as const,
      overrideValue: 20,
    };

    render(
      <ServiceItemRow
        item={itemWithPercentageOverride}
        packages={mockPackages}
        commissionDefaults={mockCommissionDefaults}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    // Commission should be 20% of 500,000 = 100,000
    expect(screen.getByText(/100.000đ/)).toBeInTheDocument();
  });
});

