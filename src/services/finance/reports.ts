'use server';

import { getMonthlyPnL as getMonthlyPnLReport } from './monthly-pnl-report';
import { getServicePerformance as getServicePerformanceReport } from './service-performance-report';

export async function getMonthlyPnL(month?: string) {
  return getMonthlyPnLReport(month);
}

export async function getServicePerformance() {
  return getServicePerformanceReport();
}
