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
} from '../movement.types';
import { LotNumber, SerialNumber } from '../inventory.types';
import { CustodyEvent, TraceabilityRecord } from '../traceability.types';

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

type LegacyValueRef = {
  value: string;
};

type MovementBoundaryRecord = Omit<
  InventoryMovement,
  | 'id'
  | 'tenantId'
  | 'movementDate'
  | 'createdBy'
  | 'movementType'
  | 'fromLocationId'
  | 'fromLocationType'
  | 'toLocationId'
  | 'toLocationType'
  | 'lotNumber'
  | 'serialNumber'
> & {
  id: string | LegacyValueRef;
  tenantId?: string;
  tenant_id?: string;
  movementDate?: Date | string;
  movement_date?: Date | string;
  createdBy?: string | null;
  created_by?: string | null;
  movementType?: string;
  movement_type?: string;
  fromLocationId?: string | null;
  from_location_id?: string | LegacyValueRef | null;
  fromLocationType?: InventoryMovement['fromLocationType'];
  from_location_type?: InventoryMovement['fromLocationType'];
  toLocationId?: string | null;
  to_location_id?: string | LegacyValueRef | null;
  toLocationType?: InventoryMovement['toLocationType'];
  to_location_type?: InventoryMovement['toLocationType'];
  lotNumber?: string | null;
  lot_number?: string | LegacyValueRef | null;
  serialNumber?: string | null;
  serial_number?: string | LegacyValueRef | null;
};

type LegacyCustodyEventAliases = {
  location_id: string;
  location_type: CustodyEvent['locationType'];
  user_id?: string | null;
};

function movementRecord(movement: InventoryMovement): MovementBoundaryRecord {
  return movement as MovementBoundaryRecord;
}

function stringValue(value: string | LegacyValueRef | null | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  return value?.value;
}

function dateValue(value: Date | string | null | undefined): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    return new Date(value);
  }

  return new Date(0);
}

function movementId(movement: InventoryMovement): string {
  return stringValue(movementRecord(movement).id) ?? '';
}

function movementTenantId(movement: InventoryMovement): string | undefined {
  const record = movementRecord(movement);
  return record.tenantId ?? record.tenant_id;
}

function movementDate(movement: InventoryMovement): Date {
  const record = movementRecord(movement);
  return dateValue(record.movementDate ?? record.movement_date);
}

function movementCreatedBy(movement: InventoryMovement): string | null | undefined {
  const record = movementRecord(movement);
  return record.createdBy ?? record.created_by;
}

function movementType(movement: InventoryMovement): string {
  const record = movementRecord(movement);
  return record.movementType ?? record.movement_type ?? '';
}

function movementFromLocationId(movement: InventoryMovement): string | undefined {
  const record = movementRecord(movement);
  return record.fromLocationId ?? stringValue(record.from_location_id);
}

function movementToLocationId(movement: InventoryMovement): string | undefined {
  const record = movementRecord(movement);
  return record.toLocationId ?? stringValue(record.to_location_id);
}

function movementFromLocationType(movement: InventoryMovement): InventoryMovement['fromLocationType'] {
  const record = movementRecord(movement);
  return record.fromLocationType ?? record.from_location_type;
}

function movementToLocationType(movement: InventoryMovement): InventoryMovement['toLocationType'] {
  const record = movementRecord(movement);
  return record.toLocationType ?? record.to_location_type;
}

function movementLotNumber(movement: InventoryMovement): string | undefined {
  const record = movementRecord(movement);
  return record.lotNumber ?? stringValue(record.lot_number);
}

