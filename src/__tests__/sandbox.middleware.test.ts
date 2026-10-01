/**
 * Sandbox Middleware Tests
 * 
 * Tests for sandbox environment detection and routing
 */

import { NextRequest } from 'next/server';
import {
  detectEnvironment,
  getSchemaForEnvironment,
  detectSandboxMode,
  validateEnvironmentAccess,
  addSandboxHeaders,
} from '@/lib/middleware/sandbox.middleware';
import { APIError, type APIPartner } from '@/types/api-gateway';
import type { PartnerContext, RequestWithPartner } from '@/lib/middleware/api-key.middleware';

type SandboxConfig = ReturnType<typeof detectSandboxMode>;
type TestSandboxRequest = RequestWithPartner & { sandbox?: SandboxConfig };

const createPartnerContext = (overrides: Partial<PartnerContext> = {}): PartnerContext => ({
  partner_id: 'partner-123',
  partner_name: 'Test Partner',
  tenant_id: 'tenant-123',
  allowed_scopes: [],
  is_active: true,
  is_sandbox: true,
  rate_limit_per_minute: 100,
  rate_limit_per_day: 5_000,
  ...overrides,
});

const createApiPartner = (apiKey: string): APIPartner => ({
  id: 'partner-123',
  tenant_id: 'tenant-123',
  partner_name: 'Test Partner',
  partner_type: 'pos',
  api_key: apiKey,
  allowed_scopes: [],
  is_active: true,
  is_sandbox: apiKey.startsWith('pk_test_'),
  rate_limit_tier: 'free',
  rate_limit_per_minute: 100,
  rate_limit_per_day: 5_000,
  rate_limit_burst: 100,
  total_requests_count: 0,
  failed_requests_count: 0,
  created_at: '2026-09-30T00:00:00.000Z',
  updated_at: '2026-09-30T00:00:00.000Z',
});

const createRequestWithPartner = (
  partner: PartnerContext,
  url = 'https://api.bella.vn/v1/orders'
): TestSandboxRequest => {
  const req = new NextRequest(url) as TestSandboxRequest;
  req.partner = partner;
  return req;
};

const createRequestWithSandbox = (sandbox: SandboxConfig): TestSandboxRequest => {
  const req = new NextRequest('https://api.bella.vn/v1/orders') as TestSandboxRequest;
  req.sandbox = sandbox;
  return req;
};

