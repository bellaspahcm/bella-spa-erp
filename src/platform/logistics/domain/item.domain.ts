/**
 * Item Domain - E7.1 Item/SKU Domain Kernel
 * 
 * Canonical source: logistics.items table schema
 * Behavioral specification: item.domain.test.ts
 * 
 * Implements 8 E7 invariants:
 * 1. SKU code required and non-empty
 * 2. Name required
 * 3. Serial tracking requires lot tracking
 * 4. Weight cannot be negative
 * 5. Standard cost cannot be negative
 * 6. Currency must be ISO 4217 format
 * 7. Dimensions must be non-negative
 * 8. Status transitions validated
 */

import type { Database } from '@/shared/database.types';
import { Result } from './core/result';

// ============================================================================
// TYPES (from canonical DB schema)
// ============================================================================

type ItemRow = Database['logistics']['Tables']['items']['Row'];
type ItemInsert = Database['logistics']['Tables']['items']['Insert'];

/**
 * Item domain entity (maps to logistics.items Row)
 */
export interface Item {
  id: string;
  tenantId: string;
  skuCode: string;
  name: string;
  description: string | null;
  type: 'GOODS' | 'SERVICE' | 'KIT' | 'BUNDLE' | 'VIRTUAL';
  category: string | null;
  baseUom: string;
  weightKg: number | null;
  dimensionsJson: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  } | null;
  standardCost: number | null;
  currency: string;
  lotTracked: boolean;
  serialTracked: boolean;
  expiryTracked: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'PENDING';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Props for creating new Item
 */
export interface CreateItemProps {
  tenantId: string;
  skuCode: string;
  name: string;
  description?: string | null;
  type?: 'GOODS' | 'SERVICE' | 'KIT' | 'BUNDLE' | 'VIRTUAL';
  category?: string | null;
  baseUom?: string;
  weightKg?: number | null;
  dimensionsJson?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  } | null;
  standardCost?: number | null;
  currency?: string;
  lotTracked?: boolean;
  serialTracked?: boolean;
  expiryTracked?: boolean;
  status?: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'PENDING';
  createdBy?: string | null;
}

/**
 * Props for updating Item
 */
export interface UpdateItemProps {
  name?: string;
  description?: string | null;
  type?: 'GOODS' | 'SERVICE' | 'KIT' | 'BUNDLE' | 'VIRTUAL';
  category?: string | null;
  baseUom?: string;
  weightKg?: number | null;
  dimensionsJson?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  } | null;
  standardCost?: number | null;
  currency?: string;
  lotTracked?: boolean;
  serialTracked?: boolean;
  expiryTracked?: boolean;
  status?: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'PENDING';
  updatedBy?: string | null;
}

// ============================================================================
// DOMAIN LOGIC
// ============================================================================

