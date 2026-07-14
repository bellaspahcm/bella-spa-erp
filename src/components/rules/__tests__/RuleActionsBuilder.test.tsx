/**
 * @jest-environment jsdom
 * 
 * Unit Tests for RuleActionsBuilder Component
 * 
 * Simplified tests focusing on component behavior without deep sub-component testing.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RuleActionsBuilder } from '../RuleActionsBuilder';
import { ActionExpression } from '../ActionRow';

// Mock action schema to avoid dependency on registry
jest.mock('@/lib/decision-engine/action-schema-registry', () => ({
  getActionSchema: jest.fn(() => ({
    key: 'approve',
    label: 'Approve',
    description: 'Approve the request',
    params: [],
  })),
  getAllActionsForProvider: jest.fn(() => [
    { key: 'approve', label: 'Approve' },
    { key: 'reject', label: 'Reject' },
  ]),
}));

describe('RuleActionsBuilder', () => {
  const mockOnChange = jest.fn();

  const defaultProps = {
    provider: 'booking',
    actions: [] as ActionExpression[],
    onChange: mockOnChange,
  };

  const existingActions: ActionExpression[] = [
    { type: 'approve', params: { reason: 'Auto-approved' } },
    { type: 'assignKtv', params: { ktvId: 'auto' } },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render empty state when no actions', () => {
      render(<RuleActionsBuilder {...defaultProps} />);

      expect(screen.getByText(/chưa thiết lập hành động/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /thêm hành động mới/i })).toBeInTheDocument();
    });

    it('should render add button for actions', () => {
      render(<RuleActionsBuilder {...defaultProps} />);
      
      const addButton = screen.getByRole('button', { name: /thêm hành động mới/i });
      expect(addButton).toBeInTheDocument();
      expect(addButton).not.toBeDisabled();
    });

    it('should render empty state helper text', () => {
      render(<RuleActionsBuilder {...defaultProps} />);

      expect(screen.getByText(/bấm nút thêm hành động phía dưới/i)).toBeInTheDocument();
    });
  });

  describe('Adding Actions', () => {
    it('should call onChange with new action when add clicked', () => {
      render(<RuleActionsBuilder {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /thêm hành động mới/i });
      fireEvent.click(addButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          type: undefined,
          params: {},
        }),
      ]);
    });

    it('should add action with empty params object', () => {
      render(<RuleActionsBuilder {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /thêm hành động mới/i }));

      const call = mockOnChange.mock.calls[0][0];
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject({
        type: undefined,
        params: {},
      });
    });

    it('should add action to existing list', () => {
      render(
        <RuleActionsBuilder
          {...defaultProps}
          actions={[existingActions[0]]}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /thêm hành động mới/i }));

      const call = mockOnChange.mock.calls[0][0];
      expect(call).toHaveLength(2);
      expect(call[0]).toEqual(existingActions[0]);
    });
  });

  describe('Disabled State', () => {
    it('should disable add button when disabled prop is true', () => {
      render(<RuleActionsBuilder {...defaultProps} disabled={true} />);

      const addButton = screen.getByRole('button', { name: /thêm hành động mới/i });
      expect(addButton).toBeDisabled();
    });

    it('should allow adding when not disabled', () => {
      render(<RuleActionsBuilder {...defaultProps} disabled={false} />);

      const addButton = screen.getByRole('button', { name: /thêm hành động mới/i });
      expect(addButton).not.toBeDisabled();
    });
  });

  describe('Provider Support', () => {
    it('should work with booking provider', () => {
      render(<RuleActionsBuilder {...defaultProps} provider="booking" />);
      expect(screen.getByRole('button', { name: /thêm hành động mới/i })).toBeInTheDocument();
    });

    it('should work with discount provider', () => {
      render(<RuleActionsBuilder {...defaultProps} provider="discount" />);
      expect(screen.getByRole('button', { name: /thêm hành động mới/i })).toBeInTheDocument();
    });

    it('should work with payroll provider', () => {
      render(<RuleActionsBuilder {...defaultProps} provider="payroll" />);
      expect(screen.getByRole('button', { name: /thêm hành động mới/i })).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors prop gracefully', () => {
      render(
        <RuleActionsBuilder
          {...defaultProps}
          actions={existingActions}
          errors={{ 'action-0': JSON.stringify({ type: 'Required field' }) }}
        />
      );

      // Component should render without crashing
      expect(screen.getByRole('button', { name: /thêm hành động mới/i })).toBeInTheDocument();
    });

    it('should handle malformed error JSON', () => {
      render(
        <RuleActionsBuilder
          {...defaultProps}
          actions={existingActions}
          errors={{ 'action-0': 'not valid json' }}
        />
      );

      // Component should render without crashing
      expect(screen.getByRole('button', { name: /thêm hành động mới/i })).toBeInTheDocument();
    });
  });

  describe('Empty vs Non-Empty States', () => {
    it('should show empty state when actions array is empty', () => {
      render(<RuleActionsBuilder {...defaultProps} actions={[]} />);

      expect(screen.getByText(/chưa thiết lập hành động/i)).toBeInTheDocument();
      expect(screen.queryByText(/hành động #/i)).not.toBeInTheDocument();
    });

    it('should hide empty state when actions exist', () => {
      render(<RuleActionsBuilder {...defaultProps} actions={existingActions} />);

      expect(screen.queryByText(/chưa thiết lập hành động/i)).not.toBeInTheDocument();
    });
  });
});
