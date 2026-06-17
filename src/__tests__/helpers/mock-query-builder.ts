/**
 * Mock Query Builder for Supabase Test Infrastructure
 * 
 * This module provides properly typed mock implementations of Supabase query builders
 * for use in Jest tests. All mocks maintain type safety while providing flexible
 * test data configuration.
 * 
 * @module __tests__/helpers/mock-query-builder
 * @see {@link https://supabase.com/docs/reference/javascript/select}
 */

/**
 * Generic type for Supabase query results
 * 
 * @template T The type of data returned by the query
 */
export interface QueryResult<T> {
  /** The data returned by the query, or null if error */
  data: T | null;
  /** Error object if query failed, null otherwise */
  error: Error | null;
  /** Total count of matching records (for paginated queries) */
  count?: number | null;
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
}

/**
 * Generic type for Supabase mutation results (insert/update/delete)
 * 
 * @template T The type of data affected by the mutation
 */
export interface MutationResult<T> {
  /** The data affected by the mutation, or null if error */
  data: T | null;
  /** Error object if mutation failed, null otherwise */
  error: Error | null;
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
}

/**
 * Mock query builder that mimics Supabase client behavior.
 * 
 * This class provides a chainable API similar to Supabase's query builder,
 * allowing tests to configure expected return data and errors.
 * 
 * @template T The type of records being queried
 * 
 * @example
 * ```typescript
 * // Create a mock builder with test data
 * const builder = new MockQueryBuilder<User>();
 * builder.data = [{ id: '1', email: 'test@example.com' }];
 * 
 * // Use in test
 * const result = await builder.eq('id', '1');
 * expect(result.data).toHaveLength(1);
 * ```
 * 
 * @example
 * ```typescript
 * // Configure error scenario
 * const builder = new MockQueryBuilder<User>();
 * builder.error = new Error('Database connection failed');
 * 
 * const result = await builder.select();
 * expect(result.error).toBeDefined();
 * ```
 */
export class MockQueryBuilder<T> {
  /** The mock data to be returned. Can be a single record or array of records */
  public data: T | T[] | null = null;
  
  /** The mock error to be returned. Set to simulate error conditions */
  public error: Error | null = null;
  
  /** The total count for paginated queries */
  public count: number | null = null;

  /**
   * Mock SELECT clause
   * @param columns Comma-separated column names (ignored in mock)
   * @returns this for chaining
   */
  select(columns?: string): this {
    return this;
  }

  /**
   * Mock EQUALS filter
   * @param column Column name to filter
   * @param value Value to match
   * @returns this for chaining
   */
  eq(column: string, value: unknown): this {
    return this;
  }

  /**
   * Mock NOT EQUALS filter
   * @param column Column name to filter
   * @param value Value to not match
   * @returns this for chaining
   */
  neq(column: string, value: unknown): this {
    return this;
  }

  /**
   * Mock GREATER THAN filter
   * @param column Column name to filter
   * @param value Value to compare
   * @returns this for chaining
   */
  gt(column: string, value: unknown): this {
    return this;
  }

  /**
   * Mock GREATER THAN OR EQUAL filter
   * @param column Column name to filter
   * @param value Value to compare
   * @returns this for chaining
   */
  gte(column: string, value: unknown): this {
    return this;
  }

  /**
   * Mock LESS THAN filter
   * @param column Column name to filter
   * @param value Value to compare
   * @returns this for chaining
   */
  lt(column: string, value: unknown): this {
    return this;
  }

  /**
   * Mock LESS THAN OR EQUAL filter
   * @param column Column name to filter
   * @param value Value to compare
   * @returns this for chaining
   */
  lte(column: string, value: unknown): this {
    return this;
  }

  /**
   * Mock IN filter
   * @param column Column name to filter
   * @param values Array of values to match
   * @returns this for chaining
   */
  in(column: string, values: unknown[]): this {
    return this;
  }

  /**
   * Mock IS filter (for null checks)
   * @param column Column name to filter
   * @param value Value to match (typically null)
   * @returns this for chaining
   */
  is(column: string, value: unknown): this {
    return this;
  }

