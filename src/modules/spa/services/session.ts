/**
 * Spa Session Management Service
 * 
 * Facade/wrapper for spa-specific session scheduling, tracking, and completion logic.
 * This module provides a spa-domain interface while delegating to core services.
 * 
 * @module spa/services/session
 * @see src/core/services/order - Core booking/order services
 */

import type { CoreBookingOrder } from '@/core/types';

/**
 * Session tracking and multiplier logic will be integrated here.
 * Currently acts as a placeholder facade for session-related functionality.
 */

/**
 * Calculate weighted session count based on package multipliers.
 * 
 * @param packageName - Name of the spa package
 * @param sessionCount - Raw session count
 * @returns Weighted session count (e.g., 1.0x, 1.5x, 2.0x)
 * 
 * @example
 * ```ts
 * calculateWeightedSessions('Combo Mẹ & Bé Tiết Kiệm', 10) // Returns 10.0
 * calculateWeightedSessions('Combo Mẹ & Bé Hạnh Phúc', 10) // Returns 15.0
 * calculateWeightedSessions('Combo Mẹ & Bé VIP Toàn Diện', 10) // Returns 20.0
 * ```
 */
export function calculateWeightedSessions(
  packageName: string,
  sessionCount: number
): number {
  // Package session multipliers per business rules:
  // - Basic/Tiết Kiệm: 1.0x
  // - Premium/Hạnh Phúc: 1.5x
  // - VIP/Toàn Diện: 2.0x
  
  const normalizedName = packageName.toLowerCase();
  
  if (normalizedName.includes('vip') || normalizedName.includes('toàn diện')) {
    return sessionCount * 2.0;
  }
  
  if (normalizedName.includes('hạnh phúc') || normalizedName.includes('premium')) {
    return sessionCount * 1.5;
  }
  
  // Default: basic package multiplier
  return sessionCount * 1.0;
}

/**
 * Get session completion status for a booking.
 * 
 * @param order - Core booking order
 * @returns Session completion data
 */
export function getSessionCompletionStatus(order: CoreBookingOrder): {
  completed: number;
  total: number;
  remaining: number;
  percentage: number;
} {
  const completed = (order.metadata.sessions_completed as number) || 0;
  const total = (order.metadata.sessions_total as number) || 0;
  const remaining = Math.max(0, total - completed);
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  
  return {
    completed,
    total,
    remaining,
    percentage: Math.round(percentage * 100) / 100, // Round to 2 decimals
  };
}

/**
 * Check if a booking order has remaining sessions available.
 * 
 * @param order - Core booking order
 * @returns True if sessions remain, false otherwise
 */
export function hasRemainingSessions(order: CoreBookingOrder): boolean {
  const { remaining } = getSessionCompletionStatus(order);
  return remaining > 0;
}

/**
 * Spa session service facade.
 * Future integration point for session scheduling and tracking.
 */
export const SpaSessionService = {
  calculateWeightedSessions,
  getSessionCompletionStatus,
  hasRemainingSessions,
} as const;
