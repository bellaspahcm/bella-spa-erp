/**
 * Leave Approval Policy v1
 * 
 * Simple leave approval rules based on:
 * - Advance notice (hours until leave)
 * - Leave balance
 * - Attendance violations
 * - Conflicts with existing bookings
 */

import type { Policy } from '../types';

export const leaveApprovalPolicyV1: Policy = {
  id: 'leave-approval-v1',
  version: '1.0.0',
  name: 'Leave Approval Policy',
  description: 'Automated leave request approval based on advance notice and attendance',
  
  rules: [
    // Rule 1: Auto-approve if ≥24h notice + good record
    {
      id: 'advance-notice-24h',
      priority: 1,
      conditions: {
        type: 'operator',
        operator: 'and',
        conditions: [
          {
            type: 'comparison',
            field: 'leave.hoursNotice',
            operator: '>=',
            value: 24
          },
          {
            type: 'comparison',
            field: 'leave.balance',
            operator: '>',
            value: 0
          },
          {
            type: 'comparison',
            field: 'attendance.violations',
            operator: '==',
            value: 0
          },
          {
            type: 'comparison',
            field: 'context.hasConflict',
            operator: '===',
            value: false
          }
        ]
      },
      action: {
        outcome: 'APPROVE',
        reason: 'Leave approved: ≥24h advance notice, sufficient balance, no violations'
      }
    },
    
    // Rule 2: Auto-reject if <24h notice
    {
      id: 'same-day-reject',
      priority: 2,
      conditions: {
        type: 'comparison',
        field: 'leave.hoursNotice',
        operator: '<',
        value: 24
      },
      action: {
        outcome: 'REJECT',
        reason: 'Leave rejected: Less than 24h advance notice required'
      }
    },
    
    // Rule 3: Auto-reject if no leave balance
    {
      id: 'no-balance-reject',
      priority: 3,
      conditions: {
        type: 'comparison',
        field: 'leave.balance',
        operator: '<=',
        value: 0
      },
      action: {
        outcome: 'REJECT',
        reason: 'Leave rejected: Insufficient leave balance'
      }
    },
    
    // Rule 4: Escalate if has conflicts
    {
      id: 'conflict-escalate',
      priority: 4,
      conditions: {
        type: 'comparison',
        field: 'context.hasConflict',
        operator: '===',
        value: true
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Manual review required: Conflicts with existing bookings'
      }
    },
    
    // Rule 5: Escalate if has attendance violations
    {
      id: 'violations-escalate',
      priority: 5,
      conditions: {
        type: 'comparison',
        field: 'attendance.violations',
        operator: '>',
        value: 0
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Manual review required: Employee has attendance violations'
      }
    },
    
    // Rule 6: Default escalate (safety fallback)
    {
      id: 'default-escalate',
      priority: 100,
      conditions: {
        type: 'operator',
        operator: 'or',
        conditions: [] // Always false, but catches anything not matched above
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Manual review required: Unhandled case'
      }
    }
  ]
};
