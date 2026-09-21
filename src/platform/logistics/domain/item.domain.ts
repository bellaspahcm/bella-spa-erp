/**
 * Item Domain Kernel
 * 
 * Pure business logic for Item/SKU management.
 * Zero dependencies on infrastructure (database, HTTP, Warehouse).
 * 
 * Responsibilities:
 * - SKU creation with validation
 * - Traceability configuration validation
 * - Status transitions
 * - Measurement semantics
 */

import { Result } from './core/result';
import type {
  Item,
  CreateItemProps,
  UpdateItemProps,
  ItemType,
  ItemStatus,
  UnitOfMeasure,
} from './item.types';

export class ItemDomain {
  /**
   * Create new Item/SKU
   * 
   * Invariants:
   * - SKU code required and non-empty
   * - Name required
   * - Base UOM required
   * - Serial tracking requires lot tracking
   * - Weights/dimensions must be non-negative
   * - Standard cost must be non-negative
   */
  static create(props: CreateItemProps): Result<Item> {
    // Required fields
    if (!props.skuCode || props.skuCode.trim() === '') {
      return Result.fail('SKU code is required', 'ITEM_SKU_CODE_REQUIRED');
    }

    if (!props.name || props.name.trim() === '') {
      return Result.fail('Item name is required', 'ITEM_NAME_REQUIRED');
    }

    if (!props.baseUom) {
      return Result.fail('Base unit of measure is required', 'ITEM_BASE_UOM_REQUIRED');
    }

    // Traceability invariant: serial tracking requires lot tracking
    if (props.serialTracked && !props.lotTracked) {
      return Result.fail(
        'Serial tracking requires lot tracking to be enabled',
        'ITEM_SERIAL_REQUIRES_LOT'
      );
    }

    // Weight validation
    if (props.weightKg !== undefined && props.weightKg < 0) {
      return Result.fail('Weight cannot be negative', 'ITEM_WEIGHT_NEGATIVE');
    }

    // Dimensions validation (if provided)
    if (props.dimensionsJson) {
      const dimResult = this.validateDimensions(props.dimensionsJson);
      if (dimResult.isFailure) {
        return dimResult as Result<Item>;
      }
    }

    // Standard cost validation
    if (props.standardCost !== undefined && props.standardCost < 0) {
      return Result.fail('Standard cost cannot be negative', 'ITEM_COST_NEGATIVE');
    }

    // Currency format validation (ISO 4217)
    if (props.currency && !/^[A-Z]{3}$/.test(props.currency)) {
      return Result.fail(
        'Currency must be 3-letter ISO 4217 code (e.g., VND, USD)',
        'ITEM_CURRENCY_INVALID'
      );
    }

    const now = new Date();

    const item: Item = {
      id: props.id || crypto.randomUUID(),
      tenantId: props.tenantId,
      skuCode: props.skuCode.trim(),
      name: props.name.trim(),
      description: props.description?.trim() || null,
      
      type: props.type || 'GOODS',
      category: props.category?.trim() || null,
      
      baseUom: props.baseUom,
      weightKg: props.weightKg !== undefined ? props.weightKg : null,
      dimensionsJson: props.dimensionsJson || null,
      
      standardCost: props.standardCost !== undefined ? props.standardCost : null,
      currency: props.currency || 'VND',
      
      lotTracked: props.lotTracked || false,
      serialTracked: props.serialTracked || false,
      expiryTracked: props.expiryTracked || false,
      
      status: props.status || 'ACTIVE',
      
      createdAt: now,
      updatedAt: now,
      createdBy: props.createdBy || null,
      updatedBy: props.updatedBy || null,
    };

    return Result.ok(item);
  }

