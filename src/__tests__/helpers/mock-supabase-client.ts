/**
 * Mock Supabase Client for Testing
 * 
 * Provides a type-safe mock implementation of the Supabase client for use in Jest tests.
 * This mock client returns typed MockQueryBuilder instances that can be configured
 * with test data.
 * 
 * @module __tests__/helpers/mock-supabase-client
 * @see {@link https://supabase.com/docs/reference/javascript/initializing}
 */

import { MockQueryBuilder } from './mock-query-builder';

/**
 * Mock Supabase client that provides table access via `from()` method.
 * 
 * This class mimics the core Supabase client API for querying tables.
 * Each table access returns a fresh MockQueryBuilder that can be configured
 * independently for each test scenario.
 * 
 * @example
 * ```typescript
 * // Create mock client
 * const client = new MockSupabaseClient();
 * 
 * // Mock successful query
 * const usersQuery = client.from<User>('users');
 * usersQuery.data = [{ id: '1', email: 'test@example.com' }];
 * 
 * // Use in code under test
 * const result = await client.from('users').select().eq('id', '1');
 * expect(result.data).toHaveLength(1);
 * ```
 * 
 * @example
 * ```typescript
 * // Mock error scenario
 * const client = new MockSupabaseClient();
 * const query = client.from<User>('users');
 * query.error = new Error('Table not found');
 * 
 * const result = await client.from('users').select();
 * expect(result.error).toBeDefined();
 * ```
 */
export class MockSupabaseClient {
  /**
   * Access a table for querying.
   * Returns a fresh MockQueryBuilder for the specified table.
   * 
   * @template T The type of records in the table
   * @param table The table name
   * @returns A new MockQueryBuilder for building queries
   * 
   * @example
   * ```typescript
   * const client = new MockSupabaseClient();
   * const builder = client.from<User>('users');
   * builder.data = [{ id: '1', email: 'test@example.com' }];
   * ```
   */
  from<T>(table: string): MockQueryBuilder<T> {
    return new MockQueryBuilder<T>();
  }
}

/**
 * Factory to create a mock Supabase client.
 * 
 * @returns A new MockSupabaseClient instance
 * 
 * @example
 * ```typescript
 * // In test setup
 * const mockClient = createMockSupabaseClient();
 * 
 * // Configure mock behavior
 * jest.mock('@supabase/supabase-js', () => ({
 *   createClient: jest.fn(() => mockClient),
 * }));
 * ```
 * 
 * @example
 * ```typescript
 * // Direct usage in tests
 * const client = createMockSupabaseClient();
 * const query = client.from<Booking>('bookings');
 * query.data = mockBookings;
 * 
 * const result = await client.from('bookings').select();
 * expect(result.data).toEqual(mockBookings);
 * ```
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  return new MockSupabaseClient();
}
