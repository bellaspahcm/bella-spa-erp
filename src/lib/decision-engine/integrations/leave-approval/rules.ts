/**
 * Leave Approval Decision Rules
 * 
 * Business rules for employee leave request approval.
 * Uses RuleProvider with IF-THEN conditional logic.
 * 
 * Rules Priority (evaluated in order):
 * 1. Insufficient balance → REJECT
 * 2. Excessive duration (>30 days) → REJECT
 * 3. Invalid duration (≤0 days) → REJECT
 * 4. Sick leave auto-approve (≤3 days) → APPROVE
 * 5. Long leave requires manager (>5 days, not manager/admin) → REJECT
 * 6. Blackout period (Tet: Jan 20 - Feb 10) → REJECT
 * 7. High season restrictions (June-Aug, >3 days) → REJECT
 * 8. Default → APPROVE
 */

import type { IfThenRule } from '../../providers/RuleProvider';

/**
 * Leave approval rules (evaluated sequentially)
 */
export const leaveApprovalRules: IfThenRule[] = [
  // Rule 1: Insufficient leave balance
  {
    id: 'leave-balance-check',
    description: 'Reject if insufficient leave balance',
    condition: {
      field: 'employeeLeaveBalance',
      operator: '<',
      value: { field: 'requestedDays' }, // Will need custom handling
    },
    action: {
      approve: false,
      reason: 'Insufficient leave balance',
      requiresManualReview: false,
    },
  },

  // Rule 2: Excessive duration
  {
    id: 'max-duration-check',
    description: 'Reject if leave duration exceeds 30 days',
    condition: {
      field: 'requestedDays',
      operator: '>',
      value: 30,
    },
    action: {
      approve: false,
      reason: 'Leave duration exceeds maximum allowed (30 days)',
      requiresManualReview: false,
    },
  },

  // Rule 3: Invalid duration
  {
    id: 'invalid-duration-check',
    description: 'Reject if leave duration is zero or negative',
    condition: {
      field: 'requestedDays',
      operator: '<=',
      value: 0,
    },
    action: {
      approve: false,
      reason: 'Invalid leave duration',
      requiresManualReview: false,
    },
  },

  // Rule 4: Sick leave auto-approve
  {
    id: 'sick-leave-auto-approve',
    description: 'Auto-approve sick leave up to 3 days',
    condition: {
      and: [
        { field: 'leaveType', operator: '==', value: 'sick' },
        { field: 'requestedDays', operator: '<=', value: 3 },
      ],
    },
    action: {
      approve: true,
      reason: 'Sick leave auto-approved (≤3 days)',
      autoApproved: true,
    },
  },

  // Rule 5: Long leave requires manager approval
  {
    id: 'long-leave-manager-approval',
    description: 'Long leave (>5 days) requires manager or admin approval',
    condition: {
      and: [
        { field: 'requestedDays', operator: '>', value: 5 },
        {
          and: [
            { field: 'approverRole', operator: '!=', value: 'manager' },
            { field: 'approverRole', operator: '!=', value: 'admin' },
          ],
        },
      ],
    },
    action: {
      approve: false,
      reason: 'Leave requests over 5 days require manager approval',
      requiresEscalation: true,
    },
  },

  // Rule 6: Tet blackout period
  {
    id: 'tet-blackout-period',
    description: 'Reject leave during Tet holiday period',
    condition: {
      // This needs custom date range check
      // For now, simplified to check startDate field
      field: 'duringTetPeriod',
      operator: '==',
      value: true,
    },
    action: {
      approve: false,
      reason: 'Cannot approve leave during Tet holiday period (Jan 20 - Feb 10)',
      blackoutPeriod: 'tet-2026',
    },
  },

  // Rule 7: High season restrictions
  {
    id: 'high-season-blackout',
    description: 'Limit leave to 3 days during high season',
    condition: {
      and: [
        { field: 'duringHighSeason', operator: '==', value: true },
        { field: 'requestedDays', operator: '>', value: 3 },
      ],
    },
    action: {
      approve: false,
      reason: 'Cannot approve leave > 3 days during high season (June-August)',
      blackoutPeriod: 'high-season-2026',
    },
  },

  // Rule 8: Default approve
  {
    id: 'default-approve',
    description: 'Default approval if all checks pass',
    condition: {
      // Always true condition
      field: '_always',
      operator: '==',
      value: true,
    },
    action: {
      approve: true,
      reason: 'All approval criteria met',
    },
  },
];

/**
 * Check if date falls within Tet period
 */
export function isDuringTetPeriod(dateStr: string): boolean {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  
  // Tet period: Jan 20 - Feb 10
  const tetStart = new Date(year, 0, 20); // Jan 20
  const tetEnd = new Date(year, 1, 10);   // Feb 10
  
  return date >= tetStart && date <= tetEnd;
}

/**
 * Check if date falls within high season
 */
export function isDuringHighSeason(dateStr: string): boolean {
  const date = new Date(dateStr);
  const month = date.getMonth(); // 0-indexed
  
  // High season: June (5) - August (7)
  return month >= 5 && month <= 7;
}

/**
 * Prepare leave approval input data
 * 
 * Transforms raw input into format expected by rules.
 * Adds computed fields like blackout period flags.
 */
export function prepareLeaveApprovalData(input: {
  employeeLeaveBalance: number;
  leaveType: string;
  requestedDays: number;
  startDate: string;
  endDate: string;
  approverRole: string;
}): Record<string, unknown> {
  return {
    ...input,
    // Computed fields
    duringTetPeriod: isDuringTetPeriod(input.startDate),
    duringHighSeason: isDuringHighSeason(input.startDate),
    _always: true, // For default rule
  };
}