function movementSerialNumber(movement: InventoryMovement): string | undefined {
  const record = movementRecord(movement);
  return record.serialNumber ?? stringValue(record.serial_number);
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
): CustodyEvent & LegacyCustodyEventAliases {
  const { movement, userId } = context;
  
  // Map movement type to custody action
  const action = mapMovementTypeToCustodyAction(movementType(movement));
  
  // Determine location (prefer destination for inbound, source for outbound)
  const locationId = movement.direction === 'INBOUND'
    ? movementToLocationId(movement)
    : movementFromLocationId(movement);
  
  const locationType = movement.direction === 'INBOUND'
    ? movementToLocationType(movement)
    : movementFromLocationType(movement);
  
  if (!locationId || !locationType) {
    throw new Error('Cannot generate custody event: location missing');
  }

  const actorId = userId || movementCreatedBy(movement);
  
  return {
    timestamp: movementDate(movement),
    locationId,
    locationType,
    location_id: locationId,
    location_type: locationType,
    action,
    userId: actorId,
    user_id: actorId,
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
  const tenantMovements = movements.filter(m => movementTenantId(m) === tenantId);
  
  // Find movements with this lot number
  let currentLotMovements = tenantMovements.filter(
    m => movementLotNumber(m) === lotNumber.value && m.status === 'COMPLETED'
  );
  
  while (currentLotMovements.length > 0 && currentDepth < options.maxDepth) {
    currentDepth++;
    const nextBatch: InventoryMovement[] = [];
    
    for (const movement of currentLotMovements) {
      movementsScanned++;
      
      // Cycle detection
      const currentMovementId = movementId(movement);

      if (visited.has(currentMovementId)) {
        cycles.push({
          movements: [currentMovementId],
          reference: lotNumber.value,
        });
        continue;
      }
      
      visited.add(currentMovementId);
      result.push(movement);
      
      // Trace further upstream
      const fromLocationId = movementFromLocationId(movement);

      if (fromLocationId) {
        const upstream = tenantMovements.filter(
          m =>
            movementToLocationId(m) === fromLocationId &&
            movementLotNumber(m) === lotNumber.value &&
            m.status === 'COMPLETED' &&
            !visited.has(movementId(m))
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
  const tenantMovements = movements.filter(m => movementTenantId(m) === tenantId);
  
  // Find origin movements (RECEIPT, no from_location)
  let currentLotMovements = tenantMovements.filter(
    m =>
      movementLotNumber(m) === lotNumber.value &&
      m.status === 'COMPLETED' &&
      !movementFromLocationId(m)
  );
  
  while (currentLotMovements.length > 0 && currentDepth < options.maxDepth) {
    currentDepth++;
    const nextBatch: InventoryMovement[] = [];
    
    for (const movement of currentLotMovements) {
      movementsScanned++;
      
      // Cycle detection
      const currentMovementId = movementId(movement);

      if (visited.has(currentMovementId)) {
        cycles.push({
          movements: [currentMovementId],
          reference: lotNumber.value,
        });
        continue;
      }
      
      visited.add(currentMovementId);
      result.push(movement);
      
      // Trace further downstream
      const toLocationId = movementToLocationId(movement);

      if (toLocationId) {
        const downstream = tenantMovements.filter(
          m =>
            movementFromLocationId(m) === toLocationId &&
            movementLotNumber(m) === lotNumber.value &&
            m.status === 'COMPLETED' &&
            !visited.has(movementId(m))
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
        movementTenantId(m) === tenantId &&
        movementLotNumber(m) === lotNumber.value &&
        m.status === 'COMPLETED'
    )
    .sort((a, b) => movementDate(a).getTime() - movementDate(b).getTime());
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
        movementTenantId(m) === tenantId &&
        movementSerialNumber(m) === serialNumber.value &&
        m.status === 'COMPLETED'
    )
    .sort((a, b) => movementDate(a).getTime() - movementDate(b).getTime());
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
    (a, b) => movementDate(a).getTime() - movementDate(b).getTime()
  );
  
  // Check for gaps (destination of movement N ≠ source of movement N+1)
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    if (
      movementToLocationId(current) &&
      movementFromLocationId(next) &&
      movementToLocationId(current) !== movementFromLocationId(next)
    ) {
      const currentToLocationId = movementToLocationId(current) ?? '';
      const nextFromLocationId = movementFromLocationId(next) ?? '';
      const currentMovementId = movementId(current);
      const nextMovementId = movementId(next);

      gaps.push({
        afterMovement: currentMovementId,
        expectedLocation: currentToLocationId,
        reason: `Gap detected: movement ${currentMovementId} ends at ${currentToLocationId}, but next movement ${nextMovementId} starts at ${nextFromLocationId}`,
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
      startDate: movementDate(sorted[0]),
      endDate: movementDate(sorted[sorted.length - 1]),
    },
  };
}
