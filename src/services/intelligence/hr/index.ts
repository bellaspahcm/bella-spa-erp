/**
 * HR Intelligence Module
 * 
 * Exports all HR Intelligence query functions, types, and services.
 * 
 * Usage:
 * ```typescript
 * import { getHRIntelligenceService } from '@/services/intelligence/hr';
 * 
 * const hrService = getHRIntelligenceService();
 * const workforce = await hrService.getWorkforceAnalytics(tenantId, 'current_quarter');
 * const attendance = await hrService.getAttendanceReport(tenantId, 'current_month', ktvId);
 * ```
 */

// Service exports
export { HRIntelligenceService, getHRIntelligenceService } from './service';

// Query function exports
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

// Type exports
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
