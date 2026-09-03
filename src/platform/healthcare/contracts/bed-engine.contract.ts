/**
 * Bed Engine Contract
 * 
 * Contract definition for Bed Engine (Healthcare Platform).
 * Defines API endpoints, events, and schemas for bed management operations.
 * 
 * Constitution Compliance:
 * - Law 1: All operations reference Encounter aggregate root
 * - Law 3: Engine decoupled from Hospital (contract-based consumption)
 * - Law 8: Contract registered in Contract Registry
 * 
 * @module platform/healthcare/contracts/bed-engine
 */

import type { EngineContract, EngineResponse, EngineHealthStatus, Bed, BedType, BedStatus } from '../shared-kernel/types';
import type { ContractMetadata } from '../../host/contract-registry/types';

// ============================================================================
// Request/Response Types
// ============================================================================

export interface BedAllocationRequest {
  tenantId: string;
  encounterId: string; // Law 1: Encounter aggregate root
  patientId: string;
  admissionId: string;
  wardId: string;
  bedType?: BedType;
  preferredBedId?: string;
  features?: string[]; // Required bed features
  priority?: 'stat' | 'urgent' | 'routine';
  requestedBy: string; // User ID
  reason?: string;
}

export interface BedReleaseRequest {
  tenantId: string;
  bedId: string;
  encounterId: string; // Law 1: Encounter aggregate root
  patientId: string;
  admissionId: string;
  reason: 'discharge' | 'transfer' | 'death' | 'other';
  releasedBy: string; // User ID
  notes?: string;
}

export interface BedTransferRequest {
  tenantId: string;
  fromBedId: string;
  toBedId: string;
  encounterId: string; // Law 1: Encounter aggregate root
  patientId: string;
  admissionId: string;
  reason: string;
  transferredBy: string; // User ID
  scheduledTime?: string; // ISO 8601 datetime
  notes?: string;
}

export interface BedQueryRequest {
  tenantId: string;
  wardId?: string;
  bedType?: BedType;
  status?: BedStatus;
  features?: string[];
  assignedPatientId?: string;
}

// ============================================================================
// Bed Engine Contract Interface
// ============================================================================

export interface BedEngineContract extends EngineContract {
  /**
   * Allocate a bed to a patient
   * 
   * @param request - Bed allocation request
   * @returns Allocated bed
   * @throws Error if no beds available or allocation fails
   */
  allocateBed(request: BedAllocationRequest): Promise<EngineResponse<Bed>>;

  /**
   * Release a bed (patient discharged or transferred out)
   * 
   * @param request - Bed release request
   * @returns Released bed
   * @throws Error if bed not found or release fails
   */
  releaseBed(request: BedReleaseRequest): Promise<EngineResponse<Bed>>;

  /**
   * Transfer patient from one bed to another
   * 
   * @param request - Bed transfer request
   * @returns Transfer result with both beds
   * @throws Error if transfer fails
   */
  transferBed(request: BedTransferRequest): Promise<EngineResponse<{
    fromBed: Bed;
    toBed: Bed;
    transferId: string;
  }>>;

  /**
   * Query available beds
   * 
   * @param request - Bed query filters
   * @returns Array of matching beds
   */
  queryBeds(request: BedQueryRequest): Promise<EngineResponse<Bed[]>>;

  healthCheck(): Promise<EngineHealthStatus>;

  /**
   * Get bed details by ID
   * 
   * @param tenantId - Tenant ID
   * @param bedId - Bed ID
   * @returns Bed details
   * @throws Error if bed not found
   */
  getBedById(tenantId: string, bedId: string): Promise<EngineResponse<Bed>>;
}

// ============================================================================
// Bed Engine Events
// ============================================================================

export interface BedAllocatedEvent {
  eventType: 'BedAllocated';
  version: '1.0.0';
  timestamp: string;
  tenantId: string;
  aggregateId: string; // encounterId (Law 1)
  aggregateType: 'encounter';
  payload: {
    bedId: string;
    patientId: string;
    admissionId: string;
    wardId: string;
    bedType: BedType;
    allocatedBy: string;
  };
}

export interface BedReleasedEvent {
  eventType: 'BedReleased';
  version: '1.0.0';
  timestamp: string;
  tenantId: string;
  aggregateId: string; // encounterId (Law 1)
  aggregateType: 'encounter';
  payload: {
    bedId: string;
    patientId: string;
    admissionId: string;
    reason: string;
    releasedBy: string;
  };
}

export interface BedTransferredEvent {
  eventType: 'BedTransferred';
  version: '1.0.0';
  timestamp: string;
  tenantId: string;
  aggregateId: string; // encounterId (Law 1)
  aggregateType: 'encounter';
  payload: {
    fromBedId: string;
    toBedId: string;
    patientId: string;
    admissionId: string;
    transferId: string;
    reason: string;
    transferredBy: string;
  };
}

// ============================================================================
// Contract Metadata (for Contract Registry)
// ============================================================================

