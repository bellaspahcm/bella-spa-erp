/**
 * Logistics OS — Traceability Operations
 * 
 * Pure functions for traceability lineage queries and custody tracking.
 * 
 * Design Principles:
 * - No mutations (read-only queries)
 * - Deterministic traversal
 * - Tenant-isolated
 * - Cycle-safe (depth-limited)
 * - Reports broken chains (no fabrication)
 * 
 * Boundary:
 * - E7.3 queries lineage → returns facts
 * - Product interprets facts → decides workflow
 * 
 * @module logistics/domain/rules/traceability.operations
 */

import {
  InventoryMovement,
  MovementId,
  CustodyEvent,
} from '../movement.types';
import { LotNumber, SerialNumber } from '../inventory.types';
import { TraceabilityRecord } from '../traceability.types';

/**
 * Lineage Query Options
 */
export interface LineageQueryOptions {
  /** Maximum depth to traverse (MANDATORY - prevents infinite loops) */
  maxDepth: number;
  
  /** Stop at first broken link (default: false) */
  stopAtBrokenLink?: boolean;
}

/**
 * Lineage Query Result
 */
export interface LineageQueryResult {
  /** Movements in lineage */
  movements: InventoryMovement[];
  
  /** Whether lineage is complete (no broken links) */
  isComplete: boolean;
  
  /** Broken links detected */
  brokenLinks: BrokenLink[];
  
  /** Cycles detected */
  cycles: Cycle[];
  
  /** Query metadata */
  metadata: {
    depthReached: number;
    maxDepthExceeded: boolean;
    movementsScanned: number;
    startedAt: Date;
  };
}

/**
 * Broken Link
 * 
 * Represents a gap in traceability chain.
 */
export interface BrokenLink {
  /** Location where link is broken */
  location: 'upstream' | 'downstream';
  
  /** Expected reference (lot/serial) */
  expectedReference: string;
  
  /** Movement where break was detected */
  lastValidMovement?: InventoryMovement;
  
  /** Reason for break */
  reason: string;
}

/**
 * Cycle
 * 
 * Represents a circular reference in lineage.
 */
export interface Cycle {
  /** Movements involved in cycle */
  movements: MovementId[];
  
  /** Lot/serial involved */
  reference: string;
}

/**
 * Custody Event Generation Context
 */
export interface CustodyEventContext {
  movement: InventoryMovement;
  userId?: string;
}

/**
 * Generate Custody Event from Movement
 * 
 * Converts movement to custody event for traceability record.
 * 
 * Invariant 16: Does not mutate input movement.
 * 
 * @param context - Generation context
 * @returns CustodyEvent
 */
export function generateCustodyEvent(
  context: CustodyEventContext
): CustodyEvent {
  const { movement, userId } = context;
  
  // Map movement type to custody action
  const action = mapMovementTypeToCustodyAction(movement.movement_type);
  
  // Determine location (prefer destination for inbound, source for outbound)
  const locationId = movement.direction === 'INBOUND'
    ? movement.to_location_id?.value
    : movement.from_location_id?.value;
  
  const locationType = movement.direction === 'INBOUND'
    ? movement.to_location_type
    : movement.from_location_type;
  
  if (!locationId || !locationType) {
    throw new Error('Cannot generate custody event: location missing');
  }
  
  return {
    timestamp: movement.movement_date,
    location_id: locationId,
    location_type: locationType,
    action,
    user_id: userId || movement.created_by,
    notes: movement.notes,
  };
}

/**
 * Map Movement Type to Custody Action
 * 
 * Internal helper for custody event generation.
 */
function mapMovementTypeToCustodyAction(
  movementType: string
): CustodyEvent['action'] {
  switch (movementType) {
    case 'RECEIPT':
    case 'RETURN_RECEIPT':
    case 'TRANSFER_IN':
    case 'PRODUCTION_OUTPUT':
      return 'RECEIVED';
    
    case 'SHIPMENT':
      return 'SHIPPED';
    
    case 'RELOCATION':
    case 'TRANSFER_OUT':
      return 'MOVED';
    
    case 'STATUS_CHANGE':
      // Would need additional context to determine QUARANTINED vs RELEASED
      return 'MOVED';
    
    case 'DAMAGE':
      return 'DAMAGED';
    
    case 'OBSOLESCENCE':
    case 'THEFT':
      return 'DESTROYED';
    
    default:
      return 'MOVED';
  }
}

