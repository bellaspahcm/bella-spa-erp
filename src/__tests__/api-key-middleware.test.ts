/**
 * API Key Middleware Tests - Phase 1
 * 
 * Critical security tests for tenant isolation
 * 
 * @module __tests__/api-key-middleware
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
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
  beforeAll(async () => {
    // Setup: Create test partners in database
    const supabase = createClient();
    
    // Create test partners (this would be done via migration seed in real setup)
    // For now, these tests assume partners exist
  });
  
  afterAll(async () => {
    // Cleanup test data
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
      const supabase = createClient();
      
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