export const BED_ENGINE_CONTRACT: ContractMetadata = {
  name: 'bed-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Bed management engine for hospital inpatient operations',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [
    {
      path: '/api/bed-engine/allocate',
      method: 'POST',
      operationId: 'allocateBed',
      summary: 'Allocate a bed to a patient',
      requestSchema: {
        schemaId: 'bed-allocation-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'encounterId', 'patientId', 'admissionId', 'wardId', 'requestedBy'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            admissionId: { type: 'string', format: 'uuid' },
            wardId: { type: 'string', format: 'uuid' },
            bedType: { type: 'string', enum: ['standard', 'icu', 'isolation', 'maternity', 'pediatric', 'psychiatric'] },
            preferredBedId: { type: 'string', format: 'uuid' },
            features: { type: 'array', items: { type: 'string' } },
            priority: { type: 'string', enum: ['stat', 'urgent', 'routine'] },
            requestedBy: { type: 'string', format: 'uuid' },
            reason: { type: 'string' },
          },
        },
      },
      responseSchema: {
        schemaId: 'bed',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['nurse', 'doctor', 'admin'] }],
    },
    {
      path: '/api/bed-engine/release',
      method: 'POST',
      operationId: 'releaseBed',
      summary: 'Release a bed (discharge or transfer)',
      requestSchema: {
        schemaId: 'bed-release-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'bedId', 'encounterId', 'patientId', 'admissionId', 'reason', 'releasedBy'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            bedId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            admissionId: { type: 'string', format: 'uuid' },
            reason: { type: 'string', enum: ['discharge', 'transfer', 'death', 'other'] },
            releasedBy: { type: 'string', format: 'uuid' },
            notes: { type: 'string' },
          },
        },
      },
      responseSchema: {
        schemaId: 'bed',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['nurse', 'doctor', 'admin'] }],
    },
    {
      path: '/api/bed-engine/transfer',
      method: 'POST',
      operationId: 'transferBed',
      summary: 'Transfer patient from one bed to another',
      requestSchema: {
        schemaId: 'bed-transfer-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'fromBedId', 'toBedId', 'encounterId', 'patientId', 'admissionId', 'reason', 'transferredBy'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            fromBedId: { type: 'string', format: 'uuid' },
            toBedId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            admissionId: { type: 'string', format: 'uuid' },
            reason: { type: 'string' },
            transferredBy: { type: 'string', format: 'uuid' },
            scheduledTime: { type: 'string', format: 'date-time' },
            notes: { type: 'string' },
          },
        },
      },
      responseSchema: {
        schemaId: 'bed-transfer-result',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['fromBed', 'toBed', 'transferId'],
          properties: {
            fromBed: { type: 'object' },
            toBed: { type: 'object' },
            transferId: { type: 'string', format: 'uuid' },
          },
        },
      },
      authentication: [{ type: 'bearer', roles: ['nurse', 'doctor', 'admin'] }],
    },
    {
      path: '/api/bed-engine/query',
      method: 'POST',
      operationId: 'queryBeds',
      summary: 'Query beds by filters',
      requestSchema: {
        schemaId: 'bed-query-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            wardId: { type: 'string', format: 'uuid' },
            bedType: { type: 'string' },
            status: { type: 'string' },
            features: { type: 'array', items: { type: 'string' } },
            assignedPatientId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'bed-array',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      authentication: [{ type: 'bearer' }],
    },
  ],
  events: [
    {
      eventType: 'BedAllocated',
      version: '1.0.0',
      summary: 'Published when a bed is allocated to a patient',
      description: 'Triggers downstream workflows: billing activation, nursing assignment, dietary orders',
      payloadSchema: {
        schemaId: 'bed-allocated-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['bedId', 'patientId', 'admissionId', 'wardId', 'bedType', 'allocatedBy'],
          properties: {
            bedId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            admissionId: { type: 'string', format: 'uuid' },
            wardId: { type: 'string', format: 'uuid' },
            bedType: { type: 'string' },
            allocatedBy: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'bed-engine',
      subscribers: ['billing-engine', 'nursing-engine', 'notification-hub'],
    },
    {
      eventType: 'BedReleased',
      version: '1.0.0',
      summary: 'Published when a bed is released (discharge or transfer)',
      description: 'Triggers downstream workflows: final billing, bed cleaning, capacity update',
      payloadSchema: {
        schemaId: 'bed-released-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['bedId', 'patientId', 'admissionId', 'reason', 'releasedBy'],
          properties: {
            bedId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            admissionId: { type: 'string', format: 'uuid' },
            reason: { type: 'string' },
            releasedBy: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'bed-engine',
      subscribers: ['billing-engine', 'housekeeping-engine', 'capacity-engine'],
    },
    {
      eventType: 'BedTransferred',
      version: '1.0.0',
      summary: 'Published when a patient is transferred between beds',
      description: 'Triggers downstream workflows: billing adjustment, nursing handover, location update',
      payloadSchema: {
        schemaId: 'bed-transferred-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['fromBedId', 'toBedId', 'patientId', 'admissionId', 'transferId', 'reason', 'transferredBy'],
          properties: {
            fromBedId: { type: 'string', format: 'uuid' },
            toBedId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            admissionId: { type: 'string', format: 'uuid' },
            transferId: { type: 'string', format: 'uuid' },
            reason: { type: 'string' },
            transferredBy: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'bed-engine',
      subscribers: ['billing-engine', 'nursing-engine', 'notification-hub'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};



