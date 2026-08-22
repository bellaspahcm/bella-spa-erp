/**
 * Unit of Measure (UOM) Domain Kernel
 * 
 * Pure business logic for UOM management and conversions.
 * Zero dependencies on infrastructure.
 * 
 * Responsibilities:
 * - UOM creation and validation
 * - Conversion factor validation (basic)
 * - Category validation
 * 
 * Note: Complex UOM conversions deferred to future enhancement.
 * E7.1 only implements basic structure.
 */

import { Result } from './core/result';
import type {
  UnitOfMeasure,
  CreateUOMProps,
  UpdateUOMProps,
  UOMCategory,
  UOMStatus,
} from './uom.types';

export class UOMDomain {
  /**
   * Create new unit of measure
   * 
   * Invariants:
   * - UOM code required and non-empty
   * - UOM name required
   * - Category required
   * - Conversion factor must be positive (if provided)
   * - Decimals must be 0-6
   */
  static create(props: CreateUOMProps): Result<UnitOfMeasure> {
    // Required fields
    if (!props.uomCode || props.uomCode.trim() === '') {
      return Result.fail(
        'UOM code is required',
        'UOM_CODE_REQUIRED'
      );
    }

    if (!props.uomName || props.uomName.trim() === '') {
      return Result.fail(
        'UOM name is required',
        'UOM_NAME_REQUIRED'
      );
    }

    if (!props.category) {
      return Result.fail(
        'UOM category is required',
        'UOM_CATEGORY_REQUIRED'
      );
    }

    // Conversion factor validation
    if (props.conversionFactor !== undefined) {
      if (props.conversionFactor <= 0) {
        return Result.fail(
          'Conversion factor must be positive',
          'UOM_CONVERSION_FACTOR_INVALID'
        );
      }

      // If conversion factor provided, base UOM required
      if (!props.baseUomCode) {
        return Result.fail(
          'Base UOM code required when conversion factor provided',
          'UOM_BASE_UOM_REQUIRED_FOR_CONVERSION'
        );
      }
    }

    // Decimals validation
    const decimals = props.decimals !== undefined ? props.decimals : 2;
    if (decimals < 0 || decimals > 6) {
      return Result.fail(
        'Decimals must be between 0 and 6',
        'UOM_DECIMALS_OUT_OF_RANGE'
      );
    }

    const now = new Date();

    const uom: UnitOfMeasure = {
      id: props.id || crypto.randomUUID(),
      tenantId: props.tenantId,
      uomCode: props.uomCode.trim().toUpperCase(),
      uomName: props.uomName.trim(),
      category: props.category,
      
      baseUomCode: props.baseUomCode?.trim().toUpperCase() || null,
      conversionFactor: props.conversionFactor || null,
      
      decimals,
      
      status: props.status || 'ACTIVE',
      
      createdAt: now,
      updatedAt: now,
    };

    return Result.ok(uom);
  }

