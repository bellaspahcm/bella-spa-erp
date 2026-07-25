/**
 * Base Salary Provider
 * 
 * Calculates employee base salary using rule-based evaluation.
 * Handles: full month, pro-rata, resignation cap, position adjustments, etc.
 * 
 * This provider demonstrates the Plugin Architecture pattern:
 * - Independent evaluation (no dependencies on other providers)
 * - Returns SalaryComponent (not raw calculation)
 * - Full audit trail (matchedRules, observability)
 * - Reusable across industries
 */

import {
  type SalaryComponent,
  type ProviderEvaluationOptions,
  type PayrollProvider,
  createSalaryComponent,
} from '@/lib/decision-engine/types/payroll-types';
import type { PayrollDecisionContext, EmployeeData, AttendanceData } from '@/lib/decision-engine/types/decision-context';

/**
 * Base Salary Provider
 * 
 * Evaluates base salary rules and returns calculated component.
 * 
 * @example
 * ```typescript
 * const provider = new BaseSalaryProvider();
 * 
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   userId: 'ktv-001',
 *   timestamp: '2026-06-01T00:00:00Z',
 *   monthYear: '2026-06-01',
 *   employee: {
 *     id: 'ktv-001',
 *     fullName: 'Nguyễn Văn A',
 *     baseSalary: 8000000,
 *     positionTier: 'senior',
 *     contractType: 'full-time',
 *     status: 'active',
 *     hireDate: '2023-01-01',
 *     resignationDate: null,
 *   },
 *   attendance: {
 *     totalDays: 26,
 *     presentDays: 20,
 *     lateDays: 0,
 *     absentDays: 0,
 *     halfDays: 0,
 *   },
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'base-salary',
 * //   eligible: true,
 * //   amount: 6153846,
 * //   reason: 'Pro-rata: 20/26 days × 8,000,000đ',
 * //   metadata: { workingDays: 20, fullSalary: 8000000 }
 * // }
 * ```
 */
export class BaseSalaryProvider implements PayrollProvider<SalaryComponent> {
  readonly name = 'BaseSalaryProvider';
  readonly decisionType = 'base-salary';

  /**
   * Evaluate base salary for the given context
   * 
   * Algorithm:
   * 1. Find matching calculation rule (full-month / pro-rata / resignation)
   * 2. Calculate base amount
   * 3. Apply adjustments (position, contract, probation)
   * 4. Apply constraints (min floor, max cap)
   * 5. Return SalaryComponent with full audit trail
   */
  async evaluate(
    context: PayrollDecisionContext,
    options?: ProviderEvaluationOptions
  ): Promise<SalaryComponent> {
    const { employee, attendance, monthYear, tenantConfig, overrides } = context;

    // Check if override amount provided
    if (options?.applyOverrides && overrides?.baseSalary !== undefined) {
      return createSalaryComponent('base-salary', {
        eligible: true,
        amount: overrides.baseSalary,
        reason: 'Manual override applied',
        metadata: {
          override: true,
          originalAmount: employee.baseSalary,
        },
      });
    }

    // Step 1: Determine calculation type and calculate base amount
    const calculationResult = await this.calculateBaseAmount(
      employee,
      attendance,
      monthYear,
      tenantConfig
    );

    if (!calculationResult.eligible) {
      return calculationResult;
    }

    let finalAmount = calculationResult.amount;
    const adjustments: string[] = [];
    let reason = calculationResult.reason;

    // Step 2: Apply position multiplier (if applicable)
    if (employee.positionTier && employee.positionTier !== 'junior') {
      const multipliers = { junior: 1.0, senior: 1.2, lead: 1.5, manager: 2.0 };
      const multiplier = multipliers[employee.positionTier] || 1.0;
      
      if (multiplier !== 1.0) {
        finalAmount = finalAmount * multiplier;
        adjustments.push(`Position ${employee.positionTier} (${multiplier}x)`);
      }
    }

    // Step 3: Apply contract type adjustment (if applicable)
    if (employee.contractType && employee.contractType !== 'full-time') {
      const multipliers = { 'full-time': 1.0, 'part-time': 0.5, contract: 0.8, intern: 0.6 };
      const multiplier = multipliers[employee.contractType] || 1.0;
      
      if (multiplier !== 1.0) {
        finalAmount = finalAmount * multiplier;
        adjustments.push(`Contract ${employee.contractType} (${multiplier}x)`);
      }
    }

    // Step 4: Apply probation discount (if applicable)
    if (employee.status === 'probation' && employee.probationEndDate) {
      const probationEnd = new Date(employee.probationEndDate);
      const monthDate = new Date(monthYear);
      
      if (monthDate < probationEnd) {
        finalAmount = finalAmount * 0.85;
        adjustments.push('Probation period (85%)');
      }
    }

    // Step 5: Apply min floor constraint
    if (tenantConfig?.minBaseSalary && finalAmount < tenantConfig.minBaseSalary) {
      adjustments.push(`Min floor applied (${tenantConfig.minBaseSalary.toLocaleString('vi-VN')}đ)`);
      finalAmount = tenantConfig.minBaseSalary;
    }

    // Step 6: Apply max cap constraint
    if (tenantConfig?.maxBaseSalary && finalAmount > tenantConfig.maxBaseSalary) {
      adjustments.push(`Max cap applied (${tenantConfig.maxBaseSalary.toLocaleString('vi-VN')}đ)`);
      finalAmount = tenantConfig.maxBaseSalary;
    }

    // Build final reason
    if (adjustments.length > 0) {
      reason += ` | Adjustments: ${adjustments.join(', ')}`;
    }

    return createSalaryComponent('base-salary', {
      eligible: true,
      amount: Math.round(finalAmount),
      reason,
      metadata: {
        ...calculationResult.metadata, // Preserve calculation type and other metadata
        baseCalculation: calculationResult.amount,
        adjustments: adjustments.length > 0 ? adjustments : undefined,
        finalAmount: Math.round(finalAmount),
      },
    });
  }

