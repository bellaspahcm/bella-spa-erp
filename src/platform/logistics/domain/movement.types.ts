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
  document_type: string;
  
  /** Document ID */
  document_id: string;
  
  /** Document number (human-readable) */
  document_number?: string;
  
  /** Line item ID (if applicable) */
  line_item_id?: string;
}

/**
 * Inventory Movement (Core Entity)
 * 
 * Immutable record of inventory transaction
 * 
 * Direction Rules:
 * - INBOUND: to_location_id required, from_location_id optional
 * - OUTBOUND: from_location_id required, to_location_id optional
 * - NEUTRAL: both from_location_id and to_location_id required
 * 
 * Example (Receipt):
 * ```typescript
 * const movement: InventoryMovement = {
 *   id: { value: '123e4567-...' },
 *   movement_number: { value: 'MOV-2024-001234' },
 *   tenant_id: 'tenant-a',
 *   movement_date: new Date(),
 *   movement_type: 'RECEIPT',
 *   direction: 'INBOUND',
 *   item_id: { value: 'item-1' },
 *   from_location_id: undefined, // From supplier (external)
 *   from_location_type: 'SUPPLIER',
 *   to_location_id: { value: 'WH-001' },
 *   to_location_type: 'WAREHOUSE',
 *   quantity: 100,
 *   unit_of_measure: 'EA',
 *   lot_number: { value: 'LOT-2024-001' },
 *   unit_cost: 50.00, // Hint for Finance OS
 *   total_cost: 5000.00,
 *   currency: 'VND',
 *   source_document: {
 *     document_type: 'RECEIPT',
 *     document_id: 'receipt-123',
 *     document_number: 'RCP-2024-001',
 *   },
 *   status: 'COMPLETED',
 *   created_at: new Date(),
 * };
 * ```
 */
export interface InventoryMovement {
  // ========== Identity ==========
  /** Unique movement identifier */
  id: MovementId;
  
  /** Human-readable movement number */
  movement_number: MovementNumber;
  
  /** Tenant ID (P0 Gate - tenant isolation) */
  tenant_id: string;
  
  // ========== Temporal ==========
  /** Movement date (business date) */
  movement_date: Date;
  
  /** Creation timestamp (system time) */
  created_at: Date;
  
  /** Created by user ID */
  created_by?: string;
  
  // ========== Classification ==========
  /** Type of movement */
  movement_type: MovementType;
  
  /** Directional indicator */
  direction: MovementDirection;
  
  // ========== Item ==========
  /** Item reference */
  item_id: ItemId;
  
  // ========== Locations ==========
  /** Source location (optional for inbound) */
  from_location_id?: LocationId;
  
  /** Source location type */
  from_location_type?: LocationType;
  
  /** Destination location (optional for outbound) */
  to_location_id?: LocationId;
  
  /** Destination location type */
  to_location_type?: LocationType;
  
  // ========== Quantity ==========
  /** Movement quantity (always positive) */
  quantity: number;
  
  /** Unit of measure */
  unit_of_measure: string;
  
  // ========== Traceability ==========
  /** Lot/batch number */
  lot_number?: LotNumber;
  
  /** Serial number */
  serial_number?: SerialNumber;
  
  /** Expiry date */
  expiry_date?: Date;
  
  // ========== Costing (Hints for Finance OS) ==========
  /** Unit cost (optional, for reference) */
  unit_cost?: number;
  
  /** Total cost (quantity * unit_cost) */
  total_cost?: number;
  
  /** Currency (ISO 4217) */
  currency?: string;
  
  // ========== Source Document ==========
  /** Reference to originating document */
  source_document?: SourceDocumentReference;
  
  // ========== Reason & Notes ==========
  /** Reason for movement (especially for adjustments) */
  reason?: string;
  
  /** Additional notes */
  notes?: string;
  
  // ========== Batch Processing ==========
  /** Batch ID (for bulk operations) */
  batch_id?: string;
  
  // ========== Approval ==========
  /** Approved by user ID (for adjustments) */
  approved_by?: string;
  
  /** Approval timestamp */
  approved_at?: Date;
  
  // ========== Status ==========
  /** Processing status */
  status: MovementStatus;
  
  /** Completion timestamp (when status → COMPLETED) */
  completed_at?: Date;
  
  /** Cancellation timestamp (when status → CANCELLED) */
  cancelled_at?: Date;
  
  /** Cancellation reason */
  cancellation_reason?: string;
}

/**
 * Create Movement Props
 * 
 * Input for creating a new movement
 */
export interface CreateMovementProps {
  tenant_id: string;
  movement_date?: Date; // Defaults to now
  movement_type: MovementType;
  direction: MovementDirection;
  item_id: string;
  from_location_id?: string;
  from_location_type?: LocationType;
  to_location_id?: string;
  to_location_type?: LocationType;
  quantity: number;
  unit_of_measure: string;
  lot_number?: string;
  serial_number?: string;
  expiry_date?: Date;
  unit_cost?: number;
  total_cost?: number;
  currency?: string;
  source_document?: SourceDocumentReference;
  reason?: string;
  notes?: string;
  batch_id?: string;
  approved_by?: string;
  created_by?: string;
}

/**
 * Movement Filters
 * 
 * Query filters for searching movements
 */
export interface MovementFilters {
  /** Filter by item */
  item_id?: string | string[];
  
  /** Filter by movement type */
  movement_type?: MovementType | MovementType[];
  
  /** Filter by direction */
  direction?: MovementDirection;
  
  /** Filter by from location */
  from_location_id?: string | string[];
  
  /** Filter by to location */
  to_location_id?: string | string[];
  
  /** Filter by location (either from or to) */
  location_id?: string;
  
  /** Filter by lot number */
  lot_number?: string;
  
  /** Filter by serial number */
  serial_number?: string;
  
  /** Filter by date range */
  movement_date_from?: Date;
  movement_date_to?: Date;
  
  /** Filter by status */
  status?: MovementStatus | MovementStatus[];
  
  /** Filter by source document */
  source_document_type?: string;
  source_document_id?: string;
  
  /** Filter by batch */
  batch_id?: string;
  
  /** Filter by creator */
  created_by?: string;
}

/**
 * Movement Summary
 * 
 * Aggregated movement statistics
 */
export interface MovementSummary {
  tenant_id: string;
  item_id?: string;
  location_id?: string;
  period_from: Date;
  period_to: Date;
  
  inbound_quantity: number;
  inbound_value: number;
  inbound_count: number;
  
  outbound_quantity: number;
  outbound_value: number;
  outbound_count: number;
  
  adjustment_quantity: number; // Net adjustment
  adjustment_count: number;
  
  by_type: Array<{
    movement_type: MovementType;
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

