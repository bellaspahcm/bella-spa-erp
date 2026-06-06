'use server';

import { getMonthlyPnL, getServicePerformance } from './reports';
import { getFinancialOverview } from './transactions';

type FinancialOverview = Awaited<ReturnType<typeof getFinancialOverview>>;
type MonthlyPnL = Awaited<ReturnType<typeof getMonthlyPnL>>;
type ServicePerformance = Awaited<ReturnType<typeof getServicePerformance>>;

export type FinanceDashboardSnapshot = {
  overview: FinancialOverview;
  monthlyPnl: MonthlyPnL | null;
  servicePerformance: ServicePerformance;
};

export type FinanceDashboardSnapshotErrors = Partial<{
  overview: string;
  monthlyPnl: string;
  servicePerformance: string;
}>;

export type FinanceDashboardSnapshotResult = {
  success: boolean;
  data: FinanceDashboardSnapshot;
  errors: FinanceDashboardSnapshotErrors;
};

const EMPTY_OVERVIEW: FinancialOverview = {
  totalBalance: 0,
  totalRevenueMonth: 0,
  totalExpenseMonth: 0,
  transactions: [],
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
  return fallback;
}

export async function getFinanceDashboardSnapshot(month?: string): Promise<FinanceDashboardSnapshotResult> {
  const [overviewResult, pnlResult, performanceResult] = await Promise.allSettled([
    getFinancialOverview(),
    getMonthlyPnL(month),
    getServicePerformance(),
  ]);

  const errors: FinanceDashboardSnapshotErrors = {};

  const overview =
    overviewResult.status === 'fulfilled'
      ? overviewResult.value
      : EMPTY_OVERVIEW;
  if (overviewResult.status === 'rejected') {
    errors.overview = getErrorMessage(
      overviewResult.reason,
      'Không thể tải dữ liệu tổng quan tài chính',
    );
  }

  const monthlyPnl =
    pnlResult.status === 'fulfilled'
      ? pnlResult.value
      : null;
  if (pnlResult.status === 'rejected') {
    errors.monthlyPnl = getErrorMessage(
      pnlResult.reason,
      'Không thể tải báo cáo P&L',
    );
  }

  const servicePerformance =
    performanceResult.status === 'fulfilled'
      ? performanceResult.value
      : [];
  if (performanceResult.status === 'rejected') {
    errors.servicePerformance = getErrorMessage(
      performanceResult.reason,
      'Không thể tải phân tích hiệu quả dịch vụ',
    );
  }

  return {
    success: Object.keys(errors).length === 0,
    data: {
      overview,
      monthlyPnl,
      servicePerformance,
    },
    errors,
  };
}
