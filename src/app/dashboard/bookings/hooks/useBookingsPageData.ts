'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase-client';
import { getDefaultTenantModuleKey, type TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { getCalendarSessions } from '@/modules/booking/actions/session-actions';
import { getBookings } from '@/modules/booking/actions/lifecycle-actions';
import { getTenantSettings } from '@/services/tenant-actions';
import { getUsers } from '@/services/user-actions';

import type { KtvOption, SessionHistoryItem } from '../components/BookingDayDetailModal';
import type { BookingOption } from '../components/BookingCreateScheduleModal';
import type { TimelineSession } from '../components/BookingsTimelineGrid';

export function useBookingsPageData() {
  const [sessions, setSessions] = useState<TimelineSession[]>([]);
  const [allBookings, setAllBookings] = useState<BookingOption[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ktvs, setKtvs] = useState<KtvOption[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [tenantModuleKey, setTenantModuleKey] = useState<TenantModuleKey>('babycare');

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
      const data = await getCalendarSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const fetchKtvs = useCallback(async () => {
    const data = await getUsers();
    setKtvs(data.filter((user: KtvOption & { role?: string | null }) => user.role?.toLowerCase() === 'ktv'));
  }, []);

  const fetchSessionHistory = useCallback(async (bookingId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('session_logs')
      .select('*')
      .eq('booking_id', bookingId)
      .order('session_number', { ascending: false });

    setSessionHistory(data || []);
  }, []);

  const fetchTenantModuleKey = useCallback(async () => {
    try {
      const tenant = await getTenantSettings();
      setTenantModuleKey(getDefaultTenantModuleKey(tenant?.enabled_modules));
    } catch (error) {
      console.error('Error fetching tenant module config:', error);
      toast.error('Không thể tải cấu hình phân hệ');
      setTenantModuleKey('babycare');
    }
  }, []);

  const refreshBookingsPage = useCallback(async () => {
    await Promise.all([fetchSessions(), fetchAllBookings(), fetchKtvs(), fetchTenantModuleKey()]);
  }, [fetchAllBookings, fetchKtvs, fetchSessions, fetchTenantModuleKey]);

  useEffect(() => {
    const initializeBookingsPage = async () => {
      await refreshBookingsPage();
    };

    void initializeBookingsPage();

    const supabase = createClient();
    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        void fetchSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        void fetchAllBookings();
        void fetchSessions();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAllBookings, fetchSessions, refreshBookingsPage]);

  return {
    sessions,
    allBookings,
    isSyncing,
    ktvs,
    sessionHistory,
    tenantModuleKey,
    fetchSessions,
    fetchAllBookings,
    fetchSessionHistory,
    refreshBookingsPage,
  };
}
