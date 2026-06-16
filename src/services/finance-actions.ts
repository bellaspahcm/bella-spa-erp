// Legacy barrel export - re-exports from core
// Maintains backward compatibility for files not yet migrated

export type {
  MappedTransaction, RevenueDBRow, ExpenseDBRow, KtvDBRow, SalaryRecordDBRow,
  SessionReviewDBRow, SessionLogDBRow, BookingDBRow, ServiceBookingDBRow,
} from '@/core/services/finance/types';

export { getFinancialOverview, confirmTransaction, recordTransaction } from '@/core/services/finance/transactions';
export { getMonthlyPnL, getServicePerformance } from '@/core/services/finance/reports';
export { getFinanceDashboardSnapshot } from '@/core/services/finance/dashboard-snapshot';
export type {
  FinanceDashboardSnapshot,
  FinanceDashboardSnapshotErrors,
  FinanceDashboardSnapshotResult,
} from '@/core/services/finance/dashboard-snapshot';
export { lockMonth, unlockMonth } from '@/core/services/finance/lock-month';