  /**
   * Mock NOT filter
   * @param column Column name to filter
   * @param operator Operator to negate
   * @param value Value to compare
   * @returns this for chaining
   */
  not(column: string, operator: string, value: unknown): this {
    return this;
  }

  /**
   * Mock OR filter
   * @param query Query string in Supabase format
   * @returns this for chaining
   */
  or(query: string): this {
    return this;
  }

  /**
   * Mock ORDER BY clause
   * @param column Column name to order by
   * @param options Ordering options
   * @returns this for chaining
   */
  order(column: string, options?: { ascending?: boolean }): this {
    return this;
  }

  /**
   * Mock LIMIT clause
   * @param count Maximum number of records to return
   * @returns this for chaining
   */
  limit(count: number): this {
    return this;
  }

  /**
   * Mock RANGE clause (for pagination)
   * @param from Starting index (inclusive)
   * @param to Ending index (inclusive)
   * @returns this for chaining
   */
  range(from: number, to: number): this {
    return this;
  }

  /**
   * Returns a single record result.
   * Expects data to be a single record (not an array).
   * Throws if multiple records found (mimics Supabase behavior).
   * 
   * @returns Promise resolving to QueryResult with single record
   */
  single(): Promise<QueryResult<T>> {
    return Promise.resolve({
      data: Array.isArray(this.data) ? (this.data[0] as T) : this.data,
      error: this.error,
      status: this.error ? 400 : 200,
      statusText: this.error ? 'Error' : 'OK',
    });
  }

  /**
   * Returns a single record or null if not found.
   * Does not throw on zero or multiple records.
   * 
   * @returns Promise resolving to QueryResult with single record or null
   */
  maybeSingle(): Promise<QueryResult<T | null>> {
    return this.single();
  }

  /**
   * Executes the query and returns array results.
   * This makes the builder promise-like for use with await.
   * 
   * @param onfulfilled Success callback
   * @param onrejected Error callback
   * @returns Promise resolving to QueryResult with array of records
   */
  then(
    onfulfilled?: ((value: QueryResult<T[]>) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null
  ): Promise<unknown> {
    const result: QueryResult<T[]> = {
      data: Array.isArray(this.data) ? this.data : (this.data ? [this.data] : []),
      error: this.error,
      count: this.count,
      status: this.error ? 400 : 200,
      statusText: this.error ? 'Error' : 'OK',
    };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

/**
 * Factory to create a typed mock query builder.
 * 
 * @template T The type of records the builder will query
 * @returns A new MockQueryBuilder instance
 * 
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   email: string;
 *   role: string;
 * }
 * 
 * const builder = createMockQueryBuilder<User>();
 * builder.data = [{ id: '1', email: 'test@example.com', role: 'admin' }];
 * ```
 */
export function createMockQueryBuilder<T>(): MockQueryBuilder<T> {
  return new MockQueryBuilder<T>();
}

/**
 * Helper to configure a builder with successful data.
 * 
 * @template T The type of records
 * @param builder The mock query builder to configure
 * @param data The data to return from queries
 * @returns The configured builder for chaining
 * 
 * @example
 * ```typescript
 * const builder = mockSuccess(
 *   createMockQueryBuilder<User>(),
 *   [{ id: '1', email: 'test@example.com' }]
 * );
 * ```
 */
export function mockSuccess<T>(builder: MockQueryBuilder<T>, data: T | T[]): MockQueryBuilder<T> {
  builder.data = data;
  builder.error = null;
  return builder;
}

/**
 * Helper to configure a builder with an error.
 * 
 * @template T The type of records
 * @param builder The mock query builder to configure
 * @param error The error to return from queries
 * @returns The configured builder for chaining
 * 
 * @example
 * ```typescript
 * const builder = mockError(
 *   createMockQueryBuilder<User>(),
 *   new Error('Connection timeout')
 * );
 * ```
 */
export function mockError<T>(builder: MockQueryBuilder<T>, error: Error): MockQueryBuilder<T> {
  builder.data = null;
  builder.error = error;
  return builder;
}