  /**
   * Update existing UOM
   * 
   * Cannot change:
   * - tenantId (immutable)
   * - uomCode (business key, immutable)
   * - category (immutable, structural)
   * - createdAt (audit)
   */
  static update(
    existingUOM: UnitOfMeasure,
    updates: UpdateUOMProps
  ): Result<UnitOfMeasure> {
    // Name cannot be empty if provided
    if (updates.uomName !== undefined && 
        (!updates.uomName || updates.uomName.trim() === '')) {
      return Result.fail(
        'UOM name cannot be empty',
        'UOM_NAME_REQUIRED'
      );
    }

    // Conversion factor validation
    if (updates.conversionFactor !== undefined && updates.conversionFactor <= 0) {
      return Result.fail(
        'Conversion factor must be positive',
        'UOM_CONVERSION_FACTOR_INVALID'
      );
    }

    // Decimals validation
    if (updates.decimals !== undefined) {
      if (updates.decimals < 0 || updates.decimals > 6) {
        return Result.fail(
          'Decimals must be between 0 and 6',
          'UOM_DECIMALS_OUT_OF_RANGE'
        );
      }
    }

    const updated: UnitOfMeasure = {
      ...existingUOM,
      ...updates,
      uomName: updates.uomName?.trim() || existingUOM.uomName,
      baseUomCode: updates.baseUomCode !== undefined 
        ? updates.baseUomCode?.trim().toUpperCase() || null 
        : existingUOM.baseUomCode,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Validate UOM status transition
   */
  static canTransitionTo(
    uom: UnitOfMeasure,
    newStatus: UOMStatus
  ): Result<void> {
    const validTransitions: Record<UOMStatus, UOMStatus[]> = {
      ACTIVE: ['INACTIVE'],
      INACTIVE: ['ACTIVE'],
    };

    const allowed = validTransitions[uom.status] || [];

    if (!allowed.includes(newStatus)) {
      return Result.fail(
        `Cannot transition from ${uom.status} to ${newStatus}`,
        'UOM_INVALID_TRANSITION'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Convert quantity from one UOM to another
   * 
   * Note: E7.1 basic implementation (same-category only).
   * Complex cross-category conversions deferred to future.
   */
  static convert(
    quantity: number,
    fromUOM: UnitOfMeasure,
    toUOM: UnitOfMeasure
  ): Result<number> {
    // Same UOM, no conversion needed
    if (fromUOM.uomCode === toUOM.uomCode) {
      return Result.ok(quantity);
    }

    // Must be same category
    if (fromUOM.category !== toUOM.category) {
      return Result.fail(
        `Cannot convert between different categories (${fromUOM.category} → ${toUOM.category})`,
        'UOM_CROSS_CATEGORY_CONVERSION_NOT_SUPPORTED'
      );
    }

    // Both must have conversion factors
    if (!fromUOM.conversionFactor || !toUOM.conversionFactor) {
      return Result.fail(
        'Both UOMs must have conversion factors defined',
        'UOM_CONVERSION_FACTOR_MISSING'
      );
    }

    // Must have same base UOM
    if (fromUOM.baseUomCode !== toUOM.baseUomCode) {
      return Result.fail(
        'UOMs must share same base UOM for conversion',
        'UOM_DIFFERENT_BASE_UOM'
      );
    }

    // Convert: from → base → to
    const quantityInBase = quantity * fromUOM.conversionFactor;
    const quantityInTarget = quantityInBase / toUOM.conversionFactor;

    // Round to target UOM decimals
    const rounded = this.roundToDecimals(quantityInTarget, toUOM.decimals);

    return Result.ok(rounded);
  }

  /**
   * Check if UOM is base UOM (no conversion factor)
   */
  static isBaseUOM(uom: UnitOfMeasure): boolean {
    return uom.conversionFactor === null || uom.baseUomCode === null;
  }

  /**
   * Check if UOM is active
   */
  static isActive(uom: UnitOfMeasure): boolean {
    return uom.status === 'ACTIVE';
  }

  /**
   * Validate quantity precision against UOM decimals
   */
  static validateQuantityPrecision(
    quantity: number,
    uom: UnitOfMeasure
  ): Result<void> {
    const quantityStr = quantity.toString();
    const decimalPart = quantityStr.split('.')[1];

    if (decimalPart && decimalPart.length > uom.decimals) {
      return Result.fail(
        `Quantity precision (${decimalPart.length} decimals) exceeds UOM precision (${uom.decimals} decimals)`,
        'UOM_QUANTITY_PRECISION_EXCEEDED'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Round quantity to UOM decimals
   */
  static roundToDecimals(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Format quantity with UOM code
   * 
   * NOTE: Presentation helper.
   * May move to API/presentation layer if tests show no domain-level need.
   * Do not treat this as a Logistics OS primitive.
   */
  static formatQuantity(quantity: number, uom: UnitOfMeasure): string {
    const rounded = this.roundToDecimals(quantity, uom.decimals);
    return `${rounded.toFixed(uom.decimals)} ${uom.uomCode}`;
  }
}