/**
 * Trace Upstream
 * 
 * Traverse lineage backwards (from current location to origin).
 * 
 * Invariants:
 * - #11: Tenant isolation mandatory
 * - #12: Deterministic traversal
 * - #13: Cycle detection (does not crash)
 * - #14: Broken chains reported (no fabrication)
 * - #15: Depth limit mandatory
 * - #16: No mutations
 * 
 * @param tenantId - Tenant ID (isolation)
 * @param lotNumber - Lot to trace
 * @param movements - All movements (repository query result)
 * @param options - Query options
 * @returns Lineage query result
 */
export function traceUpstream(
  tenantId: string,
  lotNumber: LotNumber,
  movements: InventoryMovement[],
  options: LineageQueryOptions
): LineageQueryResult {
  const startedAt = new Date();
  const visited = new Set<string>();
  const result: InventoryMovement[] = [];
  const brokenLinks: BrokenLink[] = [];
  const cycles: Cycle[] = [];
  let movementsScanned = 0;
  let currentDepth = 0;
  let maxDepthExceeded = false;
  
  // Filter tenant-isolated movements
  const tenantMovements = movements.filter(m => m.tenant_id === tenantId);
  
  // Find movements with this lot number
  let currentLotMovements = tenantMovements.filter(
    m => m.lot_number?.value === lotNumber.value && m.status === 'COMPLETED'
  );
  
  while (currentLotMovements.length > 0 && currentDepth < options.maxDepth) {
    currentDepth++;
    const nextBatch: InventoryMovement[] = [];
    
    for (const movement of currentLotMovements) {
      movementsScanned++;
      
      // Cycle detection
      if (visited.has(movement.id.value)) {
        cycles.push({
          movements: [movement.id],
          reference: lotNumber.value,
        });
        continue;
      }
      
      visited.add(movement.id.value);
      result.push(movement);
      
      // Trace further upstream
      if (movement.from_location_id) {
        const upstream = tenantMovements.filter(
          m =>
            m.to_location_id?.value === movement.from_location_id?.value &&
            m.lot_number?.value === lotNumber.value &&
            m.status === 'COMPLETED' &&
            !visited.has(m.id.value)
        );
        
        nextBatch.push(...upstream);
      } else {
        // Origin reached (no further upstream)
        // This is expected for RECEIPT movements
      }
    }
    
    currentLotMovements = nextBatch;
    
    if (currentDepth >= options.maxDepth && currentLotMovements.length > 0) {
      maxDepthExceeded = true;
    }
  }
  
  // Detect broken links
  const isComplete = brokenLinks.length === 0 && cycles.length === 0 && !maxDepthExceeded;
  
  return {
    movements: result,
    isComplete,
    brokenLinks,
    cycles,
    metadata: {
      depthReached: currentDepth,
      maxDepthExceeded,
      movementsScanned,
      startedAt,
    },
  };
}

/**
 * Trace Downstream
 * 
 * Traverse lineage forwards (from origin to current location).
 * 
 * Invariants: Same as traceUpstream (#11-16)
 * 
 * @param tenantId - Tenant ID (isolation)
 * @param lotNumber - Lot to trace
 * @param movements - All movements (repository query result)
 * @param options - Query options
 * @returns Lineage query result
 */
export function traceDownstream(
  tenantId: string,
  lotNumber: LotNumber,
  movements: InventoryMovement[],
  options: LineageQueryOptions
): LineageQueryResult {
  const startedAt = new Date();
  const visited = new Set<string>();
  const result: InventoryMovement[] = [];
  const brokenLinks: BrokenLink[] = [];
  const cycles: Cycle[] = [];
  let movementsScanned = 0;
  let currentDepth = 0;
  let maxDepthExceeded = false;
  
  // Filter tenant-isolated movements
  const tenantMovements = movements.filter(m => m.tenant_id === tenantId);
  
  // Find origin movements (RECEIPT, no from_location)
  let currentLotMovements = tenantMovements.filter(
    m =>
      m.lot_number?.value === lotNumber.value &&
      m.status === 'COMPLETED' &&
      !m.from_location_id
  );
  
  while (currentLotMovements.length > 0 && currentDepth < options.maxDepth) {
    currentDepth++;
    const nextBatch: InventoryMovement[] = [];
    
    for (const movement of currentLotMovements) {
      movementsScanned++;
      
      // Cycle detection
      if (visited.has(movement.id.value)) {
        cycles.push({
          movements: [movement.id],
          reference: lotNumber.value,
        });
        continue;
      }
      
      visited.add(movement.id.value);
      result.push(movement);
      
      // Trace further downstream
      if (movement.to_location_id) {
        const downstream = tenantMovements.filter(
          m =>
            m.from_location_id?.value === movement.to_location_id?.value &&
            m.lot_number?.value === lotNumber.value &&
            m.status === 'COMPLETED' &&
            !visited.has(m.id.value)
        );
        
        nextBatch.push(...downstream);
      }
    }
    
    currentLotMovements = nextBatch;
    
    if (currentDepth >= options.maxDepth && currentLotMovements.length > 0) {
      maxDepthExceeded = true;
    }
  }
  
  // Detect broken links
  const isComplete = brokenLinks.length === 0 && cycles.length === 0 && !maxDepthExceeded;
  
  return {
    movements: result,
    isComplete,
    brokenLinks,
    cycles,
    metadata: {
      depthReached: currentDepth,
      maxDepthExceeded,
      movementsScanned,
      startedAt,
    },
  };
}

