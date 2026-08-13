/**
 * Temporal Event Domain Entity — Phase H9 Temporal Engine
 *
 * Represents an immutable bitemporal event entry in the clinical timeline.
 * Enforces Law 11 zero `any` types.
 *
 * @module platform/healthcare/engines/temporal-engine/domain/temporal-event.entity
 */

import { BitemporalClock } from './bitemporal-clock.vo';
import type { HealthcareAggregateType, ITemporalEventRecord } from '../../../contracts/temporal-engine.contract';

export interface TemporalEventParams {
  id: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  aggregateType: HealthcareAggregateType;
  aggregateId: string;
  eventType: string;
  validTime: string;
  transactionTime?: string;
  sequenceNumber: number;
  deltaPayload: Record<string, unknown>;
  createdAt?: string;
}

export class TemporalEventEntity {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly encounterId: string;
  public readonly patientId: string;
  public readonly aggregateType: HealthcareAggregateType;
  public readonly aggregateId: string;
  public readonly eventType: string;
  public readonly clock: BitemporalClock;
  public readonly sequenceNumber: number;
  public readonly deltaPayload: Record<string, unknown>;
  public readonly createdAt: string;

  constructor(params: TemporalEventParams) {
    if (!params.tenantId) throw new Error('Tenant ID is required for TemporalEventEntity');
    if (!params.encounterId) throw new Error('Encounter ID is required for TemporalEventEntity');
    if (!params.patientId) throw new Error('Patient ID is required for TemporalEventEntity');
    if (!params.aggregateId) throw new Error('Aggregate ID is required for TemporalEventEntity');

    this.id = params.id;
    this.tenantId = params.tenantId;
    this.encounterId = params.encounterId;
    this.patientId = params.patientId;
    this.aggregateType = params.aggregateType;
    this.aggregateId = params.aggregateId;
    this.eventType = params.eventType;
    this.clock = new BitemporalClock(params.validTime, params.transactionTime);
    this.sequenceNumber = params.sequenceNumber;
    this.deltaPayload = params.deltaPayload;
    this.createdAt = params.createdAt || new Date().toISOString();
  }

  public toRecord(): ITemporalEventRecord {
    return {
      id: this.id,
      tenantId: this.tenantId,
      encounterId: this.encounterId,
      patientId: this.patientId,
      aggregateType: this.aggregateType,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      validTime: this.clock.validTime,
      transactionTime: this.clock.transactionTime,
      sequenceNumber: this.sequenceNumber,
      deltaPayload: this.deltaPayload,
      createdAt: this.createdAt,
    };
  }
}
