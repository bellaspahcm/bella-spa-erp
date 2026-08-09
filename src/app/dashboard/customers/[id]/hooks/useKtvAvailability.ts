import { useState, useCallback, useMemo } from 'react';
// Inline debounce implementation to avoid lodash dependency issues
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  return debounced;
}

export interface KTVAvailabilityInfo {
  id: string;
  name: string;
  available: boolean;
  reason?: string;
  conflictType?: 'overlap' | 'break_time_violation' | 'daily_limit';
  conflictDetails?: {
    existingBookingTime?: string;
    requiredBreakMinutes?: number;
    nextAvailableTime?: string;
  };
}

export interface KTVAvailabilityResult {
  available: KTVAvailabilityInfo[];
  unavailable: KTVAvailabilityInfo[];
}

/**
 * Hook to check KTV availability when editing booking time
 * 
 * Usage:
 * ```tsx
 * const { availability, isLoading, checkAvailability } = useKtvAvailability();
 * 
 * // Trigger check when time changes
 * useEffect(() => {
 *   if (date && time) {
 *     checkAvailability({ date, time, duration: 60, excludeBookingId: booking.id });
 *   }
 * }, [date, time]);
 * ```
 */
export function useKtvAvailability() {
  const [availability, setAvailability] = useState<KTVAvailabilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(
    async (params: {
      date: string;
      time: string;
      duration?: number;
      excludeBookingId?: string;
    }) => {
      if (!params.date || !params.time) {
        setAvailability(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          date: params.date,
          time: params.time,
          duration: (params.duration || 60).toString(),
        });

        if (params.excludeBookingId) {
          searchParams.append('excludeBookingId', params.excludeBookingId);
        }

        const response = await fetch(`/api/bookings/check-ktv-availability?${searchParams.toString()}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data: KTVAvailabilityResult = await response.json();
        setAvailability(data);
      } catch (err: unknown) {
        console.error('[useKtvAvailability] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to check availability');
        setAvailability(null);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Debounced version for real-time input
  const checkAvailabilityDebounced = useMemo(
    () => debounce(checkAvailability, 500),
    [checkAvailability]
  );

  return {
    availability,
    isLoading,
    error,
    checkAvailability,
    checkAvailabilityDebounced,
  };
}
