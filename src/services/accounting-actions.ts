// Barrel for accounting server actions. Split from a 1003-LOC monolith (Sprint 1.3).
// Public API is unchanged — all original imports of '@/services/accounting-actions'
// continue to resolve. Types re-exported from the plain ./accounting/types module.

export type {
  AccountingEventTemplate,
  AccountingReadinessSummary,
  AccountingReviewItem,
  AccountingStandardProfile,
  BusinessEventType,
  CreateAccountInput,
  ManualJournalInput,
  ReconciliationRow,
  SalaryReconciliationRow,
} from './accounting/types';

export {
  getAccounts, createAccount, updateAccount,
} from './accounting/coa';

export {
  getAccountingMode, updateAccountingMode, syncLegacyToLedger,
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
  classifyAccountingSourcePreview,
} from './accounting/templates';
