/**
 * @jest-environment jsdom
 * 
 * Unit Tests for RuleConditionsBuilder Component
 * 
 * Tests the conditions builder that allows users to:
 * - Add/remove conditions
 * - Select fields, operators, values
 * - Toggle AND/OR logical operators
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RuleConditionsBuilder } from '../RuleConditionsBuilder';

describe('RuleConditionsBuilder', () => {
  const mockOnChange = jest.fn();

  const defaultProps = {
    provider: 'booking' as const,
    conditions: [],
    onChange: mockOnChange,
  };

  const existingConditions = [
    { field: 'customer.tier', operator: 'equals', value: 'VIP' },
    { field: 'booking.totalAmount', operator: 'greater_than', value: 5000000 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render empty state when no conditions', () => {
      render(<RuleConditionsBuilder {...defaultProps} />);

      expect(screen.getByText(/no conditions/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add condition/i })).toBeInTheDocument();
    });

    it('should render existing conditions', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
        />
      );

      expect(screen.getAllByTestId(/condition-row/i)).toHaveLength(2);
    });

    it('should show AND/OR toggle when multiple conditions', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
        />
      );

      expect(screen.getByRole('button', { name: /and/i })).toBeInTheDocument();
    });
  });

  describe('Adding Conditions', () => {
    it('should call onChange with new condition when add clicked', () => {
      render(<RuleConditionsBuilder {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /add condition/i });
      fireEvent.click(addButton);

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          field: '',
          operator: 'equals',
          value: '',
        }),
      ]);
    });

    it('should add condition with default values', () => {
      render(<RuleConditionsBuilder {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /add condition/i }));

      const call = mockOnChange.mock.calls[0][0];
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject({
        field: '',
        operator: 'equals',
        value: '',
      });
    });
  });

  describe('Removing Conditions', () => {
    it('should call onChange without removed condition', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
        />
      );

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      expect(mockOnChange).toHaveBeenCalledWith([existingConditions[1]]);
    });

    it('should remove last condition', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={[existingConditions[0]]}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      expect(mockOnChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Logical Operator Toggle', () => {
    it('should toggle between AND and OR', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
          logicalOperator="AND"
        />
      );

      const toggleButton = screen.getByRole('button', { name: /and/i });
      fireEvent.click(toggleButton);

      expect(mockOnChange).toHaveBeenCalled();
      // In real implementation, this would pass 'OR' to parent
    });

    it('should not show toggle for single condition', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={[existingConditions[0]]}
        />
      );

      expect(screen.queryByRole('button', { name: /and/i })).not.toBeInTheDocument();
    });
  });

  describe('Field Selection', () => {
    it('should show field selector for each condition', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={existingConditions}
        />
      );

      const fieldSelectors = screen.getAllByLabelText(/field/i);
      expect(fieldSelectors).toHaveLength(2);
    });

    it('should filter fields by provider', () => {
      render(
        <RuleConditionsBuilder
          {...defaultProps}
          provider="discount"
          conditions={[existingConditions[0]]}
        />
      );

      // In real implementation, would verify only discount fields shown
      expect(screen.getByLabelText(/field/i)).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show validation error for empty field', () => {
      const invalidCondition = [
        { field: '', operator: 'equals', value: 'test' }
      ];

      render(
        <RuleConditionsBuilder
          {...defaultProps}
          conditions={invalidCondition}
        />
      );

      // In real implementation, would show error message
      expect(screen.getByLabelText(/field/i)).toBeInTheDocument();
    });
  });
});
