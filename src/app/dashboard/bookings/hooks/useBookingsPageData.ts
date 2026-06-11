'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { createClient } from '@/lib/supabase-client';
import { getBookings } from '@/modules/booking/actions/lifecycle-actions';
import { getCalendarSessions, getSessionLogs } from '@/modules/booking/actions/session-actions';
import { getUsers } from '@/services/user-actions';

import type { BookingOption } from '../components/BookingCreateScheduleModal';
import type { KtvOption, SessionHistoryItem } from '../components/BookingDayDetailModal';
import type { TimelineSession } from '../components/BookingsTimelineGrid';

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCalendarSessionRange(currentMonth: Date) {
  const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  startDate.setDate(startDate.getDate() - 7);

  const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  endDate.setDate(endDate.getDate() + 7);

  return {
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
  };
}

export function useBookingsPageData(currentMonth: Date) {
  const [sessions, setSessions] = useState<TimelineSession[]>([]);
  const [allBookings, setAllBookings] = useState<BookingOption[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ktvs, setKtvs] = useState<KtvOption[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const sessionsReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calendarSessionRange = useMemo(
    () => getCalendarSessionRange(currentMonth),
    [currentMonth]
  );
  const {
    tenantModuleKey,
    isTenantModuleLoading,
    tenantModuleError,
    refreshTenantModuleKey,
  } = useTenantModuleKey();

  const fetchAllBookings = useCallback(async () => {
    try {
      const data = await getBookings();
      setAllBookings(data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setAllBookings([]);
      toast.error('Khong the tai danh sach booking');
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await getCalendarSessions(calendarSessionRange);
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [calendarSessionRange]);

  const fetchKtvs = useCallback(async () => {
    const data = await getUsers();
    setKtvs(data.filter((user: KtvOption & { role?: string | null }) => user.role?.toLowerCase() === 'ktv'));
  }, []);

  const fetchSessionHistory = useCallback(async (bookingId: string) => {
    const data = await getSessionLogs(bookingId);
    setSessionHistory((data || []).slice().sort((a, b) => (b.session_number || 0) - (a.session_number || 0)));
  }, []);

  const refreshBookingsPage = useCallback(async () => {
    await Promise.all([fetchSessions(), fetchAllBookings(), fetchKtvs(), refreshTenantModuleKey()]);
  }, [fetchAllBookings, fetchKtvs, fetchSessions, refreshTenantModuleKey]);

  const scheduleSessionsReload = useCallback(() => {
    if (sessionsReloadTimerRef.current) {
      clearTimeout(sessionsReloadTimerRef.current);
    }

    sessionsReloadTimerRef.current = setTimeout(() => {
      void fetchSessions();
    }, 400);
  }, [fetchSessions]);

  useEffect(() => {
    void Promise.all([fetchSessions(), fetchKtvs(), refreshTenantModuleKey()]);
  }, [fetchKtvs, fetchSessions, refreshTenantModuleKey]);

  useEffect(() => {
    void fetchAllBookings();
  }, [fetchAllBookings]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        scheduleSessionsReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        void fetchAllBookings();
        scheduleSessionsReload();
      })
      .subscribe();

    return () => {
      if (sessionsReloadTimerRef.current) {
        clearTimeout(sessionsReloadTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [fetchAllBookings, scheduleSessionsReload]);

  return {
    sessions,
    allBookings,
    isSyncing,
    ktvs,
    sessionHistory,
    tenantModuleKey,
    isTenantModuleLoading,
    tenantModuleError,
    fetchSessions,
    fetchAllBookings,
    fetchSessionHistory,
    refreshBookingsPage,
  };
}
