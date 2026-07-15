'use client';

/**
 * useProgressiveLoad
 *
 * A reusable hook that splits page data fetching into two phases to
 * eliminate long blank-screen waits and create a snappy perceived performance:
 *
 * ─── Phase 1 (Critical) ────────────────────────────────────────────────────
 * Data that the user sees "above the fold" immediately — e.g. customer name,
 * booking cards, session list. Clears the full-page spinner as fast as possible.
 *
 * ─── Phase 2 (Secondary) ───────────────────────────────────────────────────
 * Data that enriches the page but is NOT blocking — e.g. KTV dropdown list,
 * tenant branding labels, AI suggestions, resource rooms. Loads silently in
 * the background 200 ms after Phase 1 finishes, so it never races with
 * critical requests.
 *
 * Usage:
 * ```ts
 * const { criticalReady, secondaryReady } = useProgressiveLoad({
 *   critical: async () => {
 *     const [customer, bookings] = await Promise.all([fetchCustomer(id), fetchBookings(id)]);
 *     setCustomer(customer);
 *     setBookings(bookings);
 *   },
 *   secondary: async () => {
 *     const ktvs = await fetchKtvs();
 *     setKtvs(ktvs);
 *   },
 *   secondaryDelayMs: 200, // optional (default 200 ms)
 * });
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseProgressiveLoadOptions {
  /** Critical data loader — runs immediately, clears the main spinner when done. */
  critical: () => Promise<void>;
  /** Secondary data loader — runs silently after `secondaryDelayMs`. */
  secondary?: () => Promise<void>;
  /**
   * How long to wait (ms) after the component mounts before starting the
   * secondary fetch. Gives Phase 1 a head-start on the network connection.
   * Default: 200 ms.
   */
  secondaryDelayMs?: number;
  /**
   * Dependencies array — if any value changes the entire load sequence is
   * re-triggered, identical to the second argument of `useEffect`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps?: any[];
}

interface UseProgressiveLoadResult {
  /** True once Phase 1 (critical) data has finished loading. */
  criticalReady: boolean;
  /** True once Phase 2 (secondary) data has finished loading. */
  secondaryReady: boolean;
  /** True if either phase encountered an error. */
  hasError: boolean;
  /** The error thrown by Phase 1 (if any). */
  criticalError: Error | null;
  /** The error thrown by Phase 2 (if any). */
  secondaryError: Error | null;
}

export function useProgressiveLoad({
  critical,
  secondary,
  secondaryDelayMs = 200,
  deps = [],
}: UseProgressiveLoadOptions): UseProgressiveLoadResult {
  const [criticalReady, setCriticalReady] = useState(false);
  const [secondaryReady, setSecondaryReady] = useState(!secondary); // if no secondary, instantly ready
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const [secondaryError, setSecondaryError] = useState<Error | null>(null);

  const secondaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const criticalRef = useRef(critical);
  const secondaryRef = useRef(secondary);

  // Keep refs up-to-date so the effect closure always calls the latest version
  criticalRef.current = critical;
  secondaryRef.current = secondary;

  const runLoad = useCallback(async () => {
    // Reset state for re-runs (e.g. on dep change)
    setCriticalReady(false);
    setCriticalError(null);
    setSecondaryReady(!secondaryRef.current);
    setSecondaryError(null);

    // ── Phase 1: Critical ────────────────────────────────────────────────────
    try {
      await criticalRef.current();
    } catch (err) {
      setCriticalError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setCriticalReady(true);
    }

    // ── Phase 2: Secondary (deferred) ────────────────────────────────────────
    if (!secondaryRef.current) return;

    secondaryTimerRef.current = setTimeout(async () => {
      try {
        await secondaryRef.current!();
      } catch (err) {
        setSecondaryError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setSecondaryReady(true);
      }
    }, secondaryDelayMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void runLoad();
    return () => {
      if (secondaryTimerRef.current) {
        clearTimeout(secondaryTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runLoad]);

  return {
    criticalReady,
    secondaryReady,
    hasError: criticalError !== null || secondaryError !== null,
    criticalError,
    secondaryError,
  };
}