  /**
   * Calculate base amount (Step 1)
   * Determines: full month, pro-rata, or resignation cap
   * @private
   */
  private async calculateBaseAmount(
    employee: EmployeeData,
    attendance: AttendanceData | undefined,
    monthYear: string,
    _tenantConfig: PayrollDecisionContext['tenantConfig']
  ): Promise<SalaryComponent> {
    const baseSalary = employee.baseSalary || 0;

    if (baseSalary <= 0) {
      return createSalaryComponent('base-salary', {
        eligible: false,
        amount: 0,
        reason: 'No base salary configured for employee',
      });
    }

    // Check resignation cap first (highest priority after base check)
    if (employee.resignationDate) {
      const resignDate = new Date(employee.resignationDate);
      const monthDate = new Date(monthYear);
      
      // Check if resignation is in the calculation month
      if (
        resignDate.getFullYear() === monthDate.getFullYear() &&
        resignDate.getMonth() === monthDate.getMonth()
      ) {
        const dayOfResignation = resignDate.getDate();
        const proRatedAmount = (baseSalary / 26) * dayOfResignation;
        
        return createSalaryComponent('base-salary', {
          eligible: true,
          amount: Math.round(proRatedAmount),
          reason: `Resignation cap: ${dayOfResignation}/26 days × ${baseSalary.toLocaleString('vi-VN')}đ (Resigned ${resignDate.toLocaleDateString('vi-VN')})`,
          metadata: {
            calculationType: 'resignation-cap',
            dayOfResignation,
            fullSalary: baseSalary,
          },
        });
      }
    }

    // Check for full month (26 days present)
    if (attendance && attendance.presentDays >= 26) {
      return createSalaryComponent('base-salary', {
        eligible: true,
        amount: baseSalary,
        reason: `Full month: ${baseSalary.toLocaleString('vi-VN')}đ (${attendance.presentDays}/26 days)`,
        metadata: {
          calculationType: 'full-month',
          workingDays: attendance.presentDays,
          fullSalary: baseSalary,
        },
      });
    }

    // Pro-rata calculation (partial month)
    if (attendance && attendance.presentDays > 0 && attendance.presentDays < 26) {
      const proRatedAmount = (baseSalary / 26) * attendance.presentDays;
      
      return createSalaryComponent('base-salary', {
        eligible: true,
        amount: Math.round(proRatedAmount),
        reason: `Pro-rata: ${attendance.presentDays}/26 days × ${baseSalary.toLocaleString('vi-VN')}đ`,
        metadata: {
          calculationType: 'pro-rata',
          workingDays: attendance.presentDays,
          fullSalary: baseSalary,
          divisor: 26,
        },
      });
    }

    // No attendance or 0 days present
    return createSalaryComponent('base-salary', {
      eligible: false,
      amount: 0,
      reason: 'No attendance recorded for the period',
      metadata: {
        calculationType: 'no-attendance',
      },
    });
  }
}
