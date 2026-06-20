jest.mock('server-only', () => ({}), { virtual: true });

const mockRpc = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

const mockAdminFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockAdminFrom,
  })),
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://mock.supabase.co',
  getSupabaseAdminKey: () => 'mock-key',
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { apiKeyMiddleware, RequestWithPartner } from '@/lib/middleware/api-key.middleware';
import { createClient } from '@/lib/supabase-server';

// Mock data
const MOCK_TENANT_A = 'tenant_a_uuid';
const MOCK_TENANT_B = 'tenant_b_uuid';
const MOCK_API_KEY_A = 'pk_live_tenant_a_test_key';
const MOCK_API_KEY_B = 'pk_live_tenant_b_test_key';
const MOCK_INVALID_KEY = 'pk_live_invalid_key';

describe('API Key Middleware - Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ data: null, error: null });
    
    mockRpc.mockImplementation((fn, params) => {
      if (params.p_api_key === MOCK_API_KEY_A) {
        return Promise.resolve({
          data: [{
            partner_id: 'test_partner_a',
            tenant_id: MOCK_TENANT_A,
            partner_name: 'Partner A',
            allowed_scopes: ['order:read', 'order:write'],
            is_active: true,
            is_sandbox: false,
            rate_limit_per_minute: 100,
            rate_limit_per_day: 5000,
          }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockFrom.mockImplementation((table) => {
      return {
        insert: mockInsert,
        delete: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({
                data: [{ endpoint: '/api/v1/orders', method: 'GET' }],
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    mockAdminFrom.mockImplementation((table) => {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { metadata: {} }, error: null }),
          }),
        }),
      };
    });
  });
  
  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'GET',
      }) as RequestWithPartner;
      
      const response = await apiKeyMiddleware(req);
      
      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);
      
      const body = await response?.json();
      expect(body.error.code).toBe('AUTH_001');
    });
    
    it('should reject requests with invalid API key', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'GET',
        headers: {
          'x-api-key': MOCK_INVALID_KEY,
        },
      }) as RequestWithPartner;
      
      const response = await apiKeyMiddleware(req);
      
      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);
      
      const body = await response?.json();
      expect(body.error.code).toBe('AUTH_001');
    });
    
    it('should accept valid API key via x-api-key header', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'GET',
        headers: {
          'x-api-key': MOCK_API_KEY_A,
        },
      }) as RequestWithPartner;
      
      const response = await apiKeyMiddleware(req);
      
      // Null response means authentication passed
      expect(response).toBeNull();
      expect(req.partner).toBeDefined();
      expect(req.partner?.tenant_id).toBe(MOCK_TENANT_A);
    });
    
    it('should accept valid API key via Authorization header', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${MOCK_API_KEY_A}`,
        },
      }) as RequestWithPartner;
      
      const response = await apiKeyMiddleware(req);
      
      expect(response).toBeNull();
      expect(req.partner).toBeDefined();
      expect(req.partner?.tenant_id).toBe(MOCK_TENANT_A);
    });

    it('should reject requests if client IP is not in partner IP whitelist', async () => {
      // Mock metadata with IP whitelist
      mockAdminFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { metadata: { ip_whitelist: ['192.168.1.100'] } },
              error: null,
            }),
          }),
        }),
      }));

      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'GET',
        headers: {
          'x-api-key': MOCK_API_KEY_A,
          'x-forwarded-for': '203.0.113.195', // Unauthorized IP
        },
      }) as RequestWithPartner;

      const response = await apiKeyMiddleware(req);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);

      const body = await response?.json();
      expect(body.error.code).toBe('AUTHZ_001');
      expect(body.error.message).toContain('IP address is not whitelisted');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        partner_id: 'test_partner_a',
        tenant_id: MOCK_TENANT_A,
        endpoint: '/api/v1/orders',
        status_code: 403,
        is_error: true,
        error_code: 'AUTHZ_001',
        ip_address: '203.0.113.195',
      }));
    });

    it('should propagate audit persistence failures for rejected IPs', async () => {
      mockAdminFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { metadata: { ip_whitelist: ['192.168.1.100'] } },
              error: null,
            }),
          }),
        }),
      }));
      mockInsert.mockResolvedValueOnce({
        data: null,
        error: { code: 'DB_DOWN', message: 'audit unavailable' },
      });

      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'GET',
        headers: {
          'x-api-key': MOCK_API_KEY_A,
          'x-forwarded-for': '203.0.113.195',
        },
      }) as RequestWithPartner;

      await expect(apiKeyMiddleware(req)).rejects.toMatchObject({
        code: 'SERVER_002',
        message: 'Failed to persist API request audit log',
      });
    });

    it('should allow requests if client IP matches partner IP whitelist', async () => {
      // Mock metadata with IP whitelist
      mockAdminFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { metadata: { ip_whitelist: ['192.168.1.100', '203.0.113.195'] } },
              error: null,
            }),
          }),
        }),
      }));

      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'GET',
        headers: {
          'x-api-key': MOCK_API_KEY_A,
          'x-forwarded-for': '203.0.113.195', // Authorized IP
        },
      }) as RequestWithPartner;

      const response = await apiKeyMiddleware(req);

      expect(response).toBeNull(); // Should pass
      expect(req.partner).toBeDefined();
    });
  });
  
  describe('Tenant Isolation - CRITICAL SECURITY', () => {
    it('should resolve tenant from API key, not from request body', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'POST',
        headers: {
          'x-api-key': MOCK_API_KEY_A,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_123',
          // Note: NO tenant_id in body - should be resolved from API key
        }),
      }) as RequestWithPartner;
      
      const response = await apiKeyMiddleware(req);
      
      expect(response).toBeNull();
      expect(req.partner?.tenant_id).toBe(MOCK_TENANT_A);
    });
    
    it('should REJECT if client tries to inject different tenant_id', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'POST',
        headers: {
          'x-api-key': MOCK_API_KEY_A, // Partner A's key
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_123',
          tenant_id: MOCK_TENANT_B, // ❌ Trying to access Tenant B data!
        }),
      }) as RequestWithPartner;
      
      const response = await apiKeyMiddleware(req);
      
      // Should be rejected
      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);
      
      const body = await response?.json();
      expect(body.error.code).toBe('AUTHZ_003');
      expect(body.error.message).toContain('Tenant ID mismatch');
    });
    
    it('should allow if client provides matching tenant_id', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'POST',
        headers: {
          'x-api-key': MOCK_API_KEY_A,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: 'cust_123',
          tenant_id: MOCK_TENANT_A, // ✅ Matches API key's tenant
        }),
      }) as RequestWithPartner;
      
      const response = await apiKeyMiddleware(req);
      
      // Should pass
      expect(response).toBeNull();
      expect(req.partner?.tenant_id).toBe(MOCK_TENANT_A);
    });
  });
  
  describe('Public Endpoints', () => {
    it('should allow public endpoints without API key', async () => {
      const publicEndpoints = [
        '/api/auth/login',
        '/api/auth/logout',
        '/api/health',
      ];
      
      for (const endpoint of publicEndpoints) {
        const req = new NextRequest(`http://localhost:3000${endpoint}`, {
          method: 'GET',
        }) as RequestWithPartner;
        
        const response = await apiKeyMiddleware(req);
        
        // Should pass (null response)
        expect(response).toBeNull();
      }
    });
  });
  
  describe('Request Logging', () => {
    it('should log all API requests', async () => {
      const supabase = await createClient();
      
      const req = new NextRequest('http://localhost:3000/api/v1/orders', {
        method: 'GET',
        headers: {
          'x-api-key': MOCK_API_KEY_A,
        },
      }) as RequestWithPartner;
      
      // Clear previous logs
      await supabase
        .from('api_request_logs')
        .delete()
        .eq('partner_id', 'test_partner_a');
      
      // Make request
      await apiKeyMiddleware(req);
      
      // Check log was created
      const { data: logs, error } = await supabase
        .from('api_request_logs')
        .select('*')
        .eq('partner_id', 'test_partner_a')
        .order('created_at', { ascending: false })
        .limit(1);
      
      expect(error).toBeNull();
      expect(logs).toHaveLength(1);
      expect(logs![0].endpoint).toBe('/api/v1/orders');
      expect(logs![0].method).toBe('GET');
    });
  });
});

