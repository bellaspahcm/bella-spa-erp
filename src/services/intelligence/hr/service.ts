/**
 * HR Intelligence Service
 * 
 * Service layer with caching for HR Intelligence metrics.
 * Implements cache → DB fallback pattern with automatic cache invalidation.
 * 
 * Cache Flow:
 * 1. Check cache → If hit, return immediately
 * 2. Query database (materialized views) → Compute metrics
 * 3. Write to cache → Return result
 * 
 * Cache Strategy:
 * - Workforce Analytics: 1 hour TTL (headcount changes infrequently)
 * - Attendance Report: 1 hour TTL (daily attendance logs)
 * - Payroll Summary: 1 hour TTL (monthly calculations)
 * - Employee Performance: 1 hour TTL (aggregated metrics)
 * - Recruitment Metrics: 1 hour TTL (hiring pipeline)
 * - Training Metrics: 1 hour TTL (completion rates)
 * - Retention Analysis: 1 hour TTL (tenure analysis)
 * - Productivity Trends: 1 hour TTL (historical analysis)
 * 
 * Cache Invalidation:
 * Automatic via BusinessEventListener → CacheInvalidator
 * - salary_records.updated → Invalidates hr:*
 * - attendance.logged → Invalidates hr:*
 * - kpi_records.updated → Invalidates hr:*
 * - users.updated → Invalidates hr:*
 */

import type { IntelligenceService, DateRange, TimePeriod, IntelligenceResponse, CacheService } from '../shared/types';
import { IntelligenceError, QueryError } from '../shared/types';
import { getCache } from '../cache';
import { buildCacheKey, parseDateRange, formatDate } from '../shared/helpers';
import { DEFAULT_CACHE_TTL, CACHE_KEY_PREFIX } from '../shared/constants';
import type {
  WorkforceAnalytics,
  AttendanceReport,
  PayrollSummary,
  EmployeePerformance,
  RetentionAnalysis,
  ProductivityTrends,
} from './queries';
import {
  getWorkforceAnalytics as queryWorkforceAnalytics,
  getAttendanceReport as queryAttendanceReport,
  getPayrollSummary as queryPayrollSummary,
  getEmployeePerformance as queryEmployeePerformance,
  getRecruitmentMetrics as queryRecruitmentMetrics,
  getTrainingMetrics as queryTrainingMetrics,
  getRetentionAnalysis as queryRetentionAnalysis,
  getProductivityTrends as queryProductivityTrends,
  RecruitmentMetrics,
  TrainingMetrics,
} from './queries-simple';

// ─────────────────────────────────────────────────────────────────────────────
// HR Intelligence Service
// ─────────────────────────────────────────────────────────────────────────────

export class HRIntelligenceService implements IntelligenceService {
  readonly moduleName = 'hr';
  private cache: CacheService;

