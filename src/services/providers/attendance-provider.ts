/**
 * Attendance Provider (Configuration-Driven)
 * 
 * Calculates attendance-based deductions (late penalties, absent penalties).
 * Supports multiple strategies:
 * - Late Deduction: Penalty for late arrivals (with grace period)
 * - Absent Deduction: Penalty for absences
 * - Combined: Both late and absent penalties
 * 
 * CONFIGURATION-DRIVEN ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────┐
 * │  Tenant Config (JSONB)  →  Strategy Selection  →  Logic │
 * │  ────────────────────────────────────────────────────── │
 * │  Provider reads config from PayrollConfigService        │
 * │  Selects strategy dynamically based on config           │
 * │  Executes calculation using strategy parameters         │
 * └─────────────────────────────────────────────────────────┘
 * 
 * CROSS-INDUSTRY ABSTRACTION:
 * - Spa: Late = -50k, Absent = -200k
 * - Retail: Late = -30k, Absent = -150k
 * - Manufacturing: Late = -100k, Absent = -300k
 * - Office: Late = -0 (flexible), Absent = -1 day salary
 * 
 * This provider does NOT know about "Spa" or "Retail".
 * It reads generic config and applies universal attendance logic.
 */

import {
  type SalaryComponent,
  type ProviderEvaluationOptions,
  type PayrollProvider,
  createSalaryComponent,
} from '@/lib/decision-engine/types/payroll-types';
import type { PayrollDecisionContext } from '@/lib/decision-engine/types/decision-context';
import { PayrollConfigService } from '@/services/payroll-config.service';
import type { AttendanceConfig, AttendanceDeductionConfig, ProviderConfig } from '@/types/payroll-config';

/**
 * Attendance Provider
 * 
 * Evaluates attendance-based deductions using tenant configuration.
 * 
 * @example Spa with Late Deduction Strategy
 * ```typescript
 * // Tenant config (stored in database):
 * {
 *   provider_key: 'attendance',
 *   enabled: true,
 *   strategy: 'late_deduction',
 *   config: {
 *     latePenalty: 50000,
 *     lateGracePeriod: 15,
 *     absentPenalty: 200000
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   attendance: {
 *     lateDays: 3,
 *     absentDays: 1
 *   },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'attendance-deduction',
 * //   eligible: true,
 * //   amount: -350000,
 * //   reason: 'Attendance deductions: 3 late × -50,000đ + 1 absent × -200,000đ = -350,000đ',
 * //   metadata: { lateDays: 3, absentDays: 1, latePenalty: 50000, absentPenalty: 200000 }
 * // }
 * ```
 */
export class AttendanceProvider implements PayrollProvider<SalaryComponent> {
  readonly name = 'AttendanceProvider';
  readonly decisionType = 'attendance-deduction';

  private configService: PayrollConfigService;

  constructor() {
    this.configService = PayrollConfigService.getInstance();
  }

  /**
   * Evaluate attendance deductions for the given context
   * 
   * Algorithm:
   * 1. Load tenant configuration from PayrollConfigService
   * 2. Check if attendance provider is enabled
   * 3. Extract attendance data (lateDays, absentDays)
   * 4. Select strategy and execute calculation
   * 5. Return SalaryComponent with negative amount (deduction)
   */
  async evaluate(
    context: PayrollDecisionContext,
    options?: ProviderEvaluationOptions
  ): Promise<SalaryComponent> {
    const { tenantId, attendance, overrides } = context;

    // Check if override amount provided
    if (options?.applyOverrides && typeof overrides?.attendanceDeduction === 'number') {
      return createSalaryComponent('attendance-deduction', {
        eligible: true,
        amount: overrides.attendanceDeduction,
        reason: 'Manual override applied',
        metadata: {
          override: true,
        },
      });
    }

    // Step 1: Load tenant configuration
    const config = (await this.configService.getProviderConfig(tenantId, 'attendance')) as unknown as ProviderConfig<AttendanceConfig>;

    // Step 2: Check if attendance provider is enabled
    if (!config.enabled) {
      return createSalaryComponent('attendance-deduction', {
        eligible: false,
        amount: 0,
        reason: 'Attendance deduction is disabled for this tenant',
        metadata: {
          configDisabled: true,
        },
      });
    }

    // Step 3: Extract attendance data
    if (!attendance) {
      return createSalaryComponent('attendance-deduction', {
        eligible: false,
        amount: 0,
        reason: 'No attendance data available',
      });
    }

    const lateDays = attendance.lateDays || 0;
    const absentDays = attendance.absentDays || 0;

    // No violations
    if (lateDays === 0 && absentDays === 0) {
      return createSalaryComponent('attendance-deduction', {
        eligible: false,
        amount: 0,
        reason: 'Perfect attendance (no late or absent days)',
        metadata: {
          lateDays: 0,
          absentDays: 0,
        },
      });
    }

    // Step 4: Select strategy and calculate deduction
    const result = this.calculateDeduction(config.strategy || 'combined', config.config, lateDays, absentDays);

    return createSalaryComponent('attendance-deduction', {
      eligible: result.eligible,
      amount: result.amount, // Negative value (deduction)
      reason: result.reason,
      metadata: {
        strategy: config.strategy,
        lateDays,
        absentDays,
        ...result.metadata,
      },
    });
  }

