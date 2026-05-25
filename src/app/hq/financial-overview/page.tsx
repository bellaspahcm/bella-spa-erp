import { checkHqAuth, getConsolidatedPnLReport } from '@/services/hq-actions';
import { redirect } from 'next/navigation';
import FinancialOverviewClient from './financial-overview-client';

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

  let pnlRows: any[] = [];
  let errorMessage: string | null = null;

  try {
    pnlRows = await getConsolidatedPnLReport(fromDate, toDate);
  } catch (err: any) {
    // Supabase PostgrestError serializes poorly through console.error — destructure explicitly
    const fullError = {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
      name: err?.name,
      stack: err?.stack?.split('\n').slice(0, 3).join('\n'),
    };
    console.error('[HqFinancialOverview] Error loading consolidated P&L:', JSON.stringify(fullError, null, 2));
    errorMessage = err?.message
      || err?.details
      || err?.hint
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
