/**
 * Logistics OS Domain Kernel - Public API
 * 
 * E7.1: Pure domain layer (zero infrastructure dependencies)
 * 
 * This module exports domain logic for:
 * - Item/SKU management
 * - Inventory balance and reservations
 * - Inventory movements (transactions)
 * - Traceability (lot/serial tracking)
 * - Location management (generic)
 * - Unit of measure
 * 
 * All domain logic is:
 * - Infrastructure-independent (no DB, no HTTP)
 * - Product-independent (no Warehouse/Finance knowledge)
 * - Testable without external dependencies
 * - Pure TypeScript (Result<T> pattern for errors)
 */

// Core utilities
export { Result } from './core/result';
export type { Result as ResultType } from './core/result';

// Domain kernels
export { ItemDomain } from './item.domain';
export { InventoryDomain } from './inventory.domain';
export { MovementDomain } from './movement.domain';
export { TraceabilityDomain } from './traceability.domain';
export { LocationDomain } from './location.domain';
export { UOMDomain } from './uom.domain';

// Type exports
export type {
  // Item types
  Item,
  CreateItemProps,
  UpdateItemProps,
  ItemType,
  ItemStatus,
  ItemId,
} from './item.types';

// Inventory types
export type {
  Inventory,
  CreateInventoryProps,
  UpdateInventoryQuantityProps,
  ReserveInventoryProps,
  ReleaseReservationProps,
  InventoryStatus,
  InventoryFilters,
  LotNumber,
  SerialNumber,
} from './inventory.types';

// Movement types
export type {
  InventoryMovement,
  CreateMovementProps,
  MovementType,
  MovementDirection,
  MovementStatus,
  MovementFilters,
  MovementId,
} from './movement.types';

// Location types
export type {
  Location,
  CreateLocationProps,
  UpdateLocationProps,
  LocationStatus,
  LocationFilters,
  LocationType,
} from './location.types';

// UOM types
export type {
  UOMCategory,
  StandardUOM,
  UOMDefinition,
  UOMConversion,
} from './uom.types';

// Traceability types
export type {
  Traceability,
  TraceabilityRecord,
  CreateTraceabilityProps,
  AddCustodyEventProps,
  CustodyEvent,
  RecallStatus,
  ComplianceStatus,
  TraceabilityFilters,
  TraceabilityId,
} from './traceability.types';
