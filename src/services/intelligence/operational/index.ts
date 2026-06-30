/**
 * Operational Intelligence Module - Public Exports
 * 
 * This module provides operational intelligence for:
 * - KTV Performance (sessions, ratings, revenue, attendance)
 * - KTV Leaderboards (top performers)
 * - Inventory Status (stock levels, reorder recommendations)
 * - Inventory Forecasting (usage patterns, stockout predictions)
 * - Session Analytics (completion rates, peak hours, satisfaction)
 * - Capacity Utilization (booking capacity, utilization rates)
 * 
 * Usage:
 * ```typescript
 * import { 
 *   getKtvPerformance, 
 *   getKtvLeaderboard, 
 *   getInventoryStatus 
 * } from '@/services/intelligence/operational';
 * 
 * const ktvMetrics = await getKtvPerformance('ktv-123', 'month');
 * const leaderboard = await getKtvLeaderboard('tenant-123', 'week', 'revenue', 10);
 * const inventory = await getInventoryStatus('tenant-123', 'low_stock');
 * ```
 */

// Query functions
export {
  getKtvPerformance,
  getKtvLeaderboard,
  getInventoryStatus,
  getInventoryForecast,
  getSessionAnalytics,
  getCapacityUtilization,
} from './queries';

// Type exports
export type {
  KtvPerformance,
  KtvLeaderboardEntry,
  InventoryStatus,
  InventoryForecast,
  SessionAnalytics,
  CapacityUtilization,
} from './queries';

// Shared types
export type { DateRange, TimePeriod } from '../shared/types';
