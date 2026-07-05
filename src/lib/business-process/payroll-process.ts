/**
 * Payroll Business Process
 * 
 * Composes multiple policy providers to calculate employee salary:
 * 1. Base Salary Policy - pro-rata, position adjustments
 * 2. Compensation Policy - rewards (activity, value, sales)
 * 3. Attendance Policy - penalties for late/absent
 * 4. Constraint Policy - min floor, max cap
 * 
 * This is the FIRST business process implementation proving that
 * Bella EIP uses policy composition, not monolithic modules.
 */

import { BaseBusinessProcess } from './executor';
import type { ProcessConfig, PayrollProcessResult, PolicyExecutionResult } from './types';
import type { PayrollDecisionContext } from '@/lib/decision-engine/types/decision-context';
import type { PayrollProvider, SalaryComponent, SalaryComponentType, SalaryDeductionType } from '@/lib/decision-engine/types/payroll-types';
import { BaseSalaryProvider } from '@/services/providers/base-salary-provider';
import { CompensationProvider } from '@/services/providers/compensation-provider';

/**
 * Payroll Business Process
 * 
 * Demonstrates how a business process is composed from independent policies.
 * 
 * Key Insights:
 * - NOT a "Payroll Module"
 * - NOT a "Payroll Engine"
 * - It's a **composition of policies**
 * 
 * Same pattern will apply to:
 * - Booking Process (Eligibility + Recommendation + Approval)
 * - Procurement Process (Validation + Approval + Escalation)
 * - Manufacturing Process (Validation + Reward + Penalty)
 */
export class PayrollProcess extends BaseBusinessProcess<
  PayrollDecisionContext,
  PayrollProcessResult
> {
  config: ProcessConfig = {
    name: 'PayrollProcess',
    version: '1.0.0',
    executionMode: 'parallel', // Policies are independent, run in parallel
    continueOnFailure: true, // Continue even if one policy fails
    timeout: 5000, // 5 second timeout
  };

  policies: PayrollProvider<SalaryComponent>[] = [
    new BaseSalaryProvider(),
    new CompensationProvider(),
    // TODO: Add AttendanceProvider (Penalty Policy)
    // TODO: Add ConstraintProvider
  ];

  /**
   * Aggregate policy results into final payroll result
   * 
   * This is where we combine:
   * - Base Salary
   * + Compensation (Rewards)
   * - Penalties
   * + Adjustments
   * = Total Salary
   */
  protected async aggregate(
    context: PayrollDecisionContext,
    policyResults: PolicyExecutionResult[]
  ): Promise<PayrollProcessResult> {
    // Extract salary components from successful policies
    const components: SalaryComponent[] = [];
    
    let baseSalary = 0;
    let compensation = 0;
    let penalties = 0;
    let adjustments = 0;

    for (const result of policyResults) {
      if (result.status === 'success' && result.data) {
        const component = result.data as SalaryComponent;
        components.push(component);

        // Only include eligible components in the total
        if (!component.eligible) {
          continue;
        }

        // Categorize by component type (not policyType!)
        // component.type comes from createSalaryComponent('xxx', ...)
        // Note: TypeScript narrowing - deduction types vs earning types
        switch (component.type as SalaryComponentType | SalaryDeductionType) {
          case 'base-salary':
            baseSalary += component.amount;
            break;
          case 'session-commission':
          case 'service-commission':
          case 'product-commission':
            compensation += component.amount;
            break;
          case 'late-penalty':
          case 'absent-penalty':
          case 'violation-deduction':
            penalties += component.amount;
            break;
          case 'manual-bonus':
          case 'position-bonus':
          case 'kpi-bonus':
            adjustments += component.amount;
            break;
          case 'manual-deduction':
            adjustments -= component.amount; // Subtract deductions from adjustments
            break;
        }
      }
    }

    // Calculate total salary
    const totalSalary = baseSalary + compensation - penalties + adjustments;

    return {
      employeeId: context.employee.id,
      monthYear: context.monthYear,
      totalSalary,
      components,
      breakdown: {
        baseSalary,
        compensation,
        penalties,
        adjustments,
      },
    };
  }
}

/**
 * Factory function for creating Payroll Process
 * 
 * Makes it easy to instantiate in different contexts.
 */
export function createPayrollProcess(): PayrollProcess {
  return new PayrollProcess();
}
