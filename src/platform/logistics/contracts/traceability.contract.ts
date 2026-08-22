/**
 * Logistics OS: Traceability & Audit Contract
 * 
 * Chain of custody, compliance tracking, and audit trail for Logistics domain.
 * Regulatory compliance (FDA, Customs, etc.) requires immutable traceability.
 * 
 * @module LogisticsOS/Traceability
 */

import { ItemId, LocationId } from './inventory.contract';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Event type classification
 */
export enum TraceabilityEventType {
  // Inventory events
  RECEIVED = 'received',
  MOVED = 'moved',
  ALLOCATED = 'allocated',
  PICKED = 'picked',
  PACKED = 'packed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
  
  // Status changes
  STATUS_CHANGED = 'status_changed',
  QUARANTINED = 'quarantined',
  RELEASED = 'released',
  
  // Quality events
  INSPECTED = 'inspected',
  DAMAGED = 'damaged',
  RECALLED = 'recalled',
  
  // Adjustments
  ADJUSTED = 'adjusted',
  CORRECTED = 'corrected',
}

/**
 * Actor type
 */
export enum ActorType {
  USER = 'user',
  SYSTEM = 'system',
  API = 'api',
  INTEGRATION = 'integration',
}

// ============================================================================
// TRACEABILITY EVENT
// ============================================================================

/**
 * Immutable traceability event
 * 
 * Once recorded, cannot be modified (only supplemented with new events).
 * Provides complete chain of custody for regulatory compliance.
 */
export interface TraceabilityEvent {
  /** Unique event ID */
  id: string;
  
  /** Tenant isolation */
  tenant_id: string;
  
  /** Event type */
  event_type: TraceabilityEventType;
  
  /** Item being traced */
  item_id: ItemId;
  
  /** Lot/batch (if lot-controlled) */
  lot_number?: string;
  
  /** Serial numbers (if serialized) */
  serial_numbers?: string[];
  
  /** Quantity involved */
  quantity: number;
  
  /** Location context */
  from_location_id?: LocationId;
  to_location_id?: LocationId;
  current_location_id?: LocationId;
  
  /** Actor who performed action */
  actor_id: string;
  actor_type: ActorType;
  actor_name?: string;
  
  /** Reference to source transaction */
  transaction_id?: string;
  transaction_type?: string; // receipt, order, shipment, etc.
  
  /** External references */
  reference_id?: string; // PO number, DO number, etc.
  reference_type?: string;
  
  /** Event timestamp (immutable) */
  occurred_at: Date;
  
  /** Event recorded timestamp */
  recorded_at: Date;
  
  /** Additional context */
  notes?: string;
  reason?: string;
  
  /** Compliance data */
  compliance_data?: {
    temperature?: number;
    humidity?: number;
    certification_id?: string;
    inspector_id?: string;
    [key: string]: unknown;
  };
  
  /** Extensibility */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CHAIN OF CUSTODY
// ============================================================================

/**
 * Chain of custody link
 */
export interface CustodyLink {
  event_id: string;
  event_type: TraceabilityEventType;
  occurred_at: Date;
  actor_id: string;
  actor_name?: string;
  from_location?: string;
  to_location?: string;
  quantity: number;
  lot_number?: string;
  serial_numbers?: string[];
  notes?: string;
}

/**
 * Complete chain of custody
 */
export interface ChainOfCustody {
  item_id: ItemId;
  lot_number?: string;
  serial_numbers?: string[];
  chain: CustodyLink[];
  current_location_id?: LocationId;
  current_status: string;
  first_event: Date;
  last_event: Date;
}

// ============================================================================
// TRACEABILITY SERVICE
// ============================================================================

/**
 * Record traceability event parameters
 */
export interface RecordEventRequest {
  tenant_id: string;
  event_type: TraceabilityEventType;
  item_id: ItemId;
  quantity: number;
  lot_number?: string;
  serial_numbers?: string[];
  from_location_id?: LocationId;
  to_location_id?: LocationId;
  current_location_id?: LocationId;
  actor_id: string;
  actor_type: ActorType;
  transaction_id?: string;
  transaction_type?: string;
  reference_id?: string;
  reference_type?: string;
  occurred_at?: Date; // Defaults to now
  notes?: string;
  reason?: string;
  compliance_data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Traceability event query filters
 */
export interface TraceabilityQueryFilter {
  tenant_id: string;
  item_id?: ItemId;
  lot_number?: string;
  serial_numbers?: string[];
  location_id?: LocationId;
  event_types?: TraceabilityEventType[];
  actor_id?: string;
  transaction_id?: string;
  reference_id?: string;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Traceability service interface
 */
export interface ITraceabilityService {
  /**
   * Record traceability event (immutable)
   * 
   * Effect:
   * - Creates immutable event record
   * - Updates current location/status tracking
   * - Emits TraceabilityEventRecordedEvent for downstream processing
   * 
   * Validates:
   * - Item exists
   * - Locations exist (if provided)
   * - Tenant isolation
   * - Lot/serial match item configuration
   */
  recordEvent(request: RecordEventRequest): Promise<TraceabilityEvent>;

  /**
   * Get chain of custody for item/lot/serial
   * 
   * Returns complete chronological history of events.
   * Used for compliance, recalls, investigations.
   */
  getChainOfCustody(params: {
    item_id: ItemId;
    lot_number?: string;
    serial_numbers?: string[];
    tenant_id: string;
  }): Promise<ChainOfCustody>;

