/**
 * Payroll Salary Validation Policy v1
 * 
 * Domain: Financial validation for KTV salary records
 * Purpose: Validate salary calculations, flag anomalies, route approvals
 * 
 * Principles:
 * - Policy = Data (JSON-serializable, no functions)
 * - Validates results, does NOT calculate
 * - Service layer computes all salary components
 * - Policy checks thresholds, data integrity, approval routing
 * 
 * Case Study 3: Proves DSL expressiveness for complex financial domain
 * 
 * @see docs/decision-engine/CASE_STUDY_3_PAYROLL_REQUIREMENTS.md
 * @see docs/decision-engine/CASE_STUDY_3_PAYROLL_KNOWLEDGE_STRUCTURE.md
 * @see docs/decision-engine/CASE_STUDY_3_DSL_ANALYSIS.md
 */

import { Policy } from '../types';

/**
 * Payroll Salary Validation Policy v1
 * 
 * Rules (5 validation rules, priority 0-3):
 * 
 * 1. Data integrity (Priority 0 - Blocking):
 *    - Rule 1: Negative component detection
 *    - Rule 2: Excessive deduction cap (> 30%)
 * 
 * 2. Approval routing (Priority 1 - High):
 *    - Rule 3: High salary CFO approval (> 15M)
 *    - Rule 4: KPI consistency check
 * 
 * 3. Informational (Priority 2-3 - Low):
 *    - Rule 5: Low attendance alert
 * 
 * Knowledge fields used:
 * - salary.*: Pre-calculated salary components (13 fields)
 * - validation.*: Derived validation metrics (5 fields)
 * - config.*: Tenant configuration (10 fields)
 * - employee.*: Employee metadata (7 fields)
 * - record.*: Record metadata (5 fields)
 */
export const payrollSalaryPolicyV1: Policy = {
  id: 'payroll-salary-v1',
  version: '1.0.0',
  name: 'Payroll Salary Validation Policy',
  description: 'Validates KTV salary calculations, flags anomalies, and routes approvals based on thresholds',
  
  rules: [
    /**
     * Rule 1: Negative Component Detection (Priority 0 - BLOCKING)
     * 
     * Business Logic:
     * - If any salary component is negative → DATA_ERROR
     * - Blocks salary publishing until fixed
     * 
     * Knowledge Fields:
     * - validation.hasNegativeComponent (boolean)
     * 
     * Operators: === (comparison)
     */
    {
      id: 'payroll-negative-component',
      priority: 0,
      conditions: { 
        type: 'comparison',
        field: 'validation.hasNegativeComponent', 
        operator: '===', 
        value: true 
      },
      action: {
        outcome: 'DATA_ERROR',
        reason: 'Phát hiện component âm (lỗi dữ liệu nghiêm trọng)'
      }
    },

    /**
     * Rule 2: Excessive Deduction Cap (Priority 0 - BLOCKING)
     * 
     * Business Logic:
     * - If deductions > 30% of base salary AND not resigned → EXCESSIVE_DEDUCTION
     * - Prevents unreasonable penalties
     * 
     * Knowledge Fields:
     * - validation.deductionPercent (number)
     * - employee.isResigned (boolean)
     * 
     * Operators: and (logical), > (comparison), === (comparison)
     */
    {
      id: 'payroll-deduction-cap',
      priority: 0,
      conditions: {
        type: 'operator',
        operator: 'and',
        conditions: [
          { 
            type: 'comparison',
            field: 'validation.deductionPercent', 
            operator: '>', 
            value: 30 
          },
          { 
            type: 'comparison',
            field: 'employee.isResigned', 
            operator: '===', 
            value: false 
          }
        ]
      },
      action: {
        outcome: 'EXCESSIVE_DEDUCTION',
        reason: 'Tổng phạt vượt 30% lương cơ bản, cần review'
      }
    },

    /**
     * Rule 3: High Salary CFO Approval (Priority 1 - APPROVAL ROUTING)
     * 
     * Business Logic:
     * - If total salary > 15,000,000 VND → REQUIRES_CFO_APPROVAL
     * - High-value salary requires executive approval
     * 
     * Knowledge Fields:
     * - salary.totalSalary (number)
     * 
     * Operators: > (comparison)
     */
    {
      id: 'payroll-high-salary-cfo',
      priority: 1,
      conditions: { 
        type: 'comparison',
        field: 'salary.totalSalary', 
        operator: '>', 
        value: 15000000 
      },
      action: {
        outcome: 'REQUIRES_CFO_APPROVAL',
        reason: 'Tổng lương vượt 15 triệu, cần CFO phê duyệt'
      }
    },

    /**
     * Rule 4: KPI Consistency Check (Priority 1 - DATA INTEGRITY)
     * 
     * Business Logic:
     * - If KPI bonus > 0 BUT sessions < 30 → DATA_ERROR
     * - Detects calculation inconsistency (KPI awarded but target not met)
     * 
     * Knowledge Fields:
     * - salary.kpiBonus (number)
     * - salary.sessionCount (number)
     * 
     * Operators: and (logical), > (comparison), < (comparison)
     */
    {
      id: 'payroll-kpi-mismatch',
      priority: 1,
      conditions: {
        type: 'operator',
        operator: 'and',
        conditions: [
          { 
            type: 'comparison',
            field: 'salary.kpiBonus', 
            operator: '>', 
            value: 0 
          },
          { 
            type: 'comparison',
            field: 'salary.sessionCount', 
            operator: '<', 
            value: 30 
          }
        ]
      },
      action: {
        outcome: 'KPI_MISMATCH',
        reason: 'KPI bonus được nhận nhưng sessions < target (lỗi dữ liệu)'
      }
    },

    /**
     * Rule 5: Low Attendance Alert (Priority 2 - INFORMATIONAL)
     * 
     * Business Logic:
     * - If base salary < 50% of raw salary AND working days < 13 → LOW_ATTENDANCE_ALERT
     * - Flags unusually low attendance for verification
     * 
     * Knowledge Fields:
     * - validation.baseSalaryPercent (number)
     * - salary.actualDays (number)
     * 
     * Operators: and (logical), < (comparison, used twice)
     */
    {
      id: 'payroll-low-attendance',
      priority: 2,
      conditions: {
        type: 'operator',
        operator: 'and',
        conditions: [
          { 
            type: 'comparison',
            field: 'validation.baseSalaryPercent', 
            operator: '<', 
            value: 50 
          },
          {
            type: 'comparison',
            field: 'salary.actualDays',
            operator: '<',
            value: 13
          }
        ]
      },
      action: {
        outcome: 'LOW_ATTENDANCE_ALERT',
        reason: 'Công < 50%, kiểm tra nghỉ việc hoặc lỗi chấm công'
      }
    }
  ]
};

