/**
 * Decision Engine Metrics Collector
 * 
 * Collects and aggregates metrics for Decision Engine performance monitoring.
 * Provides real-time and historical metrics for BI Dashboard integration.
 * 
 * Metrics Categories:
 * - Execution metrics (latency, throughput)
 * - Decision outcomes (approval rate, rejection rate)
 * - Provider performance (execution time per provider)
 * - Cache efficiency (hit rate, miss rate)
 * - Error rates (failures, timeouts, fallbacks)
 * 
 * @module DecisionEngine/Observability
 */

export interface DecisionMetric {
  /** Metric timestamp */
  timestamp: Date;
  /** Decision type (e.g., 'booking_approval', 'discount_eligibility') */
  decisionType: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Provider used */
  provider: string;
  /** Number of rules matched */
  rulesMatched: number;
  /** Whether decision was approved */
  approved: boolean;
  /** Whether decision required manual review */
  requiresManualReview: boolean;
  /** Whether cache was used */
  cacheHit: boolean;
  /** Whether decision failed */
  failed: boolean;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Tenant ID */
  tenantId: string;
}

export interface AggregatedMetrics {
  /** Time period for aggregation */
  period: {
    start: Date;
    end: Date;
  };
  /** Total decisions made */
  totalDecisions: number;
  /** Average execution time (ms) */
  averageExecutionTime: number;
  /** p50 latency (ms) */
  p50Latency: number;
  /** p95 latency (ms) */
  p95Latency: number;
  /** p99 latency (ms) */
  p99Latency: number;
  /** Average confidence score */
  averageConfidence: number;
  /** Auto approval rate (0-1) */
  autoApprovalRate: number;
  /** Rejection rate (0-1) */
  rejectionRate: number;
  /** Manual review rate (0-1) */
  manualReviewRate: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Fallback rate (0-1) */
  fallbackRate: number;
  /** Rule hit counts */
  ruleHitCounts: Record<string, number>;
  /** Provider execution times */
  providerMetrics: Record<string, {
    count: number;
    averageTime: number;
    p95Time: number;
  }>;
}

export interface MetricsQuery {
  /** Start time for query */
  startTime?: Date;
  /** End time for query */
  endTime?: Date;
  /** Decision type filter */
  decisionType?: string;
  /** Tenant ID filter */
  tenantId?: string;
  /** Limit number of results */
  limit?: number;
}

/**
 * In-memory metrics collector with circular buffer.
 * 
 * For production, this should be replaced with a time-series database
 * like Prometheus, InfluxDB, or CloudWatch Metrics.
 * 
 * Current implementation:
 * - Stores last 10,000 metrics in memory
 * - Provides real-time aggregation
 * - Thread-safe for concurrent access
 */
export class MetricsCollector {
  private metrics: DecisionMetric[] = [];
  private readonly maxSize = 10000; // Keep last 10k metrics in memory

  /**
   * Record a decision metric.
   * 
   * @param metric - Decision metric to record
   * 
   * @example
   * ```ts
   * collector.record({
   *   timestamp: new Date(),
   *   decisionType: 'booking_approval',
   *   executionTime: 12.5,
   *   confidence: 0.95,
   *   provider: 'RuleProvider',
   *   rulesMatched: 2,
   *   approved: true,
   *   requiresManualReview: false,
   *   cacheHit: false,
   *   failed: false,
   *   usedFallback: false,
   *   tenantId: 'tenant-123',
   * });
   * ```
   */
  record(metric: DecisionMetric): void {
    this.metrics.push(metric);

    // Keep buffer size under control (circular buffer)
    if (this.metrics.length > this.maxSize) {
      this.metrics.shift();
    }
  }

