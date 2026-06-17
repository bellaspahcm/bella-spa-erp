/**
 * Spa Session Hook
 * 
 * Custom React hook for spa-specific session tracking and management.
 * Provides session state management and completion logic.
 * 
 * @module spa/hooks/useSpaSession
 */

import { useState, useCallback } from 'react';
import type { CoreBookingOrder } from '@/core/types';
import { 
  calculateWeightedSessions, 
  getSessionCompletionStatus,
  hasRemainingSessions,
} from '@/modules/spa/services/session';

/**
 * Session tracking state.
 */
export interface SpaSessionState {
  /** Number of sessions completed */
  completed: number;
  /** Total sessions in package */
  total: number;
  /** Remaining sessions */
  remaining: number;
  /** Completion percentage (0-100) */
  percentage: number;
  /** Weighted session count (with multiplier applied) */
  weightedCompleted: number;
}

/**
 * Spa session tracking hook.
 * 
 * @param order - Booking order with session data
 * @param packageName - Package name for weighted session calculation
 * @returns Session state and operations
 * 
 * @example
 * ```tsx
 * function SessionTracker({ order }: { order: CoreBookingOrder }) {
 *   const { sessionState, canCompleteSession, markSessionComplete } = useSpaSession(
 *     order,
 *     'Combo Mẹ & Bé VIP'
 *   );
 *   
 *   return (
 *     <div>
 *       <p>Progress: {sessionState.completed} / {sessionState.total}</p>
 *       <p>Weighted: {sessionState.weightedCompleted} sessions</p>
 *       {canCompleteSession && (
 *         <button onClick={markSessionComplete}>Complete Session</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSpaSession(
  order: CoreBookingOrder | null,
  packageName?: string
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Get current session state.
   */
  const getSessionState = useCallback((): SpaSessionState | null => {
    if (!order) return null;

    const status = getSessionCompletionStatus(order);
    const weightedCompleted = packageName
      ? calculateWeightedSessions(packageName, status.completed)
      : status.completed;

    return {
      ...status,
      weightedCompleted,
    };
  }, [order, packageName]);

  /**
   * Check if session can be completed.
   */
  const canCompleteSession = useCallback((): boolean => {
    if (!order) return false;
    return hasRemainingSessions(order);
  }, [order]);

  /**
   * Mark a session as complete.
   * (Delegates to spa session service)
   */
  const markSessionComplete = useCallback(async () => {
    if (!order || !canCompleteSession()) {
      setError(new Error('Cannot complete session'));
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Call spa session service to mark session complete
      // await SpaSessionService.markComplete(order.id);
      
      console.log('[useSpaSession] Session completion not yet implemented');
      return true;
    } catch (err) {
      setError(err as Error);
      console.error('[useSpaSession] Failed to complete session:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [order, canCompleteSession]);

  /**
   * Calculate weighted sessions for a given count.
   */
  const calculateWeighted = useCallback((count: number): number => {
    if (!packageName) return count;
    return calculateWeightedSessions(packageName, count);
  }, [packageName]);

  return {
    sessionState: getSessionState(),
    isLoading,
    error,
    canCompleteSession: canCompleteSession(),
    markSessionComplete,
    calculateWeighted,
  };
}

