/**
 * Unit tests for TenantContext middleware.
 * 
 * @remarks
 * These tests verify that the middleware correctly extracts tenant context
 * from authenticated requests and handles error cases appropriately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext, withTenantContext } from './tenantContext';

// Mock Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(),
}));

// Import after mock
import { createClient } from '@/lib/supabase-server';

describe('extractTenantContext', () => {
  let mockSupabase: unknown;
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock request
    mockRequest = {
      headers: new Headers(),
      url: 'http://localhost:3000/api/test',
    } as NextRequest;

    // Create mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('Success Cases', () => {
    it('should extract tenant context for authenticated user with tenant', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Mock user profile with tenant_id
      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tenant_id: 'tenant-456' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockUserQuery);

      // Mock tenant configuration
      const mockTenantQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'tenant-456',
            name: 'Test Tenant',
            enabled_modules: ['spa'],
            subscription_tier: 'professional',
            role_permissions: {
              feature_flags: {
                advanced_reports: true,
              },
            },
            brand_theme: {
              logoUrl: 'https://example.com/logo.png',
              primaryColor: '#000000',
            },
            salary_config: { base_rate: 5000 },
            qr_bank_code: 'VCB',
            qr_account_number: '1234567890',
            qr_account_name: 'Test Company',
            contact_phone: '0123456789',
            email: 'contact@test.com',
            address: '123 Test St',
            logo_url: null,
          },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockTenantQuery);

      // Execute
      const result = await extractTenantContext(mockRequest);

      // Verify success
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.tenantId).toBe('tenant-456');
        expect(result.context.tenantName).toBe('Test Tenant');
        expect(result.context.enabledModules).toEqual(['spa']);
        expect(result.context.subscriptionPlan).toBe('professional');
        expect(result.context.featureFlags.advanced_reports).toBe(true);
        expect(result.context.settings.currency).toBe('VND');
        expect(result.context.settings.timezone).toBe('Asia/Ho_Chi_Minh');
        expect(result.context.settings.logoUrl).toBe('https://example.com/logo.png');
        expect(result.context.settings.salaryConfig).toEqual({ base_rate: 5000 });
        expect(result.context.settings.qrPayment).toEqual({
          bankCode: 'VCB',
          accountNumber: '1234567890',
          accountName: 'Test Company',
        });
        expect(result.context.settings.contact).toEqual({
          phone: '0123456789',
          email: 'contact@test.com',
          address: '123 Test St',
        });
      }

      // Verify calls
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.from).toHaveBeenCalledWith('tenants');
    });

    it('should use default values for missing tenant configuration', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock user profile
      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tenant_id: 'tenant-789' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockUserQuery);

      // Mock minimal tenant configuration
      const mockTenantQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'tenant-789',
            name: 'Minimal Tenant',
            enabled_modules: null, // Should default to ['spa']
            subscription_tier: null, // Should default to 'basic'
            role_permissions: null,
            brand_theme: null,
            logo_url: null,
            salary_config: null,
            qr_bank_code: null,
            contact_phone: null,
            email: null,
            address: null,
          },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockTenantQuery);

      // Execute
      const result = await extractTenantContext(mockRequest);

      // Verify defaults applied
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.enabledModules).toEqual(['spa']);
        expect(result.context.subscriptionPlan).toBe('basic');
        expect(result.context.featureFlags).toEqual({});
        expect(result.context.settings.currency).toBe('VND');
        expect(result.context.settings.companyName).toBe('Minimal Tenant');
      }
    });
  });

  describe('Error Cases', () => {
    it('should return 401 for unauthenticated user', async () => {
      // Mock authentication failure
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      // Execute
      const result = await extractTenantContext(mockRequest);

      // Verify error response
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.statusCode).toBe(401);
        expect(result.error).toContain('Unauthorized');
      }
    });

    it('should return 403 for user without tenant', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-no-tenant' } },
        error: null,
      });

      // Mock user profile with no tenant_id
      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tenant_id: null },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockUserQuery);

      // Execute
      const result = await extractTenantContext(mockRequest);

      // Verify error response
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.statusCode).toBe(403);
        expect(result.error).toContain('no tenant assigned');
      }
    });

    it('should return 404 for non-existent tenant', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-999' } },
        error: null,
      });

      // Mock user profile
      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tenant_id: 'non-existent-tenant' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockUserQuery);

      // Mock tenant not found
      const mockTenantQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockTenantQuery);

      // Execute
      const result = await extractTenantContext(mockRequest);

      // Verify error response
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.statusCode).toBe(404);
        expect(result.error).toContain('not found');
      }
    });

    it('should return 500 for database query error', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-db-error' } },
        error: null,
      });

      // Mock database error
      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockUserQuery);

      // Execute
      const result = await extractTenantContext(mockRequest);

      // Verify error response
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.statusCode).toBe(500);
        expect(result.error).toContain('Failed to fetch');
      }
    });
  });
});

describe('withTenantContext middleware', () => {
  let mockSupabase: unknown;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: { getUser: jest.fn() },
      from: jest.fn(),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  it('should call handler with tenant context when extraction succeeds', async () => {
    // Mock successful extraction
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-success' } },
      error: null,
    });

    const mockUserQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-success' },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(mockUserQuery);

    const mockTenantQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'tenant-success',
          name: 'Success Tenant',
          enabled_modules: ['spa'],
          subscription_tier: 'basic',
          role_permissions: null,
          brand_theme: null,
          logo_url: null,
        },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(mockTenantQuery);

    // Create mock handler
    const mockHandler = jest.fn().mockResolvedValue(
      NextResponse.json({ success: true })
    );

    // Create wrapped handler
    const wrappedHandler = withTenantContext(mockHandler);

    // Create mock request
    const mockRequest = new NextRequest('http://localhost:3000/api/test');

    // Execute
    await wrappedHandler(mockRequest);

    // Verify handler was called with tenant context
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantContext: expect.objectContaining({
          tenantId: 'tenant-success',
          tenantName: 'Success Tenant',
        }),
      })
    );
  });

  it('should return error response when extraction fails', async () => {
    // Mock extraction failure (unauthenticated)
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    // Create mock handler (should not be called)
    const mockHandler = jest.fn();

    // Create wrapped handler
    const wrappedHandler = withTenantContext(mockHandler);

    // Create mock request
    const mockRequest = new NextRequest('http://localhost:3000/api/test');

    // Execute
    const response = await wrappedHandler(mockRequest);

    // Verify handler was NOT called
    expect(mockHandler).not.toHaveBeenCalled();

    // Verify error response
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('should handle handler errors gracefully', async () => {
    // Mock successful extraction
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-handler-error' } },
      error: null,
    });

    const mockUserQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-handler-error' },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(mockUserQuery);

    const mockTenantQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'tenant-handler-error',
          name: 'Error Tenant',
          enabled_modules: ['spa'],
          subscription_tier: 'basic',
          role_permissions: null,
          brand_theme: null,
          logo_url: null,
        },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(mockTenantQuery);

    // Create handler that throws error
    const mockHandler = jest.fn().mockRejectedValue(
      new Error('Handler error')
    );

    // Create wrapped handler
    const wrappedHandler = withTenantContext(mockHandler);

    // Create mock request
    const mockRequest = new NextRequest('http://localhost:3000/api/test');

    // Execute
    const response = await wrappedHandler(mockRequest);

    // Verify error response
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('Internal server error');
  });
});
