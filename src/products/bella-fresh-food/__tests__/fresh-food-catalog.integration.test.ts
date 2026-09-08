/**
 * Fresh Food Catalog Integration Tests
 * 
 * Tests Product #3 integration with Retail OS R1+R4
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { FreshFoodCatalogService } from '../services/fresh-food-catalog.service';
import { cleanRetailTables } from '../../__tests__/setup-integration-tests';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Fresh Food Catalog Integration', () => {
  let service: FreshFoodCatalogService;
  let supabase: ReturnType<typeof createClient>;
  const testTenantId = '00000000-0000-0000-0000-000000000001'; // Valid UUID (same as Kids Clothing)
  const testRunId = Date.now(); // Unique ID for this test run

  beforeAll(async () => {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    // Clean tables before tests  
    await cleanRetailTables();

    supabase = createClient(supabaseUrl, supabaseKey);
    service = new FreshFoodCatalogService(supabase);
  });

  it('should create perishable product', async () => {
    const request = {
      tenantId: testTenantId,
      sku: 'MILK-ORGANIC-1L',
      name: 'Organic Milk - Whole 1L',
      description: 'Fresh organic whole milk',
      basePrice: 4.99,
      category: 'Dairy' as const,
      shelfLifeDays: 7,
      unit: 'L'
    };

    const product = await service.createProduct(request);

    expect(product).toBeDefined();
    expect(product.sku).toBe('MILK-ORGANIC-1L');
    expect(product.basePrice).toBe(4.99);
    expect(product.category).toBe('Dairy');
  }, 30000);

  it('should receive batch with expiry date', async () => {
    // Create product first
    const productRequest = {
      tenantId: testTenantId,
      sku: 'CHEESE-CHEDDAR',
      name: 'Cheddar Cheese Block',
      basePrice: 8.99,
      category: 'Dairy' as const,
      shelfLifeDays: 30,
      unit: 'kg'
    };

    const product = await service.createProduct(productRequest);

    // Receive batch
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    const batchRequest = {
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'CHEESE-20260906-001',
      manufacturedDate: new Date().toISOString(),
      expiryDate: expiryDate.toISOString(),
      quantity: 50
    };

    const batch = await service.receiveBatch(batchRequest);

    expect(batch).toBeDefined();
    expect(batch.batchNumber).toBe('CHEESE-20260906-001');
    expect(batch.currentStock).toBe(50);
    expect(batch.initialStock).toBe(50);
    expect(new Date(batch.expiryDate).getTime()).toBeGreaterThan(Date.now());
  }, 30000);

  it('should reject batch with past expiry date', async () => {
    const productRequest = {
      tenantId: testTenantId,
      sku: 'YOGURT-PLAIN',
      name: 'Plain Yogurt',
      basePrice: 2.99,
      category: 'Dairy' as const,
      shelfLifeDays: 14,
      unit: 'kg'
    };

    const product = await service.createProduct(productRequest);

    // Try to receive batch with past expiry
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const batchRequest = {
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'YOGURT-EXPIRED',
      expiryDate: yesterday.toISOString(),
      quantity: 30
    };

    await expect(service.receiveBatch(batchRequest)).rejects.toThrow('INVALID_EXPIRY_DATE');
  }, 30000);

  it('should return batches in FEFO order', async () => {
    // Create product
    const productRequest = {
      tenantId: testTenantId,
      sku: 'BREAD-WHEAT',
      name: 'Whole Wheat Bread',
      basePrice: 3.49,
      category: 'Bakery' as const,
      shelfLifeDays: 5,
      unit: 'pcs'
    };

    const product = await service.createProduct(productRequest);

    // Receive multiple batches with different expiry dates
    const batch1Expiry = new Date();
    batch1Expiry.setDate(batch1Expiry.getDate() + 3);

    const batch2Expiry = new Date();
    batch2Expiry.setDate(batch2Expiry.getDate() + 1);

    const batch3Expiry = new Date();
    batch3Expiry.setDate(batch3Expiry.getDate() + 5);

    await service.receiveBatch({
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'BREAD-001',
      expiryDate: batch1Expiry.toISOString(),
      quantity: 20
    });

    await service.receiveBatch({
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'BREAD-002',
      expiryDate: batch2Expiry.toISOString(),
      quantity: 15
    });

    await service.receiveBatch({
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'BREAD-003',
      expiryDate: batch3Expiry.toISOString(),
      quantity: 25
    });

    // Get batches - should be in FEFO order
    const batches = await service.getBatchesForProduct(testTenantId, product.id);

    expect(batches).toHaveLength(3);
    expect(batches[0].batchNumber).toBe('BREAD-002'); // Expires first
    expect(batches[1].batchNumber).toBe('BREAD-001'); // Expires second
    expect(batches[2].batchNumber).toBe('BREAD-003'); // Expires last
  }, 30000);

  it('should suggest next batch for sale (FEFO logic)', async () => {
    // Create product
    const productRequest = {
      tenantId: testTenantId,
      sku: 'APPLE-ORGANIC',
      name: 'Organic Apples',
      basePrice: 2.99,
      category: 'Produce' as const,
      shelfLifeDays: 10,
      unit: 'kg'
    };

    const product = await service.createProduct(productRequest);

    // Receive batches
    const soonExpiry = new Date();
    soonExpiry.setDate(soonExpiry.getDate() + 2);

    const laterExpiry = new Date();
    laterExpiry.setDate(laterExpiry.getDate() + 8);

    await service.receiveBatch({
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'APPLE-SOON',
      expiryDate: soonExpiry.toISOString(),
      quantity: 30
    });

    await service.receiveBatch({
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'APPLE-LATER',
      expiryDate: laterExpiry.toISOString(),
      quantity: 50
    });

    // Get next batch (should suggest earliest expiry)
    const nextBatch = await service.getNextBatchForSale(testTenantId, product.id, 10);

    expect(nextBatch).toBeDefined();
    expect(nextBatch?.batchNumber).toBe('APPLE-SOON');
  }, 30000);

  it('should sell from batch and reduce stock', async () => {
    // Create product
    const productRequest = {
      tenantId: testTenantId,
      sku: 'CARROT-ORGANIC',
      name: 'Organic Carrots',
      basePrice: 1.99,
      category: 'Produce' as const,
      shelfLifeDays: 14,
      unit: 'kg'
    };

    const product = await service.createProduct(productRequest);

    // Receive batch
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 10);

    const batch = await service.receiveBatch({
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'CARROT-001',
      expiryDate: expiryDate.toISOString(),
      quantity: 40
    });

    // Sell 15 kg
    const updated = await service.sellFromBatch(testTenantId, batch.id, 15);

    expect(updated.currentStock).toBe(25);
    expect(updated.id).toBe(batch.id);
  }, 30000);

  it('should reject sale from expired batch', async () => {
    // Create product
    const productRequest = {
      tenantId: testTenantId,
      sku: 'LETTUCE',
      name: 'Iceberg Lettuce',
      basePrice: 1.49,
      category: 'Produce' as const,
      shelfLifeDays: 7,
      unit: 'pcs'
    };

    const product = await service.createProduct(productRequest);

    // Receive batch expiring in 1 second (simulate expired)
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + 1);

    const batch = await service.receiveBatch({
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'LETTUCE-EXPIRED',
      expiryDate: expiryDate.toISOString(),
      quantity: 20
    });

    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to sell - should fail
    await expect(
      service.sellFromBatch(testTenantId, batch.id, 5)
    ).rejects.toThrow('BATCH_EXPIRED');
  }, 35000);

  it('should get product with all batches and total stock', async () => {
    // Create product
    const productRequest = {
      tenantId: testTenantId,
      sku: 'TOMATO',
      name: 'Cherry Tomatoes',
      basePrice: 3.99,
      category: 'Produce' as const,
      shelfLifeDays: 7,
      unit: 'kg'
    };

    const product = await service.createProduct(productRequest);

    // Receive multiple batches
    const exp1 = new Date();
    exp1.setDate(exp1.getDate() + 5);
    const exp2 = new Date();
    exp2.setDate(exp2.getDate() + 7);

    await service.receiveBatch({
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'TOMATO-001',
      expiryDate: exp1.toISOString(),
      quantity: 30
    });

    await service.receiveBatch({
      tenantId: testTenantId,
      productId: product.id,
      batchNumber: 'TOMATO-002',
      expiryDate: exp2.toISOString(),
      quantity: 40
    });

    // Get product with batches
    const result = await service.getProductWithBatches(testTenantId, product.id);

    expect(result.product).toBeDefined();
    expect(result.batches).toHaveLength(2);
    expect(result.totalStock).toBe(70); // 30 + 40
  }, 30000);
});
