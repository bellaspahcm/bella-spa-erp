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
 * import { getOperationalIntelligenceService } from '@/services/intelligence/operational';
 * 
 * const service = getOperationalIntelligenceService();
 * const ktvMetrics = await service.getKtvPerformance('ktv-123', 'month');
 * const leaderboard = await service.getKtvLeaderboard('tenant-123', 'week', 'revenue', 10);
 * const inventory = await service.getInventoryStatus('tenant-123', 'low_stock');
 * ```
 */

// Service exports
export {
  OperationalIntelligenceService,
  getOperationalIntelligenceService,
} from './service';

// Query functions (can be used directly without service layer)
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
export type { DateRange, TimePeriod, IntelligenceResponse } from '../shared/types';