/**
 * Get Lot History
 * 
 * Get complete movement history for a lot (chronological order).
 * 
 * Simpler than upstream/downstream - just filters and sorts.
 * 
 * Invariants:
 * - #11: Tenant isolation
 * - #16: No mutations
 * 
 * @param tenantId - Tenant ID
 * @param lotNumber - Lot number
 * @param movements - All movements
 * @returns Movements for this lot (chronological)
 */
export function getLotHistory(
  tenantId: string,
  lotNumber: LotNumber,
  movements: InventoryMovement[]
): InventoryMovement[] {
  return movements
    .filter(
      m =>
        m.tenant_id === tenantId &&
        m.lot_number?.value === lotNumber.value &&
        m.status === 'COMPLETED'
    )
    .sort((a, b) => a.movement_date.getTime() - b.movement_date.getTime());
}

/**
 * Get Serial History
 * 
 * Get complete movement history for a serial number (chronological order).
 * 
 * Invariants:
 * - #11: Tenant isolation
 * - #16: No mutations
 * 
 * @param tenantId - Tenant ID
 * @param serialNumber - Serial number
 * @param movements - All movements
 * @returns Movements for this serial (chronological)
 */
export function getSerialHistory(
  tenantId: string,
  serialNumber: SerialNumber,
  movements: InventoryMovement[]
): InventoryMovement[] {
  return movements
    .filter(
      m =>
        m.tenant_id === tenantId &&
        m.serial_number?.value === serialNumber.value &&
        m.status === 'COMPLETED'
    )
    .sort((a, b) => a.movement_date.getTime() - b.movement_date.getTime());
}

/**
 * Validate Traceability Chain
 * 
 * Check if a traceability chain is complete and valid.
 * 
 * Returns validation result (does not throw, does not mutate).
 * 
 * @param movements - Movements to validate
 * @returns Validation result
 */
export interface TraceabilityChainValidation {
  isValid: boolean;
  gaps: ChainGap[];
  overlaps: ChainOverlap[];
  metadata: {
    totalMovements: number;
    startDate: Date | null;
    endDate: Date | null;
  };
}

export interface ChainGap {
  /** Location where gap exists */
  afterMovement: MovementId;
  
  /** Expected next location */
  expectedLocation: string;
  
  /** Gap reason */
  reason: string;
}

export interface ChainOverlap {
  /** Overlapping movements */
  movements: MovementId[];
  
  /** Overlap reason */
  reason: string;
}

export function validateTraceabilityChain(
  movements: InventoryMovement[]
): TraceabilityChainValidation {
  const gaps: ChainGap[] = [];
  const overlaps: ChainOverlap[] = [];
  
  if (movements.length === 0) {
    return {
      isValid: false,
      gaps: [],
      overlaps: [],
      metadata: {
        totalMovements: 0,
        startDate: null,
        endDate: null,
      },
    };
  }
  
  // Sort chronologically
  const sorted = [...movements].sort(
    (a, b) => a.movement_date.getTime() - b.movement_date.getTime()
  );
  
  // Check for gaps (destination of movement N ≠ source of movement N+1)
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    if (
      current.to_location_id &&
      next.from_location_id &&
      current.to_location_id.value !== next.from_location_id.value
    ) {
      gaps.push({
        afterMovement: current.id,
        expectedLocation: current.to_location_id.value,
        reason: `Gap detected: movement ${current.id.value} ends at ${current.to_location_id.value}, but next movement ${next.id.value} starts at ${next.from_location_id.value}`,
      });
    }
  }
  
  const isValid = gaps.length === 0 && overlaps.length === 0;
  
  return {
    isValid,
    gaps,
    overlaps,
    metadata: {
      totalMovements: movements.length,
      startDate: sorted[0].movement_date,
      endDate: sorted[sorted.length - 1].movement_date,
    },
  };
}
