/**
 * InventoryMovement Domain Entity
 * 
 * Canonical Authority: supabase/migrations/20260905000001_retail_os_canonical_schema.sql
 * Table: retail_inventory_movements
 * 
 * Business Rules:
 * 1. Quantity change can be negative (decrease) or positive (increase)
 * 2. Previous stock and new stock must be non-negative
 * 3. New stock = Previous stock + Quantity change
 * 4. Movement type determines if quantity increases or decreases
 * 5. Immutable after creation (audit trail)
 */

import type { RetailInventoryMovement as RetailInventoryMovementRow } from '../../../types/retail-database.types';

export type MovementType = 'RESTOCK' | 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE' | 'TRANSFER';
export type ReferenceType = 'SALE' | 'PURCHASE_ORDER' | 'MANUAL';

export interface InventoryMovementProps {
  id: string;
  tenantId: string;
  productId: string;
  movementType: MovementType;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  referenceType?: ReferenceType;
  referenceId?: string;
  reason?: string;
  performedBy?: string;
  createdAt: Date;
}

export interface CreateInventoryMovementCommand {
  tenantId: string;
  productId: string;
  movementType: MovementType;
  quantityChange: number;
  previousStock: number;
  referenceType?: ReferenceType;
  referenceId?: string;
  reason?: string;
  performedBy?: string;
}

export class InventoryMovement {
  private constructor(private props: InventoryMovementProps) {}

  static create(command: CreateInventoryMovementCommand): InventoryMovement {
    // Validation: previous stock must be non-negative
    if (command.previousStock < 0) {
      throw new Error('Previous stock cannot be negative');
    }

    // Calculate new stock
    const newStock = command.previousStock + command.quantityChange;

    // Validation: new stock must be non-negative
    if (newStock < 0) {
      throw new Error(`New stock cannot be negative (would be ${newStock})`);
    }

    // Validation: quantity change direction must match movement type
    const isIncrease = command.quantityChange > 0;
    const isDecrease = command.quantityChange < 0;

    const increaseTypes: MovementType[] = ['RESTOCK', 'RETURN', 'ADJUSTMENT'];
    const decreaseTypes: MovementType[] = ['SALE', 'DAMAGE', 'TRANSFER'];

    if (isIncrease && decreaseTypes.includes(command.movementType)) {
      console.warn(`Warning: ${command.movementType} typically decreases stock, but quantity change is positive`);
    }

    if (isDecrease && increaseTypes.includes(command.movementType)) {
      console.warn(`Warning: ${command.movementType} typically increases stock, but quantity change is negative`);
    }

    return new InventoryMovement({
      id: crypto.randomUUID(),
      tenantId: command.tenantId,
      productId: command.productId,
      movementType: command.movementType,
      quantityChange: command.quantityChange,
      previousStock: command.previousStock,
      newStock,
      referenceType: command.referenceType,
      referenceId: command.referenceId,
      reason: command.reason,
      performedBy: command.performedBy,
      createdAt: new Date(),
    });
  }

  static fromPersistence(row: RetailInventoryMovementRow): InventoryMovement {
    return new InventoryMovement({
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      movementType: row.movement_type as MovementType,
      quantityChange: row.quantity_change,
      previousStock: row.previous_stock,
      newStock: row.new_stock,
      referenceType: row.reference_type as ReferenceType | undefined,
      referenceId: row.reference_id ?? undefined,
      reason: row.reason ?? undefined,
      performedBy: row.performed_by ?? undefined,
      createdAt: new Date(row.created_at),
    });
  }

  toPersistence(): RetailInventoryMovementRow {
    return {
      id: this.props.id,
      tenant_id: this.props.tenantId,
      product_id: this.props.productId,
      movement_type: this.props.movementType,
      quantity_change: this.props.quantityChange,
      previous_stock: this.props.previousStock,
      new_stock: this.props.newStock,
      reference_type: this.props.referenceType ?? null,
      reference_id: this.props.referenceId ?? null,
      reason: this.props.reason ?? null,
      performed_by: this.props.performedBy ?? null,
      created_at: this.props.createdAt.toISOString(),
    };
  }

  // Getters
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get productId(): string { return this.props.productId; }
  get movementType(): MovementType { return this.props.movementType; }
  get quantityChange(): number { return this.props.quantityChange; }
  get previousStock(): number { return this.props.previousStock; }
  get newStock(): number { return this.props.newStock; }
  get referenceType(): ReferenceType | undefined { return this.props.referenceType; }
  get referenceId(): string | undefined { return this.props.referenceId; }
  get reason(): string | undefined { return this.props.reason; }
  get performedBy(): string | undefined { return this.props.performedBy; }
  get createdAt(): Date { return this.props.createdAt; }
  get isIncrease(): boolean { return this.props.quantityChange > 0; }
  get isDecrease(): boolean { return this.props.quantityChange < 0; }
}
