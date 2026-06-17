/**
 * Spa Salary Calculation Service
 * 
 * Facade/wrapper for spa-specific KTV salary calculations.
 * Delegates to the centralized hr-salary module while providing a spa-domain interface.
 * 
 * **Important**: This module DOES NOT duplicate business logic. It re-exports
 * existing salary calculation functions to establish module boundaries per Phase 3 architecture.
 * 
 * @module spa/services/salary
 * @see src/modules/hr-salary/actions - Core salary calculation engine
 */

// Re-export core salary calculation functions
export { recalculateAndSaveSalaryRecordEngine as recalculateSpaSalary } from '@/modules/hr-salary/actions/salary-recalculation-engine';

import { calcProRataBaseSalary } from '@/modules/hr-salary/actions/base-salary-actions';
export { calcProRataBaseSalary };

import {
  calculateWeightedSessionCount,
  calculateSessionCommissionBonus,
  calculateRatingBonus,
  calculateLiveAttendanceSalaryComponents,
  buildPackageMultiplierMap,
} from '@/modules/hr-salary/actions/salary-attendance-calculation';
export {
  calculateWeightedSessionCount,
  calculateSessionCommissionBonus,
  calculateRatingBonus,
  calculateLiveAttendanceSalaryComponents,
  buildPackageMultiplierMap,
};

// Re-export admin salary actions
import {
  recalculateAndSaveSalaryRecord,
  publishSalaryRecord,
  adminConfirmOnBehalf,
  finalizeSalaryRecord,
  updateSalaryConfig,
} from '@/modules/hr-salary/actions/admin-salary-actions';
export {
  recalculateAndSaveSalaryRecord,
  publishSalaryRecord,
  adminConfirmOnBehalf,
  finalizeSalaryRecord,
  updateSalaryConfig as updateSalaryRecordManually,
};

// Re-export query actions
import {
  getSalaryData,
  getKtvSessionMatrix,
} from '@/modules/hr-salary/actions/query-salary-actions';
export {
  getSalaryData,
  getKtvSessionMatrix,
};

/**
 * Spa salary service facade.
 * 
 * This facade establishes the module boundary for spa-specific salary operations.
 * All spa components should import from this module, not directly from hr-salary.
 * 
 * @example
 * ```ts
 * import { SpaSalaryService } from '@/modules/spa/services/salary';
 * 
 * // Recalculate a KTV's salary for a given month
 * await SpaSalaryService.recalculateSalary(supabase, ktvId, monthYear, tenantId);
 * ```
 */
export const SpaSalaryService = {
  recalculateSalary: recalculateAndSaveSalaryRecord,
  publishSalary: publishSalaryRecord,
  confirmSalary: adminConfirmOnBehalf,
  finalizeSalary: finalizeSalaryRecord,
  updateSalaryManually: updateSalaryConfig,
  getSalaryData,
  getKtvSessionMatrix,
  calculateProRataBaseSalary: calcProRataBaseSalary,
  calculateWeightedSessions: calculateWeightedSessionCount,
  calculateSessionCommission: calculateSessionCommissionBonus,
  calculateRatingBonus,
} as const;

