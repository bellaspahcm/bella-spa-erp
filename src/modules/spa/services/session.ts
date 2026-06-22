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
import { BUSINESS_RULES } from '@bella/shared';

/**
 * Session tracking and multiplier logic will be integrated here.
 * Currently acts as a placeholder facade for session-related functionality.
 */

/**
 * Calculates weighted session count based on spa package multipliers.
 * 
 * Different spa packages have different session value multipliers for KPI and
 * salary calculations. This function applies the correct multiplier based on
 * package tier.
 * 
 * @param packageName - Name of the spa package (Vietnamese or English)
 * @param sessionCount - Raw number of sessions completed
 * @returns Weighted session count (quy đổi) with multiplier applied
 * 
 * @remarks
 * **Package Multipliers (Bella Spa):**
 * - **Basic/Tiết Kiệm**: 1.0x (standard package)
 * - **Premium/Hạnh Phúc**: 1.5x (mid-tier package)
 * - **VIP/Toàn Diện**: 2.0x (premium package)
 * 
 * **Business Logic:**
 * - Uses case-insensitive pattern matching on package name
 * - Checks for Vietnamese and English tier keywords
 * - Defaults to basic multiplier (1.0x) if tier not detected
 * - Multipliers defined in {@link BUSINESS_RULES.SESSIONS.MULTIPLIERS}
 * 
 * **Use Cases:**
 * - KPI target calculations (30 weighted sessions/month)
 * - Rating bonus calculations (multiplied by weighted sessions)
 * - Salary commission calculations
 * - Performance leaderboards
 * 
 * **Example Calculation:**
 * - KTV completes 10 VIP sessions → 10 × 2.0 = 20.0 weighted sessions
 * - KTV completes 15 Basic sessions → 15 × 1.0 = 15.0 weighted sessions
 * - Combined: 35.0 weighted sessions (exceeds 30 target for KPI bonus)
 * 
 * @example
 * ```typescript
 * // Basic package
 * calculateWeightedSessions('Combo Mẹ & Bé Tiết Kiệm', 10) // 10.0
 * 
 * // Premium package
 * calculateWeightedSessions('Combo Mẹ & Bé Hạnh Phúc', 10) // 15.0
 * 
 * // VIP package
 * calculateWeightedSessions('Combo Mẹ & Bé VIP Toàn Diện', 10) // 20.0
 * 
 * // Unknown package (defaults to basic)
 * calculateWeightedSessions('Custom Package', 10) // 10.0
 * ```
 * 
 * @see {@link BUSINESS_RULES.SESSIONS.MULTIPLIERS} for multiplier constants
 * @see {@link buildPackageMultiplierMap} for database-driven multiplier lookup
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
    return sessionCount * BUSINESS_RULES.SESSIONS.MULTIPLIERS.VIP;
  }
  
  if (normalizedName.includes('hạnh phúc') || normalizedName.includes('premium')) {
    return sessionCount * BUSINESS_RULES.SESSIONS.MULTIPLIERS.HAPPY;
  }
  
  // Default: basic package multiplier
  return sessionCount * BUSINESS_RULES.SESSIONS.MULTIPLIERS.BASIC;
}

/**
 * Gets session completion status for a spa booking order.
 * 
 * Calculates completion progress including completed count, remaining sessions,
 * and completion percentage for UI display and validation.
 * 
 * @param order - Core booking order object
 * @returns Session completion status object
 * 
 * @remarks
 * **Status Object Fields:**
 * - `completed`: Number of sessions completed
 * - `total`: Total number of sessions in package
 * - `remaining`: Sessions left to complete (never negative)
 * - `percentage`: Completion percentage (0-100, rounded to 2 decimals)
 * 
 * **Data Source:**
 * Reads from `order.metadata`:
 * - `sessions_completed`: Current completed count (from `booking.completed_sessions`)
 * - `sessions_total`: Total package sessions (from `booking.total_sessions`)
 * 
 * **Edge Cases:**
 * - If `completed > total`: remaining = 0 (prevents negative values)
 * - If `total = 0`: percentage = 0 (prevents division by zero)
 * - Missing metadata: defaults to 0 for all values
 * 
 * **Use Cases:**
 * - Progress bars in booking detail pages
 * - Session availability validation
 * - Completion notifications
 * - Package reuse eligibility checks
 * 
 * @example
 * ```typescript
 * const order = {
 *   metadata: {
 *     sessions_completed: 3,
 *     sessions_total: 10
 *   }
 * };
 * 
 * const status = getSessionCompletionStatus(order);
 * // {
 * //   completed: 3,
 * //   total: 10,
 * //   remaining: 7,
 * //   percentage: 30.0
 * // }
 * ```
 * 
 * @example
 * ```typescript
 * // Display in UI
 * const status = getSessionCompletionStatus(order);
 * console.log(`Hoàn thành: ${status.completed}/${status.total} ca (${status.percentage}%)`);
 * console.log(`Còn lại: ${status.remaining} ca`);
 * ```
 * 
 * @see {@link hasRemainingSessions} for simple availability check
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
 * Checks if a booking order has remaining sessions available.
 * 
 * Simple boolean check for session availability validation. Returns `true`
 * if the customer has at least one session remaining in their package.
 * 
 * @param order - Core booking order object
 * @returns `true` if sessions remain, `false` if package is fully used
 * 
 * @remarks
 * **Use Cases:**
 * - Validate before scheduling new session
 * - Show/hide "Book Next Session" button
 * - Prevent overbooking package sessions
 * - Check package reuse eligibility
 * 
 * **Business Logic:**
 * - Calls {@link getSessionCompletionStatus} internally
 * - Returns `remaining > 0`
 * - Thread-safe (no side effects)
 * 
 * **Performance:**
 * - O(1) operation (simple metadata read)
 * - No database queries
 * - Safe for high-frequency calls
 * 
 * @example
 * ```typescript
 * // Validate before scheduling
 * if (hasRemainingSessions(order)) {
 *   await scheduleNextSession(order.id);
 * } else {
 *   alert('Gói dịch vụ đã hết số ca. Vui lòng mua gói mới.');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Conditional UI rendering
 * {hasRemainingSessions(order) && (
 *   <Button onClick={scheduleSession}>
 *     Đặt lịch ca tiếp theo
 *   </Button>
 * )}
 * 
 * {!hasRemainingSessions(order) && (
 *   <Alert>Gói dịch vụ đã hoàn thành</Alert>
 * )}
 * ```
 * 
 * @see {@link getSessionCompletionStatus} for detailed completion info
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
