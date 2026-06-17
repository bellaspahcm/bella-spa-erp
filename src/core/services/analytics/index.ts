/**
 * Analytics Services - Core Platform
 * 
 * Business intelligence, dashboard aggregation, and report generation services.
 * Extracted from monolithic structure to enable multi-module analytics.
 * 
 * @module core/services/analytics
 */

// Dashboard aggregation exports
export {
  type DashboardStatsViewModel,
  type DashboardAlert,
  type InventorySummaryViewModel,
  type PerformanceDataPointViewModel,
  type KtvPerformanceViewModel,
  type DashboardSessionViewModel,
  getDashboardStats,
  getUpcomingSessions,
  getDashboardInventorySummary,
  getTopTechnicians,
  getMonthlyPerformance,
  getImportantAlerts,
} from './dashboard-actions';

// Report generation and export exports
export {
  type SalaryExportSnapshot,
  type ExcelExportResult,
  type SalaryExportResult,
  type SessionMatrixRow,
  type TrialBalanceExportRow,
  type AccountingReportRecord,
  type AccountingReportData,
  exportSalaryToExcel,
  exportSalaryToExcelResult,
  exportSessionMatrixToExcel,
  exportSessionMatrixToExcelResult,
  exportAccountingReportToExcel,
  exportAccountingReportToExcelResult,
} from './export-actions';
