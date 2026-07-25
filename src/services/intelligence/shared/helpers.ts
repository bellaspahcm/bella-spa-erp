/**
 * Intelligence Layer - Helper Functions
 * 
 * Shared utility functions used across all intelligence modules.
 */

import type { DateRange, TimePeriod } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert TimePeriod to DateRange.
 * 
 * @param period - Time period (day, week, month, quarter, year)
 * @param baseDate - Base date to calculate from (defaults to today)
 * @returns DateRange object with startDate and endDate
 */
export function periodToDateRange(period: TimePeriod, baseDate: Date = new Date()): DateRange {
  const end = new Date(baseDate);
  end.setHours(23, 59, 59, 999); // End of day

  let start: Date;

  switch (period) {
    case 'day':
      start = new Date(baseDate);
      start.setHours(0, 0, 0, 0); // Start of day
      break;

    case 'week':
      start = new Date(baseDate);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;

    case 'month':
      start = new Date(baseDate);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;

    case 'quarter':
      start = new Date(baseDate);
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      break;

    case 'year':
      start = new Date(baseDate);
      start.setFullYear(start.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      break;

    default:
      // Custom period - use baseDate as both start and end
      start = new Date(baseDate);
      start.setHours(0, 0, 0, 0);
  }

  return {
    startDate: start,
    endDate: end,
  };
}

/**
 * Format Date to YYYY-MM-DD string.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Format Date to YYYY-MM-DD HH:mm:ss string.
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Get start of month for a given date.
 */
export function getStartOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get end of month for a given date.
 */
export function getEndOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Get month key in YYYY-MM-01 format.
 * Used for querying monthly aggregated data.
 */
export function getMonthKey(date: Date = new Date()): string {
  return formatDate(getStartOfMonth(date));
}

/**
 * Parse date range from various formats.
 */
export function parseDateRange(
  range: DateRange | TimePeriod | { period?: TimePeriod; dateRange?: DateRange }
): DateRange {
  if (typeof range === 'string') {
    // It's a TimePeriod string
    return periodToDateRange(range);
  }

  if ('period' in range && range.period) {
    return periodToDateRange(range.period);
  }

  if ('dateRange' in range && range.dateRange) {
    return range.dateRange;
  }

  // It's already a DateRange
  return range as DateRange;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache Key Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build cache key for intelligence queries.
 * 
 * Format: {prefix}:{tenantId}:{function}:{params}
 * 
 * Examples:
 * - executive:tenant-123:summary:2026-06
 * - finance:tenant-123:pnl:2026-06-01_2026-06-30
 * - sales:tenant-123:pipeline:week
 */
export function buildCacheKey(
  prefix: string,
  tenantId: string,
  functionName: string,
  params: Record<string, unknown> = {}
): string {
  // Sort params by key for consistent cache keys
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${serializeParamValue(params[key])}`)
    .join('_');

  const parts = [prefix, tenantId, functionName];
  if (sortedParams) {
    parts.push(sortedParams);
  }

  return parts.join(':');
}

/**
 * Serialize parameter value for cache key.
 */
function serializeParamValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  if (typeof value === 'object') {
    // For objects, use JSON stringification
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Build cache key pattern for invalidation.
 * 
 * Examples:
 * - executive:* → All executive cache entries
 * - finance:tenant-123:* → All finance cache entries for tenant-123
 * - sales:tenant-123:pipeline:* → All pipeline cache entries
 */
export function buildCachePattern(
  prefix: string,
  tenantId?: string,
  functionName?: string
): string {
  const parts = [prefix];

  if (tenantId) {
    parts.push(tenantId);
  }

  if (functionName) {
    parts.push(functionName);
  }

  return parts.join(':') + ':*';
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Transformation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate percentage.
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Calculate percentage change between two values.
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Round number to specified decimal places.
 */
export function roundNumber(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Format number as currency (VND).
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

/**
 * Format number with thousand separators.
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Calculate growth rate between two values.
 * Returns value between -1 and Infinity (e.g., 0.5 = 50% growth).
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? Infinity : 0;
  return (current - previous) / previous;
}

// ─────────────────────────────────────────────────────────────────────────────
// Array Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Group array of objects by a key.
 * 
 * @example
 * groupBy([{type: 'A', value: 1}, {type: 'B', value: 2}, {type: 'A', value: 3}], 'type')
 * // Returns: { A: [{type: 'A', value: 1}, {type: 'A', value: 3}], B: [{type: 'B', value: 2}] }
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Sum array of numbers.
 */
export function sum(array: number[]): number {
  return array.reduce((acc, val) => acc + val, 0);
}

/**
 * Calculate average of array of numbers.
 */
export function average(array: number[]): number {
  if (array.length === 0) return 0;
  return sum(array) / array.length;
}

/**
 * Calculate median of array of numbers.
 */
export function median(array: number[]): number {
  if (array.length === 0) return 0;

  const sorted = [...array].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Get unique values from array.
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate tenant ID format.
 * UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function isValidTenantId(tenantId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(tenantId);
}

/**
 * Validate date format (YYYY-MM-DD).
 */
export function isValidDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  // Check if it's a valid date
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Validate date range.
 */
export function isValidDateRange(range: DateRange): boolean {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);

  return start <= end;
}
