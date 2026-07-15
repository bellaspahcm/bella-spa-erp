'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import {
  getCachedBookingPageResources,
  getCachedBookingPageUsers,
  getCachedBookingsForPage,
} from '@/lib/bookings-page-client-cache';
import { createClient } from '@/lib/supabase-client';
import { getCalendarSessions, getSessionLogs } from '@/core/services/order';
import type { Database } from '@/types/database.types';

import type { BookingOption } from '../components/BookingCreateScheduleModal';
import type { KtvOption, SessionHistoryItem } from '../components/BookingDayDetailModal';
import type { TimelineSession } from '../components/BookingsTimelineGrid';

type BookingResourceRow = Database['public']['Tables']['booking_resources']['Row'];

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
  const [bookingResources, setBookingResources] = useState<BookingResourceRow[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const sessionsReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bookingsReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const fetchAllBookings = useCallback(async (options: { force?: boolean } = {}) => {
    try {
      const data = await getCachedBookingsForPage(options);
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

  const fetchKtvs = useCallback(async (options: { force?: boolean } = {}) => {
    const data = await getCachedBookingPageUsers(options);
    setKtvs(data.filter((user: KtvOption & { role?: string | null }) => user.role?.toLowerCase() === 'ktv'));
  }, []);

  const fetchBookingResources = useCallback(async (options: { force?: boolean } = {}) => {
    // Fetch booking resources for all modules that need resource management
    const result = await getCachedBookingPageResources(options);
    if (result.success) {
      setBookingResources(result.data);
      return;
    }

    console.error('Error fetching booking resources:', result.error);
    setBookingResources([]);
  }, []);

  const fetchSessionHistory = useCallback(async (bookingId: string) => {
    const data = await getSessionLogs(bookingId);
    setSessionHistory((data || []).slice().sort((a, b) => (b.session_number || 0) - (a.session_number || 0)));
  }, []);

  const refreshBookingsPage = useCallback(async () => {
    await Promise.all([
      fetchSessions(),
      fetchAllBookings({ force: true }),
      fetchKtvs({ force: true }),
      fetchBookingResources({ force: true }),
      refreshTenantModuleKey(),
    ]);
  }, [fetchAllBookings, fetchBookingResources, fetchKtvs, fetchSessions, refreshTenantModuleKey]);

  const scheduleSessionsReload = useCallback(() => {
    if (sessionsReloadTimerRef.current) {
      clearTimeout(sessionsReloadTimerRef.current);
    }

    sessionsReloadTimerRef.current = setTimeout(() => {
      void fetchSessions();
    }, 400);
  }, [fetchSessions]);

  const scheduleBookingsReload = useCallback(() => {
    if (bookingsReloadTimerRef.current) {
      clearTimeout(bookingsReloadTimerRef.current);
    }

    bookingsReloadTimerRef.current = setTimeout(() => {
      void fetchAllBookings({ force: true });
    }, 400);
  }, [fetchAllBookings]);

  // ─── Progressive load ──────────────────────────────────────────────────────
  // Phase 1 (Critical): calendar sessions — the main visual grid.
  //   Runs immediately so the calendar is interactive within ~1-2 s.
  // Phase 2 (Secondary): bookings list + KTV dropdown + room resources.
  //   Loads silently 200 ms after Phase 1 so it never competes with sessions.
  useEffect(() => {
    // Phase 1 — calendar sessions (visible above the fold)
    void fetchSessions();
    void refreshTenantModuleKey();

    // Phase 2 — secondary data, deferred to give Phase 1 a head-start
    const secondaryTimer = setTimeout(() => {
      void fetchAllBookings();
      void fetchKtvs();
      void fetchBookingResources();
    }, 200);

    return () => clearTimeout(secondaryTimer);
  }, [fetchSessions, fetchAllBookings, fetchKtvs, fetchBookingResources, refreshTenantModuleKey]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        scheduleSessionsReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        scheduleBookingsReload();
        scheduleSessionsReload();
      })
      .subscribe();

    return () => {
      if (sessionsReloadTimerRef.current) {
        clearTimeout(sessionsReloadTimerRef.current);
      }
      if (bookingsReloadTimerRef.current) {
        clearTimeout(bookingsReloadTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [scheduleBookingsReload, scheduleSessionsReload]);

  return {
    sessions,
    allBookings,
    isSyncing,
    ktvs,
    bookingResources,
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
