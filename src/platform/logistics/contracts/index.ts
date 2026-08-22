/**
 * Logistics OS: Domain Contracts
 * 
 * TypeScript interfaces defining the boundary between Logistics OS and Products.
 * Products (Warehouse, Fulfillment, Transportation, etc.) consume these contracts.
 * 
 * Contracts define WHAT the OS provides, not HOW it's implemented.
 * 
 * @module LogisticsOS/Contracts
 */

// ============================================================================
// INVENTORY DOMAIN
// ============================================================================

export * from './inventory.contract';

// ============================================================================
// ITEM MASTER DATA
// ============================================================================

export * from './item.contract';

// ============================================================================
// TRACEABILITY & AUDIT
// ============================================================================

export * from './traceability.contract';
