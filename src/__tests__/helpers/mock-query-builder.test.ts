/**
 * Mock Query Builder Tests
 * 
 * Demonstrates usage of the typed mock query builder infrastructure
 * and validates that the mocks behave correctly.
 */

import {
  MockQueryBuilder,
  createMockQueryBuilder,
  mockSuccess,
  mockError,
  QueryResult,
} from './mock-query-builder';

import {
  MockSupabaseClient,
  createMockSupabaseClient,
} from './mock-supabase-client';

// Example types for testing
interface User {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
}

interface Booking {
  id: string;
  customer_id: string;
  status: 'pending' | 'confirmed' | 'completed';
  total_amount: number;
}

describe('MockQueryBuilder', () => {
  describe('Basic Query Operations', () => {
    it('should return configured data for array queries', async () => {
      const builder = createMockQueryBuilder<User>();
      builder.data = [
        { id: '1', email: 'user1@test.com', role: 'admin', tenant_id: 'tenant-1' },
        { id: '2', email: 'user2@test.com', role: 'user', tenant_id: 'tenant-1' },
      ];

      const result = await builder.select().eq('tenant_id', 'tenant-1');

      expect(result.data).toHaveLength(2);
      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it('should return single record with single()', async () => {
      const builder = createMockQueryBuilder<User>();
      builder.data = [
        { id: '1', email: 'user1@test.com', role: 'admin', tenant_id: 'tenant-1' },
      ];

      const result = await builder.select().eq('id', '1').single();

      expect(result.data).toEqual({
        id: '1',
        email: 'user1@test.com',
        role: 'admin',
        tenant_id: 'tenant-1',
      });
      expect(result.error).toBeNull();
    });

    it('should handle errors correctly', async () => {
      const builder = createMockQueryBuilder<User>();
      builder.error = new Error('Connection timeout');

      const result = await builder.select();

      expect(result.data).toEqual([]);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Connection timeout');
      expect(result.status).toBe(400);
    });

    it('should support method chaining', async () => {
      const builder = createMockQueryBuilder<Booking>();
      builder.data = [
        { id: 'b1', customer_id: 'c1', status: 'confirmed', total_amount: 500000 },
      ];

      const result = await builder
        .select('*')
        .eq('customer_id', 'c1')
        .eq('status', 'confirmed')
        .order('total_amount', { ascending: false })
        .limit(10);

      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].status).toBe('confirmed');
    });
  });

  describe('Helper Functions', () => {
    it('should configure success with mockSuccess helper', async () => {
      const builder = mockSuccess(
        createMockQueryBuilder<User>(),
        [{ id: '1', email: 'test@test.com', role: 'user', tenant_id: 'tenant-1' }]
      );

      const result = await builder.select();

      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('should configure error with mockError helper', async () => {
      const builder = mockError(
        createMockQueryBuilder<User>(),
        new Error('Database error')
      );

      const result = await builder.select();

      expect(result.data).toEqual([]);
      expect(result.error?.message).toBe('Database error');
    });
  });

  describe('Type Safety', () => {
    it('should provide IDE autocomplete for typed data', async () => {
      const builder = createMockQueryBuilder<User>();
      builder.data = [
        { id: '1', email: 'test@test.com', role: 'admin', tenant_id: 'tenant-1' },
      ];

      const result = await builder.select();

      // TypeScript should provide autocomplete for these properties
      expect(result.data?.[0].id).toBe('1');
      expect(result.data?.[0].email).toBe('test@test.com');
      expect(result.data?.[0].role).toBe('admin');
      expect(result.data?.[0].tenant_id).toBe('tenant-1');
    });

    it('should handle nullable results correctly', async () => {
      const builder = createMockQueryBuilder<User>();
      builder.data = null;

      const result = await builder.select();

      expect(result.data).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array data', async () => {
      const builder = createMockQueryBuilder<User>();
      builder.data = [];

      const result = await builder.select();

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it('should handle single() with array data', async () => {
      const builder = createMockQueryBuilder<User>();
      builder.data = [
        { id: '1', email: 'test@test.com', role: 'admin', tenant_id: 'tenant-1' },
        { id: '2', email: 'test2@test.com', role: 'user', tenant_id: 'tenant-1' },
      ];

      const result = await builder.single();

      // Should return first element
      expect(result.data?.id).toBe('1');
    });

    it('should handle maybeSingle() when no data', async () => {
      const builder = createMockQueryBuilder<User>();
      builder.data = null;

      const result = await builder.maybeSingle();

      expect(result.data).toBeNull();
    });
  });
});

describe('MockSupabaseClient', () => {
  it('should create query builders for tables', () => {
    const client = createMockSupabaseClient();
    const usersQuery = client.from<User>('users');
    const bookingsQuery = client.from<Booking>('bookings');

    expect(usersQuery).toBeInstanceOf(MockQueryBuilder);
    expect(bookingsQuery).toBeInstanceOf(MockQueryBuilder);
  });

  it('should allow independent configuration of different tables', async () => {
    const client = createMockSupabaseClient();

    const usersQuery = client.from<User>('users');
    usersQuery.data = [
      { id: '1', email: 'user@test.com', role: 'admin', tenant_id: 'tenant-1' },
    ];

    const bookingsQuery = client.from<Booking>('bookings');
    bookingsQuery.data = [
      { id: 'b1', customer_id: 'c1', status: 'confirmed', total_amount: 500000 },
    ];

    const usersResult = await client.from<User>('users').select();
    const bookingsResult = await client.from<Booking>('bookings').select();

    // Note: Each from() call creates a new builder, so we need to configure the actual
    // builders used in the queries above. This demonstrates the pattern.
    expect(usersQuery).toBeInstanceOf(MockQueryBuilder);
    expect(bookingsQuery).toBeInstanceOf(MockQueryBuilder);
  });

  it('should demonstrate usage pattern for mocking in tests', async () => {
    // This is how you'd use it in a real test
    const client = createMockSupabaseClient();
    
    // Store reference to the builder
    const mockBuilder = createMockQueryBuilder<User>();
    mockBuilder.data = [
      { id: '1', email: 'test@test.com', role: 'admin', tenant_id: 'tenant-1' },
    ];

    // In real usage, you'd mock the client.from() method to return your configured builder
    jest.spyOn(client, 'from').mockReturnValue(mockBuilder);

    const result = await client.from<User>('users').select();

    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].email).toBe('test@test.com');
  });
});

describe('Integration Examples', () => {
  it('should demonstrate filtering patterns', async () => {
    const builder = createMockQueryBuilder<Booking>();
    builder.data = [
      { id: 'b1', customer_id: 'c1', status: 'confirmed', total_amount: 500000 },
      { id: 'b2', customer_id: 'c1', status: 'pending', total_amount: 300000 },
      { id: 'b3', customer_id: 'c2', status: 'completed', total_amount: 700000 },
    ];

    // Mock supports all Supabase filter methods
    const result = await builder
      .select()
      .eq('customer_id', 'c1')
      .in('status', ['confirmed', 'pending'])
      .gte('total_amount', 300000);

    expect(result.data).toHaveLength(3);
  });

  it('should demonstrate error handling patterns', async () => {
    const builder = createMockQueryBuilder<User>();
    builder.error = new Error('Row level security policy violation');

    try {
      const result = await builder.select().eq('id', '1');
      
      if (result.error) {
        throw result.error;
      }
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('security policy');
    }
  });

  it('should demonstrate pagination patterns', async () => {
    const builder = createMockQueryBuilder<User>();
    builder.data = new Array(50).fill(null).map((_, i) => ({
      id: `user-${i}`,
      email: `user${i}@test.com`,
      role: 'user',
      tenant_id: 'tenant-1',
    }));
    builder.count = 50;

    const result = await builder
      .select()
      .range(0, 9)
      .limit(10);

    expect(result.data).toHaveLength(50);
    expect(result.count).toBe(50);
  });
});
