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
import type { Database } from '@/types/database.types';

// Connection strings từ environment
const PRIMARY_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const PRIMARY_KEY = (process.env.NODE_ENV === 'test' && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY))
  ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!)
  : (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
const REPLICA_URL = process.env.SUPABASE_READ_REPLICA_URL;
const REPLICA_KEY = process.env.SUPABASE_READ_REPLICA_KEY;

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
    if (!PRIMARY_URL || !PRIMARY_KEY) {
      throw new Error(
        'Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) environment variables.'
      );
    }
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

  if (!REPLICA_URL || !REPLICA_KEY) {
    throw new Error('Read replica is enabled but its credentials are missing');
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
 * 
 * Note: Using getter functions instead of direct properties to lazy-initialize clients
 * This prevents build-time crashes when env vars are not available yet
 */
export const db = {
  /**
   * Primary database - Use for:
   * - All write operations (INSERT, UPDATE, DELETE)
   * - Real-time subscriptions
   * - Transactional queries
   * - Time-sensitive reads
   */
  get primary() {
    return getPrimaryClient();
  },

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
  get replica() {
    return getReplicaClient();
  },
};

/**
 * Decorator to automatically use read replica for analytics
 */
export function useReadReplica<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  return (async (...args: unknown[]) => {
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
  if (!USE_READ_REPLICA) {
    return {
      healthy: false,
      lag_ms: null,
      error: 'Read replica is disabled',
    };
  }

  if (!REPLICA_URL || !REPLICA_KEY) {
    return {
      healthy: false,
      lag_ms: null,
      error: 'Read replica credentials are missing',
    };
  }

  if (REPLICA_URL === PRIMARY_URL) {
    return {
      healthy: false,
      lag_ms: null,
      error: 'Read replica URL points to the primary database',
    };
  }

  try {
    const replica = getReplicaClient();
    const { error } = await replica.from('tenants').select('id').limit(1);

    if (error) {
      throw error;
    }

    return {
      healthy: false,
      lag_ms: null,
      error: 'Replica connected, but authoritative replication lag monitoring is not configured',
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
 * 
 * NOTE: These examples require corresponding RPC functions to be implemented in the database.
 * Currently using fallback implementations until RPCs are created.
 */
export const analyticsQueries = {
  /**
   * Monthly revenue report - Use read replica
   * TODO: Implement get_monthly_revenue RPC function
   */
  async getMonthlyRevenue(tenantId: string, year: number, month: number) {
    const client = getReplicaClient();
    
    // Fallback to regular query until RPC is implemented
    return client
      .from('revenue')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', `${year}-${String(month).padStart(2, '0')}-01`)
      .lt('created_at', `${year}-${String(month + 1).padStart(2, '0')}-01`);
  },

  /**
   * KTV performance leaderboard - Use read replica
   */
  async getKtvLeaderboard(tenantId: string, startDate: string, endDate: string) {
    const client = getReplicaClient();
    
    return client
      .from('session_logs')
      .select(`
        ktv_id,
        staff:users!ktv_id(full_name)
      `)
      .eq('tenant_id', tenantId)
      .gte('checked_out_at', startDate)
      .lte('checked_out_at', endDate)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
  },

  /**
   * Salary reconciliation report - Use read replica
   * TODO: Implement get_salary_reconciliation_report RPC function
   */
  async getSalaryReconciliation(tenantId: string, year: number, month: number) {
    const client = getReplicaClient();
    
    // Fallback to regular query until RPC is implemented
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    return client
      .from('salary_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month_year', monthYear);
  },

  /**
   * Inventory turnover analysis - Use read replica
   * TODO: Implement get_inventory_turnover RPC function and inventory_transactions table
   */
  async getInventoryTurnover(tenantId: string, days: number) {
    // Table not implemented yet
    return { data: [], error: new Error('inventory_transactions table not implemented') };
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
