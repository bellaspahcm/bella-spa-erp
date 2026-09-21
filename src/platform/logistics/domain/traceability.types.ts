/**
 * Logistics OS — Traceability Domain Types
 * 
 * Traceability provides lot/serial tracking and chain of custody
 * for regulatory compliance (FDA, EU regulations, etc.).
 * 
 * Design Principles:
 * - Regulatory-ready (supports recalls, compliance reporting)
 * - Product-agnostic (serves all Logistics Products)
 * - Immutable chain of custody
 * 
 * @module logistics/domain/traceability
 */

import { ItemId } from './item.types';
import { LocationId, LocationType, LotNumber, SerialNumber } from './inventory.types';

/**
 * Traceability ID
 */
export interface TraceabilityId {
  value: string; // UUID
}

/**
 * Supplier Reference
 */
export interface SupplierReference {
  supplier_id: string;
  supplier_name: string;
  supplier_lot_number?: string;
}

/**
 * Custody Event
 * 
 * Records a single event in chain of custody
 */
export interface CustodyEvent {
  timestamp: Date;
  location_id: string;
  location_type: LocationType;
  action: 'RECEIVED' | 'MOVED' | 'QUARANTINED' | 'RELEASED' | 'SHIPPED' | 'DAMAGED' | 'DESTROYED';
  user_id?: string;
  notes?: string;
}

/**
 * Recall Status
 */
export type RecallStatus =
  | 'NONE'        // No recall
  | 'RECALLED'    // Active recall
  | 'DESTROYED';  // Recalled and destroyed

/**
 * Compliance Status
 */
export type ComplianceStatus =
  | 'COMPLIANT'     // Meets all requirements
  | 'NON_COMPLIANT' // Violates requirements
  | 'UNDER_REVIEW'; // Pending review

/**
 * Traceability Record (Core Entity)
 * 
 * Complete traceability information for lot or serial
 */
export interface TraceabilityRecord {
  id: TraceabilityId;
  tenant_id: string;
  item_id: ItemId;
  
  // Identifiers
  lot_number?: LotNumber;
  serial_number?: SerialNumber;
  
  // Lifecycle
  manufactured_date?: Date;
  expiry_date?: Date;
  received_date: Date;
  
  // Origin
  supplier?: SupplierReference;
  
  // Chain of custody
  custody_events: CustodyEvent[];
  
  // Compliance
  compliance_status: ComplianceStatus;
  recall_status: RecallStatus;
  recall_reason?: string;
  recall_date?: Date;
  
  // Audit
  created_at: Date;
  updated_at: Date;
}

/**
 * Create Traceability Props
 */
export interface CreateTraceabilityProps {
  tenant_id: string;
  item_id: string;
  lot_number?: string;
  serial_number?: string;
  manufactured_date?: Date;
  expiry_date?: Date;
  received_date?: Date;
  supplier?: SupplierReference;
}

/**
 * Traceability Filters
 */
export interface TraceabilityFilters {
  item_id?: string | string[];
  lot_number?: string;
  serial_number?: string;
  expiry_before?: Date;
  expiry_after?: Date;
  recall_status?: RecallStatus;
  compliance_status?: ComplianceStatus;
  supplier_id?: string;
}

/**
 * Traceability Domain Error
 */
export class TraceabilityDomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = 'TraceabilityDomainError';
  }
}

export const TraceabilityErrorCodes = {
  LOT_OR_SERIAL_REQUIRED: 'LOT_OR_SERIAL_REQUIRED',
  DUPLICATE_LOT_SERIAL: 'DUPLICATE_LOT_SERIAL',
  EXPIRY_DATE_REQUIRED: 'EXPIRY_DATE_REQUIRED',
  EXPIRY_DATE_INVALID: 'EXPIRY_DATE_INVALID',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  CANNOT_MODIFY_RECALLED: 'CANNOT_MODIFY_RECALLED',
} as const;

