/**
 * Mock Supabase Client for Testing
 * 
 * This mock provides a simplified Supabase client interface
 * for unit and integration tests. It returns predictable data
 * and allows testing without real database connections.
 * 
 * Usage:
 * ```typescript
 * jest.mock('@/lib/supabase-server');
 * import { createClient } from '@/lib/supabase-server';
 * 
 * // In tests:
 * const supabase = createClient();
 * const mockFrom = supabase.from as jest.Mock;
 * mockFrom.mockReturnValueOnce({
 *   select: jest.fn().mockResolvedValue({ data: [...], error: null }),
 * });
 * ```
 */

interface MockQueryBuilder {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  in: jest.Mock;
  gt: jest.Mock;
  gte: jest.Mock;
  lt: jest.Mock;
  lte: jest.Mock;
  like: jest.Mock;
  ilike: jest.Mock;
  is: jest.Mock;
  or: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  range: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
}

/**
 * Create a mock query builder with chainable methods
 * Each method returns a NEW instance to avoid conflicts
 */
function createMockQueryBuilder(): MockQueryBuilder {
  const mockBuilder: any = {
    select: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    insert: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    update: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    delete: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    upsert: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    eq: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    neq: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    in: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    gt: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    gte: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    lt: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    lte: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    like: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    ilike: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    is: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    or: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    order: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    limit: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    range: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };

  return mockBuilder;
}

/**
 * Mock Supabase client
 * Each from() call returns a FRESH query builder to avoid test conflicts
 */
export const createClient = jest.fn(() => ({
  from: jest.fn((table: string) => createMockQueryBuilder()),
  
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          role: 'authenticated',
        },
      },
      error: null,
    }),
    
    getSession: jest.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
          access_token: 'test-token',
        },
      },
      error: null,
    }),
  },
  
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      download: jest.fn().mockResolvedValue({ data: null, error: null }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

/**
 * Helper: Reset all mocks between tests
 */
export function resetSupabaseMocks() {
  (createClient as jest.Mock).mockClear();
}
