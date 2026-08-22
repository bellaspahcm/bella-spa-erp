/**
 * UOM (Unit of Measure) Domain Tests
 * 
 * Test Coverage:
 * - 4 domain invariants
 * - UOM creation & validation
 * - Conversion factor validation
 * - Quantity conversion (basic)
 * - Decimal precision
 * - Result<T> error paths
 */

import { UOMDomain } from '../uom.domain';
import type { CreateUOMProps, UnitOfMeasure } from '../uom.types';

describe('UOMDomain', () => {
  const baseProps: CreateUOMProps = {
    tenantId: 'tenant-1',
    uomCode: 'EA',
    uomName: 'Each',
    category: 'QUANTITY',
  };

  describe('create() - Invariant #1: UOM code required', () => {
    it('should fail if UOM code is missing', () => {
      const props = { ...baseProps, uomCode: '' };
      const result = UOMDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('UOM code is required');
      expect(result.errorCode).toBe('UOM_CODE_REQUIRED');
    });

    it('should fail if UOM code is whitespace only', () => {
      const props = { ...baseProps, uomCode: '   ' };
      const result = UOMDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('UOM_CODE_REQUIRED');
    });

    it('should trim and uppercase UOM code', () => {
      const props = { ...baseProps, uomCode: '  ea  ' };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.uomCode).toBe('EA');
    });

    it('should accept valid UOM code', () => {
      const props = { ...baseProps, uomCode: 'BOX' };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.uomCode).toBe('BOX');
    });
  });

  describe('create() - Invariant #2: UOM name required', () => {
    it('should fail if UOM name is missing', () => {
      const props = { ...baseProps, uomName: '' };
      const result = UOMDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('UOM name is required');
      expect(result.errorCode).toBe('UOM_NAME_REQUIRED');
    });

    it('should fail if UOM name is whitespace only', () => {
      const props = { ...baseProps, uomName: '   ' };
      const result = UOMDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('UOM_NAME_REQUIRED');
    });

    it('should trim UOM name', () => {
      const props = { ...baseProps, uomName: '  Each  ' };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.uomName).toBe('Each');
    });
  });

  describe('create() - Invariant #3: Conversion factor must be positive', () => {
    it('should fail if conversion factor is zero', () => {
      const props = {
        ...baseProps,
        conversionFactor: 0,
        baseUomCode: 'EA',
      };
      const result = UOMDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Conversion factor must be positive');
      expect(result.errorCode).toBe('UOM_CONVERSION_FACTOR_INVALID');
    });

    it('should fail if conversion factor is negative', () => {
      const props = {
        ...baseProps,
        conversionFactor: -1.5,
        baseUomCode: 'EA',
      };
      const result = UOMDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('UOM_CONVERSION_FACTOR_INVALID');
    });

    it('should fail if conversion factor provided without base UOM', () => {
      const props = {
        ...baseProps,
        conversionFactor: 12,
        baseUomCode: undefined,
      };
      const result = UOMDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Base UOM code required when conversion factor provided');
      expect(result.errorCode).toBe('UOM_BASE_UOM_REQUIRED_FOR_CONVERSION');
    });

    it('should accept valid conversion factor', () => {
      const props = {
        ...baseProps,
        uomCode: 'DZ',
        uomName: 'Dozen',
        conversionFactor: 12,
        baseUomCode: 'EA',
      };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.conversionFactor).toBe(12);
      expect(result.value?.baseUomCode).toBe('EA');
    });

    it('should accept fractional conversion factor', () => {
      const props = {
        ...baseProps,
        uomCode: 'G',
        uomName: 'Gram',
        conversionFactor: 0.001,
        baseUomCode: 'KG',
      };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.conversionFactor).toBe(0.001);
    });

    it('should accept UOM without conversion factor (base UOM)', () => {
      const props = {
        ...baseProps,
        conversionFactor: undefined,
        baseUomCode: undefined,
      };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.conversionFactor).toBeNull();
      expect(result.value?.baseUomCode).toBeNull();
    });
  });

  describe('create() - Invariant #4: Decimals must be 0-6', () => {
    it('should fail if decimals is negative', () => {
      const props = { ...baseProps, decimals: -1 };
      const result = UOMDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Decimals must be between 0 and 6');
      expect(result.errorCode).toBe('UOM_DECIMALS_OUT_OF_RANGE');
    });

    it('should fail if decimals is greater than 6', () => {
      const props = { ...baseProps, decimals: 7 };
      const result = UOMDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('UOM_DECIMALS_OUT_OF_RANGE');
    });

    it('should accept decimals = 0', () => {
      const props = { ...baseProps, decimals: 0 };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.decimals).toBe(0);
    });

    it('should accept decimals = 6', () => {
      const props = { ...baseProps, decimals: 6 };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.decimals).toBe(6);
    });

    it('should default decimals to 2 if not provided', () => {
      const props = { ...baseProps, decimals: undefined };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.decimals).toBe(2);
    });

    it('should accept decimals in range 0-6', () => {
      for (let d = 0; d <= 6; d++) {
        const props = { ...baseProps, decimals: d };
        const result = UOMDomain.create(props);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.decimals).toBe(d);
      }
    });
  });

  describe('update()', () => {
    let uom: UnitOfMeasure;

    beforeEach(() => {
      const createResult = UOMDomain.create(baseProps);
      uom = createResult.value!;
    });

    it('should update UOM name', () => {
      const result = UOMDomain.update(uom, {
        uomName: 'Unit',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.uomName).toBe('Unit');
    });

    it('should fail if UOM name is empty', () => {
      const result = UOMDomain.update(uom, {
        uomName: '',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('UOM name cannot be empty');
      expect(result.errorCode).toBe('UOM_NAME_REQUIRED');
    });

    it('should update conversion factor', () => {
      const result = UOMDomain.update(uom, {
        conversionFactor: 24,
        baseUomCode: 'EA',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.conversionFactor).toBe(24);
    });

    it('should fail if conversion factor is negative', () => {
      const result = UOMDomain.update(uom, {
        conversionFactor: -5,
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('UOM_CONVERSION_FACTOR_INVALID');
    });

    it('should fail if conversion factor is zero', () => {
      const result = UOMDomain.update(uom, {
        conversionFactor: 0,
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('UOM_CONVERSION_FACTOR_INVALID');
    });

    it('should update decimals', () => {
      const result = UOMDomain.update(uom, {
        decimals: 4,
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.decimals).toBe(4);
    });

    it('should fail if decimals out of range', () => {
      const result = UOMDomain.update(uom, {
        decimals: 10,
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('UOM_DECIMALS_OUT_OF_RANGE');
    });

    it('should preserve immutable fields', () => {
      const result = UOMDomain.update(uom, {
        uomName: 'Updated',
      });

      expect(result.value?.tenantId).toBe(uom.tenantId);
      expect(result.value?.uomCode).toBe(uom.uomCode);
      expect(result.value?.category).toBe(uom.category);
      expect(result.value?.createdAt).toEqual(uom.createdAt);
    });

    it('should update updatedAt timestamp', () => {
      const originalUpdated = uom.updatedAt;

      const result = UOMDomain.update(uom, {
        uomName: 'Updated',
      });

      expect(result.value?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdated.getTime()
      );
    });
  });

  describe('Status transitions', () => {
    let uom: UnitOfMeasure;

    beforeEach(() => {
      const createResult = UOMDomain.create(baseProps);
      uom = createResult.value!;
    });

    it('should allow ACTIVE to INACTIVE transition', () => {
      expect(uom.status).toBe('ACTIVE');

      const result = UOMDomain.canTransitionTo(uom, 'INACTIVE');

      expect(result.isSuccess).toBe(true);
    });

    it('should allow INACTIVE to ACTIVE transition', () => {
      const updateResult = UOMDomain.update(uom, { status: 'INACTIVE' });
      const inactive = updateResult.value!;

      const result = UOMDomain.canTransitionTo(inactive, 'ACTIVE');

      expect(result.isSuccess).toBe(true);
    });

    it('should not allow same status transition', () => {
      const result = UOMDomain.canTransitionTo(uom, 'ACTIVE');

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('UOM_INVALID_TRANSITION');
    });
  });

  describe('convert() - Quantity conversion', () => {
    let baseUOM: UnitOfMeasure;
    let dozen: UnitOfMeasure;
    let gross: UnitOfMeasure;

    beforeEach(() => {
      // Base: EA (Each)
      const baseResult = UOMDomain.create({
        ...baseProps,
        uomCode: 'EA',
        uomName: 'Each',
        decimals: 2,
      });
      baseUOM = baseResult.value!;

      // Dozen: 1 DZ = 12 EA
      const dozenResult = UOMDomain.create({
        ...baseProps,
        uomCode: 'DZ',
        uomName: 'Dozen',
        conversionFactor: 12,
        baseUomCode: 'EA',
        decimals: 2,
      });
      dozen = dozenResult.value!;

      // Gross: 1 GR = 144 EA (12 dozen)
      const grossResult = UOMDomain.create({
        ...baseProps,
        uomCode: 'GR',
        uomName: 'Gross',
        conversionFactor: 144,
        baseUomCode: 'EA',
        decimals: 2,
      });
      gross = grossResult.value!;
    });

    it('should return same quantity if same UOM', () => {
      const result = UOMDomain.convert(100, baseUOM, baseUOM);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(100);
    });

    it('should convert from larger to smaller unit', () => {
      // 2 dozen → EA
      const result = UOMDomain.convert(2, dozen, baseUOM);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(24); // 2 * 12 = 24
    });

    it('should convert from smaller to larger unit', () => {
      // 24 EA → dozen
      const result = UOMDomain.convert(24, baseUOM, dozen);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(2); // 24 / 12 = 2
    });

    it('should convert between non-base units', () => {
      // 1 gross → dozen
      const result = UOMDomain.convert(1, gross, dozen);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(12); // 144 / 12 = 12
    });

    it('should fail if UOMs are different categories', () => {
      const weightUOM = UOMDomain.create({
        ...baseProps,
        uomCode: 'KG',
        uomName: 'Kilogram',
        category: 'WEIGHT',
      }).value!;

      const result = UOMDomain.convert(10, baseUOM, weightUOM);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('different categories');
      expect(result.errorCode).toBe('UOM_CROSS_CATEGORY_CONVERSION_NOT_SUPPORTED');
    });

    it('should fail if conversion factor missing', () => {
      const noFactorUOM = UOMDomain.create({
        ...baseProps,
        uomCode: 'UNIT',
        uomName: 'Unit',
      }).value!;

      const result = UOMDomain.convert(10, dozen, noFactorUOM);

      expect(result.isFailure).toBe(true);
      // Will fail at "different base UOM" check because noFactorUOM has no baseUomCode
      expect(result.errorCode).toBe('UOM_DIFFERENT_BASE_UOM');
    });

    it('should fail if different base UOMs', () => {
      const differentBase = UOMDomain.create({
        ...baseProps,
        uomCode: 'PK',
        uomName: 'Pack',
        conversionFactor: 6,
        baseUomCode: 'UNIT', // Different base
      }).value!;

      const result = UOMDomain.convert(10, dozen, differentBase);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('same base UOM');
      expect(result.errorCode).toBe('UOM_DIFFERENT_BASE_UOM');
    });

    it('should round result to target UOM decimals', () => {
      // 10 EA → dozen
      const result = UOMDomain.convert(10, baseUOM, dozen);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(0.83); // 10 / 12 = 0.8333... → 0.83 (2 decimals)
    });

    it('should handle fractional quantities', () => {
      // 1.5 dozen → EA
      const result = UOMDomain.convert(1.5, dozen, baseUOM);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(18); // 1.5 * 12 = 18
    });
  });

  describe('isBaseUOM()', () => {
    it('should identify base UOM (no conversion factor)', () => {
      const createResult = UOMDomain.create(baseProps);
      const uom = createResult.value!;

      expect(UOMDomain.isBaseUOM(uom)).toBe(true);
    });

    it('should identify non-base UOM', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        uomCode: 'DZ',
        conversionFactor: 12,
        baseUomCode: 'EA',
      });
      const uom = createResult.value!;

      expect(UOMDomain.isBaseUOM(uom)).toBe(false);
    });
  });

  describe('isActive()', () => {
    it('should identify ACTIVE UOM', () => {
      const createResult = UOMDomain.create(baseProps);
      const uom = createResult.value!;

      expect(UOMDomain.isActive(uom)).toBe(true);
    });

    it('should identify INACTIVE UOM', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        status: 'INACTIVE',
      });
      const uom = createResult.value!;

      expect(UOMDomain.isActive(uom)).toBe(false);
    });
  });

  describe('validateQuantityPrecision()', () => {
    it('should pass if quantity precision matches UOM', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        decimals: 2,
      });
      const uom = createResult.value!;

      const result = UOMDomain.validateQuantityPrecision(10.25, uom);

      expect(result.isSuccess).toBe(true);
    });

    it('should pass if quantity precision less than UOM', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        decimals: 4,
      });
      const uom = createResult.value!;

      const result = UOMDomain.validateQuantityPrecision(10.25, uom);

      expect(result.isSuccess).toBe(true);
    });

    it('should fail if quantity precision exceeds UOM', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        decimals: 2,
      });
      const uom = createResult.value!;

      const result = UOMDomain.validateQuantityPrecision(10.2567, uom);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('precision');
      expect(result.errorCode).toBe('UOM_QUANTITY_PRECISION_EXCEEDED');
    });

    it('should pass for integer quantities', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        decimals: 0,
      });
      const uom = createResult.value!;

      const result = UOMDomain.validateQuantityPrecision(10, uom);

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('roundToDecimals()', () => {
    it('should round to 0 decimals', () => {
      expect(UOMDomain.roundToDecimals(10.7, 0)).toBe(11);
      expect(UOMDomain.roundToDecimals(10.4, 0)).toBe(10);
    });

    it('should round to 2 decimals', () => {
      expect(UOMDomain.roundToDecimals(10.256, 2)).toBe(10.26);
      expect(UOMDomain.roundToDecimals(10.254, 2)).toBe(10.25);
    });

    it('should round to 4 decimals', () => {
      expect(UOMDomain.roundToDecimals(10.25678, 4)).toBe(10.2568);
      expect(UOMDomain.roundToDecimals(10.25674, 4)).toBe(10.2567);
    });

    it('should handle no rounding needed', () => {
      expect(UOMDomain.roundToDecimals(10.25, 2)).toBe(10.25);
      expect(UOMDomain.roundToDecimals(10, 0)).toBe(10);
    });
  });

  describe('formatQuantity() - Presentation helper', () => {
    it('should format quantity with UOM code', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        decimals: 2,
      });
      const uom = createResult.value!;

      const formatted = UOMDomain.formatQuantity(10.5, uom);

      expect(formatted).toBe('10.50 EA');
    });

    it('should format with correct decimals', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        decimals: 4,
      });
      const uom = createResult.value!;

      const formatted = UOMDomain.formatQuantity(10.567, uom);

      expect(formatted).toBe('10.5670 EA');
    });

    it('should format with 0 decimals', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        decimals: 0,
      });
      const uom = createResult.value!;

      const formatted = UOMDomain.formatQuantity(10.7, uom);

      expect(formatted).toBe('11 EA'); // Rounded
    });
  });

  describe('UOM categories', () => {
    it('should accept QUANTITY category', () => {
      const result = UOMDomain.create({
        ...baseProps,
        category: 'QUANTITY',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.category).toBe('QUANTITY');
    });

    it('should accept WEIGHT category', () => {
      const result = UOMDomain.create({
        ...baseProps,
        uomCode: 'KG',
        uomName: 'Kilogram',
        category: 'WEIGHT',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.category).toBe('WEIGHT');
    });

    it('should accept VOLUME category', () => {
      const result = UOMDomain.create({
        ...baseProps,
        uomCode: 'L',
        uomName: 'Liter',
        category: 'VOLUME',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.category).toBe('VOLUME');
    });

    it('should accept LENGTH category', () => {
      const result = UOMDomain.create({
        ...baseProps,
        uomCode: 'M',
        uomName: 'Meter',
        category: 'LENGTH',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.category).toBe('LENGTH');
    });

    it('should accept TIME category', () => {
      const result = UOMDomain.create({
        ...baseProps,
        uomCode: 'HR',
        uomName: 'Hour',
        category: 'TIME',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.category).toBe('TIME');
    });
  });

  describe('Tenant isolation', () => {
    it('should preserve tenant ID', () => {
      const props = {
        ...baseProps,
        tenantId: 'tenant-abc-123',
      };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.tenantId).toBe('tenant-abc-123');
    });

    it('should preserve tenant ID through update', () => {
      const createResult = UOMDomain.create({
        ...baseProps,
        tenantId: 'tenant-xyz',
      });
      const uom = createResult.value!;

      const updateResult = UOMDomain.update(uom, {
        uomName: 'Updated',
      });

      expect(updateResult.value?.tenantId).toBe('tenant-xyz');
    });
  });

  describe('Edge cases and boundary values', () => {
    it('should handle very large conversion factors', () => {
      const props = {
        ...baseProps,
        uomCode: 'BILLION',
        uomName: 'Billion',
        conversionFactor: 1000000000,
        baseUomCode: 'EA',
      };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.conversionFactor).toBe(1000000000);
    });

    it('should handle very small conversion factors', () => {
      const props = {
        ...baseProps,
        uomCode: 'MICRO',
        uomName: 'Microgram',
        conversionFactor: 0.000001,
        baseUomCode: 'G',
      };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.conversionFactor).toBe(0.000001);
    });

    it('should set timestamps correctly', () => {
      const before = new Date();
      const result = UOMDomain.create(baseProps);
      const after = new Date();

      expect(result.isSuccess).toBe(true);
      const uom = result.value!;
      
      expect(uom.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(uom.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(uom.updatedAt).toEqual(uom.createdAt);
    });

    it('should handle very long UOM codes', () => {
      const longCode = 'A'.repeat(100);
      const props = {
        ...baseProps,
        uomCode: longCode,
      };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.uomCode).toBe(longCode.toUpperCase());
    });

    it('should handle very long UOM names', () => {
      const longName = 'B'.repeat(1000);
      const props = {
        ...baseProps,
        uomName: longName,
      };
      const result = UOMDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.uomName).toBe(longName);
    });
  });
});
