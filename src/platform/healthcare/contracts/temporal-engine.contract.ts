/**
 * Temporal & Clinical History Engine Contract — Phase H9
 *
 * Defines the public API contract for the Temporal Engine.
 * Provides bitemporal timeline tracking (valid_time vs transaction_time),
 * point-in-time clinical state reconstruction, and historical audit integration.
 *
 * Constitution:
 *   - Law 1: Encounter as aggregate root
 *   - Law 11: Zero `any` types (Law 11 enforced)
 *   - Bitemporal model: valid_time (event occurrence) vs transaction_time (system record)
 *
 * @module platform/healthcare/contracts/temporal-engine.contract
 */

import type { EngineResponse } from '../shared-kernel/types';

export type TimeDimension = 'VALID_TIME' | 'TRANSACTION_TIME';

export type HealthcareAggregateType =
  | 'Patient'
  | 'Encounter'
  | 'Admission'
  | 'ICU'
  | 'Surgery'
  | 'Laboratory'
  | 'Pharmacy'
  | 'BloodBank'
  | 'ClinicalDecision';

export interface ITemporalEventInput {
  tenantId: string;
  encounterId: string;
  patientId: string;
  aggregateType: HealthcareAggregateType;
  aggregateId: string;
  eventType: string;
  validTime: string;
  transactionTime?: string;
  deltaPayload: Record<string, unknown>;
}

export interface ITemporalEventRecord {
  id: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  aggregateType: HealthcareAggregateType;
  aggregateId: string;
  eventType: string;
  validTime: string;
  transactionTime: string;
  sequenceNumber: number;
  deltaPayload: Record<string, unknown>;
  createdAt: string;
}

export interface ITemporalStateSnapshot {
  tenantId: string;
  encounterId: string;
  patientId: string;
  asOfValidTime: string;
  asOfTransactionTime: string;
  timeDimension: TimeDimension;
  activeMedications: Array<Record<string, unknown>>;
  allergies: Array<Record<string, unknown>>;
  labResults: Array<Record<string, unknown>>;
  vitalSigns: Array<Record<string, unknown>>;
  diagnoses: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  cdsDecisions: Array<Record<string, unknown>>;
  eventCountReconstructed: number;
}

export interface IDecisionTemporalAudit {
  decisionId: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  evaluationTimestamp: string;
  evaluationFingerprint: string;
  decisionResult: string;
  decisionSeverity: string;
  decisionEnforcement: string;
  temporalSnapshot: ITemporalStateSnapshot;
  auditProvenanceMatch: boolean;
}

export interface IHistoricalStateQuery {
  tenantId: string;
  encounterId: string;
  targetTime: string;
  timeDimension?: TimeDimension;
  includeFields?: Array<
    'MEDICATIONS' | 'ALLERGIES' | 'LAB_RESULTS' | 'VITAL_SIGNS' | 'ORDERS' | 'DECISIONS'
  >;
}

export interface ITemporalContract {
  /**
   * Records a new bitemporal event into the immutable timeline.
   */
  recordTemporalEvent(
    input: ITemporalEventInput
  ): Promise<EngineResponse<ITemporalEventRecord>>;

  /**
   * Reconstructs the exact patient encounter state at historical timestamp T.
   */
  reconstructStateAt(
    tenantId: string,
    encounterId: string,
    targetTime: string,
    timeDimension?: TimeDimension
  ): Promise<EngineResponse<ITemporalStateSnapshot>>;

  /**
   * Retrieves the full temporal audit context for an H8 CDS decision,
   * answering: "What did Bella know when issuing this decision?"
   */
  getDecisionTemporalContext(
    tenantId: string,
    decisionId: string
  ): Promise<EngineResponse<IDecisionTemporalAudit>>;

  /**
   * Queries historical clinical state with field filtering.
   */
  queryHistoricalState(
    query: IHistoricalStateQuery
  ): Promise<EngineResponse<Partial<ITemporalStateSnapshot>>>;
}
