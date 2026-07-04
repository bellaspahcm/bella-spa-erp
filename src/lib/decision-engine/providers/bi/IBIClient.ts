/**
 * Decision Engine Platform - BI Client Interface
 * 
 * Abstraction layer for database operations.
 * Allows different database implementations (PostgreSQL, MySQL, etc.)
 * without changing BIProvider logic.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 6
 */

import type { BIQuery, BIQueryOptions, BIQueryResult } from './types';

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  /** Database type */
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'oracle';
  
  /** Host */
  host?: string;
  
  /** Port */
  port?: number;
  
  /** Database name */
  database: string;
  
  /** Username */
  user?: string;
  
  /** Password */
  password?: string;
  
  /** Connection string (alternative to host/port/user/password) */
  connectionString?: string;
  
  /** Connection pool settings */
  pool?: {
    /** Minimum connections */
    min?: number;
    /** Maximum connections */
    max?: number;
    /** Idle timeout in milliseconds */
    idleTimeoutMillis?: number;
    /** Connection timeout in milliseconds */
    connectionTimeoutMillis?: number;
  };
  
  /** SSL/TLS settings */
  ssl?: boolean | {
    rejectUnauthorized?: boolean;
    ca?: string;
    key?: string;
    cert?: string;
  };
  
  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * Connection health status
 */
export interface ConnectionHealth {
  /** Is connected */
  connected: boolean;
  
  /** Database server version */
  version?: string;
  
  /** Latency in milliseconds */
  latency?: number;
  
  /** Active connections */
  activeConnections?: number;
  
  /** Idle connections */
  idleConnections?: number;
  
  /** Last health check timestamp */
  lastCheck: Date;
  
  /** Error message (if unhealthy) */
  error?: string;
}

/**
 * Query execution statistics
 */
export interface QueryStats {
  /** Query execution time in milliseconds */
  executionTime: number;
  
  /** Number of rows returned */
  rowCount: number;
  
  /** Query hash (for caching) */
  queryHash?: string;
  
  /** Was result cached */
  cached?: boolean;
  
  /** Database used */
  database: string;
}

/**
 * Transaction interface
 */
export interface ITransaction {
  /**
   * Execute query within transaction
   */
  query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>;
  
  /**
   * Commit transaction
   */
  commit(): Promise<void>;
  
  /**
   * Rollback transaction
   */
  rollback(): Promise<void>;
  
  /**
   * Check if transaction is active
   */
  isActive(): boolean;
}

/**
 * BI Client Error
 */
export class BIClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'BIClientError';
  }
}

/**
 * Connection Error
 */
export class ConnectionError extends BIClientError {
  constructor(message: string, originalError?: Error) {
    super(message, 'CONNECTION_ERROR', originalError);
    this.name = 'ConnectionError';
  }
}

/**
 * Query Error
 */
export class QueryError extends BIClientError {
  constructor(message: string, originalError?: Error) {
    super(message, 'QUERY_ERROR', originalError);
    this.name = 'QueryError';
  }
}

/**
 * Timeout Error
 */
export class QueryTimeoutError extends BIClientError {
  constructor(message: string, originalError?: Error) {
    super(message, 'QUERY_TIMEOUT', originalError);
    this.name = 'QueryTimeoutError';
  }
}

/**
 * Transaction Error
 */
export class TransactionError extends BIClientError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TRANSACTION_ERROR', originalError);
    this.name = 'TransactionError';
  }
}

/**
 * BI Client Interface
 * 
 * Abstraction for database operations.
 * Implementations: PostgreSQLClient, MySQLClient, etc.
 * 
 * @example
 * ```typescript
 * const client = new PostgreSQLClient(config);
 * await client.connect();
 * 
 * const result = await client.execute(query);
 * console.log(result.value);
 * 
 * await client.disconnect();
 * ```
 */
export interface IBIClient {
  /**
   * Client name
   */
  readonly name: string;
  
  /**
   * Database type
   */
  readonly databaseType: string;
  
  /**
   * Connect to database
   * 
   * Establishes connection pool and validates connectivity.
   * 
   * @returns Promise<void>
   * @throws ConnectionError if connection fails
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from database
   * 
   * Closes all connections gracefully.
   * 
   * @returns Promise<void>
   */
  disconnect(): Promise<void>;
  
  /**
   * Execute BI query
   * 
   * Converts BIQuery to native SQL and executes it.
   * Returns standardized result.
   * 
   * @param query - BI query definition
   * @param options - Query options
   * @returns Promise<BIQueryResult> - Query result
   * @throws QueryError if query execution fails
   * @throws QueryTimeoutError if query times out
   * 
   * @example
   * ```typescript
   * const query = aggregation()
   *   .table('bookings')
   *   .count()
   *   .where('status', 'approved')
   *   .build();
   * 
   * const result = await client.execute(query);
   * console.log(result.value); // 1234
   * ```
   */
  execute<T = unknown>(
    query: BIQuery,
    options?: BIQueryOptions
  ): Promise<BIQueryResult<T>>;
  
  /**
   * Execute raw SQL query
   * 
   * Executes raw SQL without query translation.
   * Use with caution - bypasses query builder safety.
   * 
   * @param sql - SQL query string
   * @param parameters - Query parameters
   * @param options - Query options
   * @returns Promise<BIQueryResult> - Query result
   * @throws QueryError if query execution fails
   * 
   * @example
   * ```typescript
   * const result = await client.executeRaw(
   *   'SELECT COUNT(*) as total FROM bookings WHERE status = $1',
   *   ['approved']
   * );
   * ```
   */
  executeRaw<T = unknown>(
    sql: string,
    parameters?: unknown[],
    options?: BIQueryOptions
  ): Promise<BIQueryResult<T>>;
  
