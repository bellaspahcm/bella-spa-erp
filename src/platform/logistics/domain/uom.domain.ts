/**
 * UOM (Unit of Measure) Domain
 * 
 * E7 Logistics Domain Kernel - UOM Component
 * Canonical: Database['logistics']['Tables']['uom']
 */

import { Result } from './core/result';
import type { Database } from '../../../shared/database.types';

// Canonical DB row type
type UOMRow = Database['logistics']['Tables']['uom']['Row'];

// Domain types
export type UOMCategory = 'QUANTITY' | 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'TIME';
export type UOMStatus = 'ACTIVE' | 'INACTIVE';

export interface UnitOfMeasure {
  id: string;
  tenantId: string;
  uomCode: string;
  uomName: string;
  category: UOMCategory;
  decimals: number;
  conversionFactor: number | null;
  baseUomCode: string | null;
  status: UOMStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUOMProps {
  tenantId: string;
  uomCode: string;
  uomName: string;
  category: UOMCategory;
  decimals?: number;
  conversionFactor?: number;
  baseUomCode?: string;
  status?: UOMStatus;
}

export interface UpdateUOMProps {
  uomName?: string;
  decimals?: number;
  conversionFactor?: number;
  baseUomCode?: string;
  status?: UOMStatus;
}

export class UOMDomain {
  /**
   * Create a new UOM
   * Validates 4 domain invariants
   */
  static create(props: CreateUOMProps): Result<UnitOfMeasure> {
    // Invariant #1: UOM code required
    const trimmedCode = props.uomCode.trim();
    if (!trimmedCode) {
      return Result.fail('UOM code is required', 'UOM_CODE_REQUIRED');
    }

    // Invariant #2: UOM name required
    const trimmedName = props.uomName.trim();
    if (!trimmedName) {
      return Result.fail('UOM name is required', 'UOM_NAME_REQUIRED');
    }

    // Invariant #3: Conversion factor must be positive
    if (props.conversionFactor !== undefined) {
      if (props.conversionFactor <= 0) {
        return Result.fail('Conversion factor must be positive', 'UOM_CONVERSION_FACTOR_INVALID');
      }
      if (!props.baseUomCode) {
        return Result.fail('Base UOM code required when conversion factor provided', 'UOM_BASE_UOM_REQUIRED_FOR_CONVERSION');
      }
    }

    // Invariant #4: Decimals must be 0-6
    const decimals = props.decimals ?? 2;
    if (decimals < 0 || decimals > 6) {
      return Result.fail('Decimals must be between 0 and 6', 'UOM_DECIMALS_OUT_OF_RANGE');
    }

    const now = new Date();
    const uom: UnitOfMeasure = {
      id: crypto.randomUUID(),
      tenantId: props.tenantId,
      uomCode: trimmedCode.toUpperCase(),
      uomName: trimmedName,
      category: props.category,
      decimals,
      conversionFactor: props.conversionFactor ?? null,
      baseUomCode: props.baseUomCode ?? null,
      status: props.status ?? 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    return Result.ok(uom);
  }

  /**
   * Update existing UOM
   */
  static update(uom: UnitOfMeasure, props: UpdateUOMProps): Result<UnitOfMeasure> {
    // Validate UOM name if provided
    if (props.uomName !== undefined) {
      const trimmedName = props.uomName.trim();
      if (!trimmedName) {
        return Result.fail('UOM name cannot be empty', 'UOM_NAME_REQUIRED');
      }
    }

    // Validate conversion factor if provided
    if (props.conversionFactor !== undefined) {
      if (props.conversionFactor <= 0) {
        return Result.fail('Conversion factor must be positive', 'UOM_CONVERSION_FACTOR_INVALID');
      }
    }

    // Validate decimals if provided
    if (props.decimals !== undefined) {
      if (props.decimals < 0 || props.decimals > 6) {
        return Result.fail('Decimals must be between 0 and 6', 'UOM_DECIMALS_OUT_OF_RANGE');
      }
    }

    const updated: UnitOfMeasure = {
      ...uom,
      uomName: props.uomName?.trim() ?? uom.uomName,
      decimals: props.decimals ?? uom.decimals,
      conversionFactor: props.conversionFactor ?? uom.conversionFactor,
      baseUomCode: props.baseUomCode ?? uom.baseUomCode,
      status: props.status ?? uom.status,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Check if status transition is allowed
   */
  static canTransitionTo(uom: UnitOfMeasure, targetStatus: UOMStatus): Result<true> {
    if (uom.status === targetStatus) {
      return Result.fail(
        `UOM is already ${targetStatus}`,
        'UOM_INVALID_TRANSITION'
      );
    }

    // All transitions between ACTIVE and INACTIVE are allowed
    return Result.ok(true);
  }

  /**
   * Convert quantity from one UOM to another
   * Requires same category and compatible base UOM
   */
  static convert(
    quantity: number,
    fromUOM: UnitOfMeasure,
    toUOM: UnitOfMeasure
  ): Result<number> {
    // Same UOM - no conversion needed
    if (fromUOM.uomCode === toUOM.uomCode) {
      return Result.ok(quantity);
    }

    // Must be same category
    if (fromUOM.category !== toUOM.category) {
      return Result.fail(
        `Cannot convert between different categories: ${fromUOM.category} → ${toUOM.category}`,
        'UOM_CROSS_CATEGORY_CONVERSION_NOT_SUPPORTED'
      );
    }

    // Must have same base UOM
    const fromBase = fromUOM.baseUomCode ?? fromUOM.uomCode;
    const toBase = toUOM.baseUomCode ?? toUOM.uomCode;

    if (fromBase !== toBase) {
      return Result.fail(
        `Cannot convert UOMs with different base UOM: ${fromBase} vs ${toBase}. UOMs must share same base UOM`,
        'UOM_DIFFERENT_BASE_UOM'
      );
    }

    // Get conversion factors (1.0 for base UOMs)
    const fromFactor = fromUOM.conversionFactor ?? 1.0;
    const toFactor = toUOM.conversionFactor ?? 1.0;

    // Convert: quantity * fromFactor / toFactor
    const converted = (quantity * fromFactor) / toFactor;

    // Round to target UOM decimals
    const rounded = this.roundToDecimals(converted, toUOM.decimals);

    return Result.ok(rounded);
  }

  /**
   * Check if UOM is a base UOM (no conversion factor)
   */
  static isBaseUOM(uom: UnitOfMeasure): boolean {
    return uom.conversionFactor === null;
  }

  /**
   * Check if UOM is active
   */
  static isActive(uom: UnitOfMeasure): boolean {
    return uom.status === 'ACTIVE';
  }

  /**
   * Validate that quantity precision doesn't exceed UOM decimals
   */
  static validateQuantityPrecision(
    quantity: number,
    uom: UnitOfMeasure
  ): Result<true> {
    const decimalPlaces = this.countDecimals(quantity);

    if (decimalPlaces > uom.decimals) {
      return Result.fail(
        `Quantity precision (${decimalPlaces}) exceeds UOM decimals (${uom.decimals})`,
        'UOM_QUANTITY_PRECISION_EXCEEDED'
      );
    }

    return Result.ok(true);
  }

  /**
   * Round number to specified decimal places
   */
  static roundToDecimals(value: number, decimals: number): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * Format quantity with UOM code for display
   */
  static formatQuantity(quantity: number, uom: UnitOfMeasure): string {
    const rounded = this.roundToDecimals(quantity, uom.decimals);
    return `${rounded.toFixed(uom.decimals)} ${uom.uomCode}`;
  }

  /**
   * Count decimal places in a number
   */
  private static countDecimals(value: number): number {
    if (Math.floor(value) === value) return 0;
    
    const str = value.toString();
    const decimalIndex = str.indexOf('.');
    
    if (decimalIndex === -1) return 0;
    
    return str.length - decimalIndex - 1;
  }
}