export const ItemDomain = {
  /**
   * Create new Item with invariant validation
   */
  create(props: CreateItemProps): Result<Item> {
    // Invariant 1: SKU code required and non-empty
    const skuCode = props.skuCode?.trim();
    if (!skuCode) {
      return Result.fail('SKU code is required', 'ITEM_SKU_CODE_REQUIRED');
    }

    // Invariant 2: Name required
    const name = props.name?.trim();
    if (!name) {
      return Result.fail('Item name is required', 'ITEM_NAME_REQUIRED');
    }

    // Invariant 3: Serial tracking requires lot tracking
    const lotTracked = props.lotTracked ?? false;
    const serialTracked = props.serialTracked ?? false;
    if (serialTracked && !lotTracked) {
      return Result.fail(
        'Serial tracking requires lot tracking to be enabled',
        'ITEM_SERIAL_REQUIRES_LOT'
      );
    }

    // Invariant 4: Weight cannot be negative
    if (props.weightKg !== undefined && props.weightKg !== null && props.weightKg < 0) {
      return Result.fail('Weight cannot be negative', 'ITEM_WEIGHT_NEGATIVE');
    }

    // Invariant 5: Standard cost cannot be negative
    if (props.standardCost !== undefined && props.standardCost !== null && props.standardCost < 0) {
      return Result.fail('Standard cost cannot be negative', 'ITEM_COST_NEGATIVE');
    }

    // Invariant 6: Currency must be ISO 4217 format (3 uppercase letters)
    const currency = props.currency || 'VND';
    if (!/^[A-Z]{3}$/.test(currency)) {
      return Result.fail(
        'Currency must be 3-letter ISO 4217 code (e.g., VND, USD)',
        'ITEM_CURRENCY_INVALID'
      );
    }

    // Invariant 7: Dimensions must be non-negative
    if (props.dimensionsJson) {
      const { length, width, height } = props.dimensionsJson;
      if (length !== undefined && length < 0) {
        return Result.fail('Length cannot be negative', 'ITEM_DIMENSION_NEGATIVE');
      }
      if (width !== undefined && width < 0) {
        return Result.fail('Width cannot be negative', 'ITEM_DIMENSION_NEGATIVE');
      }
      if (height !== undefined && height < 0) {
        return Result.fail('Height cannot be negative', 'ITEM_DIMENSION_NEGATIVE');
      }
    }

    // Invariant 8: Status defaults to ACTIVE
    const status = props.status || 'ACTIVE';

    // Create Item entity
    const now = new Date();
    const item: Item = {
      id: crypto.randomUUID(),
      tenantId: props.tenantId,
      skuCode,
      name,
      description: props.description ?? null,
      type: props.type || 'GOODS',
      category: props.category ?? null,
      baseUom: props.baseUom || 'EA',
      weightKg: props.weightKg ?? null,
      dimensionsJson: props.dimensionsJson ?? null,
      standardCost: props.standardCost ?? null,
      currency,
      lotTracked,
      serialTracked,
      expiryTracked: props.expiryTracked ?? false,
      status,
      createdAt: now,
      updatedAt: now,
      createdBy: props.createdBy ?? null,
      updatedBy: null,
    };

    return Result.ok(item);
  },

  /**
   * Update Item with invariant validation
   */
  update(item: Item, changes: UpdateItemProps): Result<Item> {
    // Validate name if changing
    if (changes.name !== undefined) {
      const name = changes.name?.trim();
      if (!name) {
        return Result.fail('Item name cannot be empty', 'ITEM_NAME_REQUIRED');
      }
    }

    // Validate serial→lot invariant if changing tracking
    const newLotTracked = changes.lotTracked ?? item.lotTracked;
    const newSerialTracked = changes.serialTracked ?? item.serialTracked;
    if (newSerialTracked && !newLotTracked) {
      return Result.fail(
        'Serial tracking requires lot tracking to be enabled',
        'ITEM_SERIAL_REQUIRES_LOT'
      );
    }

    // Validate weight if changing
    if (changes.weightKg !== undefined && changes.weightKg !== null && changes.weightKg < 0) {
      return Result.fail('Weight cannot be negative', 'ITEM_WEIGHT_NEGATIVE');
    }

    // Validate cost if changing
    if (changes.standardCost !== undefined && changes.standardCost !== null && changes.standardCost < 0) {
      return Result.fail('Standard cost cannot be negative', 'ITEM_COST_NEGATIVE');
    }

    // Validate currency if changing
    if (changes.currency !== undefined) {
      if (!/^[A-Z]{3}$/.test(changes.currency)) {
        return Result.fail(
          'Currency must be 3-letter ISO 4217 code',
          'ITEM_CURRENCY_INVALID'
        );
      }
    }

    // Validate dimensions if changing
    if (changes.dimensionsJson) {
      const { length, width, height } = changes.dimensionsJson;
      if (length !== undefined && length < 0) {
        return Result.fail('Length cannot be negative', 'ITEM_DIMENSION_NEGATIVE');
      }
      if (width !== undefined && width < 0) {
        return Result.fail('Width cannot be negative', 'ITEM_DIMENSION_NEGATIVE');
      }
      if (height !== undefined && height < 0) {
        return Result.fail('Height cannot be negative', 'ITEM_DIMENSION_NEGATIVE');
      }
    }

    // Apply changes
    const updated: Item = {
      ...item,
      ...changes,
      name: changes.name?.trim() ?? item.name,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  },

  /**
   * Validate status transition
   */
  canTransitionTo(
    item: Item,
    newStatus: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'PENDING'
  ): Result<boolean> {
    const { status } = item;

    // Valid transitions
    const validTransitions: Record<string, string[]> = {
      PENDING: ['ACTIVE', 'INACTIVE'],
      ACTIVE: ['INACTIVE', 'DISCONTINUED'],
      INACTIVE: ['ACTIVE'],
      DISCONTINUED: [], // Terminal state
    };

    const allowed = validTransitions[status] || [];
    if (!allowed.includes(newStatus)) {
      return Result.fail(
        `Cannot transition from ${status} to ${newStatus}`,
        'ITEM_INVALID_TRANSITION'
      );
    }

    return Result.ok(true);
  },

  /**
   * Check if item requires lot tracking (lot, serial, or expiry)
   */
  requiresLotTracking(item: Item): boolean {
    return item.lotTracked || item.serialTracked || item.expiryTracked;
  },

  /**
   * Calculate volume from dimensions
   */
  calculateVolume(item: Item): number | null {
    if (!item.dimensionsJson) return null;

    const { length, width, height } = item.dimensionsJson;
    if (
      length === undefined ||
      width === undefined ||
      height === undefined
    ) {
      return null;
    }

    return length * width * height;
  },
};
