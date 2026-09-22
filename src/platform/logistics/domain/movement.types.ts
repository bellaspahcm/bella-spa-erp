/**
 * Logistics OS — Inventory Movement Domain Types
 * 
 * InventoryMovement is an immutable transaction log of all inventory movements.
 * Provides complete audit trail for regulatory compliance and reconciliation.
 * 
 * Design Principles:
 * - Immutable (movements cannot be updated, only created)
 * - Audit-ready (complete transaction history)
 * - Product-agnostic (serves all Logistics Products)
 * - Finance-ready (includes cost hints for Finance OS)
 * 
 * @module logistics/domain/movement
 */

import { ItemId } from './item.types';
import { LocationId, LocationType, LotNumber, SerialNumber } from './inventory.types';

/**
 * Movement ID (unique identifier)
 */
export interface MovementId {
  value: string; // UUID
}

/**
 * Movement Number
 * 
 * Human-readable movement identifier
 */
export interface MovementNumber {
  value: string; // e.g., "MOV-2024-001234"
}

/**
 * Movement Type
 * 
 * Categorizes the nature of the movement
 */
export type MovementType =
  // Inbound
  | 'RECEIPT'                  // Goods received from supplier
  | 'RETURN_RECEIPT'           // Customer return received
  | 'TRANSFER_IN'              // Transfer from another location
  | 'PRODUCTION_OUTPUT'        // Manufactured goods
  
  // Outbound
  | 'ISSUE'                    // Goods issued/sold
  | 'SHIPMENT'                 // Goods shipped to customer
  | 'TRANSFER_OUT'             // Transfer to another location
  | 'PRODUCTION_CONSUMPTION'   // Consumed in production
  
  // Adjustments
  | 'ADJUSTMENT_INCREASE'      // Physical count adjustment (increase)
  | 'ADJUSTMENT_DECREASE'      // Physical count adjustment (decrease)
  | 'DAMAGE'                   // Damaged goods write-off
  | 'OBSOLESCENCE'             // Obsolete goods write-off
  | 'THEFT'                    // Shrinkage/theft
  
  // Internal
  | 'RELOCATION'               // Move within same location (bin-to-bin)
  | 'STATUS_CHANGE'            // Status change (e.g., QUARANTINE → AVAILABLE)
  | 'CYCLE_COUNT';             // Cycle count adjustment

/**
 * Movement Direction
 * 
 * Simplified directional indicator
 */
export type MovementDirection =
  | 'INBOUND'   // Increases inventory
  | 'OUTBOUND'  // Decreases inventory
  | 'NEUTRAL';  // No net change (e.g., relocation)

/**
 * Movement Status
 * 
 * Processing status of movement
 */
export type MovementStatus =
  | 'PENDING'      // Created but not yet processed
  | 'COMPLETED'    // Processed and inventory updated
  | 'CANCELLED'    // Cancelled (no inventory impact)
  | 'FAILED';      // Processing failed

/**
 * Source Document Reference
 * 
 * Links movement to originating business document
 */
export interface SourceDocumentReference {
  /** Document type (e.g., "RECEIPT", "ORDER", "TRANSFER") */
  documentType: string;
  
  /** Document ID */
  documentId: string;
  
  /** Document number (human-readable) */
  documentNumber?: string;
  
  /** Line item ID (if applicable) */
  line_itemId?: string;
}

/**
 * Inventory Movement (Core Entity)
 * 
 * Immutable record of inventory transaction
 * 
 * Direction Rules:
 * - INBOUND: toLocationId required, fromLocationId optional
 * - OUTBOUND: fromLocationId required, toLocationId optional
 * - NEUTRAL: both fromLocationId and toLocationId required
 * 
 * Example (Receipt):
 * ```typescript
 * const movement: InventoryMovement = {
 *   id: { value: '123e4567-...' },
 *   movementNumber: { value: 'MOV-2024-001234' },
 *   tenantId: 'tenant-a',
 *   movementDate: new Date(),
 *   movementType: 'RECEIPT',
 *   direction: 'INBOUND',
 *   itemId: { value: 'item-1' },
 *   fromLocationId: undefined, // From supplier (external)
 *   fromLocationType: 'SUPPLIER',
 *   toLocationId: { value: 'WH-001' },
 *   toLocationType: 'WAREHOUSE',
 *   quantity: 100,
 *   unitOfMeasure: 'EA',
 *   lotNumber: { value: 'LOT-2024-001' },
 *   unitCost: 50.00, // Hint for Finance OS
 *   totalCost: 5000.00,
 *   currency: 'VND',
 *   sourceDocument: {
 *     documentType: 'RECEIPT',
 *     documentId: 'receipt-123',
 *     documentNumber: 'RCP-2024-001',
 *   },
 *   status: 'COMPLETED',
 *   createdAt: new Date(),
 * };
 * ```
 */
export interface InventoryMovement {
  // ========== Identity ==========
  /** Unique movement identifier */
  id: MovementId;
  
  /** Human-readable movement number */
  movementNumber: MovementNumber;
  
  /** Tenant ID (P0 Gate - tenant isolation) */
  tenantId: string;
  
  // ========== Temporal ==========
  /** Movement date (business date) */
  movementDate: Date;
  
  /** Creation timestamp (system time) */
  createdAt: Date;
  
  /** Created by user ID */
  createdBy?: string;
  
  // ========== Classification ==========
  /** Type of movement */
  movementType: MovementType;
  
  /** Directional indicator */
  direction: MovementDirection;
  
  // ========== Item ==========
  /** Item reference */
  itemId: ItemId;
  
  // ========== Locations ==========
  /** Source location (optional for inbound) */
  fromLocationId?: LocationId;
  
