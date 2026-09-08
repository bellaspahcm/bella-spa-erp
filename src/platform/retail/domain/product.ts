/**
 * Retail Product Domain Entity
 * 
 * Canonical Authority: supabase/migrations/20260905000001_retail_os_canonical_schema.sql
 * Table: retail_products
 */

import type { RetailProduct as RetailProductRow } from '../../../types/retail-database.types';

export type ProductStatus = 'ACTIVE' | 'DISCONTINUED' | 'OUT_OF_STOCK';

export interface ProductProps {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  costPrice?: number;
  trackInventory: boolean;
  currentStock?: number;
  reorderPoint?: number;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateProductCommand {
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  costPrice?: number;
  trackInventory?: boolean;
  currentStock?: number;
  reorderPoint?: number;
  createdBy?: string;
}

export interface UpdateProductCommand {
  name?: string;
  description?: string;
  category?: string;
  basePrice?: number;
  costPrice?: number;
  reorderPoint?: number;
  status?: ProductStatus;
  updatedBy?: string;
}

export class Product {
  private constructor(private props: ProductProps) {}

  static create(command: CreateProductCommand): Product {
    // Validation
    if (command.basePrice < 0) {
      throw new Error('Base price cannot be negative');
    }

    if (command.costPrice !== undefined && command.costPrice < 0) {
      throw new Error('Cost price cannot be negative');
    }

    if (command.currentStock !== undefined && command.currentStock < 0) {
      throw new Error('Stock cannot be negative');
    }

    if (command.reorderPoint !== undefined && command.reorderPoint < 0) {
      throw new Error('Reorder point cannot be negative');
    }

    const now = new Date();

    return new Product({
      id: crypto.randomUUID(),
      tenantId: command.tenantId,
      sku: command.sku,
      name: command.name,
      description: command.description,
      category: command.category,
      basePrice: command.basePrice,
      costPrice: command.costPrice,
      trackInventory: command.trackInventory ?? true,
      currentStock: command.currentStock ?? 0,
      reorderPoint: command.reorderPoint,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      createdBy: command.createdBy,
      updatedBy: command.createdBy,
    });
  }

  static fromPersistence(row: RetailProductRow): Product {
    return new Product({
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      description: row.description ?? undefined,
      category: row.category,
      basePrice: row.base_price,
      costPrice: row.cost_price ?? undefined,
      trackInventory: row.track_inventory,
      currentStock: row.current_stock ?? undefined,
      reorderPoint: row.reorder_point ?? undefined,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined,
    });
  }

  update(command: UpdateProductCommand): void {
    if (command.basePrice !== undefined && command.basePrice < 0) {
      throw new Error('Base price cannot be negative');
    }

    if (command.costPrice !== undefined && command.costPrice < 0) {
      throw new Error('Cost price cannot be negative');
    }

    if (command.name !== undefined) this.props.name = command.name;
    if (command.description !== undefined) this.props.description = command.description;
    if (command.category !== undefined) this.props.category = command.category;
    if (command.basePrice !== undefined) this.props.basePrice = command.basePrice;
    if (command.costPrice !== undefined) this.props.costPrice = command.costPrice;
    if (command.reorderPoint !== undefined) this.props.reorderPoint = command.reorderPoint;
    if (command.status !== undefined) this.props.status = command.status;
    if (command.updatedBy !== undefined) this.props.updatedBy = command.updatedBy;

    this.props.updatedAt = new Date();
  }

  discontinue(userId?: string): void {
    this.props.status = 'DISCONTINUED';
    this.props.updatedBy = userId;
    this.props.updatedAt = new Date();
  }

  markOutOfStock(userId?: string): void {
    this.props.status = 'OUT_OF_STOCK';
    this.props.updatedBy = userId;
    this.props.updatedAt = new Date();
  }

  reactivate(userId?: string): void {
    if (this.props.status === 'DISCONTINUED') {
      throw new Error('Cannot reactivate discontinued product');
    }

    this.props.status = 'ACTIVE';
    this.props.updatedBy = userId;
    this.props.updatedAt = new Date();
  }

  adjustStock(newStock: number, userId?: string): void {
    if (!this.props.trackInventory) {
      throw new Error('Cannot adjust stock for non-tracked inventory product');
    }

    if (newStock < 0) {
      throw new Error('Stock cannot be negative');
    }

    this.props.currentStock = newStock;
    this.props.updatedBy = userId;
    this.props.updatedAt = new Date();

    // Auto-mark out of stock if needed
    if (newStock === 0 && this.props.status === 'ACTIVE') {
      this.props.status = 'OUT_OF_STOCK';
    }
  }

  needsReorder(): boolean {
    if (!this.props.trackInventory || !this.props.reorderPoint) {
      return false;
    }

    const stock = this.props.currentStock ?? 0;
    return stock <= this.props.reorderPoint;
  }

  toPersistence(): RetailProductRow {
    return {
      id: this.props.id,
      tenant_id: this.props.tenantId,
      sku: this.props.sku,
      name: this.props.name,
      description: this.props.description ?? null,
      category: this.props.category,
      base_price: this.props.basePrice,
      cost_price: this.props.costPrice ?? null,
      track_inventory: this.props.trackInventory,
      current_stock: this.props.currentStock ?? null,
      reorder_point: this.props.reorderPoint ?? null,
      status: this.props.status,
      created_at: this.props.createdAt.toISOString(),
      updated_at: this.props.updatedAt.toISOString(),
      created_by: this.props.createdBy ?? null,
      updated_by: this.props.updatedBy ?? null,
    };
  }

  // Getters
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get sku(): string { return this.props.sku; }
  get name(): string { return this.props.name; }
  get description(): string | undefined { return this.props.description; }
  get category(): string { return this.props.category; }
  get basePrice(): number { return this.props.basePrice; }
  get costPrice(): number | undefined { return this.props.costPrice; }
  get trackInventory(): boolean { return this.props.trackInventory; }
  get currentStock(): number | undefined { return this.props.currentStock; }
  get reorderPoint(): number | undefined { return this.props.reorderPoint; }
  get status(): ProductStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get createdBy(): string | undefined { return this.props.createdBy; }
  get updatedBy(): string | undefined { return this.props.updatedBy; }
}
