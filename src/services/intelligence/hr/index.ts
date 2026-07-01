/**
 * HR Intelligence Module
 * 
 * Exports all HR Intelligence query functions and types.
 * 
 * Usage:
 * ```typescript
 * import { getWorkforceAnalytics, getAttendanceReport } from '@/services/intelligence/hr';
 * 
 * const workforce = await getWorkforceAnalytics(tenantId, 'current_quarter');
 * const attendance = await getAttendanceReport(tenantId, 'current_month', ktvId);
 * ```
 */

export {
  getWorkforceAnalytics,
  getAttendanceReport,
  getPayrollSummary,
  getEmployeePerformance,
  getRecruitmentMetrics,
  getTrainingMetrics,
  getRetentionAnalysis,
  getProductivityTrends,
} from './queries';

export type {
  WorkforceAnalytics,
  AttendanceReport,
  PayrollSummary,
  EmployeePerformance,
  RecruitmentMetrics,
  TrainingMetrics,
  RetentionAnalysis,
  ProductivityTrends,
} from './queries';
