'use server';

import {
  getImportantAlerts,
  type DashboardAlert,
} from '@/core/services/analytics/dashboard-actions';

export async function getDashboardWidgetAlerts(): Promise<DashboardAlert[]> {
  try {
    return await getImportantAlerts();
  } catch (error) {
    console.warn('Dashboard widget alerts are temporarily unavailable:', error);
    return [];
  }
}
