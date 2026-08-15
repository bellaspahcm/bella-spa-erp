import { DomainEventEnvelope, EventBusPort, EventHandler as CoreEventHandler } from '../../core/events';

export type EventType =
  // Encounter Engine Events (Phase 3)
  | 'EncounterCreated'
  | 'EncounterArrived'
  | 'EncounterTriaged'
  | 'EncounterStarted'
  | 'EncounterHeld'
  | 'EncounterResumed'
  | 'EncounterFinished'
  | 'EncounterCancelled'
  | 'DiagnosisAdded'
  | 'ProviderAssigned'
  | 'EncounterTransferred'
  // Bed Engine Events
  | 'BedAllocated'
  | 'BedReleased'
  | 'BedTransferred'
  // Nursing Engine Events
  | 'VitalsRecorded'
  | 'VitalsAlertTriggered'
  // Pharmacy Engine Events
  | 'MedicationAdministered'
  | 'MedicationRefused'
  | 'MedicationHeld'
  // Billing Engine Events
  | 'BillingChargeCreated'
  | 'PaymentReceived'
  // Clinical Engine Events
  | 'TimelineEntryAdded'
  | 'DiagnosisRecorded'
  // Perioperative events (v1.1 Clinical Safety Profile)
  | 'hos.or.scheduled.v1'
  | 'hos.or.rescheduled.v1'
  | 'hos.or.cancelled.v1'
  | 'hos.or.ready.v1'
  | 'hos.surgical.case.created.v1'
  | 'hos.surgical.team.assigned.v1'
  | 'hos.surgical.safety.signin.v1'
  | 'hos.surgical.safety.timeout.v1'
  | 'hos.surgical.procedure.started.v1'
  | 'hos.surgical.procedure.completed.v1'
  | 'hos.anesthesia.preop.completed.v1'
  | 'hos.anesthesia.observation.recorded.v1'
  | 'hos.pacu.discharged.v1'
  | 'hos.cssd.cycle.completed.v1'
  // Critical Care & Diagnostics events (Phase B2, B3, B4)
  | 'hos.blood.transfusion.blocked.v1'
  | 'hos.icu.ventilator.validation_failed.v1'
  | 'hos.ed.triage.reassessed.v1'
  | 'hos.blood.crossmatch.completed.v1'
  | 'hos.blood.unit.reserved.v1'
  | 'hos.blood.transfusion.started.v1'
  | 'hos.blood.transfusion.completed.v1'
  // Clinical Decision Support events (Phase C)
  | 'hos.cds.drug_interaction.detected.v1'
  | 'hos.cds.allergy.blocked.v1'
  | 'hos.cds.protocol.violated.v1'
  | 'hos.cds.dispense.blocked.v1'
  | 'hos.order.created.v1'
  | 'hos.order.approved.v1'
  | 'hos.order.discontinued.v1'
  // Phase D1 — Compensating Transaction Engine events
  | 'platform.transaction.started.v1'
  | 'platform.transaction.step.executed.v1'
  | 'platform.transaction.committed.v1'
  | 'platform.transaction.rollback.started.v1'
  | 'platform.transaction.rollback.completed.v1'
  | 'platform.transaction.rollback.failed.v1'
  | 'platform.transaction.manual_recovery.required.v1'
  // Phase D2 — Temporal Intelligence Engine events
  | 'platform.temporal.snapshot.captured.v1'
  // Phase D3 — Governed Business Rule Engine events
  | 'platform.rule.created.v1'
  | 'platform.rule.approved.v1'
  | 'platform.rule.activated.v1'
  | 'platform.rule.evaluated.v1'
  | 'platform.rule.suspended.v1'
  | 'platform.rule.retired.v1'
  // Phase D4 — Analytics Engine events
  | 'platform.metric.recorded.v1'
  | 'platform.metric.daily_rollup.completed.v1'
  | 'platform.metric.monthly_rollup.completed.v1'
  | 'platform.metric.enterprise_rollup.completed.v1'
  // Finance OS Kernel events (F1 Ledger)
  | 'finance.transaction.posted.v1'
  | 'finance.transaction.reversed.v1'
  | 'finance.transaction.voided.v1'
  | 'finance.period.opened.v1'
  | 'finance.period.closed.v1'
  | 'finance.period.locked.v1'
  // Finance OS F2.2 — Cash Projection Contract (v2)
  // Worker MUST subscribe to v2 only. v1 is a backward-compatibility event.
  | 'finance.transaction.posted.v2'
  | 'finance.transaction.reversed.v2'
  | (string & {});

