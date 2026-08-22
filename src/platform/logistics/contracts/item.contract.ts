/**
 * Logistics OS: Item/SKU Master Data Contract
 * 
 * Shared item/product/SKU entity for Logistics domain.
 * All Products reference the same item master data.
 * 
 * @module LogisticsOS/Item
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Unique identifier for item
 */
export type ItemId = string;

/**
 * Item category classification
 */
export enum ItemCategory {
  RAW_MATERIAL = 'raw_material',
  FINISHED_GOOD = 'finished_good',
  COMPONENT = 'component',
  PACKAGING = 'packaging',
  CONSUMABLE = 'consumable',
  SERVICE = 'service',
}

/**
 * Item status
 */
export enum ItemStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
  PENDING = 'pending',
}

/**
 * Unit of measure
 */
export enum UnitOfMeasure {
  EACH = 'EA',
  CASE = 'CS',
  PALLET = 'PL',
  KILOGRAM = 'KG',
  GRAM = 'G',
  POUND = 'LB',
  OUNCE = 'OZ',
  LITER = 'L',
  MILLILITER = 'ML',
  GALLON = 'GAL',
  METER = 'M',
  CENTIMETER = 'CM',
  INCH = 'IN',
  FOOT = 'FT',
}

/**
 * Dimension unit
 */
export enum DimensionUnit {
  CM = 'cm',
  IN = 'in',
  M = 'm',
  FT = 'ft',
}

/**
 * Weight unit
 */
export enum WeightUnit {
  KG = 'kg',
  G = 'g',
  LB = 'lb',
  OZ = 'oz',
}

// ============================================================================
// ITEM ENTITY
// ============================================================================

/**
 * Physical dimensions
 */
export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: DimensionUnit;
}

/**
 * Weight
 */
export interface Weight {
  value: number;
  unit: WeightUnit;
}

/**
 * Item identifiers (barcodes, GTINs, etc.)
 */
export interface ItemIdentifiers {
  /** Internal SKU code */
  sku: string;
  
  /** Universal Product Code (UPC) */
  upc?: string;
  
  /** European Article Number (EAN) */
  ean?: string;
  
  /** Global Trade Item Number */
  gtin?: string;
  
  /** Manufacturer part number */
  mpn?: string;
  
  /** International Standard Book Number */
  isbn?: string;
  
  /** Custom barcodes */
  custom_barcodes?: string[];
}

/**
 * Item master data entity
 */
export interface Item {
  /** Unique ID */
  id: ItemId;
  
  /** Tenant ownership */
  tenant_id: string;
  
  /** Identifiers */
  identifiers: ItemIdentifiers;
  
  /** Description */
  name: string;
  description?: string;
  
  /** Classification */
  category: ItemCategory;
  status: ItemStatus;
  
  /** Unit of measure */
  base_uom: UnitOfMeasure;
  
  /** Physical attributes */
  dimensions?: Dimensions;
  weight?: Weight;
  
  /** Inventory management */
  is_serialized: boolean;
  is_lot_controlled: boolean;
  is_perishable: boolean;
  shelf_life_days?: number;
  
  /** Safety stock */
  min_stock_level?: number;
  max_stock_level?: number;
  reorder_point?: number;
  
  /** Timestamps */
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
  
  /** Extensibility */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// UOM CONVERSION
// ============================================================================

/**
 * UOM conversion rule
 */
export interface UOMConversion {
  item_id: ItemId;
  from_uom: UnitOfMeasure;
  to_uom: UnitOfMeasure;
  conversion_factor: number;
  tenant_id: string;
}

/**
 * UOM conversion service
 */
export interface IUOMConversion {
  /**
   * Convert quantity between UOMs
   * 
   * Example: 1 CASE = 12 EACH
   * convertQuantity({ item_id, quantity: 2, from: CASE, to: EACH }) → 24
   */
  convertQuantity(params: {
    item_id: ItemId;
    quantity: number;
    from_uom: UnitOfMeasure;
    to_uom: UnitOfMeasure;
    tenant_id: string;
  }): Promise<number>;

  /**
   * Get conversion factor
   */
  getConversionFactor(params: {
    item_id: ItemId;
    from_uom: UnitOfMeasure;
    to_uom: UnitOfMeasure;
    tenant_id: string;
  }): Promise<number>;

  /**
   * Define conversion rule
   */
  defineConversion(conversion: UOMConversion): Promise<void>;
}

// ============================================================================
// ITEM QUERY
// ============================================================================

/**
 * Item query filters
 */
export interface ItemQueryFilter {
  tenant_id: string;
  item_ids?: ItemId[];
  sku?: string;
  upc?: string;
  ean?: string;
  gtin?: string;
  category?: ItemCategory;
  status?: ItemStatus;
  search?: string; // Fuzzy search on name/description
  is_active?: boolean;
}

/**
 * Item query service
 */
export interface IItemQuery {
  /**
   * Get item by ID
   */
  getItemById(params: {
    item_id: ItemId;
    tenant_id: string;
  }): Promise<Item | null>;