  /**
   * Query raw metrics.
   * 
   * @param query - Query parameters
   * @returns Filtered metrics
   * 
   * @example
   * ```ts
   * const recentMetrics = collector.query({
   *   startTime: new Date(Date.now() - 3600000), // Last hour
   *   decisionType: 'booking_approval',
   *   tenantId: 'tenant-123',
   *   limit: 100,
   * });
   * ```
   */
  query(query: MetricsQuery = {}): DecisionMetric[] {
    let filtered = this.metrics;

    if (query.startTime) {
      filtered = filtered.filter(m => m.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      filtered = filtered.filter(m => m.timestamp <= query.endTime!);
    }

    if (query.decisionType) {
      filtered = filtered.filter(m => m.decisionType === query.decisionType);
    }

    if (query.tenantId) {
      filtered = filtered.filter(m => m.tenantId === query.tenantId);
    }

    if (query.limit) {
      filtered = filtered.slice(-query.limit);
    }

    return filtered;
  }

  /**
   * Get aggregated metrics for a time period.
   * 
   * Calculates:
   * - Total decisions
   * - Latency percentiles (p50, p95, p99)
   * - Approval/rejection rates
   * - Cache hit rate
   * - Error and fallback rates
   * - Per-rule and per-provider statistics
   * 
   * @param query - Query parameters
   * @returns Aggregated metrics
   * 
   * @example
   * ```ts
   * const stats = collector.aggregate({
   *   startTime: new Date(Date.now() - 3600000), // Last hour
   *   tenantId: 'tenant-123',
   * });
   * 
   * console.log(`P95 Latency: ${stats.p95Latency}ms`);
   * console.log(`Auto Approval Rate: ${stats.autoApprovalRate * 100}%`);
   * console.log(`Cache Hit Rate: ${stats.cacheHitRate * 100}%`);
   * ```
   */
  aggregate(query: MetricsQuery = {}): AggregatedMetrics {
    const filtered = this.query(query);

    if (filtered.length === 0) {
      return this.emptyMetrics(query.startTime, query.endTime);
    }

    const totalDecisions = filtered.length;
    const executionTimes = filtered.map(m => m.executionTime).sort((a, b) => a - b);
    const confidences = filtered.map(m => m.confidence);
    const approved = filtered.filter(m => m.approved).length;
    const rejected = filtered.filter(m => !m.approved).length;
    const manualReview = filtered.filter(m => m.requiresManualReview).length;
    const cacheHits = filtered.filter(m => m.cacheHit).length;
    const errors = filtered.filter(m => m.failed).length;
    const fallbacks = filtered.filter(m => m.usedFallback).length;

    // Calculate percentiles
    const p50Index = Math.floor(executionTimes.length * 0.5);
    const p95Index = Math.floor(executionTimes.length * 0.95);
    const p99Index = Math.floor(executionTimes.length * 0.99);

    // Calculate rule hit counts (placeholder - would need rule IDs in metrics)
    const ruleHitCounts: Record<string, number> = {};

    // Calculate provider metrics
    const providerGroups = new Map<string, number[]>();
    filtered.forEach(m => {
      if (!providerGroups.has(m.provider)) {
        providerGroups.set(m.provider, []);
      }
      providerGroups.get(m.provider)!.push(m.executionTime);
    });

    const providerMetrics: Record<string, { count: number; averageTime: number; p95Time: number }> = {};
    providerGroups.forEach((times, provider) => {
      const sortedTimes = times.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      providerMetrics[provider] = {
        count: times.length,
        averageTime: times.reduce((sum, t) => sum + t, 0) / times.length,
        p95Time: sortedTimes[p95Index] || 0,
      };
    });

    return {
      period: {
        start: query.startTime || filtered[0].timestamp,
        end: query.endTime || filtered[filtered.length - 1].timestamp,
      },
      totalDecisions,
      averageExecutionTime: executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length,
      p50Latency: executionTimes[p50Index] || 0,
      p95Latency: executionTimes[p95Index] || 0,
      p99Latency: executionTimes[p99Index] || 0,
      averageConfidence: confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
      autoApprovalRate: approved / totalDecisions,
      rejectionRate: rejected / totalDecisions,
      manualReviewRate: manualReview / totalDecisions,
      cacheHitRate: cacheHits / totalDecisions,
      errorRate: errors / totalDecisions,
      fallbackRate: fallbacks / totalDecisions,
      ruleHitCounts,
      providerMetrics,
    };
  }

  /**
   * Get total number of metrics stored.
   * 
   * @returns Metrics count
   */
  count(): number {
    return this.metrics.length;
  }

  /**
   * Clear all metrics (for testing).
   */
  clear(): void {
    this.metrics = [];
  }

  private emptyMetrics(start?: Date, end?: Date): AggregatedMetrics {
    return {
      period: {
        start: start || new Date(),
        end: end || new Date(),
      },
      totalDecisions: 0,
      averageExecutionTime: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      averageConfidence: 0,
      autoApprovalRate: 0,
      rejectionRate: 0,
      manualReviewRate: 0,
      cacheHitRate: 0,
      errorRate: 0,
      fallbackRate: 0,
      ruleHitCounts: {},
      providerMetrics: {},
    };
  }
}

/**
 * Global metrics collector singleton.
 * 
 * In production, this should be replaced with a proper metrics backend
 * (Prometheus, CloudWatch, etc.)
 */
export const metricsCollector = new MetricsCollector();
