/**
 * @jest-environment jsdom
 * 
 * Unit Tests for RuleConditionsBuilder Component
 * 
 * Simplified tests focusing on component behavior without deep sub-component testing.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RuleConditionsBuilder } from '../RuleConditionsBuilder';
import { ConditionExpression } from '../ConditionRow';

// Mock field schema to avoid dependency on registry
jest.mock('@/lib/decision-engine/field-schema-registry', () => ({
  getFieldSchema: jest.fn(() => ({
    key: 'test.field',
    label: 'Test Field',
    type: 'string',
    operators: ['equals', 'not_equals'],
  })),
  getAllFieldsForProvider: jest.fn(() => [
    { key: 'test.field', label: 'Test Field', type: 'string' },
  ]),
}));

describe('RuleConditionsBuilder', () => {
  const mockOnChange = jest.fn();
  const mockOnLogicalOperatorChange = jest.fn();

  const defaultProps = {
    provider: 'booking',
    conditions: [] as ConditionExpression[],
    onChange: mockOnChange,
  };

  const existingConditions: ConditionExpression[] = [
    { field: 'customer.tier', operator: 'equals', value: 'VIP' },
    { field: 'booking.totalAmount', operator: 'greater_than', value: 5000000 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render empty state when no conditions', () => {
      render(<RuleConditionsBuilder {...defaultProps} />);

      expect(screen.getByText(/chưa thiết lập điều kiện/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /thêm điều kiện mới/i })).toBeInTheDocument();
    });

    it('should render add button for conditions', () => {
      render(<RuleConditionsBuilder {...defaultProps} />);
      
      const addButton = screen.getByRole('button', { name: /thêm điều kiện mới/i });
      expect(addButton).toBeInTheDocument();
      expect(addButton).not.toBeDisabled();
    });

    it('should show AND/OR toggle when multiple conditions with handler', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
          onLogicalOperatorChange={mockOnLogicalOperatorChange}
        />
      );

      expect(screen.getByText(/tất cả \(and\)/i)).toBeInTheDocument();
      expect(screen.getByText(/bất kỳ \(or\)/i)).toBeInTheDocument();
    });
  });

  describe('Adding Conditions', () => {
    it('should call onChange with new condition when add clicked', () => {
      render(<RuleConditionsBuilder {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /thêm điều kiện mới/i });
      fireEvent.click(addButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          field: undefined,
          operator: undefined,
          value: undefined,
        }),
      ]);
    });

    it('should add condition to existing list', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={[existingConditions[0]]}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /thêm điều kiện mới/i }));

      const call = mockOnChange.mock.calls[0][0];
      expect(call).toHaveLength(2);
      expect(call[0]).toEqual(existingConditions[0]);
    });
  });

  describe('Logical Operator Toggle', () => {
    it('should call handler when OR button clicked', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
          logicalOperator="and"
          onLogicalOperatorChange={mockOnLogicalOperatorChange}
        />
      );

      const orButton = screen.getByText(/bất kỳ \(or\)/i).closest('button');
      fireEvent.click(orButton!);

      expect(mockOnLogicalOperatorChange).toHaveBeenCalledWith('or');
    });

    it('should call handler when AND button clicked', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
          logicalOperator="or"
          onLogicalOperatorChange={mockOnLogicalOperatorChange}
        />
      );

      const andButton = screen.getByText(/tất cả \(and\)/i).closest('button');
      fireEvent.click(andButton!);

      expect(mockOnLogicalOperatorChange).toHaveBeenCalledWith('and');
    });

    it('should not show toggle for single condition', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={[existingConditions[0]]}
          onLogicalOperatorChange={mockOnLogicalOperatorChange}
        />
      );

      expect(screen.queryByText(/tất cả \(and\)/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/bất kỳ \(or\)/i)).not.toBeInTheDocument();
    });

    it('should not show toggle without handler', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
        />
      );

      expect(screen.queryByText(/tất cả \(and\)/i)).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should disable add button when disabled prop is true', () => {
      render(<RuleConditionsBuilder {...defaultProps} disabled={true} />);

      const addButton = screen.getByRole('button', { name: /thêm điều kiện mới/i });
      expect(addButton).toBeDisabled();
    });

    it('should disable toggle buttons when disabled', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
          logicalOperator="and"
          onLogicalOperatorChange={mockOnLogicalOperatorChange}
          disabled={true}
        />
      );

      const andButton = screen.getByText(/tất cả \(and\)/i).closest('button');
      const orButton = screen.getByText(/bất kỳ \(or\)/i).closest('button');
      
      expect(andButton).toBeDisabled();
      expect(orButton).toBeDisabled();
    });
  });
});
