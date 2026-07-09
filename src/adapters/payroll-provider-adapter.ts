/**
 * Payroll Provider Adapter
 * 
 * Bridges existing salary calculation system with new Decision Engine PayrollProvider.
 * Converts current data structures to PayrollDecisionInput format.
 * 
 * USAGE:
 * ```typescript
 * const adapter = new PayrollProviderAdapter();
 * const result = await adapter.calculateSalaryComponents({
 *   tenantId: 'bella-spa',
 *   employeeId: 'emp-123',
 *   monthYear: '2026-07',
 *   sessions: [...],
 *   attendance: [...],
 *   employee: {...},
 *   config: {...}
 * });
 * 
 * // Use result in salary_records
 * await saveSalaryRecord({
 *   ...result,
 *   total_salary: baseSalary + result.net_adjustment
 * });
 * ```
 */

import { PayrollProvider } from '@/lib/decision-engine/providers/payroll';
import type {
  PayrollDecisionInput,
  PayrollDecisionOutput,
} from '@/lib/decision-engine/providers/payroll';
import type { Database } from '@/types/supabase';

// Flexible types that accept either full table rows or minimal shapes
type SessionLike = {
  id: string;
  status?: string;
  rating?: number | null;
  total_amount?: number | null;
  package_name?: string | null;
};

type AttendanceLike = {
  id: string;
  ktv_id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
  tenant_id: string;
};

type EmployeeLike = {
  id: string;
  base_salary: number | null;
  position?: string | null;
  hired_date?: string | null;
  tenant_id: string;
};

/**
 * Input for adapter (from existing system)
 * 
 * Accepts flexible data shapes from salary recalculation engine.
 * Can handle both full table rows and minimal required fields.
 */
export interface SalaryCalculationContext {
  tenantId: string;
  employeeId: string;
  monthYear: string; // YYYY-MM format
  
  /** Session records (can be session_logs or sessions table) */
  sessions: SessionLike[];
  
  /** Attendance records from attendance table */
  attendance: AttendanceLike[];
  
  /** Employee data from users table */
  employee: EmployeeLike;
  
  /** Tenant payroll configuration */
  config: {
    kpi?: {
      enabled: boolean;
      strategy: 'threshold' | 'linear' | 'tier';
      config: Record<string, any>;
    };
    attendance?: {
      enabled: boolean;
      strategy: 'late_deduction' | 'absent_deduction' | 'combined';
      config: Record<string, any>;
    };
    rating?: {
      enabled: boolean;
      strategy: 'threshold' | 'linear' | 'tier';
      config: Record<string, any>;
    };
    commission?: {
      enabled: boolean;
      strategy: 'fixed' | 'tier' | 'percentage' | 'service';
      config: Record<string, any>;
    };
  };
}

/**
 * Output for salary_records table
 */
export interface SalaryRecordComponents {
  kpi_bonus: number;
  violations_deduction: number;
  rating_bonus: number;
  session_bonus: number;
  total_bonuses: number;
  total_deductions: number;
  net_adjustment: number;
  
  /** Metadata for audit trail */
  calculation_metadata: {
    provider: string;
    matchedRules: string[];
    executionTime: number;
    confidence: number;
    timestamp: string;
  };
}

/**
 * Payroll Provider Adapter
 * 
 * Converts existing salary calculation data structures to/from PayrollProvider format.
 */
export class PayrollProviderAdapter {
  private provider: PayrollProvider;

  constructor(options?: { debug?: boolean }) {
    this.provider = new PayrollProvider(options);
  }

  /**
   * Calculate salary components using PayrollProvider
   * 
   * Main integration point between existing system and Decision Engine.
   */
  async calculateSalaryComponents(
    context: SalaryCalculationContext
  ): Promise<SalaryRecordComponents> {
    // 1. Transform context to PayrollDecisionInput
    const input = this.transformToDecisionInput(context);

    // 2. Evaluate via PayrollProvider
    const result = await this.provider.evaluate(input);

    // 3. Transform result to salary_records format
    return this.transformToSalaryRecord(result);
  }

