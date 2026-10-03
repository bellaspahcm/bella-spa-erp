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

import { LocationType } from './inventory.types';

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
  supplierId: string;
  supplierName: string;
  supplierLotNumber?: string | null;
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
  action: 'RECEIVED' | 'MOVED' | 'TRANSFERRED' | 'QUARANTINED' | 'RELEASED' | 'SHIPPED' | 'DAMAGED' | 'DESTROYED';
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
/** Alias for TraceabilityRecord — backward-compatible export for domain consumers */
export type Traceability = TraceabilityRecord;

export interface TraceabilityRecord {
  id: TraceabilityId;
  tenantId: string;
  itemId: string;
  
  // Identifiers
  lotNumber?: string | null;
  serialNumber?: string | null;
  
  // Lifecycle
  manufacturedDate?: Date | null;
  expiryDate?: Date | null;
  receivedDate: Date;
  
  // Origin
  supplierId?: string | null;
  supplierName?: string | null;
  supplierLotNumber?: string | null;
  
  // Chain of custody
  custodyEvents: CustodyEvent[];
  
  // Compliance
  complianceStatus: ComplianceStatus;
  recallStatus: RecallStatus;
  recallReason?: string | null;
  recallDate?: Date | null;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Add Custody Event Props
 */
export interface AddCustodyEventProps {
  locationId: string;
  locationType?: LocationType | null;
  action: CustodyEvent['action'];
  userId?: string | null;
  notes?: string | null;
  timestamp?: Date;
}

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
 * Traceability Filters
 */
export interface TraceabilityFilters {
  itemId?: string | string[];
  lotNumber?: string;
  serialNumber?: string;
  expiryBefore?: Date;
  expiryAfter?: Date;
  recallStatus?: RecallStatus;
  complianceStatus?: ComplianceStatus;
  supplierId?: string;
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

