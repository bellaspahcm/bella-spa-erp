import { MisaOutboundAdapter } from '../adapter';
import { IntegrationConfig } from '../../../lib/integrations/abstractions/IIntegrationAdapter';

describe('MISA Outbound Integration Adapter', () => {
  let adapter: MisaOutboundAdapter;

  beforeEach(() => {
    adapter = new MisaOutboundAdapter();
    // Clear mock URL before each test
    delete process.env.MISA_API_URL;
  });

  describe('Configuration Validation', () => {
    it('should validate complete integration config successfully', () => {
      const validConfig: IntegrationConfig = {
        provider: 'misa',
        enabled: true,
        tenantId: 'tenant-123',
        config: {
          apiUrl: 'https://api.misa.com.vn/v2',
          accessToken: 'valid-secret-token',
        },
      };

      const validation = adapter.validate(validConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it('should fail validation if provider does not match', () => {
      const invalidConfig: IntegrationConfig = {
        provider: 'not-misa',
        enabled: true,
        tenantId: 'tenant-123',
        config: {},
      };

      const validation = adapter.validate(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors?.[0]).toContain('Expected provider \'misa\'');
    });

    it('should fail validation if credentials or api url are missing', () => {
      const invalidConfig: IntegrationConfig = {
        provider: 'misa',
        enabled: true,
        tenantId: 'tenant-123',
        config: {},
      };

      const validation = adapter.validate(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing MISA API URL (apiUrl)');
      expect(validation.errors).toContain('Missing MISA Access Token (accessToken)');
    });
  });

  describe('Action Data Validation', () => {
    it('should accept valid sync_invoice data', async () => {
      const result = await adapter.send({
        action: 'sync_invoice',
        tenantId: 'tenant-123',
        data: {
          totalAmount: 1500000000,
          description: 'Syncing sales contract A1-100',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject sync_invoice data if amount is missing', async () => {
      const result = await adapter.send({
        action: 'sync_invoice',
        tenantId: 'tenant-123',
        data: {
          description: 'Syncing sales contract A1-100 without amount',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invoice requires an amount');
    });

    it('should reject sync_expense data if amount is missing', async () => {
      const result = await adapter.send({
        action: 'sync_expense',
        tenantId: 'tenant-123',
        data: {
          category: 'office_supplies',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expense requires an amount');
    });

    it('should reject sync_salary data if amount is missing', async () => {
      const result = await adapter.send({
        action: 'sync_salary',
        tenantId: 'tenant-123',
        data: {
          ktvId: 'ktv-123',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Salary requires an amount');
    });

    it('should reject sync_journal data if lines and product_id are missing', async () => {
      const result = await adapter.send({
        action: 'sync_journal',
        tenantId: 'tenant-123',
        data: {
          description: 'Generic journal without entries',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Journal entry requires lines array or product transaction context');
    });
  });

  describe('HTTP Sync and Retry Mechanism', () => {
    let originalFetch: typeof global.fetch;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('should successfully sync transaction in live mode (fetch succeeds)', async () => {
      process.env.MISA_API_URL = 'https://api.misa.com.vn/v2';
      process.env.MISA_API_TOKEN = 'live-token';

      const mockResponse = {
        misa_ref_id: 'misa-ref-123',
        status: 'synced',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.send({
        action: 'sync_invoice',
        tenantId: 'tenant-123',
        data: {
          totalAmount: 20000000,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry up to 3 times on transient failure and succeed eventually', async () => {
      process.env.MISA_API_URL = 'https://api.misa.com.vn/v2';
      process.env.MISA_API_TOKEN = 'live-token';

      const mockResponse = {
        misa_ref_id: 'misa-ref-123',
        status: 'synced',
      };

      // Mock fetch: fail first 2 times, succeed on 3rd attempt
      let attempts = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            status: 503,
            text: () => Promise.resolve('Service Unavailable'),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });
      });

      const result = await adapter.send({
        action: 'sync_invoice',
        tenantId: 'tenant-123',
        data: {
          totalAmount: 20000000,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after 3 unsuccessful retry attempts', async () => {
      process.env.MISA_API_URL = 'https://api.misa.com.vn/v2';
      process.env.MISA_API_TOKEN = 'live-token';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await adapter.send({
        action: 'sync_invoice',
        tenantId: 'tenant-123',
        data: {
          totalAmount: 20000000,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to sync to MISA after 3 attempts');
      expect(result.retryable).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
