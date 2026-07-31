import { describe, it, expect } from '@jest/globals';
import { moduleRegistry } from '@/core/adapters/registry';
import { ALL_MODULE_IDS } from '@/core/types/module';

describe('Real Estate Module Isolation & Registration Tests', () => {
  describe('Test 1: Module Registry', () => {
    it('should have real_estate in ALL_MODULE_IDS', () => {
      expect(ALL_MODULE_IDS).toContain('real_estate');
    });

    it('should successfully register real_estate adapter in global registry', () => {
      // Import the registration wrapper to trigger self-registration
      require('@/modules/real_estate/register');
      
      expect(moduleRegistry.has('real_estate')).toBe(true);
      
      const adapter = moduleRegistry.get('real_estate');
      expect(adapter).toBeDefined();
      expect(adapter?.moduleName).toBe('Real Estate Management');
      expect(adapter?.moduleId).toBe('real_estate');
    });
  });

  describe('Test 2: Theme & Spacing Definitions', () => {
    it('should have CSS theme variables and selectors in globals.css', () => {
      const fs = require('fs');
      const css = fs.readFileSync('src/app/globals.css', 'utf-8');

      // Check for real_estate theme selector
      expect(css).toContain('html[data-tenant-module="real_estate"]');
      
      // Check for premium theme color tokens
      expect(css).toContain('#1e3a8a'); // Real Estate primary deep navy
      expect(css).toContain('#d97706'); // Real Estate accent amber gold
      expect(css).toContain('#fffbeb'); // Warm cream background
    });
  });

  describe('Test 3: Tenant Isolation & Leakage Checks', () => {
    it('should reject bookings from other tenants in validateBookingRules', async () => {
      const adapter = moduleRegistry.get('real_estate');
      expect(adapter?.validateBookingRules).toBeDefined();

      const mockContext = {
        tenantId: 'tenant-a',
        tenantName: 'Real Estate Chi Nhanh A',
        enabledModules: ['real_estate'] as const,
        subscriptionPlan: 'basic' as const,
        featureFlags: {},
        settings: {},
      };

      const validOrder = {
        id: 'order-1',
        tenantId: 'tenant-a',
        customerId: 'customer-1',
        serviceItemId: 'item-1',
        scheduledStartTime: '2026-07-31',
        status: 'pending' as const,
        metadata: {},
      };

      const invalidOrder = {
        id: 'order-2',
        tenantId: 'tenant-b', // Wrong tenant!
        customerId: 'customer-1',
        serviceItemId: 'item-1',
        scheduledStartTime: '2026-07-31',
        status: 'pending' as const,
        metadata: {},
      };

      // Valid order must pass
      const validResult = await adapter!.validateBookingRules!(validOrder, mockContext);
      expect(validResult).toBe(true);

      // Order with different tenantId must be blocked
      const invalidResult = await adapter!.validateBookingRules!(invalidOrder, mockContext);
      expect(invalidResult).toBe(false);
    });
  });

  describe('Test 4: Database & RLS Isolation', () => {
    const skipSupabaseTests = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = skipSupabaseTests
      ? null
      : require('@supabase/supabase-js').createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

    it('should successfully fetch projects and products from the database if they exist', async () => {
      if (skipSupabaseTests) {
        console.log('⚠️  Skipping database fetch test - credentials not available');
        return;
      }

      const { data: projects, error: projectsError } = await supabase
        .from('real_estate_projects')
        .select('*');

      if (projectsError) {
        console.error('Failed to query real_estate_projects:', projectsError.message);
        throw projectsError;
      }

      expect(Array.isArray(projects)).toBe(true);

      const { data: products, error: productsError } = await supabase
        .from('real_estate_products')
        .select('*');

      if (productsError) {
        console.error('Failed to query real_estate_products:', productsError.message);
        throw productsError;
      }

      expect(Array.isArray(products)).toBe(true);
    });
  });

  describe('Test 5: Service Layer and State Machine Validation', () => {
    it('should allow valid transitions according to the state machine dict', async () => {
      // Mock supabase client
      const mockSingle = jest.fn().mockImplementation(() => Promise.resolve({
        data: { id: 'prod-1', tenant_id: 'tenant-a', status: 'available', product_code: 'A1-101' },
        error: null,
      }));
      const mockSelect = jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(() => ({
            single: mockSingle,
          })),
        })),
      }));
      const mockUpdateSingle = jest.fn().mockImplementation(() => Promise.resolve({
        data: { id: 'prod-1', tenant_id: 'tenant-a', status: 'booked', product_code: 'A1-101' },
        error: null,
      }));
      const mockUpdate = jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(() => ({
            select: jest.fn().mockImplementation(() => ({
              single: mockUpdateSingle,
            })),
          })),
        })),
      }));
      const mockSupabase = {
        from: jest.fn().mockImplementation((table) => {
          if (table === 'real_estate_products') {
            return {
              select: mockSelect,
              update: mockUpdate,
            };
          }
          return {};
        }),
      } as any;

      const { ProductService } = require('@/modules/real_estate/services/ProductService');
      const updatedProduct = await ProductService.updateProductStatus(
        mockSupabase,
        'tenant-a',
        'prod-1',
        'booked',
        'Khách Hàng A'
      );

      expect(updatedProduct.status).toBe('booked');
      expect(mockSupabase.from).toHaveBeenCalledWith('real_estate_products');
    });

    it('should block invalid transitions and throw error', async () => {
      const mockSingle = jest.fn().mockImplementation(() => Promise.resolve({
        data: { id: 'prod-1', tenant_id: 'tenant-a', status: 'deposited', product_code: 'A1-101' },
        error: null,
      }));
      const mockSelect = jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(() => ({
            single: mockSingle,
          })),
        })),
      }));
      const mockSupabase = {
        from: jest.fn().mockImplementation((table) => {
          if (table === 'real_estate_products') {
            return { select: mockSelect };
          }
          return {};
        }),
      } as any;

      const { ProductService } = require('@/modules/real_estate/services/ProductService');
      
      // Try invalid transition: deposited -> available
      await expect(
        ProductService.updateProductStatus(
          mockSupabase,
          'tenant-a',
          'prod-1',
          'available',
          null
        )
      ).rejects.toThrow(/Không thể chuyển đổi trạng thái/);
    });
  });

  describe('Test 6: Real Estate Vocabulary & UI Component Audit', () => {
    it('should verify Real Estate components use industry terminology and avoid legacy Spa terms', () => {
      const fs = require('fs');
      const path = require('path');

      const components = [
        'src/modules/real_estate/components/ProjectHeader.tsx',
        'src/modules/real_estate/components/InventoryMatrixGrid.tsx',
        'src/modules/real_estate/components/UnitDetailModal.tsx',
        'src/app/dashboard/real-estate/page.tsx',
      ];

      for (const compPath of components) {
        expect(fs.existsSync(compPath)).toBe(true);

        const content = fs.readFileSync(compPath, 'utf-8');

        // Must contain Real Estate terms
        const hasRealEstateTerms =
          content.includes('Căn') ||
          content.includes('Sàn') ||
          content.includes('Tầng') ||
          content.includes('Giữ Chỗ') ||
          content.includes('Đã Cọc') ||
          content.includes('Dự Án');
        expect(hasRealEstateTerms).toBe(true);

        // Must NOT contain legacy Spa terms in Real Estate component labels
        expect(content).not.toContain('Kỹ Thuật Viên');
        expect(content).not.toContain('Liệu trình');
        expect(content).not.toContain('Combo Mẹ');
      }
    });
  });

  describe('Test 7: Reservation Hold Expiration & Accounting Outbox Events', () => {
    it('should identify and auto-release expired booked units older than hold threshold', async () => {
      const mockExpiredBookedUnit = {
        id: 'prod-expired-1',
        product_code: 'A1-909',
        status: 'booked',
        tenant_id: 'tenant-a',
        updated_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
      };

      const mockSelect = jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(() => ({
            lt: jest.fn().mockImplementation(() => Promise.resolve({
              data: [mockExpiredBookedUnit],
              error: null,
            })),
          })),
        })),
      }));

      const mockUpdateSingle = jest.fn().mockImplementation(() => Promise.resolve({
        data: { ...mockExpiredBookedUnit, status: 'available', owner_name: null },
        error: null,
      }));

      const mockUpdate = jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(() => ({
            select: jest.fn().mockImplementation(() => ({
              single: mockUpdateSingle,
            })),
          })),
        })),
      }));

      const mockSupabase = {
        from: jest.fn().mockImplementation(() => ({
          select: mockSelect,
          update: mockUpdate,
        })),
      } as any;

      const { ReservationExpiryEngine } = require('@/modules/real_estate/services/ReservationExpiryEngine');
      const released = await ReservationExpiryEngine.checkAndReleaseExpiredHoldings(
        mockSupabase,
        'tenant-a',
        24
      );

      expect(released.length).toBe(1);
      expect(released[0].status).toBe('available');
    });

    it('should verify RealEstateAccountingService builds valid outbox payload', async () => {
      const mockTenantId = '00000000-0000-0000-0000-000000000001';
      const mockProductId = '00000000-0000-0000-0000-000000000100';
      const mockProjectId = '00000000-0000-0000-0000-000000000010';
      const mockProduct = {
        id: mockProductId,
        product_code: 'A1-100',
        project_id: mockProjectId,
        tenant_id: mockTenantId,
        area: 75,
        unit_price: 60000000,
        status: 'deposited',
        owner_name: 'Khách Hàng B',
      };

      const { RealEstateAccountingService } = require('@/modules/real_estate/services/RealEstateAccountingService');
      
      const mockSupabase = {
        rpc: jest.fn().mockImplementation(() => Promise.resolve({ data: 'outbox-id-123', error: null })),
      } as any;

      const result = await RealEstateAccountingService.emitStatusChangeEvent(
        mockSupabase,
        mockTenantId,
        mockProduct as any,
        'deposited'
      );

      expect(result).toBe(true);
    });
  });

  describe('Test 8: Architecture Drift Guard (Zero Cross-Vertical Imports)', () => {
    it('should verify real_estate files do not import from beauty_spa or babycare verticals', () => {
      const fs = require('fs');
      const path = require('path');

      function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
        const files = fs.readdirSync(dirPath);

        files.forEach((file: string) => {
          const fullPath = path.join(dirPath, file);
          if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
          } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            arrayOfFiles.push(fullPath);
          }
        });

        return arrayOfFiles;
      }

      const realEstateFiles = getAllFiles('src/modules/real_estate');
      expect(realEstateFiles.length).toBeGreaterThan(0);

      for (const filePath of realEstateFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).not.toContain('modules/spa');
        expect(content).not.toContain('modules/beauty_spa');
        expect(content).not.toContain('modules/babycare');
      }
    });
  });
});





