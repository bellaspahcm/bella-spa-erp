/**
 * Decision Engine Platform - Mock BI Client
 * 
 * Mock implementation of IBIClient for testing and development.
 * Simulates database operations without requiring actual database.
 * 
 * @see src/lib/decision-engine/providers/bi/IBIClient.ts
 */

import type {
  DatabaseConfig,
  ConnectionHealth,
  IBIClient,
  ITransaction,
} from '../IBIClient';
import {
  BaseBIClient,
  ConnectionError,
  QueryError,
  TransactionError,
} from '../IBIClient';
import type { BIQuery, BIQueryOptions, BIQueryResult } from '../types';
import { buildWhereClause } from '../types';

/**
 * Mock data store
 */
interface MockDataStore {
  [table: string]: Record<string, unknown>[];
}

/**
 * Mock Transaction
 */
class MockTransaction implements ITransaction {
  private active: boolean = true;
  private queries: Array<{ sql: string; params?: unknown[] }> = [];

  async query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]> {
    if (!this.active) {
      throw new TransactionError('Transaction is not active');
    }

    this.queries.push({ sql, params: parameters });

    // Mock result
    return [] as T[];
  }

  async commit(): Promise<void> {
    if (!this.active) {
      throw new TransactionError('Transaction is not active');
    }
    this.active = false;
  }

  async rollback(): Promise<void> {
    if (!this.active) {
      throw new TransactionError('Transaction is not active');
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  getQueries() {
    return this.queries;
  }
}

/**
 * Mock BI Client
 * 
 * Simulates database operations with in-memory data store.
 * Useful for testing BIProvider without database.
 * 
 * @example
 * ```typescript
 * const client = new MockBIClient({
 *   type: 'postgresql',
 *   database: 'test_db'
 * });
 * 
 * // Seed mock data
 * client.setMockData('bookings', [
 *   { id: 1, customer_id: 123, status: 'approved', amount: 1000000 },
 *   { id: 2, customer_id: 123, status: 'approved', amount: 2000000 },
 *   { id: 3, customer_id: 456, status: 'pending', amount: 500000 }
 * ]);
 * 
 * await client.connect();
 * 
 * const query = aggregation()
 *   .table('bookings')
 *   .count()
 *   .where('customer_id', 123)
 *   .where('status', 'approved')
 *   .build();
 * 
 * const result = await client.execute(query);
 * console.log(result.value); // 2
 * ```
 */
export class MockBIClient extends BaseBIClient implements IBIClient {
  readonly name = 'MockBIClient';
  readonly databaseType = 'mock';

  private mockData: MockDataStore = {};
  private queryDelay: number = 10; // Simulate network latency
  private shouldFail: boolean = false;
  private failureMessage: string = 'Mock failure';

  constructor(config: DatabaseConfig) {
    super(config);
  }

  /**
   * Set mock data for table
   */
  setMockData(table: string, data: Record<string, unknown>[]): void {
    this.mockData[table] = data;
  }

  /**
   * Get mock data for table
   */
  getMockData(table: string): Record<string, unknown>[] {
    return this.mockData[table] || [];
  }

  /**
   * Clear all mock data
   */
  clearMockData(): void {
    this.mockData = {};
  }

  /**
   * Set query delay (ms)
   */
  setQueryDelay(ms: number): void {
    this.queryDelay = ms;
  }

  /**
   * Simulate failure
   */
  simulateFailure(message: string = 'Mock failure'): void {
    this.shouldFail = true;
    this.failureMessage = message;
  }

  /**
   * Reset failure simulation
   */
  resetFailure(): void {
    this.shouldFail = false;
  }

  async connect(): Promise<void> {
    if (this.shouldFail) {
      throw new ConnectionError(this.failureMessage);
    }

    await this.delay(50); // Simulate connection time
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    await this.delay(10);
    this.isConnected = false;
  }

  async execute<T = unknown>(
    query: BIQuery,
    options?: BIQueryOptions
  ): Promise<BIQueryResult<T>> {
    this.validateConnected();

    if (this.shouldFail) {
      throw new QueryError(this.failureMessage);
    }

    const startTime = Date.now();
    await this.delay(this.queryDelay);

    let value: T;

    switch (query.type) {
      case 'sql':
        value = this.executeSQLQuery(query) as T;
        break;
      case 'aggregation':
        value = this.executeAggregationQuery(query) as T;
        break;
      case 'time-series':
        value = this.executeTimeSeriesQuery(query) as T;
        break;
      case 'metric':
        value = this.executeMetricQuery(query) as T;
        break;
      default:
        throw new QueryError(`Unsupported query type: ${(query as any).type}`);
    }

    const executionTime = Date.now() - startTime;

    return {
      value,
      metadata: {
        executionTime,
        rowCount: Array.isArray(value) ? value.length : 1,
        database: this.config.database,
        queryHash: this.createQueryHash(query),
        cached: false,
      },
    };
  }

  async executeRaw<T = unknown>(
    sql: string,
    parameters?: unknown[],
    options?: BIQueryOptions
  ): Promise<BIQueryResult<T>> {
    this.validateConnected();

    if (this.shouldFail) {
      throw new QueryError(this.failureMessage);
    }

    const startTime = Date.now();
    await this.delay(this.queryDelay);

    // Mock: return empty array
    const value = [] as unknown as T;
    const executionTime = Date.now() - startTime;

    return {
      value,
      metadata: {
        executionTime,
        rowCount: 0,
        database: this.config.database,
        queryHash: this.createQueryHash(sql),
        cached: false,
      },
    };
  }

  async beginTransaction(): Promise<ITransaction> {
    this.validateConnected();

    if (this.shouldFail) {
      throw new TransactionError(this.failureMessage);
    }

    return new MockTransaction();
  }

  async healthCheck(): Promise<ConnectionHealth> {
    const startTime = Date.now();

    try {
      if (!this.isConnected) {
        throw new Error('Not connected');
      }

      await this.delay(5);

      return {
        connected: true,
        version: 'Mock 1.0.0',
        latency: Date.now() - startTime,
        activeConnections: 1,
        idleConnections: 0,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        connected: false,
        lastCheck: new Date(),
        error: (error as Error).message,
      };
    }
  }

  getConnectionStats() {
    return {
      total: 1,
      active: this.isConnected ? 1 : 0,
      idle: 0,
      waiting: 0,
    };
  }

  async explain(query: BIQuery): Promise<string> {
    this.validateConnected();
    return `Mock query plan for ${query.type} query`;
  }

  /**
   * Execute SQL query
   * @private
   */
  private executeSQLQuery(query: any): unknown {
    // Mock: return empty array
    return [];
  }

  /**
   * Execute aggregation query
   * @private
   */
  private executeAggregationQuery(query: any): unknown {
    const table = query.table;
    let data = this.getMockData(table);

    // Apply filters
    if (query.filters) {
      data = data.filter((row) => {
        for (const [key, value] of Object.entries(query.filters)) {
          if (Array.isArray(value)) {
            if (!value.includes(row[key])) {
              return false;
            }
          } else if (row[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply aggregation
    const column = query.column;
    const func = query.function;

    switch (func) {
      case 'COUNT':
        return column === '*' ? data.length : data.filter(row => row[column] !== null).length;
      case 'SUM':
        return data.reduce((sum, row) => sum + (Number(row[column]) || 0), 0);
      case 'AVG':
        const values = data.map(row => Number(row[column]) || 0);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'MIN':
        return Math.min(...data.map(row => Number(row[column]) || 0));
      case 'MAX':
        return Math.max(...data.map(row => Number(row[column]) || 0));
      default:
        return 0;
    }
  }

  /**
   * Execute time-series query
   * @private
   */
  private executeTimeSeriesQuery(query: any): unknown {
    // Mock: return sample time-series data
    return [
      { period: '2024-01', value: 100 },
      { period: '2024-02', value: 150 },
      { period: '2024-03', value: 200 },
    ];
  }

  /**
   * Execute metric query
   * @private
   */
  private executeMetricQuery(query: any): unknown {
    // Mock: return sample metric value
    return { metric: query.metricId, value: 42 };
  }

  /**
   * Delay helper
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create MockBIClient instance
 * 
 * @param config - Database configuration
 * @returns MockBIClient instance
 */
export function createMockBIClient(config?: Partial<DatabaseConfig>): MockBIClient {
  return new MockBIClient({
    type: 'postgresql',
    database: 'mock_db',
    ...config,
  });
}
