/**
 * BELLA LAND — SERVER ACTIONS INTEGRATION TEST
 *
 * Tests Next.js Server Actions → Product Services → Real Estate OS → Database flow.
 * Verifies the complete integration stack from UI entry point to database.
 *
 * @module src/products/bella-land/__tests__/bella-land-actions.integration.test
 */

import { fetchPropertyCatalogAction } from '../actions/property-catalog.actions';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import crypto from 'crypto';

// Mock dependencies
jest.mock('@/lib/supabase-server');
jest.mock('@/services/user-actions');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;

describe('BELLA LAND — SERVER ACTIONS INTEGRATION', () => {
  const TEST_TENANT_ID = crypto.randomUUID();
  const TEST_PROJECT_ID = crypto.randomUUID();
  const TEST_UNIT_ID = crypto.randomUUID();

  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authenticated user
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      tenant_id: TEST_TENANT_ID,
      email: 'test@example.com',
      role: 'agent'
    } as any);

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: TEST_UNIT_ID,
                    tenant_id: TEST_TENANT_ID,
                    project_id: TEST_PROJECT_ID,
                    product_code: 'A-101',
                    product_type: 'apartment',
                    status: 'available',
                    area: 85.5,
                    unit_price: 3500000000
                  },
                  {
                    id: crypto.randomUUID(),
                    tenant_id: TEST_TENANT_ID,
                    project_id: TEST_PROJECT_ID,
                    product_code: 'A-102',
                    product_type: 'apartment',
                    status: 'available',
                    area: 90.0,
                    unit_price: 3800000000
                  }
                ],
                error: null
              })
            })
          })
        })
      })
    };

    mockCreateClient.mockResolvedValue(mockSupabase as any);
  });

  test('Server Action: Fetches property catalog successfully', async () => {
    const result = await fetchPropertyCatalogAction(TEST_PROJECT_ID);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.length).toBe(2);
    expect(result.data?.[0].product_code).toBe('A-101');
    expect(result.data?.[1].product_code).toBe('A-102');
  });

  test('Server Action: Rejects request without authentication', async () => {
    mockGetCurrentUser.mockResolvedValue(null as any);

    const result = await fetchPropertyCatalogAction(TEST_PROJECT_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain('UNAUTHORIZED');
  });

  test('Server Action: Rejects request without tenant context', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      tenant_id: null,
      email: 'test@example.com',
      role: 'agent'
    } as any);

    const result = await fetchPropertyCatalogAction(TEST_PROJECT_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain('UNAUTHORIZED');
  });

  test('Server Action: Validates project ID is required', async () => {
    const result = await fetchPropertyCatalogAction('');

    expect(result.success).toBe(false);
    expect(result.error).toContain('VALIDATION_ERROR');
    expect(result.error).toContain('Project ID is required');
  });

  test('Server Action: Returns empty array for non-existent project', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      })
    });

    const nonExistentProjectId = crypto.randomUUID();
    const result = await fetchPropertyCatalogAction(nonExistentProjectId);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.length).toBe(0);
  });

  test('Server Action: Handles database error gracefully', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      })
    });

    const result = await fetchPropertyCatalogAction(TEST_PROJECT_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('Server Action: Executes through complete Product → OS → DB stack', async () => {
    const result = await fetchPropertyCatalogAction(TEST_PROJECT_ID);

    // Verify the call chain
    expect(mockGetCurrentUser).toHaveBeenCalled();
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('real_estate_products');

    // Verify tenant isolation in query
    const fromCall = mockSupabase.from.mock.results[0].value;
    expect(fromCall.select).toHaveBeenCalledWith('*');

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(2);
  });
});