  /**
   * Find item by code (SKU, UPC, etc.)
   */
  findByCode(params: {
    code: string;
    tenant_id: string;
  }): Promise<Item | null>;

  /**
   * Search items
   */
  searchItems(filter: ItemQueryFilter): Promise<Item[]>;

  /**
   * Validate item exists and is active
   */
  validateItem(params: {
    item_id: ItemId;
    tenant_id: string;
  }): Promise<{
    valid: boolean;
    item?: Item;
    reason?: string;
  }>;
}

// ============================================================================
// ITEM MANAGEMENT
// ============================================================================

/**
 * Create item request
 */
export interface CreateItemRequest {
  tenant_id: string;
  identifiers: ItemIdentifiers;
  name: string;
  description?: string;
  category: ItemCategory;
  base_uom: UnitOfMeasure;
  dimensions?: Dimensions;
  weight?: Weight;
  is_serialized?: boolean;
  is_lot_controlled?: boolean;
  is_perishable?: boolean;
  shelf_life_days?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  reorder_point?: number;
  created_by: string;
  metadata?: Record<string, unknown>;
}

/**
 * Update item request
 */
export interface UpdateItemRequest {
  item_id: ItemId;
  tenant_id: string;
  name?: string;
  description?: string;
  category?: ItemCategory;
  status?: ItemStatus;
  dimensions?: Dimensions;
  weight?: Weight;
  is_serialized?: boolean;
  is_lot_controlled?: boolean;
  is_perishable?: boolean;
  shelf_life_days?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  reorder_point?: number;
  updated_by: string;
  metadata?: Record<string, unknown>;
}

/**
 * Item management service
 */
export interface IItemManagement {
  /**
   * Create new item
   * 
   * Validates:
   * - SKU code is unique within tenant
   * - UPC/EAN/GTIN are unique (if provided)
   * - Required fields present
   */
  createItem(request: CreateItemRequest): Promise<Item>;

  /**
   * Update existing item
   * 
   * Validates:
   * - Item exists
   * - Tenant ownership
   * - Status transitions are valid
   */
  updateItem(request: UpdateItemRequest): Promise<Item>;

  /**
   * Deactivate item
   * 
   * Effect:
   * - Sets status to INACTIVE
   * - Item can still be queried but not used in new transactions
   */
  deactivateItem(params: {
    item_id: ItemId;
    tenant_id: string;
    updated_by: string;
    reason?: string;
  }): Promise<void>;

  /**
   * Discontinue item
   * 
   * Effect:
   * - Sets status to DISCONTINUED
   * - Item cannot be used in any new transactions
   */
  discontinueItem(params: {
    item_id: ItemId;
    tenant_id: string;
    updated_by: string;
    reason?: string;
  }): Promise<void>;
}

// ============================================================================
// LOT/SERIAL TRACKING
// ============================================================================

/**
 * Lot/Batch record
 */
export interface Lot {
  id: string;
  item_id: ItemId;
  lot_number: string;
  tenant_id: string;
  manufactured_date?: Date;
  expiry_date?: Date;
  received_date: Date;
  supplier_id?: string;
  status: 'active' | 'quarantine' | 'expired' | 'recalled';
  metadata?: Record<string, unknown>;
}

/**
 * Serial number record
 */
export interface SerialNumber {
  id: string;
  item_id: ItemId;
  serial_number: string;
  lot_id?: string;
  tenant_id: string;
  status: 'available' | 'allocated' | 'shipped' | 'returned';
  current_location_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Lot/Serial tracking service
 */
export interface ILotSerialTracking {
  /**
   * Create lot/batch
   */
  createLot(params: {
    item_id: ItemId;
    lot_number: string;
    tenant_id: string;
    manufactured_date?: Date;
    expiry_date?: Date;
    supplier_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Lot>;

  /**
   * Register serial numbers
   */
  registerSerials(params: {
    item_id: ItemId;
    serial_numbers: string[];
    lot_id?: string;
    tenant_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<SerialNumber[]>;

  /**
   * Get lot by number
   */
  getLotByNumber(params: {
    lot_number: string;
    tenant_id: string;
  }): Promise<Lot | null>;

  /**
   * Get serial by number
   */
  getSerialByNumber(params: {
    serial_number: string;
    tenant_id: string;
  }): Promise<SerialNumber | null>;

  /**
   * Check lot expiry
   */
  checkExpiry(params: {
    lot_id: string;
    tenant_id: string;
  }): Promise<{
    is_expired: boolean;
    days_until_expiry?: number;
    expiry_date?: Date;
  }>;
}

// ============================================================================
// MAIN CONTRACT
// ============================================================================

/**
 * Logistics OS: Item Master Data Contract
 * 
 * Main interface for item/SKU management.
 * Products consume this contract to reference items.
 */
export interface IItemDomain {
  query: IItemQuery;
  management: IItemManagement;
  uom: IUOMConversion;
  lotSerial: ILotSerialTracking;
}
