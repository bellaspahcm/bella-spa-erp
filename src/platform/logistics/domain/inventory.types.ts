/**
 * Logistics OS — Inventory Domain Types
 * 
 * Inventory represents the current on-hand balance of items by location.
 * Supports reservation (soft allocation) and availability tracking.
 * 
 * Design Principles:
 * - Location-agnostic (uses generic locationId, not bin-specific)
 * - Product-agnostic (serves Warehouse, Fulfillment, 3PL, etc.)
 * - State-aware (AVAILABLE, QUARANTINE, DAMAGED, etc.)
 * - Traceability-ready (lot, serial, expiry tracking)
 * 
 * @module logistics/domain/inventory
 */

import { ItemId, SkuCode } from './item.types';

/**
 * Inventory ID (unique identifier)
 */
export interface InventoryId {
  value: string; // UUID
}

/**
 * Location ID (generic location reference)
 * 
 * Can represent:
 * - Warehouse (e.g., "WH-001")
 * - Store (e.g., "STORE-123")
 * - 3PL facility (e.g., "3PL-XYZ")
 * - Transit location (e.g., "TRANSIT-ABC")
 * - Customer location (e.g., "CUSTOMER-456")
 */
export interface LocationId {
  value: string; // UUID or business identifier
}

/**
 * Location Type
 * 
 * Categorizes locations by function
 */
export type LocationType =
  | 'WAREHOUSE'      // Internal warehouse
  | 'STORE'          // Retail store
  | 'FULFILLMENT'    // Fulfillment center
  | '3PL'            // Third-party logistics facility
  | 'TRANSIT'        // In-transit location
  | 'SUPPLIER'       // Supplier location
  | 'CUSTOMER'       // Customer location
  | 'STAGING'        // Staging area
  | 'QUARANTINE'     // Quality hold area
  | 'DAMAGE'         // Damaged goods area
  | 'VIRTUAL';       // Virtual/logical location

/**
 * Inventory Status
 * 
 * Lifecycle state of inventory
 */
export type InventoryStatus =
  | 'AVAILABLE'      // Available for allocation
  | 'RESERVED'       // Soft allocation (order placed)
  | 'ALLOCATED'      // Hard allocation (pick confirmed)
  | 'QUARANTINE'     // Quality hold
  | 'DAMAGED'        // Damaged/defective
  | 'EXPIRED'        // Past expiry date
  | 'TRANSIT'        // In-transit between locations
  | 'BLOCKED';       // Administrative hold

/**
 * Lot Number
 * 
 * Manufacturer's lot/batch identifier
 */
export interface LotNumber {
  value: string; // e.g., "LOT-2024-001", "BATCH-ABC"
}

/**
 * Serial Number
 * 
 * Unique item-level identifier
 */
export interface SerialNumber {
  value: string; // e.g., "SN-123456", "IMEI-789012"
}

/**
 * Inventory (Core Entity)
 * 
 * Represents current on-hand balance of an item at a location
 * 
 * Quantity Rules:
 * - quantityOnHand: Physical quantity present
 * - quantityReserved: Soft allocated (order placed, not picked)
 * - quantityAvailable: on_hand - reserved (computed)
 * 
 * Example:
 * ```typescript
 * const inventory: Inventory = {
 *   id: { value: '123e4567-...' },
 *   tenantId: 'tenant-a',
 *   itemId: { value: 'item-1' },
 *   locationId: { value: 'WH-001' },
 *   locationType: 'WAREHOUSE',
 *   quantityOnHand: 100,
 *   quantityReserved: 25,
 *   quantityAvailable: 75, // computed
 *   lotNumber: { value: 'LOT-2024-001' },
 *   serialNumber: undefined, // lot-tracked, not serial-tracked
 *   expiryDate: new Date('2025-12-31'),
 *   status: 'AVAILABLE',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface Inventory {
  // ========== Identity ==========
  /** Unique inventory record identifier */
  id: InventoryId;
  
  /** Tenant ID (P0 Gate - tenant isolation) */
  tenantId: string;
  
  /** Item reference */
  itemId: ItemId;
  
  // ========== Location ==========
  /** Generic location identifier */
  locationId: LocationId;
  
  /** Location type (for filtering/reporting) */
  locationType: LocationType;
  
  // ========== Quantity ==========
  /** Physical quantity on hand */
  quantityOnHand: number;
  
  /** Reserved quantity (soft allocation) */
  quantityReserved: number;
  
  /** Available quantity (computed: on_hand - reserved) */
  quantityAvailable: number;
  
  // ========== Traceability ==========
  /** Lot/batch number (if item.lotTracked = true) */
  lotNumber?: LotNumber;
  
  /** Serial number (if item.serialTracked = true) */
  serialNumber?: SerialNumber;
  
  /** Expiry date (if item.expiryTracked = true) */
  expiryDate?: Date;
  
  // ========== Status ==========
  /** Current inventory status */
  status: InventoryStatus;
  
  // ========== Audit ==========
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Create Inventory Props
 * 
 * Input for creating a new inventory record
 */