  /** Source location type */
  fromLocationType?: LocationType;
  
  /** Destination location (optional for outbound) */
  toLocationId?: LocationId;
  
  /** Destination location type */
  toLocationType?: LocationType;
  
  // ========== Quantity ==========
  /** Movement quantity (always positive) */
  quantity: number;
  
  /** Unit of measure */
  unitOfMeasure: string;
  
  // ========== Traceability ==========
  /** Lot/batch number */
  lotNumber?: LotNumber;
  
  /** Serial number */
  serialNumber?: SerialNumber;
  
  /** Expiry date */
  expiryDate?: Date;
  
  // ========== Costing (Hints for Finance OS) ==========
  /** Unit cost (optional, for reference) */
  unitCost?: number;
  
  /** Total cost (quantity * unitCost) */
  totalCost?: number;
  
  /** Currency (ISO 4217) */
  currency?: string;
  
  // ========== Source Document ==========
  /** Reference to originating document */
  sourceDocument?: SourceDocumentReference;
  
  // ========== Reason & Notes ==========
  /** Reason for movement (especially for adjustments) */
  reason?: string;
  
  /** Additional notes */
  notes?: string;
  
  // ========== Batch Processing ==========
  /** Batch ID (for bulk operations) */
  batchId?: string;
  
  // ========== Approval ==========
  /** Approved by user ID (for adjustments) */
  approvedBy?: string;
  
  /** Approval timestamp */
  approvedAt?: Date;
  
  // ========== Status ==========
  /** Processing status */
  status: MovementStatus;
  
  /** Completion timestamp (when status → COMPLETED) */
  completedAt?: Date;
  
  /** Cancellation timestamp (when status → CANCELLED) */
  cancelledAt?: Date;
  
  /** Cancellation reason */
  cancellationReason?: string;
}

/**
 * Create Movement Props
 * 
 * Input for creating a new movement
 */
export interface CreateMovementProps {
  tenantId: string;
  movementDate?: Date; // Defaults to now
  movementType: MovementType;
  direction: MovementDirection;
  itemId: string;
  fromLocationId?: string;
  fromLocationType?: LocationType;
  toLocationId?: string;
  toLocationType?: LocationType;
  quantity: number;
  unitOfMeasure: string;
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: Date;
  unitCost?: number;
  totalCost?: number;
  currency?: string;
  sourceDocument?: SourceDocumentReference;
  reason?: string;
  notes?: string;
  batchId?: string;
  approvedBy?: string;
  createdBy?: string;
}

/**
 * Movement Filters
 * 
 * Query filters for searching movements
 */
export interface MovementFilters {
  /** Filter by item */
  itemId?: string | string[];
  
  /** Filter by movement type */
  movementType?: MovementType | MovementType[];
  
  /** Filter by direction */
  direction?: MovementDirection;
  
  /** Filter by from location */
  fromLocationId?: string | string[];
  
  /** Filter by to location */
  toLocationId?: string | string[];
  
  /** Filter by location (either from or to) */
  locationId?: string;
  
  /** Filter by lot number */
  lotNumber?: string;
  
  /** Filter by serial number */
  serialNumber?: string;
  
  /** Filter by date range */
  movementDate_from?: Date;
  movementDate_to?: Date;
  
  /** Filter by status */
  status?: MovementStatus | MovementStatus[];
  
  /** Filter by source document */
  sourceDocument_type?: string;
  sourceDocument_id?: string;
  
  /** Filter by batch */
  batchId?: string;
  
  /** Filter by creator */
  createdBy?: string;
}

/**
 * Movement Summary
 * 
 * Aggregated movement statistics
 */
export interface MovementSummary {
  tenantId: string;
  itemId?: string;
  locationId?: string;
  periodFrom: Date;
  periodTo: Date;
  
  inboundQuantity: number;
  inboundValue: number;
  inboundCount: number;
  
  outboundQuantity: number;
  outboundValue: number;
  outboundCount: number;
  
  adjustmentQuantity: number; // Net adjustment
  adjustmentCount: number;
  
  byType: Array<{
    movementType: MovementType;
    quantity: number;
    value: number;
    count: number;
  }>;
}

/**
 * Movement Domain Error
 * 
 * Domain-specific errors for movement operations
 */
export class MovementDomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = 'MovementDomainError';
  }
}

/**
 * Movement Validation Errors
 */
export const MovementErrorCodes = {
  ITEM_REQUIRED: 'ITEM_REQUIRED',
  QUANTITY_REQUIRED: 'QUANTITY_REQUIRED',
  QUANTITY_MUST_BE_POSITIVE: 'QUANTITY_MUST_BE_POSITIVE',
  FROM_LOCATION_REQUIRED: 'FROM_LOCATION_REQUIRED',
  TO_LOCATION_REQUIRED: 'TO_LOCATION_REQUIRED',
  LOCATION_REQUIRED: 'LOCATION_REQUIRED',
  MOVEMENT_TYPE_REQUIRED: 'MOVEMENT_TYPE_REQUIRED',
  DIRECTION_REQUIRED: 'DIRECTION_REQUIRED',
  DIRECTION_MISMATCH: 'DIRECTION_MISMATCH',
  LOT_NUMBER_REQUIRED: 'LOT_NUMBER_REQUIRED',
  SERIAL_NUMBER_REQUIRED: 'SERIAL_NUMBER_REQUIRED',
  MOVEMENT_IMMUTABLE: 'MOVEMENT_IMMUTABLE',
  MOVEMENT_NOT_FOUND: 'MOVEMENT_NOT_FOUND',
  CANNOT_CANCEL_COMPLETED: 'CANNOT_CANCEL_COMPLETED',
} as const;

