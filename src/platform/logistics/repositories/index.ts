/**
 * Logistics OS Repository Layer - Public API
 * 
 * E7.1.5: Repository boundary (persistence adapters)
 * 
 * This module exports repository interfaces and implementations for:
 * - Item/SKU persistence
 * - Inventory balance persistence
 * - Movement persistence (contract only - E7.1.5)
 * - Traceability persistence (contract only - E7.1.5)
 * - Location persistence (contract only - E7.1.5)
 * - UOM persistence (contract only - E7.1.5)
 * 
 * Implementation strategy:
 * - Phase 1 (E7.1.5): Item + Inventory fully implemented
 * - Phase 2 (E7.1.6): Movement/Traceability/Location/UOM deferred to test-driven need
 */

// Repository interfaces
export type { IItemRepository, ItemFilters } from './item.repository.interface';
export type { IInventoryRepository, InventoryFilters, InventorySummary } from './inventory.repository.interface';
export type { IMovementRepository, MovementFilters } from './movement.repository.interface';
export type { ITraceabilityRepository, TraceabilityFilters } from './traceability.repository.interface';
export type { ILocationRepository, LocationFilters } from './location.repository.interface';
export type { IUOMRepository, UOMFilters } from './uom.repository.interface';

// Repository implementations (Phase 1 - E7.1.5)
export { ItemRepository } from './item.repository';
export { InventoryRepository } from './inventory.repository';

// Repository implementations (Phase 2 - Deferred to E7.1.6)
// MovementRepository - implementation deferred to test-driven need
// TraceabilityRepository - implementation deferred to test-driven need
// LocationRepository - implementation deferred to test-driven need
// UOMRepository - implementation deferred to test-driven need
