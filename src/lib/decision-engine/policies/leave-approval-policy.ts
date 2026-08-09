/**
 * Leave Approval Policy
 * 
 * Business rules for leave request approval decisions.
 * 
 * Rules:
 * 1. Check employee leave balance
 * 2. Validate request duration (max 30 days)
 * 3. Check approver authorization level
 * 4. Validate business days (no negative days)
 * 5. Check blackout periods (Tet, high season)
 * 
 * NOTE: This is a legacy example file. Production policies are defined
 * in the Rule Provider configuration.
 */

// import type { Policy } from '../types'; // TODO: Define Policy type or remove this file

export const leaveApprovalPolicy: Record<string, unknown> = {
  name: 'Leave Approval Policy',
  version: '1.0.0',
  description: 'Business rules for employee leave request approval',
  
  rules: [
    // Rule 1: Insufficient leave balance
    {
      id: 'leave-balance-check',
      name: 'Leave Balance Check',
      priority: 1,
      conditions: [
        {
          field: 'employeeLeaveBalance',
          operator: '<',
          value: { field: 'requestedDays' },
        },
      ],
      actions: [
        {
          type: 'set-output',
          field: 'approved',
          value: false,
        },
        {
          type: 'set-output',
          field: 'reason',
          value: 'Insufficient leave balance',
        },
        {
          type: 'set-confidence',
          value: 1.0,
        },
        {
          type: 'stop',
        },
      ],
    },

    // Rule 2: Excessive duration (> 30 days)
    {
      id: 'max-duration-check',
      name: 'Maximum Duration Check',
      priority: 2,
      conditions: [
        {
          field: 'requestedDays',
          operator: '>',
          value: 30,
        },
      ],
      actions: [
        {
          type: 'set-output',
          field: 'approved',
          value: false,
        },
        {
          type: 'set-output',
          field: 'reason',
          value: 'Leave duration exceeds maximum allowed (30 days)',
        },
        {
          type: 'set-confidence',
          value: 1.0,
        },
        {
          type: 'stop',
        },
      ],
    },

    // Rule 3: Invalid request (0 or negative days)
    {
      id: 'invalid-duration-check',
      name: 'Invalid Duration Check',
      priority: 3,
      conditions: [
        {
          field: 'requestedDays',
          operator: '<=',
          value: 0,
        },
      ],
      actions: [
        {
          type: 'set-output',
          field: 'approved',
          value: false,
        },
        {
          type: 'set-output',
          field: 'reason',
          value: 'Invalid leave duration',
        },
        {
          type: 'set-confidence',
          value: 1.0,
        },
        {
          type: 'stop',
        },
      ],
    },

    // Rule 4: Long leave (> 5 days) requires manager approval
    {
      id: 'long-leave-manager-approval',
      name: 'Long Leave Manager Approval',
      priority: 4,
      conditions: [
        {
          field: 'requestedDays',
          operator: '>',
          value: 5,
        },
        {
          field: 'approverRole',
          operator: '!==',
          value: 'manager',
        },
        {
          field: 'approverRole',
          operator: '!==',
          value: 'admin',
        },
      ],
      actions: [
        {
          type: 'set-output',
          field: 'approved',
          value: false,
        },
        {
          type: 'set-output',
          field: 'reason',
          value: 'Leave requests over 5 days require manager approval',
        },
        {
          type: 'set-output',
          field: 'requiresEscalation',
          value: true,
        },
        {
          type: 'set-confidence',
          value: 1.0,
        },
        {
          type: 'stop',
        },
      ],
    },

    // Rule 5: Blackout period (Tet holiday: Jan 20 - Feb 10)
    {
      id: 'tet-blackout-period',
      name: 'Tet Blackout Period',
      priority: 5,
      conditions: [
        {
          field: 'startDate',
          operator: 'date-in-range',
          value: {
            start: '2026-01-20',
            end: '2026-02-10',
          },
        },
      ],
      actions: [
        {
          type: 'set-output',
          field: 'approved',
          value: false,
        },
        {
          type: 'set-output',
          field: 'reason',
          value: 'Cannot approve leave during Tet holiday period (Jan 20 - Feb 10)',
        },
        {
          type: 'set-output',
          field: 'blackoutPeriod',
          value: 'tet-2026',
        },
        {
          type: 'set-confidence',
          value: 1.0,
        },
        {
          type: 'stop',
        },
      ],
    },

    // Rule 6: High season blackout (June 1 - Aug 31)
    {
      id: 'high-season-blackout',
      name: 'High Season Blackout',
      priority: 6,
      conditions: [
        {
          field: 'startDate',
          operator: 'date-in-range',
          value: {
            start: '2026-06-01',
            end: '2026-08-31',
          },
        },
        {
          field: 'requestedDays',
          operator: '>',
          value: 3,
        },
      ],
      actions: [
        {
          type: 'set-output',
          field: 'approved',
          value: false,
        },
        {
          type: 'set-output',
          field: 'reason',
          value: 'Cannot approve leave > 3 days during high season (June-August)',
        },
        {
          type: 'set-output',
          field: 'blackoutPeriod',
          value: 'high-season-2026',
        },
        {
          type: 'set-confidence',
          value: 0.9,
        },
        {
          type: 'stop',
        },
      ],
    },

    // Rule 7: Sick leave (always approved if <= 3 days)
    {
      id: 'sick-leave-auto-approve',
      name: 'Sick Leave Auto Approve',
      priority: 7,
      conditions: [
        {
          field: 'leaveType',
          operator: '===',
          value: 'sick',
        },
        {
          field: 'requestedDays',
          operator: '<=',
          value: 3,
        },
      ],
      actions: [
        {
          type: 'set-output',
          field: 'approved',
          value: true,
        },
        {
          type: 'set-output',
          field: 'reason',
          value: 'Sick leave auto-approved (≤3 days)',
        },
        {
          type: 'set-output',
          field: 'autoApproved',
          value: true,
        },
        {
          type: 'set-confidence',
          value: 1.0,
        },
        {
          type: 'stop',
        },
      ],
    },

    // Rule 8: Default approve (all checks passed)
    {
      id: 'default-approve',
      name: 'Default Approve',
      priority: 100,
      conditions: [],
      actions: [
        {
          type: 'set-output',
          field: 'approved',
          value: true,
        },
        {
          type: 'set-output',
          field: 'reason',
          value: 'All approval criteria met',
        },
        {
          type: 'set-confidence',
          value: 0.95,
        },
      ],
    },
  ],
};
