import { supabase } from '@/lib/supabase';
import { metadataEngine } from './metadata-engine';

describe('MetadataEngine', () => {
  const tenantId = 'tenant-123';
  const configKey = 're.product.status';

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
  };

  let spyFrom: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    spyFrom = jest.spyOn(supabase as any, 'from').mockReturnValue(mockQueryBuilder as any);
  });

  afterEach(() => {
    spyFrom.mockRestore();
  });

  describe('getLatest', () => {
    it('should query and return the latest version of config', async () => {
      const mockResult = {
        id: 'config-id-1',
        tenant_id: tenantId,
        config_key: configKey,
        config_values: { active: true },
        version: 2,
        updated_at: new Date().toISOString(),
        updated_by: 'admin',
        correlation_id: 'corr-1',
      };

      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await metadataEngine.getLatest(tenantId, configKey);

      expect(spyFrom).toHaveBeenCalledWith('metadata_configs');
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('config_key', configKey);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('version', { ascending: false });

      expect(result).not.toBeNull();
      expect(result!.version).toBe(2);
      expect(result!.configValues).toEqual({ active: true });
    });

    it('should propagate database error', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: new Error('Postgres error'),
      });

      await expect(metadataEngine.getLatest(tenantId, configKey)).rejects.toThrow('Postgres error');
    });
  });

  describe('saveNewVersion', () => {
    it('should fetch latest version, increment it, and insert both config and history entries', async () => {
      // 1. Mock getLatest returning version 2
      const latestMock = {
        id: 'config-id-1',
        tenant_id: tenantId,
        config_key: configKey,
        config_values: { active: true },
        version: 2,
        updated_at: new Date().toISOString(),
        updated_by: 'admin',
        correlation_id: 'corr-1',
      };

      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: latestMock, error: null }); // for getLatest

      // 2. Mock insert into configs returning version 3
      const newConfigMock = {
        id: 'config-id-2',
        tenant_id: tenantId,
        config_key: configKey,
        config_values: { active: false },
        version: 3,
        updated_at: new Date().toISOString(),
        updated_by: 'user-789',
        correlation_id: 'corr-2',
      };

      mockQueryBuilder.single.mockResolvedValueOnce({ data: newConfigMock, error: null }); // for insert config
      mockQueryBuilder.insert
        .mockReturnValueOnce(mockQueryBuilder) // first call returns queryBuilder to chain select
        .mockResolvedValueOnce({ error: null }); // second call resolves directly for history insert

      const result = await metadataEngine.saveNewVersion({
        tenantId,
        configKey,
        configValues: { active: false },
        updatedBy: 'user-789',
        correlationId: 'corr-2',
      });

      expect(result.version).toBe(3);
      expect(result.configValues).toEqual({ active: false });
      expect(result.correlationId).toBe('corr-2');

      // Verify config insertion
      expect(mockQueryBuilder.insert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          tenant_id: tenantId,
          config_key: configKey,
          version: 3,
          updated_by: 'user-789',
        })
      );

      // Verify history insertion
      expect(mockQueryBuilder.insert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          config_id: 'config-id-2',
          tenant_id: tenantId,
          config_key: configKey,
          version: 3,
        })
      );
    });
  });
});
