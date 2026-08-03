import { dbLogger } from '@/lib/logger';

interface QueryMetrics {
  query: string;
  duration: number;
  rowCount?: number;
  error?: Error;
}

const SLOW_QUERY_THRESHOLD = 1000; // 1 second

/**
 * Log database query execution with performance metrics
 */
export function logQuery(metrics: QueryMetrics) {
  const { query, duration, rowCount, error } = metrics;
  
  if (error) {
    // Log error queries
    dbLogger.error(
      {
        query: query.substring(0, 200), // First 200 chars
        duration,
        error: error.message,
        stack: error.stack,
      },
      'Database query failed'
    );
    
    // Report to Sentry
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: {
          type: 'database_query',
        },
        contexts: {
          query: {
            sql: query.substring(0, 200),
            duration,
          },
        },
      });
    }
  } else if (duration > SLOW_QUERY_THRESHOLD) {
    // Log slow queries
    dbLogger.warn(
      {
        query: query.substring(0, 200),
        duration,
        rowCount,
        threshold: SLOW_QUERY_THRESHOLD,
      },
      'Slow database query detected'
    );
    
    // Report to Sentry as breadcrumb
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.addBreadcrumb({
        category: 'database',
        message: 'Slow query',
        level: 'warning',
        data: {
          query: query.substring(0, 100),
          duration,
        },
      });
    }
  } else {
    // Log successful queries (debug level)
    dbLogger.debug(
      {
        query: query.substring(0, 100),
        duration,
        rowCount,
      },
      'Database query executed'
    );
  }
}

/**
 * Wrapper for monitoring database queries
 * 
 * Usage:
 *   import { monitoredQuery } from '@/lib/db/query-monitor';
 *   
 *   const products = await monitoredQuery(
 *     () => supabase
 *       .from('real_estate_products')
 *       .select('*')
 *       .eq('status', 'available'),
 *     'get_available_products'
 *   );
 */
export async function monitoredQuery<T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - start;
    
    // Extract row count if result has data array
    let rowCount: number | undefined;
    if (result && typeof result === 'object') {
      const data = (result as any).data;
      if (Array.isArray(data)) {
        rowCount = data.length;
      }
    }
    
    logQuery({
      query: queryName,
      duration,
      rowCount,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logQuery({
      query: queryName,
      duration,
      error: error as Error,
    });
    
    throw error;
  }
}

/**
 * Wrapper for monitoring RPC function calls
 */
export async function monitoredRPC<T>(
  rpcFn: () => Promise<T>,
  rpcName: string,
  params?: Record<string, unknown>
): Promise<T> {
  const queryName = params 
    ? `${rpcName}(${JSON.stringify(params).substring(0, 100)})`
    : rpcName;
  
  return monitoredQuery(rpcFn, `RPC: ${queryName}`);
}

/**
 * Create monitored Supabase client wrapper
 * 
 * Usage:
 *   const supabase = createSupabaseClient();
 *   const monitored = withQueryMonitoring(supabase);
 *   
 *   const { data } = await monitored
 *     .from('real_estate_products')
 *     .select('*');
 */
export function withQueryMonitoring<T extends any>(client: T): T {
  // This is a simplified version
  // Full implementation would wrap all Supabase query methods
  return new Proxy(client, {
    get(target, prop) {
      const value = (target as any)[prop];
      
      if (typeof value === 'function' && prop === 'from') {
        return (...args: any[]) => {
          const tableName = args[0];
          const query = value.apply(target, args);
          
          // Wrap the query execution
          const originalThen = query.then;
          query.then = function(...thenArgs: any[]) {
            return monitoredQuery(
              () => originalThen.apply(query, thenArgs),
              `SELECT from ${tableName}`
            );
          };
          
          return query;
        };
      }
      
      return value;
    },
  });
}
