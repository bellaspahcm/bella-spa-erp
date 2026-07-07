/**
 * Payroll Salary Policy Tests
 * 
 * Tests Case Study 3: Payroll DSL validation
 * 
 * Validates:
 * 1. Policy = Data (JSON-serializable)
 * 2. Knowledge = Dictionary (Record<string, unknown>)
 * 3. RuleReasoner unchanged (same engine)
 * 4. All 5 validation rules work correctly
 * 5. Beautiful boundary preserved (service computes, policy validates)
 */

import { describe, test, expect } from '@jest/globals';
import { RuleReasoner } from '@/lib/decision-engine/RuleReasoner';
import { payrollSalaryPolicyV1 } from '@/lib/decision-engine/policies/payroll-salary-v1';
import type { Knowledge } from '@/lib/decision-engine/types';

/**
 * Build mock payroll knowledge (simulates service layer output)
 */
function buildMockPayrollKnowledge(overrides: Partial<Record<string, unknown>> = {}): Knowledge {
  const defaultKnowledge: Knowledge = {
    // Salary components (normal case)
    'salary.rawBaseSalary': 6000000,
    'salary.baseSalary': 5538462,
    'salary.sessionBonus': 500000,
    'salary.ratingBonus': 465000,
    'salary.kpiBonus': 1000000,
    'salary.serviceCommission': 150000,
    'salary.productCommission': 50000,
    'salary.positionBonus': 200000,
    'salary.seniorityBonus': 600000,
    'salary.manualAdjustments': 0,
    'salary.deductions': 250000,
    'salary.advances': 0,
    'salary.totalSalary': 8253462,
    
    // Performance metrics
    'salary.sessionCount': 35,
    'salary.averageRating': 4.7,
    'salary.actualDays': 24,
    'salary.lateDays': 1,
    'salary.absentDays': 2,
    
    // Validation metrics
    'validation.deductionPercent': 4.5,
    'validation.baseSalaryPercent': 92.3,
    'validation.hasNegativeComponent': false,
    'validation.totalComponents': 8503462,
    'validation.netDeductions': 250000,
    
    // Configuration
    'config.kpiTarget': 30,
    'config.kpiBonusAmount': 1000000,
    'config.maxDeductionPercent': 30,
    'config.highSalaryThreshold': 15000000,
    
    // Employee metadata
    'employee.id': 'ktv-123',
    'employee.fullName': 'Nguyễn Văn A',
    'employee.positionTier': 'senior',
    'employee.yearsOfService': 2.5,
    'employee.isResigned': false,
    'employee.resignationDate': null,
    
    // Record metadata
    'record.status': 'draft',
    'record.monthYear': '2026-06-01',
    'record.hasManualOverrides': false,
    'record.publishedAt': null,
  };
  
  return { ...defaultKnowledge, ...overrides };
}

