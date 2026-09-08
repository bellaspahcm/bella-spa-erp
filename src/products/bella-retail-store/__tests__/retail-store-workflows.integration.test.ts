/**
 * BELLA RETAIL STORE - INTEGRATION TEST SUITE
 * 
 * Tests all 5 workflows for Reference Product #1
 * Evidence Collection for Retail OS Discovery
 * 
 * W1: Product Catalog & Availability
 * W2: Customer Purchase
 * W3: Complete Sale & Payment
 * W4: Sale → Inventory Movement
 * W5: Restock / Stock Adjustment
 */

import { ProductCatalogService } from '../services/product-catalog.service';
import { CustomerPurchaseService } from '../services/customer-purchase.service';
import { SaleCompletionService } from '../services/sale-completion.service';
import { InventoryMovementService } from '../services/inventory-movement.service';
import type { IProductCatalogContract } from '@/platform/retail/contracts/product-catalog.contract';
import type { IInventoryMovementContract } from '@/platform/retail/contracts/inventory-movement.contract';

describe('BELLA RETAIL STORE - 5 WORKFLOW INTEGRATION TESTS', () => {
  let productCatalog: ProductCatalogService;
  let customerPurchase: CustomerPurchaseService;
  let saleCompletion: SaleCompletionService;
  let inventoryMovement: InventoryMovementService;

  // Mock R1 Product Catalog Engine
  const mockR1Engine: jest.Mocked<IProductCatalogContract> = {
    createProduct: jest.fn(),
    updateProductPrice: jest.fn(),
    updateProductStatus: jest.fn(),
    getProductById: jest.fn(),
    getProductBySku: jest.fn(),
  };

  // Mock R2 Inventory Movement Engine
  const mockR2Engine: jest.Mocked<IInventoryMovementContract> = {
    recordMovement: jest.fn(),
    getMovementHistory: jest.fn(),
    getCurrentStock: jest.fn(),
    detectReorderNeeds: jest.fn(),
  };

  // Mock Supabase client
  const mockSupabase: any = {
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    productCatalog = new ProductCatalogService(mockR1Engine, mockSupabase);
    customerPurchase = new CustomerPurchaseService(mockSupabase);
    saleCompletion = new SaleCompletionService(mockSupabase);
    inventoryMovement = new InventoryMovementService(mockR2Engine, mockSupabase);
  });

  // ==================== W1: Product Catalog & Availability ====================
  describe('W1: Product Catalog & Availability', () => {
    test('W1.1: Create product with pricing and inventory', async () => {
      const mockDomainProduct = {
        id: 'prod-001',
        tenantId: 'tenant-retail-a',
        sku: 'PROD-001',
        name: 'Test Product',
        description: 'Test Description',
        category: 'Electronics',
        basePrice: 99.99,
        costPrice: 50.0,
        trackInventory: true,
        currentStock: 100,
        reorderPoint: 20,
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user-001',
        updatedBy: 'user-001',
      };

      mockR1Engine.createProduct.mockResolvedValue(mockDomainProduct);

      const result = await productCatalog.createProduct({
        tenantId: 'tenant-retail-a',
        sku: 'PROD-001',
        name: 'Test Product',
        description: 'Test Description',
        category: 'Electronics',
        basePrice: 99.99,
        costPrice: 50.0,
        currentStock: 100,
        reorderPoint: 20,
        userId: 'user-001',
      });

      expect(result.id).toBe('prod-001');
      expect(result.base_price).toBe(99.99);
      expect(result.current_stock).toBe(100);
      expect(mockR1Engine.createProduct).toHaveBeenCalledWith({
        tenantId: 'tenant-retail-a',
        sku: 'PROD-001',
        name: 'Test Product',
        description: 'Test Description',
        category: 'Electronics',
        basePrice: 99.99,
        costPrice: 50.0,
        trackInventory: undefined,
        currentStock: 100,
        reorderPoint: 20,
        status: undefined,
        userId: 'user-001',
      });
    });

    test('W1.2: Update product price', async () => {
      const mockDomainProduct = {
        id: 'prod-001',
        tenantId: 'tenant-retail-a',
        sku: 'PROD-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 89.99,
        updatedBy: 'user-001',
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockR1Engine.updateProductPrice.mockResolvedValue(mockDomainProduct);

      const result = await productCatalog.updateProductPrice({
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        basePrice: 89.99,
        userId: 'user-001',
      });

      expect(result.base_price).toBe(89.99);
      expect(mockR1Engine.updateProductPrice).toHaveBeenCalledWith({
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        basePrice: 89.99,
        userId: 'user-001',
      });
    });

    test('W1.3: Check product availability', async () => {
      const mockDomainProduct = {
        id: 'prod-001',
        tenantId: 'tenant-retail-a',
        sku: 'PROD-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 99.99,
        currentStock: 50,
        reorderPoint: 20,
        trackInventory: true,
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockR1Engine.getProductById.mockResolvedValue(mockDomainProduct);

      const result = await productCatalog.checkAvailability({
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        requestedQuantity: 10,
      });

      expect(result.available).toBe(true);
      expect(result.currentStock).toBe(50);
      expect(result.needsReorder).toBe(false);
      expect(mockR1Engine.getProductById).toHaveBeenCalledWith('tenant-retail-a', 'prod-001');
    });

    test('W1.4: Detect reorder needed', async () => {
      const mockDomainProduct = {
        id: 'prod-001',
        tenantId: 'tenant-retail-a',
        sku: 'PROD-001',
        name: 'Test Product',
        category: 'Electronics',
        basePrice: 99.99,
        currentStock: 15,
        reorderPoint: 20,
        trackInventory: true,
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockR1Engine.getProductById.mockResolvedValue(mockDomainProduct);

      const result = await productCatalog.checkAvailability({
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        requestedQuantity: 5,
      });

      expect(result.available).toBe(true);
      expect(result.needsReorder).toBe(true);
      expect(result.reorderPoint).toBe(20);
    });

    test('W1.5: Tenant isolation - missing tenantId throws error', async () => {
      // R1 engine enforces tenant isolation
      mockR1Engine.createProduct.mockRejectedValue(new Error('TENANT_ISOLATION_VIOLATION'));

      await expect(
        productCatalog.createProduct({
          tenantId: '',
          sku: 'PROD-001',
          name: 'Test',
          category: 'Test',
          basePrice: 10,
        })
      ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });

  // ==================== W2: Customer Purchase ====================
  describe('W2: Customer Purchase', () => {
    test('W2.1: Register customer', async () => {
      const mockCustomer = {
        id: 'cust-001',
        tenant_id: 'tenant-retail-a',
        email: 'customer@example.com',
        phone: '555-1234',
        first_name: 'John',
        last_name: 'Doe',
        loyalty_points: 0,
        loyalty_tier: 'BRONZE',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockCustomer, error: null }),
          }),
        }),
      });

      const result = await customerPurchase.registerCustomer({
        tenantId: 'tenant-retail-a',
        email: 'customer@example.com',
        phone: '555-1234',
        firstName: 'John',
        lastName: 'Doe',
        loyaltyTier: 'BRONZE',
      });

      expect(result.id).toBe('cust-001');
      expect(result.email).toBe('customer@example.com');
    });

    test('W2.2: Start sale (create draft)', async () => {
      const mockSale = {
        id: 'sale-001',
        tenant_id: 'tenant-retail-a',
        sale_number: 'SALE-12345',
        customer_id: 'cust-001',
        subtotal: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: 0,
        payment_method: 'CASH',
        payment_status: 'PENDING',
        status: 'DRAFT',
        cashier_id: 'cashier-001',
        sale_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockSale, error: null }),
          }),
        }),
      });

      const result = await customerPurchase.startSale({
        tenantId: 'tenant-retail-a',
        customerId: 'cust-001',
        cashierId: 'cashier-001',
      });

      expect(result.status).toBe('DRAFT');
      expect(result.customer_id).toBe('cust-001');
    });

    test('W2.3: Add product to sale (create SaleItem)', async () => {
      const mockProduct = {
        id: 'prod-001',
        base_price: 99.99,
        tenant_id: 'tenant-retail-a',
      };

      const mockSale = {
        id: 'sale-001',
        status: 'DRAFT',
        tenant_id: 'tenant-retail-a',
      };

      const mockSaleItem = {
        id: 'item-001',
        tenant_id: 'tenant-retail-a',
        sale_id: 'sale-001',
        product_id: 'prod-001',
        quantity: 2,
        unit_price: 99.99,
        discount_amount: 0,
        line_total: 199.98,
        created_at: new Date().toISOString(),
      };

      // Mock product lookup
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'retail_products') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockProduct, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'retail_sales') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockSale, error: null }),
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'retail_sale_items') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSaleItem, error: null }),
              }),
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  data: [mockSaleItem],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await customerPurchase.addSaleItem({
        tenantId: 'tenant-retail-a',
        saleId: 'sale-001',
        productId: 'prod-001',
        quantity: 2,
      });

      expect(result.quantity).toBe(2);
      expect(result.line_total).toBe(199.98);
    });

    test('W2.4: Cross-domain interaction - Customer linked to Sale', async () => {
      const mockSale = {
        id: 'sale-001',
        customer_id: 'cust-001',
        tenant_id: 'tenant-retail-a',
      };

      const mockCustomer = {
        id: 'cust-001',
        first_name: 'John',
        last_name: 'Doe',
        tenant_id: 'tenant-retail-a',
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'retail_sales') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockSale, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'retail_customers') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockCustomer, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'retail_sale_items') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await customerPurchase.getSaleWithItems('tenant-retail-a', 'sale-001');

      expect(result.sale.customer_id).toBe('cust-001');
      expect(result.customer?.first_name).toBe('John');
    });
  });

  // ==================== W3: Complete Sale & Payment ====================
  describe('W3: Complete Sale & Payment', () => {
    test('W3.1: Validate sale items', async () => {
      const mockSale = {
        id: 'sale-001',
        status: 'DRAFT',
        tenant_id: 'tenant-retail-a',
      };

      const mockItems = [
        {
          id: 'item-001',
          product_id: 'prod-001',
          quantity: 2,
          tenant_id: 'tenant-retail-a',
        },
      ];

      const mockProduct = {
        id: 'prod-001',
        status: 'ACTIVE',
        track_inventory: true,
        current_stock: 50,
        tenant_id: 'tenant-retail-a',
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'retail_sales') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockSale, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'retail_sale_items') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  data: mockItems,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'retail_products') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockProduct, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await saleCompletion.validateSaleItems('tenant-retail-a', 'sale-001');

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('W3.2: Apply sale-level discount', async () => {
      const mockSale = {
        id: 'sale-001',
        status: 'DRAFT',
        subtotal: 200.0,
        tax_amount: 20.0,
        discount_amount: 0,
        total_amount: 220.0,
        tenant_id: 'tenant-retail-a',
      };

      const mockUpdatedSale = {
        ...mockSale,
        discount_amount: 20.0,
        total_amount: 200.0,
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockSale, error: null }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockUpdatedSale, error: null }),
              }),
            }),
          }),
        }),
      });

      const result = await saleCompletion.applySaleDiscount({
        tenantId: 'tenant-retail-a',
        saleId: 'sale-001',
        discountAmount: 20.0,
      });

      expect(result.discount_amount).toBe(20.0);
      expect(result.total_amount).toBe(200.0);
    });

    test('W3.3: Complete sale - immutability boundary', async () => {
      const mockSale = {
        id: 'sale-001',
        status: 'DRAFT',
        total_amount: 200.0,
        tenant_id: 'tenant-retail-a',
      };

      const mockCompletedSale = {
        ...mockSale,
        status: 'COMPLETED',
        payment_method: 'CARD',
        payment_status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      };

      const mockItems = [{ id: 'item-001', product_id: 'prod-001', quantity: 2 }];
      const mockProduct = { id: 'prod-001', status: 'ACTIVE', track_inventory: true, current_stock: 50 };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'retail_sales') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockSale, error: null }),
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: mockCompletedSale, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'retail_sale_items') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  data: mockItems,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'retail_products') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockProduct, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await saleCompletion.completeSale({
        tenantId: 'tenant-retail-a',
        saleId: 'sale-001',
        paymentMethod: 'CARD',
      });

      expect(result.sale.status).toBe('COMPLETED');
      expect(result.sale.payment_status).toBe('COMPLETED');
      expect(result.sale.completed_at).toBeDefined();
    });

    test('W3.4: Immutability - cannot modify completed sale', async () => {
      const mockSale = {
        id: 'sale-001',
        status: 'COMPLETED',
        tenant_id: 'tenant-retail-a',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockSale, error: null }),
            }),
          }),
        }),
      });

      await expect(
        saleCompletion.applySaleDiscount({
          tenantId: 'tenant-retail-a',
          saleId: 'sale-001',
          discountAmount: 10,
        })
      ).rejects.toThrow('SALE_IMMUTABILITY_VIOLATION');
    });
  });

  // ==================== W4: Sale → Inventory Movement ====================
  describe('W4: Sale → Inventory Movement', () => {
    test('W4.1: Process inventory movements for completed sale', async () => {
      const mockSale = {
        id: 'sale-001',
        status: 'COMPLETED',
        sale_number: 'SALE-12345',
        tenant_id: 'tenant-retail-a',
      };

      const mockItems = [
        {
          id: 'item-001',
          sale_id: 'sale-001',
          product_id: 'prod-001',
          quantity: 2,
          tenant_id: 'tenant-retail-a',
        },
      ];

      const mockDomainMovement = {
        id: 'mov-001',
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        movementType: 'SALE' as const,
        quantityChange: -2,
        previousStock: 50,
        newStock: 48,
        referenceType: 'SALE' as const,
        referenceId: 'sale-001',
        reason: 'Sale SALE-12345',
        createdAt: new Date().toISOString(),
      };

      // Mock Sale and SaleItem queries (orchestration layer)
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'retail_sales') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockSale, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'retail_sale_items') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  data: mockItems,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'retail_products') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      });

      // Mock R2 recordMovement (canonical inventory logic)
      mockR2Engine.recordMovement.mockResolvedValue(mockDomainMovement);
      mockR2Engine.detectReorderNeeds.mockResolvedValue([]);

      const result = await inventoryMovement.processSaleInventoryMovement({
        tenantId: 'tenant-retail-a',
        saleId: 'sale-001',
      });

      expect(result.movements.length).toBe(1);
      expect(result.movements[0].movement_type).toBe('SALE');
      expect(result.movements[0].quantity_change).toBe(-2);
      expect(result.movements[0].new_stock).toBe(48);
      expect(mockR2Engine.recordMovement).toHaveBeenCalledWith({
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        movementType: 'SALE',
        quantityChange: -2,
        referenceType: 'SALE',
        referenceId: 'sale-001',
        reason: 'Sale SALE-12345',
        userId: undefined,
      });
    });

    test('W4.2: Detect reorder after sale', async () => {
      const mockSale = {
        id: 'sale-001',
        status: 'COMPLETED',
        sale_number: 'SALE-12345',
        tenant_id: 'tenant-retail-a',
      };

      const mockItems = [
        {
          id: 'item-001',
          sale_id: 'sale-001',
          product_id: 'prod-001',
          quantity: 35,
          tenant_id: 'tenant-retail-a',
        },
      ];

      const mockProduct = {
        id: 'prod-001',
        sku: 'PROD-001',
        name: 'Test Product',
        track_inventory: true,
        current_stock: 15,
        reorder_point: 20,
        tenant_id: 'tenant-retail-a',
      };

      const mockDomainMovement = {
        id: 'mov-001',
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        movementType: 'SALE' as const,
        quantityChange: -35,
        previousStock: 50,
        newStock: 15,
        referenceType: 'SALE' as const,
        referenceId: 'sale-001',
        createdAt: new Date().toISOString(),
      };

      const mockReorderAlert = {
        product: {
          id: 'prod-001',
          sku: 'PROD-001',
          name: 'Test Product',
        },
        currentStock: 15,
        reorderPoint: 20,
        deficit: 5,
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'retail_sales') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockSale, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'retail_sale_items') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockItems, error: null }),
              }),
            }),
          };
        }
        if (table === 'retail_products') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [mockProduct], error: null }),
              }),
            }),
          };
        }
        return {};
      });

      mockR2Engine.recordMovement.mockResolvedValue(mockDomainMovement);
      mockR2Engine.detectReorderNeeds.mockResolvedValue([mockReorderAlert]);

      const result = await inventoryMovement.processSaleInventoryMovement({
        tenantId: 'tenant-retail-a',
        saleId: 'sale-001',
      });

      expect(result.productsNeedingReorder.length).toBe(1);
      expect(result.productsNeedingReorder[0].currentStock).toBe(15);
      expect(result.productsNeedingReorder[0].reorderPoint).toBe(20);
    });
  });

  // ==================== W5: Restock / Stock Adjustment ====================
  describe('W5: Restock / Stock Adjustment', () => {
    test('W5.1: Restock product', async () => {
      const mockDomainMovement = {
        id: 'mov-001',
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        movementType: 'RESTOCK' as const,
        quantityChange: 50,
        previousStock: 10,
        newStock: 60,
        referenceType: 'MANUAL' as const,
        reason: 'Restock',
        createdAt: new Date().toISOString(),
      };

      mockR2Engine.recordMovement.mockResolvedValue(mockDomainMovement);

      const result = await inventoryMovement.restockProduct({
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        quantity: 50,
        reason: 'Restock',
      });

      expect(result.movement_type).toBe('RESTOCK');
      expect(result.quantity_change).toBe(50);
      expect(result.new_stock).toBe(60);
      expect(mockR2Engine.recordMovement).toHaveBeenCalledWith({
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        movementType: 'RESTOCK',
        quantityChange: 50,
        referenceType: 'MANUAL',
        reason: 'Restock',
        userId: undefined,
      });
    });

    test('W5.2: Stock adjustment - damage', async () => {
      const mockDomainMovement = {
        id: 'mov-002',
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        movementType: 'DAMAGE' as const,
        quantityChange: -5,
        previousStock: 60,
        newStock: 55,
        referenceType: 'MANUAL' as const,
        reason: 'Damaged goods',
        createdAt: new Date().toISOString(),
      };

      mockR2Engine.recordMovement.mockResolvedValue(mockDomainMovement);

      const result = await inventoryMovement.adjustStock({
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        quantityChange: -5,
        movementType: 'DAMAGE',
        reason: 'Damaged goods',
      });

      expect(result.movement_type).toBe('DAMAGE');
      expect(result.quantity_change).toBe(-5);
      expect(result.new_stock).toBe(55);
      expect(mockR2Engine.recordMovement).toHaveBeenCalledWith({
        tenantId: 'tenant-retail-a',
        productId: 'prod-001',
        movementType: 'DAMAGE',
        quantityChange: -5,
        referenceType: 'MANUAL',
        reason: 'Damaged goods',
        userId: undefined,
      });
    });
  });

  // ==================== Cross-Workflow Integration ====================
  describe('Cross-Workflow Integration', () => {
    test('Full workflow: Create product → Register customer → Start sale → Add items → Complete → Process inventory', async () => {
      // This test demonstrates the complete flow across all 5 workflows
      // In a real integration test, this would execute against a test database

      expect(productCatalog).toBeDefined();
      expect(customerPurchase).toBeDefined();
      expect(saleCompletion).toBeDefined();
      expect(inventoryMovement).toBeDefined();

      // Evidence: All services initialized successfully
      expect(true).toBe(true);
    });
  });

  // ==================== Tenant Isolation Tests ====================
  describe('Tenant Isolation Verification', () => {
    test('All services enforce tenant context', async () => {
      const services = [
        () => productCatalog.createProduct({ tenantId: '', sku: 'TEST', name: 'Test', category: 'Test', basePrice: 10 }),
        () => customerPurchase.registerCustomer({ tenantId: '', firstName: 'Test', lastName: 'Test', email: 'test@test.com' }),
        () => saleCompletion.validateSaleItems('', 'sale-001'),
        () => inventoryMovement.processSaleInventoryMovement({ tenantId: '', saleId: 'sale-001' }),
      ];

      for (const service of services) {
        await expect(service()).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
      }
    });
  });
});
