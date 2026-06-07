// Barrel for accounting server actions. Split from a 1003-LOC monolith (Sprint 1.3).
// Public API is unchanged — all original imports of '@/services/accounting-actions'
// continue to resolve. Types re-exported from the plain ./accounting/types module.

export type {
  OutboxEventWithDiagnostics,
} from './accounting/journals';

export type {
  AccountingEventTemplate,
  AccountingBackfillResult,
  AccountingDuplicateJournalReference,
  AccountingHealthAlertKind,
  AccountingHealthAlertNotificationResult,
  AccountingHealthCheck,
  AccountingHealthMetrics,
  AccountingHealthSeverity,
  AccountingHealthStatus,
  AccountingHealthSummary,
  BusinessHealthDatasetCounts,
  BusinessHealthFinding,
  BusinessHealthFindingDetail,
  BusinessHealthFindingSeverity,
  BusinessHealthGroup,
  BusinessHealthRepairAction,
  BusinessHealthRepairResult,
  BusinessHealthSeverity,
  BusinessHealthSummary,
  AccountingReadinessSummary,
  AccountingReviewItem,
  AccountingReviewResolutionStatus,
  AccountingStandardProfile,
  BusinessEventType,
  CreateAccountInput,
  LegacyLedgerSyncPreview,
  ManualJournalInput,
  ProfessionalModeReadinessGate,
  ReconciliationRow,
  SalaryReconciliationRow,
} from './accounting/types';

export {
  getAccounts, createAccount, updateAccount,
} from './accounting/coa';

export {
  assertLegacyFinanceWriteAllowed,
  getAccountingMode, getLegacyLedgerSyncPreview, getProfessionalModeReadinessGate, updateAccountingMode, syncLegacyToLedger,
} from './accounting/mode';

export {
  getJournalEntries, getJournalEntryDetails, reverseJournalEntry,
  getOutboxEvents, replayOutboxEvent, postManualJournalEntry,
} from './accounting/journals';

export {
  getAccountingPeriods, previewClosingEntries, closePeriodAction, reopenPeriodAction,
} from './accounting/periods';

export {
  getTrialBalanceReport, getIncomeStatementReport, getBalanceSheetReport,
  getAccountLedgerReport, getCashFlowStatementReport,
  getReconciliationReport, getSalaryReconciliationReport,
} from './accounting/reports';

export {
  getAccountingEventTemplates,
  getAccountingReviewQueue,
  getAccountingReadinessSummary,
  createAccountingReviewItem,
  resolveAccountingReviewItem,
  runAccountingMetadataBackfill,
  classifyAccountingSourcePreview,
} from './accounting/templates';

export {
  getAccountingHealthSummary,
  publishAccountingHealthAlertNotification,
  getMonthClosePreflight,
  assertMonthClosePreflight,
} from './accounting/health';

export {
  getBusinessHealthSummary,
  runBusinessHealthRepairAction,
} from './accounting/business-health';