  /**
   * Transform existing context to PayrollDecisionInput
   * @private
   */
  private transformToDecisionInput(
    context: SalaryCalculationContext
  ): PayrollDecisionInput {
    return {
      tenantId: context.tenantId,
      employeeId: context.employeeId,
      monthYear: context.monthYear,
      
      // Aggregate sessions data
      sessions: this.aggregateSessions(context.sessions),
      
      // Aggregate attendance data
      attendance: this.aggregateAttendance(context.attendance, context.monthYear),
      
      // Map employee data
      employee: {
        baseSalary: context.employee.base_salary || 0,
        position: context.employee.position || undefined,
        yearsOfService: this.calculateYearsOfService(context.employee.hired_date),
      },
      
      // Map config (already in correct format)
      config: {
        kpi: context.config.kpi
          ? {
              enabled: context.config.kpi.enabled,
              strategy: context.config.kpi.strategy,
              params: context.config.kpi.config,
            }
          : undefined,
        attendance: context.config.attendance
          ? {
              enabled: context.config.attendance.enabled,
              strategy: context.config.attendance.strategy,
              params: context.config.attendance.config,
            }
          : undefined,
        rating: context.config.rating
          ? {
              enabled: context.config.rating.enabled,
              strategy: context.config.rating.strategy,
              params: context.config.rating.config,
            }
          : undefined,
        commission: context.config.commission
          ? {
              enabled: context.config.commission.enabled,
              strategy: context.config.commission.strategy,
              params: context.config.commission.config,
            }
          : undefined,
      },
    };
  }

  /**
   * Aggregate sessions into summary data
   * @private
   */
  private aggregateSessions(sessions: SessionLike[]): {
    count: number;
    avgRating: number;
    totalRevenue: number;
    serviceTypes?: Record<string, number>;
  } {
    if (!sessions || sessions.length === 0) {
      return {
        count: 0,
        avgRating: 0,
        totalRevenue: 0,
      };
    }

    // Count completed sessions with package multipliers
    const completedSessions = sessions.filter(s => s.status === 'completed');
    
    // Sum sessions with package multipliers (if available)
    // If session has package_multiplier field, use it; otherwise default to 1.0
    const totalSessions = completedSessions.reduce((sum, session) => {
      const multiplier = (session as any).package_multiplier || 1.0;
      return sum + multiplier;
    }, 0);

    // Calculate average rating (only from rated sessions)
    const ratedSessions = completedSessions.filter(s => s.rating && s.rating > 0);
    const avgRating = ratedSessions.length > 0
      ? ratedSessions.reduce((sum, s) => sum + (s.rating || 0), 0) / ratedSessions.length
      : 0;

    // Sum total revenue
    const totalRevenue = completedSessions.reduce((sum, s) => sum + (s.total_amount || 0), 0);

    // Aggregate service types (use package_name as service type)
    const serviceTypes: Record<string, number> = {};
    completedSessions.forEach(session => {
      const serviceType = session.package_name || (session as any).service_type;
      if (serviceType) {
        serviceTypes[serviceType] = (serviceTypes[serviceType] || 0) + 1;
      }
    });

    return {
      count: totalSessions,
      avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
      totalRevenue,
      serviceTypes: Object.keys(serviceTypes).length > 0 ? serviceTypes : undefined,
    };
  }

  /**
   * Aggregate attendance into violation counts
   * @private
   */
  private aggregateAttendance(
    attendance: AttendanceLike[],
    monthYear: string
  ): {
    lateDays: number;
    absentDays: number;
    workingDays: number;
  } {
    if (!attendance || attendance.length === 0) {
      return {
        lateDays: 0,
        absentDays: 0,
        workingDays: 0,
      };
    }

    // Filter attendance for target month
    const [year, month] = monthYear.split('-').map(Number);
    const monthLogs = attendance.filter(log => {
      const logDate = new Date(log.date);
      return logDate.getFullYear() === year && logDate.getMonth() + 1 === month;
    });

    // Count violations
    const lateDays = monthLogs.filter(log => log.status === 'late').length;
    const absentDays = monthLogs.filter(log => log.status === 'absent').length;
    
    // Count working days (present + late, exclude absent)
    const workingDays = monthLogs.filter(
      log => log.status === 'present' || log.status === 'late'
    ).length;

    return {
      lateDays,
      absentDays,
      workingDays,
    };
  }

