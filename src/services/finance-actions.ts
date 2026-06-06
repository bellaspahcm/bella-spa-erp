// Barrel for finance server actions. Split from a 1019-LOC monolith (Sprint 1.3).
// Public API unchanged — all imports of '@/services/finance-actions' still resolve.

export type {
  MappedTransaction, RevenueDBRow, ExpenseDBRow, KtvDBRow, SalaryRecordDBRow,
  SessionReviewDBRow, SessionLogDBRow, BookingDBRow, ServiceBookingDBRow,
} from './finance/types';

export { getFinancialOverview, confirmTransaction, recordTransaction } from './finance/transactions';
export { getMonthlyPnL, getServicePerformance } from './finance/reports';
export { getFinanceDashboardSnapshot } from './finance/dashboard-snapshot';
export type {
  FinanceDashboardSnapshot,
  FinanceDashboardSnapshotErrors,
  FinanceDashboardSnapshotResult,
} from './finance/dashboard-snapshot';
export { lockMonth, unlockMonth } from './finance/lock-month';
