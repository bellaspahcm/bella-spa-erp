/**
 * RETAIL OS - PRODUCT CATALOG ENGINE TESTS
 * 
 * Unit tests for R1 Product Catalog Engine.
 * Verifies 5 operations + invariants.
 */

import { ProductCatalogEngine } from '@/platform/retail/engines/product-catalog/product-catalog.engine';
import type { IProductCatalogRepository } from '@/platform/retail/engines/product-catalog/product-catalog-repository.interface';
import type { Product } from '@/platform/retail/contracts/product-catalog.contract';

describe('ProductCatalogEngine', () => {
  let engine: ProductCatalogEngine;
  let mockRepository: jest.Mocked<IProductCatalogRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      updatePrice: jest.fn(),
      updateStatus: jest.fn(),
    };

    engine = new ProductCatalogEngine(mockRepository);
  });

  describe('createProduct', () => {
    it('should create product with valid data', async () => {
      const request = {
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics',
        basePrice: 99.99,
        costPrice: 50.0,
        trackInventory: true,
        currentStock: 100,
        reorderPoint: 10,
        status: 'ACTIVE' as const,
        userId: 'user-1',
      };

      const expectedProduct: Product = {
        id: expect.any(String),
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics',
        basePrice: 99.99,
        costPrice: 50.0,
        trackInventory: true,
        currentStock: 100,
        reorderPoint: 10,
        status: 'ACTIVE',
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      };

      mockRepository.create.mockResolvedValue(expectedProduct);

      const result = await engine.createProduct(request);

      expect(result).toMatchObject(expectedProduct);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          sku: 'SKU-001',
          name: 'Test Product',
          basePrice: 99.99,
        })
      );
    });

    it('should enforce tenant isolation', async () => {
      const request = {
        tenantId: '',
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 99.99,
      };

      await expect(engine.createProduct(request)).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });

    it('should enforce price positivity', async () => {
      const request = {
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: -10.0,
      };

      await expect(engine.createProduct(request)).rejects.toThrow('INVALID_PRICE');
    });

    it('should reject negative cost price', async () => {
      const request = {
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 99.99,
        costPrice: -5.0,
      };

      await expect(engine.createProduct(request)).rejects.toThrow('INVALID_COST_PRICE');
    });

    it('should set default values when optional fields omitted', async () => {
      const request = {
        tenantId: 'tenant-1',
        sku: 'SKU-002',
        name: 'Minimal Product',
        category: 'Test',
        basePrice: 10.0,
      };

      const expectedProduct: Product = {
        id: expect.any(String),
        tenantId: 'tenant-1',
        sku: 'SKU-002',
        name: 'Minimal Product',
        category: 'Test',
        basePrice: 10.0,
        trackInventory: true,
        currentStock: 0,
        status: 'ACTIVE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      };

      mockRepository.create.mockResolvedValue(expectedProduct);

      const result = await engine.createProduct(request);

      expect(result.trackInventory).toBe(true);
      expect(result.currentStock).toBe(0);
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('updateProductPrice', () => {
    it('should update price successfully', async () => {
      const request = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        basePrice: 149.99,
        userId: 'user-1',
      };

      const updatedProduct: Product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 149.99,
        trackInventory: true,
        currentStock: 100,
        status: 'ACTIVE',
        updatedBy: 'user-1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      };

      mockRepository.updatePrice.mockResolvedValue(updatedProduct);

      const result = await engine.updateProductPrice(request);

      expect(result.basePrice).toBe(149.99);
      expect(mockRepository.updatePrice).toHaveBeenCalledWith('tenant-1', 'prod-1', 149.99, 'user-1');
    });

    it('should enforce tenant isolation', async () => {
      const request = {
        tenantId: '',
        productId: 'prod-1',
        basePrice: 149.99,
      };

      await expect(engine.updateProductPrice(request)).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });

    it('should enforce price positivity', async () => {
      const request = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        basePrice: 0,
      };

      await expect(engine.updateProductPrice(request)).rejects.toThrow('INVALID_PRICE');
    });
  });

  describe('updateProductStatus', () => {
    it('should update status from ACTIVE to OUT_OF_STOCK', async () => {
      const currentProduct: Product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 99.99,
        trackInventory: true,
        currentStock: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const updatedProduct: Product = {
        ...currentProduct,
        status: 'OUT_OF_STOCK',
        updatedAt: '2026-01-02T00:00:00Z',
      };

      mockRepository.findById.mockResolvedValue(currentProduct);
      mockRepository.updateStatus.mockResolvedValue(updatedProduct);

      const result = await engine.updateProductStatus({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        status: 'OUT_OF_STOCK',
        userId: 'user-1',
      });

      expect(result.status).toBe('OUT_OF_STOCK');
    });

    it('should allow transition from OUT_OF_STOCK to ACTIVE', async () => {
      const currentProduct: Product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 99.99,
        trackInventory: true,
        currentStock: 50,
        status: 'OUT_OF_STOCK',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const updatedProduct: Product = {
        ...currentProduct,
        status: 'ACTIVE',
        updatedAt: '2026-01-02T00:00:00Z',
      };

      mockRepository.findById.mockResolvedValue(currentProduct);
      mockRepository.updateStatus.mockResolvedValue(updatedProduct);

      const result = await engine.updateProductStatus({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        status: 'ACTIVE',
        userId: 'user-1',
      });

      expect(result.status).toBe('ACTIVE');
    });

    it('should prevent reversal from DISCONTINUED (invariant)', async () => {
      const currentProduct: Product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 99.99,
        trackInventory: true,
        currentStock: 0,
        status: 'DISCONTINUED',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockRepository.findById.mockResolvedValue(currentProduct);

      await expect(
        engine.updateProductStatus({
          tenantId: 'tenant-1',
          productId: 'prod-1',
          status: 'ACTIVE',
          userId: 'user-1',
        })
      ).rejects.toThrow('INVALID_STATUS_TRANSITION');
    });

    it('should enforce tenant isolation', async () => {
      await expect(
        engine.updateProductStatus({
          tenantId: '',
          productId: 'prod-1',
          status: 'ACTIVE',
        })
      ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });

    it('should throw if product not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        engine.updateProductStatus({
          tenantId: 'tenant-1',
          productId: 'nonexistent',
          status: 'ACTIVE',
        })
      ).rejects.toThrow('PRODUCT_NOT_FOUND');
    });
  });

  describe('getProductById', () => {
    it('should return product when found', async () => {
      const product: Product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 99.99,
        trackInventory: true,
        currentStock: 100,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockRepository.findById.mockResolvedValue(product);

      const result = await engine.getProductById('tenant-1', 'prod-1');

      expect(result).toEqual(product);
      expect(mockRepository.findById).toHaveBeenCalledWith('tenant-1', 'prod-1');
    });

    it('should return null when product not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await engine.getProductById('tenant-1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should enforce tenant isolation', async () => {
      await expect(engine.getProductById('', 'prod-1')).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });

  describe('getProductBySku', () => {
    it('should return product when found', async () => {
      const product: Product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 99.99,
        trackInventory: true,
        currentStock: 100,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockRepository.findBySku.mockResolvedValue(product);

      const result = await engine.getProductBySku('tenant-1', 'SKU-001');

      expect(result).toEqual(product);
      expect(mockRepository.findBySku).toHaveBeenCalledWith('tenant-1', 'SKU-001');
    });

    it('should return null when product not found', async () => {
      mockRepository.findBySku.mockResolvedValue(null);

      const result = await engine.getProductBySku('tenant-1', 'NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should enforce tenant isolation', async () => {
      await expect(engine.getProductBySku('', 'SKU-001')).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });
});
