import { checkHqAuth, getConsolidatedPnLReport } from '@/services/hq-actions';
import { redirect } from 'next/navigation';
import FinancialOverviewClient from './financial-overview-client';

type ConsolidatedPnLRow = Awaited<ReturnType<typeof getConsolidatedPnLReport>>[number];

export const metadata = {
  title: 'Bella Spa HQ — Tổng quan Tài chính Toàn Network',
  description: 'So sánh hiệu quả kinh doanh các chi nhánh trong hệ thống Bella Spa.',
};

export default async function HqFinancialOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const auth = await checkHqAuth();
  if (!auth.authorized || !auth.user) {
    redirect('/dashboard');
  }

  // Default: current month
  const params = await searchParams;
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const fromDate = params.from || firstOfMonth;
  const toDate = params.to || todayStr;

  let pnlRows: ConsolidatedPnLRow[] = [];
  let errorMessage: string | null = null;

  try {
    pnlRows = await getConsolidatedPnLReport(fromDate, toDate);
  } catch (err: unknown) {
    const error = err as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      name?: unknown;
      stack?: unknown;
    };
    // Supabase PostgrestError serializes poorly through console.error — destructure explicitly
    const fullError = {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      name: error.name,
      stack: typeof error.stack === 'string' ? error.stack.split('\n').slice(0, 3).join('\n') : undefined,
    };
    console.error('[HqFinancialOverview] Error loading consolidated P&L:', JSON.stringify(fullError, null, 2));
    errorMessage = (typeof error.message === 'string' ? error.message : null)
      || (typeof error.details === 'string' ? error.details : null)
      || (typeof error.hint === 'string' ? error.hint : null)
      || (typeof err === 'string' ? err : null)
      || 'Không thể tải báo cáo P&L tổng hợp. Xem terminal server để biết chi tiết.';
  }

  return (
    <FinancialOverviewClient
      initialRows={pnlRows}
      initialFromDate={fromDate}
      initialToDate={toDate}
      errorMessage={errorMessage}
    />
  );
}
