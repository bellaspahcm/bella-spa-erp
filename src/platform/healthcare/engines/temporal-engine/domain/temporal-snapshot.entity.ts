/**
 * Temporal State Snapshot Domain Entity — Phase H9 Temporal Engine
 *
 * Represents an aggregated encounter state checkpoint at a specific point in time.
 * Enforces Law 11 zero `any` types.
 *
 * @module platform/healthcare/engines/temporal-engine/domain/temporal-snapshot.entity
 */

import type { ITemporalStateSnapshot, TimeDimension } from '../../../contracts/temporal-engine.contract';

export interface TemporalSnapshotParams {
  tenantId: string;
  encounterId: string;
  patientId: string;
  asOfValidTime: string;
  asOfTransactionTime: string;
  timeDimension?: TimeDimension;
  activeMedications?: Array<Record<string, unknown>>;
  allergies?: Array<Record<string, unknown>>;
  labResults?: Array<Record<string, unknown>>;
  vitalSigns?: Array<Record<string, unknown>>;
  diagnoses?: Array<Record<string, unknown>>;
  orders?: Array<Record<string, unknown>>;
  cdsDecisions?: Array<Record<string, unknown>>;
  eventCountReconstructed?: number;
}

export class TemporalSnapshotEntity {
  public readonly tenantId: string;
  public readonly encounterId: string;
  public readonly patientId: string;
  public readonly asOfValidTime: string;
  public readonly asOfTransactionTime: string;
  public readonly timeDimension: TimeDimension;
  public readonly activeMedications: Array<Record<string, unknown>>;
  public readonly allergies: Array<Record<string, unknown>>;
  public readonly labResults: Array<Record<string, unknown>>;
  public readonly vitalSigns: Array<Record<string, unknown>>;
  public readonly diagnoses: Array<Record<string, unknown>>;
  public readonly orders: Array<Record<string, unknown>>;
  public readonly cdsDecisions: Array<Record<string, unknown>>;
  public readonly eventCountReconstructed: number;

  constructor(params: TemporalSnapshotParams) {
    this.tenantId = params.tenantId;
    this.encounterId = params.encounterId;
    this.patientId = params.patientId;
    this.asOfValidTime = params.asOfValidTime;
    this.asOfTransactionTime = params.asOfTransactionTime;
    this.timeDimension = params.timeDimension || 'VALID_TIME';
    this.activeMedications = params.activeMedications || [];
    this.allergies = params.allergies || [];
    this.labResults = params.labResults || [];
    this.vitalSigns = params.vitalSigns || [];
    this.diagnoses = params.diagnoses || [];
    this.orders = params.orders || [];
    this.cdsDecisions = params.cdsDecisions || [];
    this.eventCountReconstructed = params.eventCountReconstructed || 0;
  }

  public toDTO(): ITemporalStateSnapshot {
    return {
      tenantId: this.tenantId,
      encounterId: this.encounterId,
      patientId: this.patientId,
      asOfValidTime: this.asOfValidTime,
      asOfTransactionTime: this.asOfTransactionTime,
      timeDimension: this.timeDimension,
      activeMedications: this.activeMedications,
      allergies: this.allergies,
      labResults: this.labResults,
      vitalSigns: this.vitalSigns,
      diagnoses: this.diagnoses,
      orders: this.orders,
      cdsDecisions: this.cdsDecisions,
      eventCountReconstructed: this.eventCountReconstructed,
    };
  }
}
