// Barrel for CRM server actions. Split from a 942-LOC monolith (Sprint 1.3).
// Public API unchanged — all imports of '@/services/crm-actions' still resolve.

export type { CRMStats, ZaloConfig } from './crm/types';

export { getCRMStats, getUpcomingSessions } from './crm/stats';
export { getZaloConfig, saveZaloConfig, getOrRefreshZaloToken, getZaloZnsLogs } from './crm/zalo-config';
export { sendZaloZNS, triggerZaloReminder, triggerBatchReminders } from './crm/zalo-messaging';
export { getBirthdayCustomers, sendBirthdayGreeting } from './crm/campaigns';
