/**
 * Query Optimizer Utilities
 * Phase 8: Optimization & Production Readiness
 * 
 * Utilities for optimizing database queries
 */

// ============================================================================
// QUERY PERFORMANCE MONITORING
// ============================================================================

export interface QueryMetrics {
  queryName: string;
  executionTime: number;
  rowCount: number;
  cacheHit: boolean;
  timestamp: Date;
}

const queryMetrics: QueryMetrics[] = [];
const MAX_METRICS_HISTORY = 1000;

export function recordQueryMetrics(metrics: QueryMetrics): void {
  queryMetrics.push(metrics);
  
  // Keep only recent metrics
  if (queryMetrics.length > MAX_METRICS_HISTORY) {
    queryMetrics.shift();
  }
  
  // Log slow queries
  if (metrics.executionTime > 1000) {
    console.warn(`Slow query detected: ${metrics.queryName} took ${metrics.executionTime}ms`);
  }
}

export function getQueryMetrics(queryName?: string): QueryMetrics[] {
  if (queryName) {
    return queryMetrics.filter((m) => m.queryName === queryName);
  }
  return queryMetrics;
}

export function getAverageQueryTime(queryName: string): number {
  const metrics = getQueryMetrics(queryName);
  if (metrics.length === 0) return 0;
  
  const total = metrics.reduce((sum, m) => sum + m.executionTime, 0);
  return total / metrics.length;
}

// ============================================================================
// QUERY BATCHING
// ============================================================================

interface BatchedQuery<T> {
  query: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queryBatches = new Map<string, BatchedQuery<any>[]>();
const batchTimers = new Map<string, NodeJS.Timeout>();

export function batchQuery<T>(
  batchKey: string,
  query: () => Promise<T>,
  delayMs: number = 50
): Promise<T> {
  return new Promise((resolve, reject) => {
    // Add to batch
    if (!queryBatches.has(batchKey)) {
      queryBatches.set(batchKey, []);
    }
    
    queryBatches.get(batchKey)!.push({ query, resolve, reject });
    
    // Clear existing timer
    if (batchTimers.has(batchKey)) {
      clearTimeout(batchTimers.get(batchKey)!);
    }
    
    // Set new timer to execute batch
    const timer = setTimeout(async () => {
      const batch = queryBatches.get(batchKey);
      if (!batch || batch.length === 0) return;
      
      // Execute all queries in parallel
      const results = await Promise.allSettled(
        batch.map((b) => b.query())
      );
      
      // Resolve/reject each promise
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          batch[index].resolve(result.value);
        } else {
          batch[index].reject(result.reason);
        }
      });
      
      // Clear batch
      queryBatches.delete(batchKey);
      batchTimers.delete(batchKey);
    }, delayMs);
    
    batchTimers.set(batchKey, timer);
  });
}

// ============================================================================
// CONNECTION POOLING
// ============================================================================

export const CONNECTION_POOL_CONFIG = {
  // Supabase client pooling
  MAX_CONNECTIONS: 20,
  IDLE_TIMEOUT_MS: 30000, // 30 seconds
  CONNECTION_TIMEOUT_MS: 2000, // 2 seconds
  
  // Query timeout
  STATEMENT_TIMEOUT_MS: 10000, // 10 seconds
} as const;

