/**
 * Logistics OS — Domain Layer
 * 
 * Core domain types and contracts for Logistics OS.
 * 
 * Architecture:
 * - Pure TypeScript interfaces (no implementation)
 * - Warehouse-agnostic (no Receipt, Bin, Putaway concepts)
 * - Finance-agnostic (no accounting logic)
 * - Product-agnostic (serves all Logistics Products)
 * 
 * @module logistics/domain
 */

// Item domain
export * from './item.types';

// Inventory domain
export * from './inventory.types';

// Movement domain
export * from './movement.types';

// Traceability domain
export * from './traceability.types';

// Location domain
export * from './location.types';

// UOM domain
export * from './uom.types';