  /**
   * Calculate deduction based on strategy
   * @private
   */
  private calculateDeduction(
    strategy: string,
    config: AttendanceDeductionConfig,
    lateDays: number,
    absentDays: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    switch (strategy) {
      case 'late_deduction':
      case 'combined': // Default behavior includes both
        return this.calculateCombinedDeduction(config, lateDays, absentDays);
      case 'absent_deduction':
        return this.calculateAbsentOnly(config, absentDays);
      default:
        return this.calculateCombinedDeduction(config, lateDays, absentDays);
    }
  }

  /**
   * STRATEGY 1: Combined (Late + Absent)
   * Apply both late and absent penalties
   * @private
   */
  private calculateCombinedDeduction(
    config: AttendanceDeductionConfig,
    lateDays: number,
    absentDays: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    const { latePenalty, absentPenalty, lateGracePeriod } = config;

    let totalDeduction = 0;
    const deductionParts: string[] = [];

    // Late penalty
    if (lateDays > 0 && latePenalty > 0) {
      const lateDeduction = lateDays * latePenalty;
      totalDeduction += lateDeduction;
      deductionParts.push(`${lateDays} late × -${latePenalty.toLocaleString('vi-VN')}đ`);
    }

    // Absent penalty
    if (absentDays > 0 && absentPenalty > 0) {
      const absentDeduction = absentDays * absentPenalty;
      totalDeduction += absentDeduction;
      deductionParts.push(`${absentDays} absent × -${absentPenalty.toLocaleString('vi-VN')}đ`);
    }

    if (totalDeduction === 0) {
      return {
        eligible: false,
        amount: 0,
        reason: 'No deductions applied (penalties may be set to 0)',
        metadata: {
          latePenalty,
          absentPenalty,
        },
      };
    }

    const gracePeriodNote = lateGracePeriod ? ` (${lateGracePeriod}min grace period)` : '';

    return {
      eligible: true,
      amount: -totalDeduction, // Negative value
      reason: `Attendance deductions: ${deductionParts.join(' + ')} = -${totalDeduction.toLocaleString('vi-VN')}đ${gracePeriodNote}`,
      metadata: {
        latePenalty,
        absentPenalty,
        lateGracePeriod,
        lateDeduction: lateDays > 0 ? lateDays * latePenalty : 0,
        absentDeduction: absentDays > 0 ? absentDays * absentPenalty : 0,
      },
    };
  }

  /**
   * STRATEGY 2: Absent Only
   * Apply only absent penalties (ignore late)
   * @private
   */
  private calculateAbsentOnly(
    config: AttendanceDeductionConfig,
    absentDays: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    const { absentPenalty } = config;

    if (absentDays === 0) {
      return {
        eligible: false,
        amount: 0,
        reason: 'No absent days',
      };
    }

    if (absentPenalty === 0) {
      return {
        eligible: false,
        amount: 0,
        reason: 'Absent penalty is set to 0',
        metadata: {
          absentPenalty: 0,
        },
      };
    }

    const totalDeduction = absentDays * absentPenalty;

    return {
      eligible: true,
      amount: -totalDeduction, // Negative value
      reason: `Attendance deduction (absent only): ${absentDays} days × -${absentPenalty.toLocaleString('vi-VN')}đ = -${totalDeduction.toLocaleString('vi-VN')}đ`,
      metadata: {
        absentPenalty,
        absentDeduction: totalDeduction,
      },
    };
  }
}