describe('Payroll Salary Policy v1', () => {
  const reasoner = new RuleReasoner();

  /**
   * Principle 1: Policy = Data
   * Policy must be JSON-serializable (no functions, no lambdas)
   */
  test('Principle 1: Policy is JSON-serializable (Policy = Data)', () => {
    expect(() => {
      const serialized = JSON.stringify(payrollSalaryPolicyV1);
      const deserialized = JSON.parse(serialized);
      expect(deserialized.id).toBe('payroll-salary-v1');
      expect(deserialized.rules.length).toBe(5);
    }).not.toThrow();
  });

  /**
   * Principle 2: Knowledge = Dictionary
   * Engine receives Record<string, unknown>, not typed interfaces
   */
  test('Principle 2: Knowledge is flat dictionary (Knowledge = Dictionary)', () => {
    const knowledge = buildMockPayrollKnowledge();
    
    // Verify flat structure (no nested objects at engine level)
    expect(typeof knowledge['salary.totalSalary']).toBe('number');
    expect(typeof knowledge['validation.deductionPercent']).toBe('number');
    expect(typeof knowledge['employee.isResigned']).toBe('boolean');
    
    // Verify no typed interfaces
    expect(knowledge['salary']).toBeUndefined(); // Not nested
  });

  /**
   * Principle 3: RuleReasoner unchanged
   * Same engine used for Leave, Booking, and Payroll
   */
  test('Principle 3: RuleReasoner is generic (unchanged engine)', () => {
    const knowledge = buildMockPayrollKnowledge();
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Engine can evaluate payroll policy
    expect(result).toBeDefined();
    expect(result.outcome).toBeDefined();
  });

  /**
   * Rule 1: Negative Component Detection
   */
  test('Rule 1: Negative component detected → DATA_ERROR', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.hasNegativeComponent': true,
      'salary.deductions': -100000, // Negative deduction (invalid)
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    expect(result.outcome).toBe('DATA_ERROR');
    expect(result.explanation).toContain('component âm');
  });

  test('Rule 1: No negative components → passes', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.hasNegativeComponent': false,
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Should not trigger Rule 1
    expect(result.outcome).not.toBe('DATA_ERROR');
  });

  /**
   * Rule 2: Excessive Deduction Cap
   */
  test('Rule 2: Deductions > 30% (not resigned) → EXCESSIVE_DEDUCTION', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.deductionPercent': 35.5,
      'employee.isResigned': false,
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    expect(result.outcome).toBe('EXCESSIVE_DEDUCTION');
    expect(result.explanation).toContain('30%');
  });

  test('Rule 2: Deductions > 30% but resigned → allows (no flag)', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.deductionPercent': 35.5,
      'employee.isResigned': true, // Resigned KTV → allow high deduction
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Should not trigger Rule 2
    expect(result.outcome).not.toBe('EXCESSIVE_DEDUCTION');
  });

  test('Rule 2: Deductions < 30% → passes', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.deductionPercent': 15.0,
      'employee.isResigned': false,
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Should not trigger Rule 2
    expect(result.outcome).not.toBe('EXCESSIVE_DEDUCTION');
  });

  /**
   * Rule 3: High Salary CFO Approval
   */
  test('Rule 3: Total salary > 15M → REQUIRES_CFO_APPROVAL', () => {
    const knowledge = buildMockPayrollKnowledge({
      'salary.totalSalary': 16500000,
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    expect(result.outcome).toBe('REQUIRES_CFO_APPROVAL');
    expect(result.explanation).toContain('15 triệu');
  });

  test('Rule 3: Total salary < 15M → passes', () => {
    const knowledge = buildMockPayrollKnowledge({
      'salary.totalSalary': 12000000,
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Should not trigger Rule 3
    expect(result.outcome).not.toBe('REQUIRES_CFO_APPROVAL');
  });

  /**
   * Rule 4: KPI Consistency Check
   */
  test('Rule 4: KPI bonus > 0 but sessions < 30 → KPI_MISMATCH', () => {
    const knowledge = buildMockPayrollKnowledge({
      'salary.kpiBonus': 1000000,
      'salary.sessionCount': 28, // Below target
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    expect(result.outcome).toBe('KPI_MISMATCH');
    expect(result.explanation).toContain('target');
  });

  test('Rule 4: KPI bonus > 0 and sessions >= 30 → passes', () => {
    const knowledge = buildMockPayrollKnowledge({
      'salary.kpiBonus': 1000000,
      'salary.sessionCount': 35, // Meets target
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Should not trigger Rule 4
    expect(result.outcome).not.toBe('KPI_MISMATCH');
  });

  test('Rule 4: No KPI bonus → passes (even if sessions < 30)', () => {
    const knowledge = buildMockPayrollKnowledge({
      'salary.kpiBonus': 0,
      'salary.sessionCount': 20, // Below target but no bonus claimed
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Should not trigger Rule 4 (consistent: no bonus, low sessions)
    expect(result.outcome).not.toBe('KPI_MISMATCH');
  });

  /**
   * Rule 5: Low Attendance Alert
   */
  test('Rule 5: Base salary < 50% and days < 13 → LOW_ATTENDANCE_ALERT', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.baseSalaryPercent': 45.0,
      'salary.actualDays': 12,
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    expect(result.outcome).toBe('LOW_ATTENDANCE_ALERT');
    expect(result.explanation).toContain('50%');
  });

  test('Rule 5: Base salary < 50% but days >= 13 → passes', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.baseSalaryPercent': 45.0,
      'salary.actualDays': 15, // Enough days worked
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Should not trigger Rule 5
    expect(result.outcome).not.toBe('LOW_ATTENDANCE_ALERT');
  });

  test('Rule 5: Base salary >= 50% → passes (even if days < 13)', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.baseSalaryPercent': 92.3,
      'salary.actualDays': 10, // Low days but prorata is normal
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Should not trigger Rule 5
    expect(result.outcome).not.toBe('LOW_ATTENDANCE_ALERT');
  });

  /**
   * Priority Order Test
   * Lower priority (0) should match before higher priority (1, 2, 3)
   */
  test('Priority: Rule 1 (priority 0) blocks before Rule 3 (priority 1)', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.hasNegativeComponent': true, // Rule 1 trigger
      'salary.totalSalary': 20000000, // Rule 3 trigger (but should not reach)
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Rule 1 should match first (priority 0 < 1)
    expect(result.outcome).toBe('DATA_ERROR');
  });

  test('Priority: Rule 2 (priority 0) blocks before Rule 4 (priority 1)', () => {
    const knowledge = buildMockPayrollKnowledge({
      'validation.deductionPercent': 35.0, // Rule 2 trigger
      'employee.isResigned': false,
      'salary.kpiBonus': 1000000, // Rule 4 trigger
      'salary.sessionCount': 28,
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // Rule 2 should match first (priority 0 < 1)
    expect(result.outcome).toBe('EXCESSIVE_DEDUCTION');
  });

  /**
   * Normal Salary Validation
   * Salary that passes all rules (no anomalies)
   */
  test('Normal salary: All rules pass (no flags)', () => {
    const knowledge = buildMockPayrollKnowledge({
      // All normal values (default mock)
      'validation.hasNegativeComponent': false,
      'validation.deductionPercent': 4.5,
      'salary.totalSalary': 8253462,
      'salary.kpiBonus': 1000000,
      'salary.sessionCount': 35,
      'validation.baseSalaryPercent': 92.3,
      'salary.actualDays': 24,
    });
    
    const result = reasoner.evaluate(payrollSalaryPolicyV1, knowledge);
    
    // No rules should trigger (all validations pass)
    expect(result.outcome).not.toBe('DATA_ERROR');
    expect(result.outcome).not.toBe('EXCESSIVE_DEDUCTION');
    expect(result.outcome).not.toBe('REQUIRES_CFO_APPROVAL');
    expect(result.outcome).not.toBe('KPI_MISMATCH');
    expect(result.outcome).not.toBe('LOW_ATTENDANCE_ALERT');
  });
});

