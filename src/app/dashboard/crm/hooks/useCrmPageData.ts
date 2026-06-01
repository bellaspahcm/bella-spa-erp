'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getBirthdayCustomers,
  getCRMStats,
  getUpcomingSessions,
  getZaloConfig,
  getZaloZnsLogs,
} from '@/services/crm-actions';
import type {
  BirthdayCustomer,
  CrmStatsSnapshot,
  CrmZaloConfig,
  UpcomingCrmSession,
  ZnsLog,
} from '../types';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Lỗi không xác định';
}
const DEFAULT_STATS: CrmStatsSnapshot = {
  totalRemindersSent: 0,
  pendingRemindersToday: 0,
  totalBirthdaysToday: 0,
  totalBirthdaysMonth: 0,
};

const DEFAULT_ZALO_CONFIG: CrmZaloConfig = {
  zalo_app_id: '',
  zalo_secret_key: '',
  zalo_oa_id: '',
  zalo_access_token: '',
  zalo_refresh_token: '',
  zalo_token_expires_at: '',
  zalo_template_reminder_id: '',
  zalo_template_birthday_id: '',
  zalo_auto_scan: true,
};

export function useCrmPageData() {
  const [stats, setStats] = useState<CrmStatsSnapshot>(DEFAULT_STATS);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingCrmSession[]>([]);
  const [birthdayCustomers, setBirthdayCustomers] = useState<BirthdayCustomer[]>([]);
  const [znsLogs, setZnsLogs] = useState<ZnsLog[]>([]);
  const [zaloConfig, setZaloConfig] = useState<CrmZaloConfig>(DEFAULT_ZALO_CONFIG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [nextStats, sessions, birthdays, logs, config] = await Promise.all([
        getCRMStats(),
        getUpcomingSessions(),
        getBirthdayCustomers(),
        getZaloZnsLogs(),
        getZaloConfig(),
      ]);

      setStats(nextStats);
      setUpcomingSessions(sessions as UpcomingCrmSession[]);
      setBirthdayCustomers(birthdays as BirthdayCustomer[]);
      setZnsLogs(logs as ZnsLog[]);
      setZaloConfig(config);
    } catch (error) {
      console.error('Error loading CRM data:', error);
      setLoadError(`Không thể tải dữ liệu CRM: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  return {
    stats,
    upcomingSessions,
    birthdayCustomers,
    znsLogs,
    zaloConfig,
    setZaloConfig,
    loading,
    loadError,
    loadData,
  };
}