  /**
   * Start database transaction
   * 
   * Creates new transaction for atomic operations.
   * 
   * @returns Promise<ITransaction> - Transaction interface
   * @throws TransactionError if transaction cannot be started
   * 
   * @example
   * ```typescript
   * const tx = await client.beginTransaction();
   * try {
   *   await tx.query('UPDATE accounts SET balance = balance - 100 WHERE id = 1');
   *   await tx.query('UPDATE accounts SET balance = balance + 100 WHERE id = 2');
   *   await tx.commit();
   * } catch (error) {
   *   await tx.rollback();
   *   throw error;
   * }
   * ```
   */
  beginTransaction(): Promise<ITransaction>;
  
  /**
   * Check connection health
   * 
   * Pings database and returns health status.
   * 
   * @returns Promise<ConnectionHealth> - Connection health
   * 
   * @example
   * ```typescript
   * const health = await client.healthCheck();
   * if (!health.connected) {
   *   console.error('Database connection lost:', health.error);
   * }
   * ```
   */
  healthCheck(): Promise<ConnectionHealth>;
  
  /**
   * Get connection statistics
   * 
   * Returns current connection pool statistics.
   * 
   * @returns Connection statistics
   * 
   * @example
   * ```typescript
   * const stats = client.getConnectionStats();
   * console.log(`Active: ${stats.active}, Idle: ${stats.idle}`);
   * ```
   */
  getConnectionStats(): {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  };
  
  /**
   * Test query execution (for debugging)
   * 
   * Executes EXPLAIN on query without running it.
   * Returns query execution plan.
   * 
   * @param query - BI query definition
   * @returns Promise<string> - Query execution plan
   * 
   * @example
   * ```typescript
   * const plan = await client.explain(query);
   * console.log('Query plan:', plan);
   * ```
   */
  explain(query: BIQuery): Promise<string>;
  
  /**
   * Get database schema information
   * 
   * Returns tables, columns, indexes, etc.
   * 
   * @returns Promise<DatabaseSchema> - Database schema
   */
  getSchema?(): Promise<DatabaseSchema>;
}

/**
 * Database schema information
 */
export interface DatabaseSchema {
  /** Database name */
  database: string;
  
  /** Tables */
  tables: TableSchema[];
}

/**
 * Table schema information
 */
export interface TableSchema {
  /** Table name */
  name: string;
  
  /** Schema/namespace */
  schema?: string;
  
  /** Columns */
  columns: ColumnSchema[];
  
  /** Indexes */
  indexes?: IndexSchema[];
  
  /** Primary key columns */
  primaryKey?: string[];
}

/**
 * Column schema information
 */
export interface ColumnSchema {
  /** Column name */
  name: string;
  
  /** Data type */
  type: string;
  
  /** Is nullable */
  nullable: boolean;
  
  /** Default value */
  defaultValue?: string;
  
  /** Is primary key */
  isPrimaryKey?: boolean;
  
  /** Is foreign key */
  isForeignKey?: boolean;
}

/**
 * Index schema information
 */
export interface IndexSchema {
  /** Index name */
  name: string;
  
  /** Columns */
  columns: string[];
  
  /** Is unique */
  unique: boolean;
}

/**
 * Base BI Client implementation
 * 
 * Provides common functionality for all database clients.
 */
export abstract class BaseBIClient implements IBIClient {
  abstract readonly name: string;
  abstract readonly databaseType: string;
  
  protected config: DatabaseConfig;
  protected isConnected: boolean = false;
  
  constructor(config: DatabaseConfig) {
    this.config = config;
  }
  
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract execute<T = unknown>(
    query: BIQuery,
    options?: BIQueryOptions
  ): Promise<BIQueryResult<T>>;
  abstract executeRaw<T = unknown>(
    sql: string,
    parameters?: unknown[],
    options?: BIQueryOptions
  ): Promise<BIQueryResult<T>>;
  abstract beginTransaction(): Promise<ITransaction>;
  abstract healthCheck(): Promise<ConnectionHealth>;
  abstract getConnectionStats(): {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  };
  abstract explain(query: BIQuery): Promise<string>;
  
  /**
   * Validate connection
   * @protected
   */
  protected validateConnected(): void {
    if (!this.isConnected) {
      throw new ConnectionError('Database client is not connected');
    }
  }
  
  /**
   * Create query hash for caching
   * @protected
   */
  protected createQueryHash(query: BIQuery | string): string {
    const queryString = typeof query === 'string' ? query : JSON.stringify(query);
    // Simple hash function (replace with crypto.createHash in production)
    let hash = 0;
    for (let i = 0; i < queryString.length; i++) {
      const char = queryString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Create BI client factory
 * 
 * @param config - Database configuration
 * @returns IBIClient instance
 * 
 * @example
 * ```typescript
 * const client = createBIClient({
 *   type: 'postgresql',
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'bella_spa',
 *   user: 'postgres',
 *   password: 'password'
 * });
 * ```
 */
export function createBIClient(config: DatabaseConfig): IBIClient {
  // Implementation will be in concrete client files
  throw new Error('Not implemented. Use PostgreSQLClient or MySQLClient directly.');
}
