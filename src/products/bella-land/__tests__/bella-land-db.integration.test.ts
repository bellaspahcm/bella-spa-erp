/**
 * BELLA LAND — REAL DATABASE INTEGRATION TEST SUITE
 *
 * Tests Product services against actual Supabase database with tenant isolation.
 * Verifies:
 * - Product services → Real Estate OS contracts → Database
 * - Tenant isolation (RLS) enforcement
 * - Real data flow (not mocks)
 *
 * Prerequisites:
 * - NEXT_PUBLIC_SUPABASE_URL environment variable
 * - SUPABASE_SERVICE_ROLE_KEY environment variable
 * - Test tenant with real_estate_projects and real_estate_products tables
 *
 * @module src/products/bella-land/__tests__/bella-land-db.integration.test
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { PropertyCatalogProductService } from '../services/property-catalog.service';
import { PropertyInventoryService } from '../../../platform/real-estate/engines/property-inventory.service';
import { PropertyUnitRepository } from '../../../platform/real-estate/repositories/property-unit.repository';
import crypto from 'crypto';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

const shouldSkip = !SUPABASE_URL || !SUPABASE_KEY;

const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('BELLA LAND — REAL DATABASE INTEGRATION TESTS', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let catalogService: PropertyCatalogProductService;
  let TEST_TENANT_ID: string;
  let testProjectId: string;
  let testUnitId: string;

  beforeAll(async () => {
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);

    // Create a test tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ 
        name: `Bella Land Test Tenant ${Date.now()}`, 
        status: 'active' 
      })
      .select('id')
      .single();

    if (tenantError) {
      throw new Error(`Failed to create test tenant: ${tenantError.message}`);
    }

    TEST_TENANT_ID = tenant.id;

    // Initialize Real Estate OS services
    const repository = new PropertyUnitRepository();
    const inventoryContract = new PropertyInventoryService(repository, supabase);

    // Initialize Bella Land Product service
    catalogService = new PropertyCatalogProductService(inventoryContract);

    // Setup test data: Create a test project
    testProjectId = crypto.randomUUID();
    const { error: projectError } = await supabase
      .from('real_estate_projects')
      .insert({
        id: testProjectId,
        tenant_id: TEST_TENANT_ID,
        name: 'Test Project for Bella Land Integration',
        status: 'active',
        total_units: 5
      });

    if (projectError) {
      throw new Error(`Failed to create test project: ${projectError.message}`);
    }

    // Create test property units
    testUnitId = crypto.randomUUID();
    const { error: unitError } = await supabase
      .from('real_estate_products')
      .insert([
        {
          id: testUnitId,
          tenant_id: TEST_TENANT_ID,
          project_id: testProjectId,
          product_code: 'A-101',
          product_type: 'apartment',
          status: 'available',
          area: 85.5,
          unit_price: 3500000000
        },
        {
          id: crypto.randomUUID(),
          tenant_id: TEST_TENANT_ID,
          project_id: testProjectId,
          product_code: 'A-102',
          product_type: 'apartment',
          status: 'available',
          area: 90.0,
          unit_price: 3800000000
        },
        {
          id: crypto.randomUUID(),
          tenant_id: TEST_TENANT_ID,
          project_id: testProjectId,
          product_code: 'A-103',
          product_type: 'apartment',
          status: 'booked',
          area: 95.0,
          unit_price: 4200000000
        }
      ]);

    if (unitError) {
      throw new Error(`Failed to create test units: ${unitError.message}`);
    }
  });

  afterAll(async () => {
    if (!supabase) return;

    // Cleanup: Delete test data (cascades will delete products)
    await supabase
      .from('real_estate_projects')
      .delete()
      .eq('id', testProjectId);

    // Delete test tenant (cascades will delete projects and products)
    await supabase
      .from('tenants')
      .delete()
      .eq('id', TEST_TENANT_ID);
  });

  test('Real DB: Product service retrieves units from database', async () => {
    const products = await catalogService.getProducts(TEST_TENANT_ID, testProjectId);

    expect(products).toBeDefined();
    expect(products.length).toBe(3);
    expect(products[0].tenant_id).toBe(TEST_TENANT_ID);
    expect(products[0].project_id).toBe(testProjectId);
    expect(products.some(p => p.product_code === 'A-101')).toBe(true);
    expect(products.some(p => p.product_code === 'A-102')).toBe(true);
    expect(products.some(p => p.product_code === 'A-103')).toBe(true);
  });

  test('Real DB: Tenant isolation enforced (empty tenantId rejected)', async () => {
    await expect(
      catalogService.getProducts('', testProjectId)
    ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
  });

  test('Real DB: Empty projectId rejected', async () => {
    await expect(
      catalogService.getProducts(TEST_TENANT_ID, '')
    ).rejects.toThrow('PROJECT_BOUNDARY_VIOLATION');
  });

  test('Real DB: Cross-tenant isolation (cannot access other tenant data)', async () => {
    // Try to access with wrong tenant ID
    const otherTenantId = crypto.randomUUID();
    const products = await catalogService.getProducts(otherTenantId, testProjectId);

    // Should return empty array (RLS blocks cross-tenant access)
    expect(products).toBeDefined();
    expect(products.length).toBe(0);
  });

  test('Real DB: Returns empty array for non-existent project', async () => {
    const nonExistentProjectId = crypto.randomUUID();
    const products = await catalogService.getProducts(TEST_TENANT_ID, nonExistentProjectId);

    expect(products).toBeDefined();
    expect(products.length).toBe(0);
  });

  test('Real DB: Units ordered by product_code ascending', async () => {
    const products = await catalogService.getProducts(TEST_TENANT_ID, testProjectId);

    expect(products.length).toBe(3);
    expect(products[0].product_code).toBe('A-101');
    expect(products[1].product_code).toBe('A-102');
    expect(products[2].product_code).toBe('A-103');
  });
});
