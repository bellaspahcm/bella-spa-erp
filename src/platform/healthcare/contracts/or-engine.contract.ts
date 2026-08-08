/**
 * Operating Room Engine Contract
 * 
 * Contract definition for OR Engine (Healthcare Platform).
 * 
 * @module platform/healthcare/contracts/or-engine
 */

import type { EngineContract, EngineResponse } from '../shared-kernel/types';
import type { ContractMetadata } from '../../host/contract-registry/types';

export interface OROperationScheduleRequest {
  tenantId: string;
  operatingRoomId: string;
  scheduledTimeRange: string; // Range format like '[2026-08-08 10:00:00+00, 2026-08-08 11:00:00+00)'
  notes?: string;
  requestId?: string; // Idempotency key
  userId?: string;
}

export interface OROperationRescheduleRequest {
  tenantId: string;
  scheduleId: string;
  newTimeRange: string;
  requestId?: string; // Idempotency key
  userId?: string;
}

export interface ORSchedule {
  id: string;
  tenantId: string;
  operatingRoomId: string;
  scheduledTimeRange: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OREngineContract extends EngineContract {
  scheduleOperation(request: OROperationScheduleRequest): Promise<EngineResponse<ORSchedule>>;
  rescheduleOperation(request: OROperationRescheduleRequest): Promise<EngineResponse<ORSchedule>>;
  cancelSchedule(tenantId: string, scheduleId: string, notes?: string): Promise<EngineResponse<ORSchedule>>;
  checkAvailability(tenantId: string, operatingRoomId: string, startAt: string, endAt: string, excludeScheduleId?: string): Promise<EngineResponse<{ available: boolean }>>;
}

export const OR_ENGINE_CONTRACT: ContractMetadata = {
  name: 'or-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Operating Room scheduling and availability engine',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [
    {
      eventType: 'hos.or.scheduled.v1',
      version: '1.0.0',
      summary: 'Published when an OR schedule is created',
      payloadSchema: { schemaId: 'or-scheduled-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'or-engine',
      subscribers: ['or-readiness-engine'],
    },
    {
      eventType: 'hos.or.rescheduled.v1',
      version: '1.0.0',
      summary: 'Published when an OR schedule is modified',
      payloadSchema: { schemaId: 'or-rescheduled-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'or-engine',
      subscribers: ['or-readiness-engine'],
    },
    {
      eventType: 'hos.or.cancelled.v1',
      version: '1.0.0',
      summary: 'Published when an OR schedule is cancelled',
      payloadSchema: { schemaId: 'or-cancelled-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'or-engine',
      subscribers: ['or-readiness-engine'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