export interface CreateInventoryProps {
  tenantId: string;
  itemId: string;
  locationId: string;
  locationType: LocationType;
  quantityOnHand: number;
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: Date;
  status?: InventoryStatus;
}

/**
 * Update Inventory Quantity Props
 * 
 * Input for updating inventory quantities
 */
export interface UpdateInventoryQuantityProps {
  /** Change to on-hand quantity (can be negative) */
  quantity_delta: number;
  
  /** Reason for adjustment */
  reason?: string;
}

/**
 * Reserve Inventory Props
 * 
 * Input for reserving inventory (soft allocation)
 */
export interface ReserveInventoryProps {
  /** Quantity to reserve */
  quantity: number;
  
  /** Reference to order/allocation */
  reference_id: string;
  
  /** Reference type (e.g., "ORDER", "TRANSFER") */
  reference_type: string;
}

/**
 * Release Reservation Props
 * 
 * Input for releasing reservation
 */
export interface ReleaseReservationProps {
  /** Quantity to release */
  quantity: number;
  
  /** Reason for release */
  reason?: string;
}

/**
 * Inventory Filters
 * 
 * Query filters for searching inventory
 */
export interface InventoryFilters {
  /** Filter by item */
  itemId?: string | string[];
  
  /** Filter by location */
  locationId?: string | string[];
  
  /** Filter by location type */
  locationType?: LocationType | LocationType[];
  
  /** Filter by status */
  status?: InventoryStatus | InventoryStatus[];
  
  /** Filter by lot number */
  lotNumber?: string;
  
  /** Filter by serial number */
  serialNumber?: string;
  
  /** Filter expiry date range */
  expiry_before?: Date;
  expiry_after?: Date;
  
  /** Filter by availability */
  only_available?: boolean; // quantityAvailable > 0
  
  /** Filter by minimum quantity */
  min_quantity?: number;
}

/**
 * Inventory Balance Summary
 * 
 * Aggregated view of inventory across locations
 */
export interface InventoryBalanceSummary {
  tenantId: string;
  itemId: string;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  location_count: number; // Number of locations with inventory
  by_location: Array<{
    locationId: string;
    locationType: LocationType;
    quantityOnHand: number;
    quantityReserved: number;
    quantityAvailable: number;
  }>;
  by_status: Array<{
    status: InventoryStatus;
    quantity: number;
  }>;
}

/**
 * Inventory Domain Error
 * 
 * Domain-specific errors for inventory operations
 */
export class InventoryDomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = 'InventoryDomainError';
  }
}

/**
 * Inventory Validation Errors
 */
export const InventoryErrorCodes = {
  ITEM_REQUIRED: 'ITEM_REQUIRED',
  LOCATION_REQUIRED: 'LOCATION_REQUIRED',
  QUANTITY_INVALID: 'QUANTITY_INVALID',
  INSUFFICIENT_QUANTITY: 'INSUFFICIENT_QUANTITY',
  INSUFFICIENT_AVAILABLE: 'INSUFFICIENT_AVAILABLE',
  INSUFFICIENT_RESERVED: 'INSUFFICIENT_RESERVED',
  NEGATIVE_QUANTITY_NOT_ALLOWED: 'NEGATIVE_QUANTITY_NOT_ALLOWED',
  LOT_NUMBER_REQUIRED: 'LOT_NUMBER_REQUIRED',
  SERIAL_NUMBER_REQUIRED: 'SERIAL_NUMBER_REQUIRED',
  EXPIRY_DATE_REQUIRED: 'EXPIRY_DATE_REQUIRED',
  INVENTORY_NOT_FOUND: 'INVENTORY_NOT_FOUND',
  INVENTORY_ALREADY_EXISTS: 'INVENTORY_ALREADY_EXISTS',
  CANNOT_RESERVE_UNAVAILABLE: 'CANNOT_RESERVE_UNAVAILABLE',
} as const;

