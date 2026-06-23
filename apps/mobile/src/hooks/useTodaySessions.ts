/**
 * Hook: useTodaySessions
 * Fetches today's sessions with realtime updates
 * 
 * ✅ Week 3 Fix: Added complete error handling (Loading, Error, Success states)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMobileSupabase } from '../lib/supabase';
import {
  fetchTodaySessions,
  type TodaySession,
} from '../services/dashboard/fetchTodaySessions';

export function useTodaySessions(params: {
  tenantId: string | null;
  userId: string;
  role: string;
}) {
  const [sessions, setSessions] = useState<TodaySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tenantId, userId, role } = params;

  const load = useCallback(async () => {
    if (!tenantId) {
      setSessions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchTodaySessions({ tenantId, userId, role });
      setSessions(data);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Không thể tải danh sách ca';
      setError(errorMessage);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, userId, role]);

  // Debounce ref - avoid request storm when multiple realtime events arrive
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    void load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return;
    const supabase = getMobileSupabase();
    const channel = supabase
      .channel(`today-sessions-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_logs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          // ────────────────────────────────────────────────────────────────
          // TODO Week 4-5: Replace refetch with optimistic update
          //
          // When 50 KTVs working, each INSERT → refetch all = request storm
          // Future pattern:
          //   INSERT → append item to sessions (optimistic)
          //   UPDATE status → update item in place
          //   DELETE → remove item
          //
          // Current: Debounce 500ms to group multiple events → 1 request
          // ────────────────────────────────────────────────────────────────
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            void load();
          }, 500);
        },
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [tenantId, load]);

  return { sessions, isLoading, error, refresh: load };
}