  /**
   * Calculate years of service from hired date
   * @private
   */
  private calculateYearsOfService(hiredDate: string | null): number {
    if (!hiredDate) return 0;

    const hired = new Date(hiredDate);
    const now = new Date();
    const diffYears = now.getFullYear() - hired.getFullYear();
    const monthDiff = now.getMonth() - hired.getMonth();

    // Adjust if birthday hasn't occurred this year
    return monthDiff < 0 || (monthDiff === 0 && now.getDate() < hired.getDate())
      ? diffYears - 1
      : diffYears;
  }

  /**
   * Transform PayrollDecisionOutput to salary_records format
   * @private
   */
  private transformToSalaryRecord(
    result: PayrollDecisionOutput
  ): SalaryRecordComponents {
    return {
      // Map components to salary_records columns
      kpi_bonus: result.components.kpiBonus.amount,
      violations_deduction: result.components.attendanceDeduction.amount, // Already negative
      rating_bonus: result.components.ratingBonus.amount,
      session_bonus: result.components.sessionCommission.amount,
      
      // Aggregated values
      total_bonuses: result.totalBonuses,
      total_deductions: result.totalDeductions,
      net_adjustment: result.netAdjustment,
      
      // Metadata for audit trail
      calculation_metadata: {
        provider: result.provider,
        matchedRules: result.matchedRules,
        executionTime: result.executionTime,
        confidence: result.confidence,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Validate result consistency (for migration testing)
   * 
   * Compares Decision Engine result with legacy calculation result.
   * Returns discrepancies if any.
   */
  validateAgainstLegacy(
    decisionEngineResult: SalaryRecordComponents,
    legacyResult: {
      kpi_bonus: number;
      violations_deduction: number;
      rating_bonus: number;
      session_bonus: number;
    }
  ): {
    isConsistent: boolean;
    discrepancies: Array<{
      component: string;
      legacy: number;
      decisionEngine: number;
      diff: number;
    }>;
  } {
    const discrepancies: Array<{
      component: string;
      legacy: number;
      decisionEngine: number;
      diff: number;
    }> = [];

    // Compare each component
    const components = [
      { name: 'kpi_bonus', legacy: legacyResult.kpi_bonus, de: decisionEngineResult.kpi_bonus },
      { name: 'violations_deduction', legacy: legacyResult.violations_deduction, de: decisionEngineResult.violations_deduction },
      { name: 'rating_bonus', legacy: legacyResult.rating_bonus, de: decisionEngineResult.rating_bonus },
      { name: 'session_bonus', legacy: legacyResult.session_bonus, de: decisionEngineResult.session_bonus },
    ];

    components.forEach(({ name, legacy, de }) => {
      const diff = Math.abs(legacy - de);
      if (diff > 1) { // Allow 1đ rounding difference
        discrepancies.push({
          component: name,
          legacy,
          decisionEngine: de,
          diff,
        });
      }
    });

    return {
      isConsistent: discrepancies.length === 0,
      discrepancies,
    };
  }
}

/**
 * Feature flag for gradual rollout
 */
export const USE_PAYROLL_PROVIDER = process.env.FEATURE_PAYROLL_PROVIDER === 'true';

/**
 * Helper: Calculate salary with Decision Engine (new)
 */
export async function calculateSalaryWithDecisionEngine(
  context: SalaryCalculationContext
): Promise<SalaryRecordComponents> {
  const adapter = new PayrollProviderAdapter();
  return await adapter.calculateSalaryComponents(context);
}

/**
 * Helper: Get adapter instance (singleton pattern)
 */
let adapterInstance: PayrollProviderAdapter | null = null;

export function getPayrollProviderAdapter(): PayrollProviderAdapter {
  if (!adapterInstance) {
    adapterInstance = new PayrollProviderAdapter();
  }
  return adapterInstance;
}
