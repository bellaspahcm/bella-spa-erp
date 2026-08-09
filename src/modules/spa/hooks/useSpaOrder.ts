/**
 * Spa Order Hook
 * 
 * Custom React hook for spa-specific order operations.
 * Wraps core order services with spa-domain state management.
 * 
 * @module spa/hooks/useSpaOrder
 */

import { useState, useCallback } from 'react';
import type { CoreBookingOrder } from '@/core/types';
import type { SpaBooking } from '@/modules/spa/types/booking';
import { hasRemainingSessions, getSessionCompletionStatus } from '@/modules/spa/services/session';

/**
 * Transform CoreBookingOrder to SpaBooking with spa-specific fields.
 */
function transformToSpaBooking(coreOrder: CoreBookingOrder): SpaBooking {
  return {
    ...coreOrder,
    sessionsCompleted: (coreOrder.metadata.sessions_completed as number) || 0,
    sessionsTotal: (coreOrder.metadata.sessions_total as number) || 0,
    assignedKtvId: (coreOrder.metadata.assigned_ktv_id as string) || '',
    packageCategory: (coreOrder.metadata.package_category as string) || 'basic',
  };
}

/**
 * Spa order state management hook.
 * 
 * @returns Order state and operations
 * 
 * @example
 * ```tsx
 * function SpaOrderForm() {
 *   const { order, isLoading, updateOrder, completeSession } = useSpaOrder();
 *   
 *   return (
 *     <div>
 *       <p>Sessions: {order?.sessionsCompleted} / {order?.sessionsTotal}</p>
 *       <button onClick={completeSession}>Complete Session</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSpaOrder(initialOrder?: CoreBookingOrder | null) {
  const [order, setOrder] = useState<SpaBooking | null>(
    initialOrder ? transformToSpaBooking(initialOrder) : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Update order state.
   */
  const updateOrder = useCallback((newOrder: CoreBookingOrder) => {
    setOrder(transformToSpaBooking(newOrder));
  }, []);

  /**
   * Get session completion status for current order.
   */
  const getSessionStatus = useCallback(() => {
    if (!order) return null;
    return getSessionCompletionStatus(order as CoreBookingOrder);
  }, [order]);

  /**
   * Check if order has remaining sessions.
   */
  const hasRemainingSessionsCheck = useCallback(() => {
    if (!order) return false;
    return hasRemainingSessions(order as CoreBookingOrder);
  }, [order]);

  /**
   * Complete a session for the current order.
   * (Business logic delegated to spa services)
   */
  const completeSession = useCallback(async () => {
    if (!order) {
      setError(new Error('No order available'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Call spa session service to complete session
      // const updatedOrder = await SpaSessionService.completeSession(order.id);
      // updateOrder(updatedOrder);
      
      console.log('[useSpaOrder] Session completion not yet implemented');
    } catch (err: unknown) {
      setError(err as Error);
      console.error('[useSpaOrder] Failed to complete session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [order]);

  return {
    order,
    isLoading,
    error,
    updateOrder,
    getSessionStatus,
    hasRemainingSessions: hasRemainingSessionsCheck,
    completeSession,
  };
}

