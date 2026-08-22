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

// Types (re-export from types layer)
export type {
  // Item types
  Item,
  CreateItemProps,
  UpdateItemProps,
  ItemType,
  ItemStatus,
  
  // Inventory types
  Inventory,
  CreateInventoryProps,
  UpdateInventoryQuantityProps,
  ReserveInventoryProps,
  ReleaseReservationProps,
  InventoryStatus,
  
  // Movement types
  InventoryMovement,
  CreateMovementProps,
  MovementType,
  MovementDirection,
  MovementStatus,
  
  // Traceability types
  Traceability,
  CreateTraceabilityProps,
  AddCustodyEventProps,
  CustodyEvent,
  RecallStatus,
  ComplianceStatus,
  
  // Location types
  Location,
  CreateLocationProps,
  UpdateLocationProps,
  LocationType,
  LocationStatus,
  
  // UOM types
  UnitOfMeasure,
  CreateUOMProps,
  UpdateUOMProps,
  UOMCategory,
  UOMStatus,
} from './item.types';
