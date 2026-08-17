// H1.2 Database Connections
// Constitution: v1.3 FROZEN (A3, C3)
// Purpose: Role-based connection management for security boundary

import { Pool, PoolConfig } from 'pg';

// ============================================================================
// H1.2 Worker Connection (A3)
// ============================================================================

export function createWorkerConnection(): Pool {
  // For tests: Use DATABASE_URL if available (Supabase connection string)
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }
  
  // For production: Use individual env vars
  const config: PoolConfig = {
    user: process.env.H1_2_WORKER_DB_USER || process.env.SUPABASE_DB_USER || 'postgres',
    password: process.env.H1_2_WORKER_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'bella_erp',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  if (!config.password) {
    throw new Error('H1_2_WORKER_DB_PASSWORD or SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL environment variable not set');
  }

  return new Pool(config);
}

// ============================================================================
// H1.2 Reconciliation Readonly Connection (C3)
// ============================================================================

export function createReadonlyConnection(): Pool {
  // For tests: Use DATABASE_URL if available (Supabase connection string)
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  
  // For production: Use individual env vars
  const config: PoolConfig = {
    user: process.env.H1_2_RECONCILIATION_DB_USER || process.env.SUPABASE_DB_USER || 'postgres',
    password: process.env.H1_2_RECONCILIATION_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'bella_erp',
    max: 5, // Fewer connections for readonly
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  if (!config.password) {
    throw new Error('H1_2_RECONCILIATION_DB_PASSWORD or SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL environment variable not set');
  }

  return new Pool(config);
}

// ============================================================================
// Connection Singletons
// ============================================================================

let workerPool: Pool | null = null;
let readonlyPool: Pool | null = null;

export function getWorkerPool(): Pool {
  if (!workerPool) {
    workerPool = createWorkerConnection();
  }
  return workerPool;
}

export function getReadonlyPool(): Pool {
  if (!readonlyPool) {
    readonlyPool = createReadonlyConnection();
  }
  return readonlyPool;
}

export async function closeAllConnections(): Promise<void> {
  const promises: Promise<void>[] = [];
  
  if (workerPool) {
    promises.push(workerPool.end());
    workerPool = null;
  }
  
  if (readonlyPool) {
    promises.push(readonlyPool.end());
    readonlyPool = null;
  }
  
  await Promise.all(promises);
}

// A3 Enforcement: workerPool uses h1_2_worker role (cannot mutate F1-F4)
// C3 Enforcement: readonlyPool uses h1_2_reconciliation_readonly role (cannot mutate any tables)