export interface DomainEvent<T = unknown> {
  // Event identification
  eventId: string;
  eventType: EventType;
  eventVersion: string;
  
  // Context
  tenantId: string;
  aggregateId: string; // ID of the entity that triggered the event
  aggregateType: string; // Type of entity (e.g., 'bed', 'patient', 'medication')
  
  // Payload
  payload: T;
  
  // Metadata
  occurredAt: string; // ISO timestamp
  userId?: string; // Who triggered the event
  correlationId?: string; // For tracing related events
  causationId?: string; // Event that caused this event
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void;

export interface EventBusAdapter extends EventBusPort {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T = unknown>(
    eventType: EventType,
    handler: EventHandler<T>
  ): () => void;
}

// Event payloads
export interface BedAllocatedPayload {
  bedId: string;
  bedCode: string;
  bedType: 'standard' | 'icu' | 'vip' | 'isolation';
  patientId: string;
  encounterId: string;
  admissionId: string;
  wardId: string;
  dailyRate: number;
  allocatedAt: string;
}

export interface VitalsRecordedPayload {
  vitalSignsId: string;
  patientId: string;
  encounterId: string;
  temperature: number;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  oxygenSaturation: number;
  respiratoryRate?: number;
  recordedAt: string;
  practitionerId: string;
  isCritical: boolean;
  alerts: string[];
}

export interface MedicationAdministeredPayload {
  marId: string;
  patientId: string;
  encounterId: string;
  medicationId: string;
  drugName: string;
  dosage: string;
  route: string;
  administeredAt: string;
  practitionerId: string;
  scheduledTime: string;
  notes?: string;
}

// ============================================================
// Finance OS v2 Event Payload Types (F2.2 Cash Projection Contract)
// ============================================================

/**
 * A candidate cash leg: an ASSET-type account line from an F1 transaction
 * that MAY represent a real cash flow. F2 CashProjectionWorker determines
 * whether to project or ignore each leg based on liquidity account mapping.
 *
 * F2.2 Invariant: F2 NEVER reconstructs accounting truth from these legs.
 * These are candidates only. F1 remains the sole source of financial truth.
 */
export interface CandidateCashLeg {
  /** F1 account UUID */
  account_id: string;
  /** Account code (e.g. '1111') */
  account_code: string;
  /** INFLOW = debit on asset; OUTFLOW = credit on asset */
  direction: 'INFLOW' | 'OUTFLOW';
  /** Amount in transaction currency (minor units) */
  amount_minor: number;
  currency: string;
  /** Amount in functional currency (minor units) */
  functional_amount_minor: number;
  functional_currency: string;
  /** Exchange rate applied by F1 */
  exchange_rate: number;
}

/**
 * Payload for finance.transaction.posted.v2
 * Emitted atomically alongside v1 after a successful F1 ledger post.
 * CashProjectionWorker subscribes to THIS event, NOT v1.
 */
export interface FinanceTransactionPostedV2Payload {
  event_id: string;
  event_type: 'finance.transaction.posted.v2';
  event_version: '2.0';
  tenant_id: string;
  transaction_id: string;
  transaction_type: string;
  posted_at: string;
  source_type: string;
  source_id: string;
  /** ASSET-type account legs. May be empty for non-cash transactions. */
  candidate_cash_legs: CandidateCashLeg[];
}

/**
 * Payload for finance.transaction.reversed.v2
 * Emitted atomically alongside v1 after a successful F1 reversal.
 */
export interface FinanceTransactionReversedV2Payload {
  event_id: string;
  event_type: 'finance.transaction.reversed.v2';
  event_version: '2.0';
  tenant_id: string;
  /** UUID of the new reversal transaction (the credit-side transaction) */
  transaction_id: string;
  transaction_type: 'REVERSAL';
  posted_at: string;
  /** UUID of the original transaction being reversed */
  reversal_of_transaction_id: string;
  /** Candidate cash legs from the reversal transaction lines */
  candidate_cash_legs: CandidateCashLeg[];
}
