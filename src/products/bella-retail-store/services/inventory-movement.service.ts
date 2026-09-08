/**
 * BELLA RETAIL STORE - INVENTORY MOVEMENT SERVICE
 * 
 * W4: Sale → Inventory Movement
 * - Completed Sale triggers InventoryMovement, stock decreases, reorder check
 * - Entities: Sale, SaleItem, Product, InventoryMovement
 * - Evidence target: Cross-domain capability, stock ownership
 * - Migrated to use Retail OS R2 Inventory Movement Contract
 * 
 * W5: Restock / Stock Adjustment
 * - Receive stock, create InventoryMovement, Product stock changes
 * - Entities: Product, InventoryMovement
 * - Evidence target: Boundary evidence
 * - Migrated to use Retail OS R2 Inventory Movement Contract
 * 
 * Architecture: Product -> R2 Contract -> R2 Engine -> Repository
 * Tenant Isolation: Enforced by R2 engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  RetailInventoryMovement,
  RetailProduct,
  RetailSale,
  RetailSaleItem,
} from '@/types/retail-database.types';
import type { 
  IInventoryMovementContract,
  InventoryMovement,
  ReorderAlert 
} from '@/platform/retail/contracts/inventory-movement.contract';

export interface ProcessSaleInventoryMovementRequest {
  tenantId: string;
  saleId: string;
  userId?: string;
}

export interface RestockProductRequest {
  tenantId: string;
  productId: string;
  quantity: number;
  reason?: string;
  userId?: string;
}

export interface AdjustStockRequest {
  tenantId: string;
  productId: string;
  quantityChange: number; // Can be positive or negative
  movementType: 'ADJUSTMENT' | 'RETURN' | 'DAMAGE' | 'TRANSFER';
  reason?: string;
  userId?: string;
}

export interface InventoryMovementResult {
  movements: RetailInventoryMovement[];
  productsNeedingReorder: Array<{ product: RetailProduct; currentStock: number; reorderPoint: number }>;
}

export class InventoryMovementService {
  constructor(
    private readonly inventoryMovementEngine: IInventoryMovementContract,
    private readonly supabase: SupabaseClient // Kept for Sale/SaleItem orchestration queries
  ) {}

  /**
   * W4: Process inventory movements for a completed sale
   * ORCHESTRATION: Composes R2.recordMovement() across multiple sale items
   * This is Product-specific business logic (Sale → Inventory interaction)
   */
  async processSaleInventoryMovement(
    request: ProcessSaleInventoryMovementRequest
  ): Promise<InventoryMovementResult> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: request.tenantId });

    // Verify sale is completed (Product orchestration logic)
    const { data: sale, error: saleError } = await this.supabase
      .from('retail_sales')
      .select('*')
      .eq('id', request.saleId)
      .eq('tenant_id', request.tenantId)
      .single();

    if (saleError || !sale) {
      throw new Error(`SALE_NOT_FOUND: ${saleError?.message || 'Sale does not exist'}`);
    }

    if (sale.status !== 'COMPLETED') {
      throw new Error('SALE_NOT_COMPLETED: Can only process inventory for completed sales');
    }

    // Get sale items (Product orchestration logic)
    const { data: items, error: itemsError } = await this.supabase
      .from('retail_sale_items')
      .select('*')
      .eq('sale_id', request.saleId)
      .eq('tenant_id', request.tenantId);

    if (itemsError || !items || items.length === 0) {
      throw new Error(`SALE_ITEMS_FETCH_FAILED: ${itemsError?.message || 'No items found'}`);
    }

    const movements: RetailInventoryMovement[] = [];

    // Process each item - delegate to R2 for canonical inventory logic
    for (const item of items) {
      try {
        // Use R2 to record movement (canonical)
        const movement = await this.inventoryMovementEngine.recordMovement({
          tenantId: request.tenantId,
          productId: item.product_id,
          movementType: 'SALE',
          quantityChange: -item.quantity,
          referenceType: 'SALE',
          referenceId: request.saleId,
          reason: `Sale ${sale.sale_number}`,
          userId: request.userId,
        });

        movements.push(this.mapToRetailInventoryMovement(movement));
      } catch (error: any) {
        // If product doesn't track inventory, R2 will skip
        // If negative stock, R2 will throw (propagate to caller)
        if (error.message?.includes('INVENTORY_NOT_TRACKED')) {
          continue; // Skip non-tracked products
        }
        throw error;
      }
    }

    // Detect reorder needs using R2 canonical detection
    const reorderAlerts = await this.inventoryMovementEngine.detectReorderNeeds(request.tenantId);
    
    // Map alerts to legacy format for backward compatibility
    const productsNeedingReorder: Array<{ product: RetailProduct; currentStock: number; reorderPoint: number }> = [];
    
    if (reorderAlerts.length > 0) {
      const productIds = reorderAlerts.map(a => a.product.id);
      const { data: products } = await this.supabase
        .from('retail_products')
        .select('*')
        .in('id', productIds)
        .eq('tenant_id', request.tenantId);
      
      if (products) {
        for (const alert of reorderAlerts) {
          const product = products.find(p => p.id === alert.product.id);
          if (product) {
            productsNeedingReorder.push({
              product,
              currentStock: alert.currentStock,
              reorderPoint: alert.reorderPoint,
            });
          }
        }
      }
    }

    return {
      movements,
      productsNeedingReorder,
    };
  }

  /**
   * W5.1: Restock product (receive inventory)
   * MIGRATED: Now uses R2 Inventory Movement contract
   */
  async restockProduct(request: RestockProductRequest): Promise<RetailInventoryMovement> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    if (request.quantity <= 0) {
      throw new Error('INVALID_QUANTITY: Quantity must be positive for restocking');
    }

    // Delegate to R2 engine
    const movement = await this.inventoryMovementEngine.recordMovement({
      tenantId: request.tenantId,
      productId: request.productId,
      movementType: 'RESTOCK',
      quantityChange: request.quantity,
      referenceType: 'MANUAL',
      reason: request.reason || 'Restock',
      userId: request.userId,
    });

    return this.mapToRetailInventoryMovement(movement);
  }

  /**
   * W5.2: Adjust stock (manual adjustments, returns, damage, transfers)
   * MIGRATED: Now uses R2 Inventory Movement contract
   */
  async adjustStock(request: AdjustStockRequest): Promise<RetailInventoryMovement> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Delegate to R2 engine
    const movement = await this.inventoryMovementEngine.recordMovement({
      tenantId: request.tenantId,
      productId: request.productId,
      movementType: request.movementType,
      quantityChange: request.quantityChange,
      referenceType: 'MANUAL',
      reason: request.reason || `Stock ${request.movementType.toLowerCase()}`,
      userId: request.userId,
    });

    return this.mapToRetailInventoryMovement(movement);
  }

  /**
   * Get inventory movements for a product
   * MIGRATED: Now uses R2 Inventory Movement contract
   */
  async getProductMovements(
    tenantId: string,
    productId: string
  ): Promise<RetailInventoryMovement[]> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    const movements = await this.inventoryMovementEngine.getMovementHistory(tenantId, productId);
    return movements.map(m => this.mapToRetailInventoryMovement(m));
  }

  /**
   * Get products needing reorder
   * MIGRATED: Now uses R2 Inventory Movement contract
   * Preserves backward compatibility by returning full product records
   */
  async getProductsNeedingReorder(tenantId: string): Promise<RetailProduct[]> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Use R2 to detect reorder needs
    const alerts = await this.inventoryMovementEngine.detectReorderNeeds(tenantId);
    
    if (alerts.length === 0) {
      return [];
    }

    // Fetch full product records for backward compatibility
    await this.supabase.rpc('set_tenant_context', { tenant_id: tenantId });
    
    const productIds = alerts.map(a => a.product.id);
    const { data, error } = await this.supabase
      .from('retail_products')
      .select('*')
      .in('id', productIds)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`PRODUCTS_FETCH_FAILED: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Map domain InventoryMovement to RetailInventoryMovement (DB type)
   * Preserves bella-retail-store's existing type interface
   */
  private mapToRetailInventoryMovement(movement: InventoryMovement): RetailInventoryMovement {
    return {
      id: movement.id,
      tenant_id: movement.tenantId,
      product_id: movement.productId,
      movement_type: movement.movementType,
      quantity_change: movement.quantityChange,
      previous_stock: movement.previousStock,
      new_stock: movement.newStock,
      reference_type: movement.referenceType || null,
      reference_id: movement.referenceId || null,
      reason: movement.reason || null,
      performed_by: movement.performedBy || null,
      created_at: movement.createdAt,
    };
  }
}
