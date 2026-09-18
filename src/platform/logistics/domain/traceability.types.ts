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
  locationId: string;
  locationType: LocationType | null;
  action: string;
  userId?: string | null;
  notes?: string | null;
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
  tenantId: string;
  itemId: ItemId;
  
  // Identifiers
  lotNumber?: LotNumber;
  serialNumber?: SerialNumber;
  
  // Lifecycle
  manufacturedDate?: Date;
  expiryDate?: Date;
  receivedDate: Date;
  
  // Origin
  supplierId?: string;
  supplierName?: string;
  supplierLotNumber?: string;
  
  // Chain of custody
  custodyEvents: CustodyEvent[];
  
  // Compliance
  complianceStatus: ComplianceStatus;
  recallStatus: RecallStatus;
  recallReason?: string;
  recallDate?: Date;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Traceability (alias for TraceabilityRecord)
 */
export type Traceability = TraceabilityRecord;

/**
 * Create Traceability Props
 */
export interface CreateTraceabilityProps {
  id?: string;
  tenantId: string;
  itemId: string;
  lotNumber?: string;
  serialNumber?: string;
  manufacturedDate?: Date;
  expiryDate?: Date;
  receivedDate?: Date;
  supplierId?: string;
  supplierName?: string;
  supplierLotNumber?: string;
  custodyEvents?: CustodyEvent[];
  complianceStatus?: ComplianceStatus;
  recallStatus?: RecallStatus;
}

/**
 * Add Custody Event Props
 */
export interface AddCustodyEventProps {
  locationId: string;
  locationType?: LocationType;
  action: string;
  userId?: string;
  notes?: string;
  timestamp?: Date;
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

