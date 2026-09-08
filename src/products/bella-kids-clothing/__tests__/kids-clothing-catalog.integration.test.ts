/**
 * Kids Clothing Catalog Integration Tests
 * 
 * Tests Product #2 integration with Retail OS R1+R3
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { KidsClothingCatalogService } from '../services/kids-clothing-catalog.service';
import { cleanRetailTables } from '../../__tests__/setup-integration-tests';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Kids Clothing Catalog Integration', () => {
  let service: KidsClothingCatalogService;
  let supabase: ReturnType<typeof createClient>;
  const testTenantId = '00000000-0000-0000-0000-000000000001'; // Valid UUID
  const testRunId = Date.now(); // Unique for this test run

  beforeAll(async () => {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    // Clean tables before tests
    await cleanRetailTables();

    supabase = createClient(supabaseUrl, supabaseKey);
    service = new KidsClothingCatalogService(supabase);
  });

  it('should create product with size/color variants', async () => {
    const request = {
      tenantId: testTenantId,
      sku: 'TSHIRT-UNICORN',
      name: 'Kids T-Shirt - Unicorn Print',
      description: 'Cute unicorn print t-shirt for kids',
      basePrice: 19.99,
      category: 'Tops' as const,
      season: 'Spring' as const,
      sizes: ['4T', '5T', '6', '8'],
      colors: ['Pink', 'Blue', 'White'],
      initialStockPerVariant: 20
    };

    const result = await service.createProductWithVariants(request);

    expect(result.product).toBeDefined();
    expect(result.product.sku).toBe('TSHIRT-UNICORN');
    expect(result.product.basePrice).toBe(19.99);
    expect(result.product.category).toBe('Tops');

    // Should create 4 sizes × 3 colors = 12 variants
    expect(result.variants).toHaveLength(12);

    // Check specific variant
    const pinkSize4T = result.variants.find(v => 
      v.variantAttributes.size === '4T' && 
      v.variantAttributes.color === 'Pink'
    );
    expect(pinkSize4T).toBeDefined();
    expect(pinkSize4T?.currentStock).toBe(20);
    expect(pinkSize4T?.variantSku).toContain('TSHIRT-UNICORN');
    expect(pinkSize4T?.variantSku).toContain('4T');
    expect(pinkSize4T?.variantSku).toContain('PINK');
  }, 30000);

  it('should retrieve product with all variants', async () => {
    // First create a product
    const createRequest = {
      tenantId: testTenantId,
      sku: 'DRESS-FLOWER',
      name: 'Kids Dress - Flower Pattern',
      basePrice: 29.99,
      category: 'Dresses' as const,
      season: 'Summer' as const,
      sizes: ['6', '8', '10'],
      colors: ['Yellow', 'Pink'],
      initialStockPerVariant: 15
    };

    const created = await service.createProductWithVariants(createRequest);

    // Then retrieve it
    const result = await service.getProductWithVariants(
      testTenantId,
      created.product.id
    );

    expect(result.product).toBeDefined();
    expect(result.product?.id).toBe(created.product.id);
    expect(result.variants).toHaveLength(6); // 3 sizes × 2 colors
  }, 30000);

  it('should update variant stock', async () => {
    // Create product
    const createRequest = {
      tenantId: testTenantId,
      sku: 'JACKET-WINTER',
      name: 'Kids Winter Jacket',
      basePrice: 49.99,
      category: 'Outerwear' as const,
      season: 'Winter' as const,
      sizes: ['8', '10'],
      colors: ['Navy'],
      initialStockPerVariant: 30
    };

    const created = await service.createProductWithVariants(createRequest);
    const variantToUpdate = created.variants[0];

    // Update stock
    const updated = await service.updateVariantStock(
      testTenantId,
      variantToUpdate.id,
      15
    );

    expect(updated.currentStock).toBe(15);
    expect(updated.id).toBe(variantToUpdate.id);
  }, 30000);

  it('should retrieve variant by SKU', async () => {
    // Create product
    const createRequest = {
      tenantId: testTenantId,
      sku: 'SWEATER-KNIT',
      name: 'Kids Knit Sweater',
      basePrice: 34.99,
      category: 'Tops' as const,
      season: 'Fall' as const,
      sizes: ['6'],
      colors: ['Red'],
      initialStockPerVariant: 25
    };

    const created = await service.createProductWithVariants(createRequest);
    const expectedSku = created.variants[0].variantSku;

    // Retrieve by SKU
    const variant = await service.getVariantBySku(testTenantId, expectedSku);

    expect(variant).toBeDefined();
    expect(variant?.variantSku).toBe(expectedSku);
    expect(variant?.variantAttributes.size).toBe('6');
    expect(variant?.variantAttributes.color).toBe('Red');
  }, 30000);
});
