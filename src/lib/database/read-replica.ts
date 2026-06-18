/**
 * Database Read Replica Configuration
 * 
 * Supabase read replicas để phân tải analytics và reporting queries
 * khỏi primary database, giảm latency cho write operations.
 * 
 * Setup Guide:
 * 1. Supabase Dashboard → Settings → Database → Read Replicas
 * 2. Enable read replica trong region gần users (e.g., Singapore)
 * 3. Copy read replica connection string
 * 4. Add to environment variables
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Connection strings từ environment
const PRIMARY_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PRIMARY_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const REPLICA_URL = process.env.SUPABASE_READ_REPLICA_URL || PRIMARY_URL;
const REPLICA_KEY = process.env.SUPABASE_READ_REPLICA_KEY || PRIMARY_KEY;

// Flag để enable/disable read replica routing
const USE_READ_REPLICA = process.env.USE_READ_REPLICA === 'true';

// Primary client cho write operations
let primaryClient: SupabaseClient<Database> | null = null;

// Read replica client cho analytics queries
let replicaClient: SupabaseClient<Database> | null = null;

/**
 * Get primary database client (write operations)
 */
export function getPrimaryClient(): SupabaseClient<Database> {
  if (!primaryClient) {
    primaryClient = createClient<Database>(PRIMARY_URL, PRIMARY_KEY, {
      auth: {
        persistSession: false, // Server-side, no session persistence
      },
      db: {
        schema: 'public',
      },
    });
  }
  return primaryClient;
}

/**
 * Get read replica client (read-only operations)
 * Falls back to primary if read replica not configured
 */
export function getReplicaClient(): SupabaseClient<Database> {
  if (!USE_READ_REPLICA) {
    return getPrimaryClient();
  }

  if (!replicaClient) {
    replicaClient = createClient<Database>(REPLICA_URL, REPLICA_KEY, {
      auth: {
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    });
  }
  return replicaClient;
}

/**
 * Query routing utility
 * Automatically route queries to appropriate database
 */
export const db = {
  /**
   * Primary database - Use for:
   * - All write operations (INSERT, UPDATE, DELETE)
   * - Real-time subscriptions
   * - Transactional queries
   * - Time-sensitive reads
   */
  primary: getPrimaryClient(),

  /**
   * Read replica - Use for:
   * - Analytics queries
   * - Reporting dashboards
   * - Historical data analysis
   * - Heavy aggregations
   * - Export operations
   * 
   * Note: Replica has ~100ms replication lag from primary
   */
  replica: getReplicaClient(),
};

/**
 * Decorator to automatically use read replica for analytics
 */
export function useReadReplica<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: any[]) => {
    const client = getReplicaClient();
    return fn.call({ client }, ...args);
  }) as T;
}

/**
 * Health check for read replica
 */
export async function checkReplicaHealth(): Promise<{
  healthy: boolean;
  lag_ms: number | null;
  error?: string;
}> {
  try {
    const primary = getPrimaryClient();
    const replica = getReplicaClient();

    // Query current timestamp from both
    const [primaryResult, replicaResult] = await Promise.all([
      primary.rpc('get_current_timestamp'),
      replica.rpc('get_current_timestamp'),
    ]);

    if (primaryResult.error || replicaResult.error) {
      throw new Error('Failed to query timestamps');
    }

    const primaryTime = new Date(primaryResult.data as string).getTime();
    const replicaTime = new Date(replicaResult.data as string).getTime();
    const lag = primaryTime - replicaTime;

    return {
      healthy: lag < 5000, // Consider healthy if lag < 5 seconds
      lag_ms: lag,
    };
  } catch (error) {
    return {
      healthy: false,
      lag_ms: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Analytics query examples
 */
export const analyticsQueries = {
  /**
   * Monthly revenue report - Use read replica
   */
  async getMonthlyRevenue(tenantId: string, year: number, month: number) {
    const client = getReplicaClient();
    
    return client.rpc('get_monthly_revenue', {
      p_tenant_id: tenantId,
      p_year: year,
      p_month: month,
    });
  },

  /**
   * KTV performance leaderboard - Use read replica
   */
  async getKtvLeaderboard(tenantId: string, startDate: string, endDate: string) {
    const client = getReplicaClient();
    
    return client
      .from('sessions')
      .select(`
        ktv_id,
        staff:staff!ktv_id(full_name),
        count:id.count(),
        total_rating:rating.sum()
      `)
      .eq('tenant_id', tenantId)
      .gte('checked_out_at', startDate)
      .lte('checked_out_at', endDate)
      .eq('status', 'completed')
      .order('count', { ascending: false });
  },

  /**
   * Salary reconciliation report - Use read replica
   */
  async getSalaryReconciliation(tenantId: string, year: number, month: number) {
    const client = getReplicaClient();
    
    return client.rpc('get_salary_reconciliation_report', {
      p_tenant_id: tenantId,
      p_year: year,
      p_month: month,
    });
  },

  /**
   * Inventory turnover analysis - Use read replica
   */
  async getInventoryTurnover(tenantId: string, days: number) {
    const client = getReplicaClient();
    
    return client.rpc('get_inventory_turnover', {
      p_tenant_id: tenantId,
      p_days: days,
    });
  },
};

/**
 * Connection pool configuration for production
 */
export const poolConfig = {
  primary: {
    max: 100, // Max connections to primary
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
  },
  replica: {
    max: 50, // Fewer connections to replica (read-only)
    idleTimeoutMillis: 120000,
    connectionTimeoutMillis: 15000,
  },
};