describe('Sandbox Middleware', () => {
  describe('detectEnvironment()', () => {
    it('detects sandbox from pk_test_ prefix', () => {
      expect(detectEnvironment('pk_test_abc123')).toBe('sandbox');
      expect(detectEnvironment('pk_test_xyz789')).toBe('sandbox');
    });

    it('detects production from pk_live_ prefix', () => {
      expect(detectEnvironment('pk_live_abc123')).toBe('production');
      expect(detectEnvironment('pk_live_xyz789')).toBe('production');
    });

    it('throws error for invalid API key format', () => {
      expect(() => detectEnvironment('invalid_key')).toThrow(APIError);
      expect(() => detectEnvironment('pk_wrong_format')).toThrow(APIError);
      expect(() => detectEnvironment('')).toThrow(APIError);
    });
  });

  describe('getSchemaForEnvironment()', () => {
    it('returns sandbox schema for sandbox environment', () => {
      expect(getSchemaForEnvironment('sandbox')).toBe('sandbox');
    });

    it('returns public schema for production environment', () => {
      expect(getSchemaForEnvironment('production')).toBe('public');
    });
  });

  describe('detectSandboxMode()', () => {
    it('detects sandbox mode from test API key', () => {
      const req = createRequestWithPartner(createPartnerContext({
        partner_id: 'partner-123',
        partner_name: 'Test Partner',
        tenant_id: 'tenant-123',
        is_sandbox: true,
      }));

      const config = detectSandboxMode(req);

      expect(config.environment).toBe('sandbox');
      expect(config.schema).toBe('sandbox');
      expect(config.isSandbox).toBe(true);
    });

    it('detects production mode from live API key', () => {
      const req = createRequestWithPartner(createPartnerContext({
        partner_id: 'partner-123',
        partner_name: 'Prod Partner',
        tenant_id: 'tenant-123',
        is_sandbox: false,
      }));

      const config = detectSandboxMode(req);

      expect(config.environment).toBe('production');
      expect(config.schema).toBe('public');
      expect(config.isSandbox).toBe(false);
    });

    it('throws error if partner not set', () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      // No partner set

      expect(() => detectSandboxMode(req)).toThrow(APIError);
      expect(() => detectSandboxMode(req)).toThrow('Partner not set');
    });

    it('sets sandbox config on request object', () => {
      const req = createRequestWithPartner(createPartnerContext({
        partner_id: 'partner-123',
        is_sandbox: true,
      }));

      detectSandboxMode(req);

      expect(req.sandbox).toBeDefined();
      expect(req.sandbox?.environment).toBe('sandbox');
    });
  });

  describe('validateEnvironmentAccess()', () => {
    it('allows access when environment matches', () => {
      const partner = createApiPartner('pk_test_abc123');

      expect(() => {
        validateEnvironmentAccess(partner, 'sandbox');
      }).not.toThrow();
    });

    it('blocks access when environment mismatch', () => {
      const partner = createApiPartner('pk_test_abc123'); // Sandbox key

      expect(() => {
        validateEnvironmentAccess(partner, 'production'); // Requires production
      }).toThrow(APIError);

      expect(() => {
        validateEnvironmentAccess(partner, 'production');
      }).toThrow('requires production API key');
    });

    it('provides helpful error message', () => {
      const partner = createApiPartner('pk_live_xyz789'); // Production key

      try {
        validateEnvironmentAccess(partner, 'sandbox'); // Requires sandbox
        fail('Should have thrown error');
      } catch (error: unknown) {
        const apiError = error as APIError;
        expect(apiError.message).toContain('requires sandbox API key');
        expect(apiError.message).toContain('using production key');
        expect(apiError.details).toMatchObject({
          current_environment: 'production',
          required_environment: 'sandbox',
        });
      }
    });
  });

  describe('addSandboxHeaders()', () => {
    it('adds sandbox headers for test API key', () => {
      const req = createRequestWithSandbox({
        environment: 'sandbox',
        schema: 'sandbox',
        isSandbox: true,
      });

      const headers: Record<string, string> = {};
      addSandboxHeaders(req, headers);

      expect(headers['X-Environment']).toBe('sandbox');
      expect(headers['X-Sandbox-Mode']).toBe('true');
      expect(headers['X-Sandbox-Schema']).toBe('sandbox');
    });

    it('adds production headers for live API key', () => {
      const req = createRequestWithSandbox({
        environment: 'production',
        schema: 'public',
        isSandbox: false,
      });

      const headers: Record<string, string> = {};
      addSandboxHeaders(req, headers);

      expect(headers['X-Environment']).toBe('production');
      expect(headers['X-Sandbox-Mode']).toBe('false');
      expect(headers['X-Sandbox-Schema']).toBeUndefined();
    });

    it('works with Headers object', () => {
      const req = createRequestWithSandbox({
        environment: 'sandbox',
        schema: 'sandbox',
        isSandbox: true,
      });

      const headers = new Headers();
      addSandboxHeaders(req, headers);

      expect(headers.get('X-Environment')).toBe('sandbox');
      expect(headers.get('X-Sandbox-Mode')).toBe('true');
      expect(headers.get('X-Sandbox-Schema')).toBe('sandbox');
    });

    it('defaults to production if sandbox not detected', () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      // No sandbox config set

      const headers: Record<string, string> = {};
      addSandboxHeaders(req, headers);

      expect(headers['X-Environment']).toBe('production');
      expect(headers['X-Sandbox-Mode']).toBe('false');
    });
  });

  describe('Integration: Full Request Flow', () => {
    it('handles sandbox request end-to-end', () => {
      // 1. Request comes in with test API key
      const req = new NextRequest('https://api.bella.vn/v1/orders', {
        headers: {
          'X-API-Key': 'pk_test_abc123xyz',
        },
      });

      // 2. After withAPIKey middleware
      const typedReq = req as TestSandboxRequest;
      typedReq.partner = createPartnerContext({
        partner_id: 'partner-123',
        partner_name: 'Test Partner',
        tenant_id: 'tenant-456',
        is_sandbox: true,
      });

      // 3. Detect sandbox mode
      const config = detectSandboxMode(req);

      // 4. Validate configuration
      expect(config.environment).toBe('sandbox');
      expect(config.schema).toBe('sandbox');
      expect(config.isSandbox).toBe(true);

      // 5. Add response headers
      const headers: Record<string, string> = {};
      addSandboxHeaders(req, headers);

      // 6. Verify headers
      expect(headers['X-Environment']).toBe('sandbox');
      expect(headers['X-Sandbox-Mode']).toBe('true');
    });

    it('handles production request end-to-end', () => {
      // 1. Request with live API key
      const req = new NextRequest('https://api.bella.vn/v1/orders', {
        headers: {
          'X-API-Key': 'pk_live_abc123xyz',
        },
      });

      // 2. After withAPIKey middleware
      const typedReq = req as TestSandboxRequest;
      typedReq.partner = createPartnerContext({
        partner_id: 'partner-789',
        partner_name: 'Production Partner',
        tenant_id: 'tenant-999',
        is_sandbox: false,
      });

      // 3. Detect sandbox mode
      const config = detectSandboxMode(req);

      // 4. Validate configuration
      expect(config.environment).toBe('production');
      expect(config.schema).toBe('public');
      expect(config.isSandbox).toBe(false);

      // 5. Add response headers
      const headers: Record<string, string> = {};
      addSandboxHeaders(req, headers);

      // 6. Verify headers
      expect(headers['X-Environment']).toBe('production');
      expect(headers['X-Sandbox-Mode']).toBe('false');
    });
  });

  describe('Security: Cross-Environment Access Prevention', () => {
    it('prevents test key from accessing production', () => {
      const testPartner = createApiPartner('pk_test_abc123');

      expect(() => {
        validateEnvironmentAccess(testPartner, 'production');
      }).toThrow('requires production API key');
    });

    it('prevents live key from accessing sandbox', () => {
      const prodPartner = createApiPartner('pk_live_xyz789');

      expect(() => {
        validateEnvironmentAccess(prodPartner, 'sandbox');
      }).toThrow('requires sandbox API key');
    });
  });
});