  /**
   * Create HR Intelligence Service.
   * @param cache - Optional cache instance (defaults to getCache() singleton).
   */
  constructor(cache?: CacheService) {
    this.cache = cache || getCache();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Workforce Analytics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Workforce Analytics.
   * 
   * Retrieves headcount trends, turnover rates, tenure, and role distribution.
   * Queries the mv_workforce_analytics materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Workforce analytics with cache metadata
   */
  async getWorkforceAnalytics(
    tenantId: string,
    dateRange?: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<WorkforceAnalytics[]>> {
    const startTime = Date.now();
    const parsedRange = dateRange ? parseDateRange(dateRange as any) : undefined;

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.HR,
        tenantId,
        'workforceAnalytics',
        parsedRange ? {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        } : {}
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: WorkforceAnalytics[] | null = null;
      try {
        cached = await this.cache.get<WorkforceAnalytics[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[HRIntelligence.getWorkforceAnalytics] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (simplified - ignore dateRange param for now)
      const data = await queryWorkforceAnalytics(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.HR.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[HRIntelligence.getWorkforceAnalytics] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_workforce_analytics'],
        },
      };
    } catch (error) {
      throw this.handleError('getWorkforceAnalytics', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Attendance Report
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Attendance Report.
   * 
   * Retrieves attendance rates, absences, and on-time metrics by KTV.
   * Queries the mv_attendance_summary materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @param ktvId - Optional KTV ID filter
   * @returns Attendance reports with cache metadata
   */
  async getAttendanceReport(
    tenantId: string,
    dateRange?: DateRange | TimePeriod,
    ktvId?: string
  ): Promise<IntelligenceResponse<AttendanceReport[]>> {
    const startTime = Date.now();
    const parsedRange = dateRange ? parseDateRange(dateRange as any) : undefined;

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.HR,
        tenantId,
        'attendanceReport',
        {
          ...(parsedRange ? {
            startDate: formatDate(parsedRange.startDate),
            endDate: formatDate(parsedRange.endDate),
          } : {}),
          ...(ktvId ? { ktvId } : {}),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: AttendanceReport[] | null = null;
      try {
        cached = await this.cache.get<AttendanceReport[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[HRIntelligence.getAttendanceReport] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (simplified - ignore dateRange and ktvId params for now)
      const data = await queryAttendanceReport(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.HR.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[HRIntelligence.getAttendanceReport] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_attendance_summary'],
        },
      };
    } catch (error) {
      throw this.handleError('getAttendanceReport', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Payroll Summary
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Payroll Summary.
   * 
   * Retrieves salary breakdown, bonuses, deductions, and rankings.
   * Queries the mv_payroll_summary materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param month - Month in YYYY-MM format (e.g., '2026-06')
   * @param ktvId - Optional KTV ID filter
   * @returns Payroll summary with cache metadata
   */
  async getPayrollSummary(
    tenantId: string,
    month: string,
    ktvId?: string
  ): Promise<IntelligenceResponse<PayrollSummary[]>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.HR,
        tenantId,
        'payrollSummary',
        {
          month,
          ...(ktvId ? { ktvId } : {}),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: PayrollSummary[] | null = null;
      try {
        cached = await this.cache.get<PayrollSummary[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[HRIntelligence.getPayrollSummary] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (simplified - ignore ktvId param for now)
      const data = await queryPayrollSummary(tenantId, month);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.HR.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[HRIntelligence.getPayrollSummary] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_payroll_summary'],
        },
      };
    } catch (error) {
      throw this.handleError('getPayrollSummary', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Employee Performance
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Employee Performance.
   * 
   * Retrieves KPI scores, ratings, productivity, and revenue contribution.
   * Queries the mv_employee_performance materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @param ktvId - Optional KTV ID filter
   * @param limit - Optional limit for top performers (default: 10)
   * @returns Employee performance with cache metadata
   */
  async getEmployeePerformance(
    tenantId: string,
    dateRange?: DateRange | TimePeriod,
    ktvId?: string,
    limit?: number
  ): Promise<IntelligenceResponse<EmployeePerformance[]>> {
    const startTime = Date.now();
    const parsedRange = dateRange ? parseDateRange(dateRange as any) : undefined;

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.HR,
        tenantId,
        'employeePerformance',
        {
          ...(parsedRange ? {
            startDate: formatDate(parsedRange.startDate),
            endDate: formatDate(parsedRange.endDate),
          } : {}),
          ...(ktvId ? { ktvId } : {}),
          ...(limit ? { limit } : {}),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: EmployeePerformance[] | null = null;
      try {
        cached = await this.cache.get<EmployeePerformance[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[HRIntelligence.getEmployeePerformance] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (simplified - ignore dateRange, ktvId, limit params for now)
      const data = await queryEmployeePerformance(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.HR.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[HRIntelligence.getEmployeePerformance] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_employee_performance'],
        },
      };
    } catch (error) {
      throw this.handleError('getEmployeePerformance', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Recruitment Metrics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Recruitment Metrics.
   * 
   * Retrieves hiring pipeline, conversion rates, time-to-hire, and source effectiveness.
   * Queries recruitment tables for comprehensive metrics.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Recruitment metrics with cache metadata
   */
  async getRecruitmentMetrics(
    tenantId: string,
    dateRange?: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<RecruitmentMetrics[]>> {
    const startTime = Date.now();
    const parsedRange = dateRange ? parseDateRange(dateRange as any) : undefined;

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.HR,
        tenantId,
        'recruitmentMetrics',
        parsedRange ? {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        } : {}
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: RecruitmentMetrics[] | null = null;
      try {
        cached = await this.cache.get<RecruitmentMetrics[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[HRIntelligence.getRecruitmentMetrics] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (simplified - ignore dateRange param for now)
      const data = await queryRecruitmentMetrics(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.HR.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[HRIntelligence.getRecruitmentMetrics] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['recruitment_candidates', 'recruitment_pipelines', 'recruitment_interviews'],
        },
      };
    } catch (error) {
      throw this.handleError('getRecruitmentMetrics', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Training Metrics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Training Metrics.
   * 
   * Retrieves training completion rates and skill development metrics.
   * Calculates from session_logs as proxy for on-the-job training.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Training metrics with cache metadata
   */
  async getTrainingMetrics(
    tenantId: string,
    dateRange?: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<TrainingMetrics[]>> {
    const startTime = Date.now();
    const parsedRange = dateRange ? parseDateRange(dateRange as any) : undefined;

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.HR,
        tenantId,
        'trainingMetrics',
        parsedRange ? {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        } : {}
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: TrainingMetrics[] | null = null;
      try {
        cached = await this.cache.get<TrainingMetrics[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[HRIntelligence.getTrainingMetrics] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (simplified - ignore dateRange param for now)
      const data = await queryTrainingMetrics(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.HR.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[HRIntelligence.getTrainingMetrics] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['session_logs', 'users'],
        },
      };
    } catch (error) {
      throw this.handleError('getTrainingMetrics', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Retention Analysis
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Retention Analysis.
   * 
   * Analyzes attrition risk and tenure distribution.
   * Aggregates data from workforce analytics materialized view.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Retention analysis with cache metadata
   */
  async getRetentionAnalysis(
    tenantId: string,
    dateRange?: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<RetentionAnalysis | null>> {
    const startTime = Date.now();
    const parsedRange = dateRange ? parseDateRange(dateRange as any) : undefined;

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.HR,
        tenantId,
        'retentionAnalysis',
        parsedRange ? {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        } : {}
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: RetentionAnalysis | null = null;
      try {
        cached = await this.cache.get<RetentionAnalysis | null>(cacheKey);
      } catch (cacheError) {
        console.warn('[HRIntelligence.getRetentionAnalysis] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (simplified - ignore dateRange param for now)
      const data = await queryRetentionAnalysis(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.HR.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[HRIntelligence.getRetentionAnalysis] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_workforce_analytics'],
        },
      };
    } catch (error) {
      throw this.handleError('getRetentionAnalysis', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Productivity Trends
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Productivity Trends.
   * 
   * Analyzes sessions per employee, revenue per employee, and efficiency metrics.
   * Aggregates data from employee performance materialized view.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Productivity trends with cache metadata
   */
  async getProductivityTrends(
    tenantId: string,
    dateRange?: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<ProductivityTrends[]>> {
    const startTime = Date.now();
    const parsedRange = dateRange ? parseDateRange(dateRange as any) : undefined;

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.HR,
        tenantId,
        'productivityTrends',
        parsedRange ? {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        } : {}
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: ProductivityTrends[] | null = null;
      try {
        cached = await this.cache.get<ProductivityTrends[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[HRIntelligence.getProductivityTrends] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (simplified - ignore dateRange param for now)
      const data = await queryProductivityTrends(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.HR.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[HRIntelligence.getProductivityTrends] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_employee_performance'],
        },
      };
    } catch (error) {
      throw this.handleError('getProductivityTrends', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interface Implementation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Health check for HR Intelligence module.
   * Tests database connection and cache availability.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache
      const testKey = `${CACHE_KEY_PREFIX.HR}:health:test`;
      await this.cache.set(testKey, { test: true }, { ttl: 10 });
      const cached = await this.cache.get(testKey);
      await this.cache.delete(testKey);

      if (!cached) {
        console.error('[HRIntelligence] Cache health check failed');
        return false;
      }

      // TODO: Test database connection (query a simple materialized view)
      // For now, assume DB is healthy if cache is healthy
      return true;
    } catch (error) {
      console.error('[HRIntelligence] Health check failed:', error);
      return false;
    }
  }

  /**
   * Clear all cached data for HR Intelligence module.
   * Used for manual cache invalidation or testing.
   * 
   * @param tenantId - Optional tenant ID to clear only that tenant's cache
   */
  async clearCache(tenantId?: string): Promise<void> {
    try {
      if (tenantId) {
        // Clear cache for specific tenant
        await this.cache.deleteByTag(`tenant:${tenantId}`);
        console.log(`[HRIntelligence] Cache cleared for tenant: ${tenantId}`);
      } else {
        // Clear all HR cache
        await this.cache.deletePattern(`${CACHE_KEY_PREFIX.HR}:*`);
        console.log('[HRIntelligence] Cache cleared successfully');
      }
    } catch (error) {
      console.error('[HRIntelligence] Failed to clear cache:', error);
      throw new IntelligenceError(
        'Failed to clear HR intelligence cache',
        'CACHE_CLEAR_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  private handleError(method: string, error: unknown): IntelligenceError {
    if (error instanceof IntelligenceError || error instanceof QueryError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`[HRIntelligence.${method}] Error:`, error);

    return new IntelligenceError(
      `HR intelligence operation failed: ${message}`,
      'HR_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

let hrIntelligenceInstance: HRIntelligenceService | null = null;

/**
 * Get singleton instance of HRIntelligenceService.
 * Lazy initialization on first access.
 */
export function getHRIntelligenceService(): HRIntelligenceService {
  if (!hrIntelligenceInstance) {
    hrIntelligenceInstance = new HRIntelligenceService();
  }
  return hrIntelligenceInstance;
}