  /**
   * Update existing Item
   * 
   * Cannot change:
   * - tenantId (immutable)
   * - skuCode (business key, immutable)
   * - createdAt/createdBy (audit)
   */
  static update(existingItem: Item, updates: UpdateItemProps): Result<Item> {
    // Name cannot be empty if provided
    if (updates.name !== undefined && (!updates.name || updates.name.trim() === '')) {
      return Result.fail('Item name cannot be empty', 'ITEM_NAME_REQUIRED');
    }

    // Traceability invariant
    const newLotTracked = updates.lotTracked !== undefined 
      ? updates.lotTracked 
      : existingItem.lotTracked;
    const newSerialTracked = updates.serialTracked !== undefined 
      ? updates.serialTracked 
      : existingItem.serialTracked;

    if (newSerialTracked && !newLotTracked) {
      return Result.fail(
        'Serial tracking requires lot tracking to be enabled',
        'ITEM_SERIAL_REQUIRES_LOT'
      );
    }

    // Weight validation
    if (updates.weightKg !== undefined && updates.weightKg < 0) {
      return Result.fail('Weight cannot be negative', 'ITEM_WEIGHT_NEGATIVE');
    }

    // Dimensions validation
    if (updates.dimensionsJson) {
      const dimResult = this.validateDimensions(updates.dimensionsJson);
      if (dimResult.isFailure) {
        return dimResult as Result<Item>;
      }
    }

    // Standard cost validation
    if (updates.standardCost !== undefined && updates.standardCost < 0) {
      return Result.fail('Standard cost cannot be negative', 'ITEM_COST_NEGATIVE');
    }

    // Currency validation
    if (updates.currency && !/^[A-Z]{3}$/.test(updates.currency)) {
      return Result.fail(
        'Currency must be 3-letter ISO 4217 code',
        'ITEM_CURRENCY_INVALID'
      );
    }

    const updatedItem: Item = {
      ...existingItem,
      ...updates,
      name: updates.name?.trim() || existingItem.name,
      description: updates.description !== undefined 
        ? updates.description?.trim() || null 
        : existingItem.description,
      category: updates.category !== undefined 
        ? updates.category?.trim() || null 
        : existingItem.category,
      updatedAt: new Date(),
    };

    return Result.ok(updatedItem);
  }

  /**
   * Validate item can transition to new status
   */
  static canTransitionTo(item: Item, newStatus: ItemStatus): Result<void> {
    const validTransitions: Record<ItemStatus, ItemStatus[]> = {
      PENDING: ['ACTIVE', 'INACTIVE'],
      ACTIVE: ['INACTIVE', 'DISCONTINUED'],
      INACTIVE: ['ACTIVE', 'DISCONTINUED'],
      DISCONTINUED: [], // Terminal state
    };

    const allowed = validTransitions[item.status] || [];
    
    if (!allowed.includes(newStatus)) {
      return Result.fail(
        `Cannot transition from ${item.status} to ${newStatus}`,
        'ITEM_INVALID_TRANSITION'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Check if item can be deactivated
   * 
   * Note: Actual inventory check happens at repository layer.
   * This is domain-level validation only.
   */
  static canDeactivate(item: Item): Result<void> {
    if (item.status === 'DISCONTINUED') {
      return Result.fail(
        'Cannot deactivate discontinued item',
        'ITEM_ALREADY_DISCONTINUED'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Check if item requires lot tracking
   */
  static requiresLotTracking(item: Item): boolean {
    return item.lotTracked || item.serialTracked || item.expiryTracked;
  }

  /**
   * Check if item requires serial tracking
   */
  static requiresSerialTracking(item: Item): boolean {
    return item.serialTracked;
  }

  /**
   * Check if item requires expiry tracking
   */
  static requiresExpiryTracking(item: Item): boolean {
    return item.expiryTracked;
  }

  /**
   * Validate dimensions JSON structure
   */
  private static validateDimensions(dimensionsJson: Record<string, unknown>): Result<void> {
    const { length, width, height, unit } = dimensionsJson;

    if (typeof length === 'number' && length < 0) {
      return Result.fail('Length cannot be negative', 'ITEM_DIMENSION_NEGATIVE');
    }

    if (typeof width === 'number' && width < 0) {
      return Result.fail('Width cannot be negative', 'ITEM_DIMENSION_NEGATIVE');
    }

    if (typeof height === 'number' && height < 0) {
      return Result.fail('Height cannot be negative', 'ITEM_DIMENSION_NEGATIVE');
    }

    if (unit && typeof unit !== 'string') {
      return Result.fail('Dimension unit must be a string', 'ITEM_DIMENSION_UNIT_INVALID');
    }

    return Result.ok(undefined);
  }

  /**
   * Calculate item volume (if dimensions provided)
   */
  static calculateVolume(item: Item): number | null {
    if (!item.dimensionsJson) return null;

    const { length, width, height } = item.dimensionsJson;
    
    if (
      typeof length === 'number' &&
      typeof width === 'number' &&
      typeof height === 'number'
    ) {
      return length * width * height;
    }

    return null;
  }
}
