/**
 * Logistics OS — Unit of Measure (UOM) Domain Types
 * 
 * Basic UOM support. Future enhancement: UOM conversions.
 * 
 * Design Principles:
 * - Standard units (EA, CS, KG, L, etc.)
 * - Extensible (tenant-defined UOMs)
 * - Conversion-ready (future)
 * 
 * @module logistics/domain/uom
 */

/**
 * UOM Category
 */
export type UOMCategory =
  | 'QUANTITY'  // Each, Case, Pallet
  | 'WEIGHT'    // Kilogram, Gram, Pound
  | 'VOLUME'    // Liter, Milliliter, Gallon
  | 'LENGTH'    // Meter, Centimeter, Foot, Inch
  | 'AREA'      // Square Meter, Square Foot
  | 'TIME';     // Hour, Day, Week

/**
 * Standard UOM (from item.types.ts)
 */
export type StandardUOM =
  | 'EA' | 'CS' | 'PLT'               // Quantity
  | 'KG' | 'G' | 'LB' | 'OZ'          // Weight
  | 'L' | 'ML' | 'GAL' | 'QT'         // Volume
  | 'M' | 'CM' | 'MM' | 'FT' | 'IN'   // Length
  | 'SQM' | 'SQFT'                    // Area
  | 'HR' | 'DAY' | 'WK';              // Time

/**
 * Unit of Measure (Full entity with governance fields)
 */
export interface UnitOfMeasure {
  id: string;
  tenantId: string;
  uomCode: string;
  uomName: string;
  category: UOMCategory;
  baseUomCode?: string | null;
  conversionFactor?: number | null;
  decimals: number;
  status: UOMStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UOM Definition (Future: UOM master data)
 */
export interface UOMDefinition {
  code: StandardUOM | string;
  name: string;
  category: UOMCategory;
  base_uom?: string; // For conversions
  conversion_factor?: number; // To base UOM
  decimals?: number; // Decimal precision
}

/**
 * UOM Status
 */
export type UOMStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';

/**
 * Create UOM Props
 */
export interface CreateUOMProps {
  id?: string;
  tenantId: string;
  uomCode: string;
  uomName: string;
  category: UOMCategory;
  baseUomCode?: string;
  conversionFactor?: number;
  decimals?: number;
  status?: UOMStatus;
}

/**
 * Update UOM Props
 */
export interface UpdateUOMProps {
  uomName?: string;
  category?: UOMCategory;
  baseUomCode?: string;
  conversionFactor?: number;
  decimals?: number;
  status?: UOMStatus;
}

/**
 * UOM Conversion (Future enhancement)
 */
export interface UOMConversion {
  from_uom: string;
  to_uom: string;
  factor: number;
  formula?: string;
}

/**
 * UOM Domain Error
 */
export class UOMDomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = 'UOMDomainError';
  }
}

export const UOMErrorCodes = {
  UOM_REQUIRED: 'UOM_REQUIRED',
  UOM_INVALID: 'UOM_INVALID',
  UOM_CONVERSION_NOT_FOUND: 'UOM_CONVERSION_NOT_FOUND',
  INCOMPATIBLE_UOMS: 'INCOMPATIBLE_UOMS',
} as const;

