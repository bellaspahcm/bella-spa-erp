/**
 * Encounter Engine Contract
 * 
 * Contract definition for Encounter Engine (Healthcare Platform).
 * Defines API endpoints, events, and schemas for encounter management operations.
 * 
 * Constitution Compliance:
 * - Law 1: Encounter is the Aggregate Root
 * - Law 3: Engine decoupled from Hospital (contract-based consumption)
 * - Law 5: Event-First Architecture (11 domain events)
 * - Law 8: Contract registered in Contract Registry
 * - Law 11: Strictly typed, no `any`
 * 
 * @module platform/healthcare/contracts/encounter-engine
 */

import type { ContractMetadata } from '../../host/contract-registry/types';

// ============================================================================
// Encounter Engine Contract Metadata (for Contract Registry)
// ============================================================================

export const ENCOUNTER_ENGINE_CONTRACT: ContractMetadata = {
  name: 'encounter-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Encounter management engine - Healthcare Platform aggregate root',
  owner: 'Healthcare Platform Team',
  status: 'active',
  
  // ==========================================================================
  // API Endpoints
  // ==========================================================================
  endpoints: [
    {
      path: '/api/encounter-engine/create',
      method: 'POST',
      operationId: 'createEncounter',
      summary: 'Create a new encounter',
      requestSchema: {
        schemaId: 'encounter-create-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'patientId', 'encounterClass', 'encounterType', 'userId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            encounterClass: { type: 'string', enum: ['AMB', 'EMER', 'IMP', 'OBSENC', 'VR', 'HH'] },
            encounterType: { type: 'string' },
            departmentId: { type: 'string', format: 'uuid' },
            locationId: { type: 'string', format: 'uuid' },
            priority: { type: 'string', enum: ['stat', 'urgent', 'routine', 'elective'] },
            userId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'encounter-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['nurse', 'doctor', 'receptionist', 'admin'] }],
    },
    {
      path: '/api/encounter-engine/update-status',
      method: 'POST',
      operationId: 'updateEncounterStatus',
      summary: 'Update encounter status (state transitions)',
      requestSchema: {
        schemaId: 'encounter-update-status-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'encounterId', 'status', 'userId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['planned', 'arrived', 'triaged', 'in-progress', 'on-hold', 'finished', 'cancelled'] },
            reason: { type: 'string' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'encounter-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['nurse', 'doctor', 'admin'] }],
    },
    {
      path: '/api/encounter-engine/add-diagnosis',
      method: 'POST',
      operationId: 'addDiagnosis',
      summary: 'Add diagnosis to encounter',
      requestSchema: {
        schemaId: 'encounter-add-diagnosis-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'encounterId', 'code', 'system', 'isPrimary', 'userId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            code: { type: 'string' },
            system: { type: 'string', enum: ['ICD-10', 'ICD-9', 'SNOMED-CT'] },
            display: { type: 'string' },
            isPrimary: { type: 'boolean' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'encounter-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['doctor', 'admin'] }],
    },
    {
      path: '/api/encounter-engine/assign-provider',
      method: 'POST',
      operationId: 'assignProvider',
      summary: 'Assign healthcare provider to encounter',
      requestSchema: {
        schemaId: 'encounter-assign-provider-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'encounterId', 'providerId', 'role', 'userId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            providerId: { type: 'string', format: 'uuid' },
            role: { type: 'string', enum: ['attending', 'consulting', 'referring', 'admitting', 'primary'] },
            userId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'encounter-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['doctor', 'nurse', 'admin'] }],
    },
    {
      path: '/api/encounter-engine/transfer',
      method: 'POST',
      operationId: 'transferEncounter',
      summary: 'Transfer encounter to different department/location',
      requestSchema: {
        schemaId: 'encounter-transfer-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'encounterId', 'toDepartmentId', 'toLocationId', 'userId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            toDepartmentId: { type: 'string', format: 'uuid' },
            toLocationId: { type: 'string', format: 'uuid' },
            reason: { type: 'string' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'encounter-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['doctor', 'nurse', 'admin'] }],
    },
    {
      path: '/api/encounter-engine/search',
      method: 'POST',
      operationId: 'searchEncounters',
      summary: 'Search encounters by filters',
      requestSchema: {
        schemaId: 'encounter-search-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            encounterClass: { type: 'string' },
            departmentId: { type: 'string', format: 'uuid' },
            providerId: { type: 'string', format: 'uuid' },
            fromDate: { type: 'string', format: 'date-time' },
            toDate: { type: 'string', format: 'date-time' },
            limit: { type: 'integer', minimum: 1, maximum: 1000 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
      },
      responseSchema: {
        schemaId: 'encounter-search-response',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounters', 'total'],
          properties: {
            encounters: {
              type: 'array',
              items: { type: 'object' },
            },
            total: { type: 'integer' },
          },
        },
      },
      authentication: [{ type: 'bearer' }],
    },
  ],

  // ==========================================================================
  // Domain Events (11 events)
  // ==========================================================================
  events: [
    {
      eventType: 'EncounterCreated',
      version: '1.0.0',
      summary: 'Published when a new encounter is created',
      description: 'Triggers downstream workflows: patient registration confirmation, department notification, billing activation',
      payloadSchema: {
        schemaId: 'encounter-created-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'encounterType', 'encounterClass', 'status'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            encounterType: { type: 'string' },
            encounterClass: { type: 'string' },
            status: { type: 'string' },
            departmentId: { type: 'string', format: 'uuid' },
            locationId: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['billing-engine', 'notification-hub', 'analytics-engine'],
    },
    {
      eventType: 'EncounterArrived',
      version: '1.0.0',
      summary: 'Published when patient arrives for scheduled encounter',
      description: 'Triggers: queue activation, bed allocation (if inpatient), provider notification',
      payloadSchema: {
        schemaId: 'encounter-status-changed-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'status'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            status: { type: 'string', const: 'arrived' },
            arrivedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['queue-engine', 'bed-engine', 'notification-hub'],
    },
    {
      eventType: 'EncounterTriaged',
      version: '1.0.0',
      summary: 'Published when patient is triaged (Emergency Department)',
      description: 'Triggers: priority queue placement, resource allocation based on ESI level',
      payloadSchema: {
        schemaId: 'encounter-status-changed-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'status'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            status: { type: 'string', const: 'triaged' },
            triageLevel: { type: 'integer', minimum: 1, maximum: 5 },
            triagedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['emergency-engine', 'queue-engine'],
    },
    {
      eventType: 'EncounterStarted',
      version: '1.0.0',
      summary: 'Published when clinical encounter begins (patient with provider)',
      description: 'Triggers: clinical timer start, documentation workflow activation',
      payloadSchema: {
        schemaId: 'encounter-status-changed-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'status'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            status: { type: 'string', const: 'in-progress' },
            startedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['clinical-engine', 'analytics-engine'],
    },
    {
      eventType: 'EncounterHeld',
      version: '1.0.0',
      summary: 'Published when encounter is put on hold',
      description: 'Triggers: timer pause, notification to patient/provider',
      payloadSchema: {
        schemaId: 'encounter-status-changed-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'status'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            status: { type: 'string', const: 'on-hold' },
            holdReason: { type: 'string' },
            heldAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['notification-hub'],
    },
    {
      eventType: 'EncounterResumed',
      version: '1.0.0',
      summary: 'Published when encounter resumes from hold',
      description: 'Triggers: timer resume, workflow reactivation',
      payloadSchema: {
        schemaId: 'encounter-status-changed-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'status'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            status: { type: 'string', const: 'in-progress' },
            resumedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['clinical-engine'],
    },
    {
      eventType: 'EncounterFinished',
      version: '1.0.0',
      summary: 'Published when encounter is completed',
      description: 'Triggers: final billing, bed release (if inpatient), discharge workflow',
      payloadSchema: {
        schemaId: 'encounter-status-changed-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'status'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            status: { type: 'string', const: 'finished' },
            finishedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['billing-engine', 'bed-engine', 'analytics-engine'],
    },
    {
      eventType: 'EncounterCancelled',
      version: '1.0.0',
      summary: 'Published when encounter is cancelled',
      description: 'Triggers: cancellation fee processing (if applicable), resource release',
      payloadSchema: {
        schemaId: 'encounter-cancelled-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'status', 'cancellationReason'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            status: { type: 'string', const: 'cancelled' },
            cancellationReason: { type: 'string' },
            cancelledAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['billing-engine', 'notification-hub', 'analytics-engine'],
    },
    {
      eventType: 'DiagnosisAdded',
      version: '1.0.0',
      summary: 'Published when diagnosis is added to encounter',
      description: 'Triggers: clinical pathway activation, billing adjustment, quality metrics update',
      payloadSchema: {
        schemaId: 'diagnosis-added-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'diagnosisCode', 'diagnosisSystem'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            diagnosisCode: { type: 'string' },
            diagnosisSystem: { type: 'string', enum: ['ICD-10', 'ICD-9', 'SNOMED-CT'] },
            diagnosisDisplay: { type: 'string' },
            isPrimary: { type: 'boolean' },
            recordedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['clinical-engine', 'billing-engine', 'analytics-engine'],
    },
    {
      eventType: 'ProviderAssigned',
      version: '1.0.0',
      summary: 'Published when healthcare provider is assigned to encounter',
      description: 'Triggers: provider dashboard update, billing authorization, notification',
      payloadSchema: {
        schemaId: 'provider-assigned-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'providerId', 'role'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            providerId: { type: 'string', format: 'uuid' },
            role: { type: 'string', enum: ['attending', 'consulting', 'referring', 'admitting', 'primary'] },
            assignedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['notification-hub', 'analytics-engine'],
    },
    {
      eventType: 'EncounterTransferred',
      version: '1.0.0',
      summary: 'Published when encounter is transferred between departments',
      description: 'Triggers: bed transfer, nursing handover, billing adjustment, location update',
      payloadSchema: {
        schemaId: 'encounter-transferred-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['encounterId', 'patientId', 'toDepartmentId', 'toLocationId'],
          properties: {
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            fromDepartmentId: { type: 'string', format: 'uuid' },
            toDepartmentId: { type: 'string', format: 'uuid' },
            toLocationId: { type: 'string', format: 'uuid' },
            transferReason: { type: 'string' },
            transferredAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      publisher: 'encounter-engine',
      subscribers: ['bed-engine', 'nursing-engine', 'billing-engine', 'notification-hub'],
    },
  ],

  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