  /**
   * Query traceability events
   */
  queryEvents(filter: TraceabilityQueryFilter): Promise<TraceabilityEvent[]>;

  /**
   * Get item history (all events for item)
   */
  getItemHistory(params: {
    item_id: ItemId;
    tenant_id: string;
    from_date?: Date;
    to_date?: Date;
  }): Promise<TraceabilityEvent[]>;

  /**
   * Get location history (all events at location)
   */
  getLocationHistory(params: {
    location_id: LocationId;
    tenant_id: string;
    from_date?: Date;
    to_date?: Date;
  }): Promise<TraceabilityEvent[]>;

  /**
   * Trace item forward (where did it go?)
   * 
   * Follow item/lot/serial from point in time to current state.
   */
  traceForward(params: {
    item_id: ItemId;
    lot_number?: string;
    serial_numbers?: string[];
    from_date: Date;
    tenant_id: string;
  }): Promise<TraceabilityEvent[]>;

  /**
   * Trace item backward (where did it come from?)
   * 
   * Follow item/lot/serial from current state back to origin.
   */
  traceBackward(params: {
    item_id: ItemId;
    lot_number?: string;
    serial_numbers?: string[];
    to_date: Date;
    tenant_id: string;
  }): Promise<TraceabilityEvent[]>;
}

// ============================================================================
// RECALL MANAGEMENT
// ============================================================================

/**
 * Recall record
 */
export interface Recall {
  id: string;
  tenant_id: string;
  recall_number: string;
  item_id: ItemId;
  lot_numbers?: string[];
  serial_numbers?: string[];
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  initiated_at: Date;
  initiated_by: string;
  status: 'active' | 'resolved' | 'cancelled';
  resolution_notes?: string;
  resolved_at?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Recall impact analysis
 */
export interface RecallImpact {
  recall_id: string;
  affected_quantity: number;
  affected_locations: LocationId[];
  affected_customers?: string[];
  affected_orders?: string[];
  affected_shipments?: string[];
  traceability_events: TraceabilityEvent[];
}

/**
 * Recall management interface
 */
export interface IRecallManagement {
  /**
   * Initiate recall
   * 
   * Effect:
   * - Creates recall record
   * - Traces all affected items/lots/serials
   * - Identifies impacted locations/orders/shipments
   * - Emits RecallInitiatedEvent
   */
  initiateRecall(params: {
    item_id: ItemId;
    lot_numbers?: string[];
    serial_numbers?: string[];
    reason: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    initiated_by: string;
    tenant_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<Recall>;

  /**
   * Get recall impact analysis
   * 
   * Uses traceability chain to identify all affected:
   * - Locations
   * - Customers
   * - Orders
   * - Shipments
   */
  getRecallImpact(params: {
    recall_id: string;
    tenant_id: string;
  }): Promise<RecallImpact>;

  /**
   * Resolve recall
   */
  resolveRecall(params: {
    recall_id: string;
    resolution_notes: string;
    resolved_by: string;
    tenant_id: string;
  }): Promise<void>;

  /**
   * Get active recalls
   */
  getActiveRecalls(params: {
    tenant_id: string;
    item_id?: ItemId;
  }): Promise<Recall[]>;
}

// ============================================================================
// COMPLIANCE REPORTING
// ============================================================================

/**
 * Compliance report request
 */
export interface ComplianceReportRequest {
  tenant_id: string;
  report_type: 'chain_of_custody' | 'temperature_log' | 'movement_history' | 'recall_analysis';
  item_id?: ItemId;
  lot_number?: string;
  serial_numbers?: string[];
  location_id?: LocationId;
  from_date: Date;
  to_date: Date;
  include_compliance_data?: boolean;
}

/**
 * Compliance report result
 */
export interface ComplianceReport {
  report_id: string;
  report_type: string;
  generated_at: Date;
  generated_by: string;
  parameters: ComplianceReportRequest;
  events: TraceabilityEvent[];
  summary: {
    total_events: number;
    unique_items: number;
    unique_locations: number;
    unique_lots: number;
    [key: string]: unknown;
  };
  compliance_status: 'compliant' | 'non_compliant' | 'review_required';
  findings?: string[];
}

/**
 * Compliance reporting interface
 */
export interface IComplianceReporting {
  /**
   * Generate compliance report
   * 
   * Creates regulatory-compliant report with complete audit trail.
   */
  generateReport(request: ComplianceReportRequest): Promise<ComplianceReport>;

  /**
   * Validate compliance for period
   * 
   * Checks:
   * - All events properly recorded
   * - Chain of custody complete
   * - Temperature logs (if applicable)
   * - No gaps in traceability
   */
  validateCompliance(params: {
    tenant_id: string;
    item_id?: ItemId;
    location_id?: LocationId;
    from_date: Date;
    to_date: Date;
  }): Promise<{
    is_compliant: boolean;
    violations: string[];
    warnings: string[];
  }>;
}

// ============================================================================
// MAIN CONTRACT
// ============================================================================

/**
 * Logistics OS: Traceability & Audit Contract
 * 
 * Main interface for traceability and compliance.
 * Products use this to maintain regulatory-compliant audit trail.
 */
export interface ITraceabilityDomain {
  events: ITraceabilityService;
  recalls: IRecallManagement;
  compliance: IComplianceReporting;
}
