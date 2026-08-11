/**
 * Encounter Engine Contract Definition
 * 
 * @layer Healthcare Platform → Contract Registry
 * @責任 Define API contract, events, permissions for Encounter Engine
 * 
 * Contract Registry ensures:
 * - Version compatibility
 * - Breaking change detection
 * - Permission enforcement
 * - Event schema validation
 */

/**
 * ✅ Phase 3 - Encounter Engine Contract
 * 
 * Đăng ký vào Contract Registry để:
 * 1. Hospital (và các Product Packs khác) biết cách gọi
 * 2. Platform kiểm tra version compatibility
 * 3. Permission được enforce tự động
 * 4. Event schema được validate
 */
export const EncounterEngineContract = {
  engineId: 'encounter-engine',
  engineName: 'Encounter Engine',
  version: '1.0.0',
  description: 'Core encounter (visit) management engine for all healthcare products',
  
  /**
   * Capabilities provided by this engine
   */
  capabilities: [
    'encounter.create',
    'encounter.read',
    'encounter.update',
    'encounter.search',
    'encounter.status.transition',
    'encounter.diagnosis.add',
    'encounter.provider.assign',
    'encounter.transfer',
  ],

  /**
   * API Methods
   */
  methods: [
    {
      name: 'createEncounter',
      description: 'Create a new encounter (visit)',
      permissions: ['encounter.create'],
      requestSchema: {
        type: 'object',
        required: ['tenantId', 'patientId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          encounterClass: { 
            type: 'string', 
            enum: ['inpatient', 'outpatient', 'ambulatory', 'emergency', 'observation', 'home_health', 'virtual']
          },
          encounterType: {
            type: 'string',
            enum: ['initial_visit', 'follow_up', 'annual_checkup', 'emergency', 'procedure', 'consultation', 'other']
          },
          priority: {
            type: 'string',
            enum: ['routine', 'urgent', 'emergency', 'elective']
          },
          serviceType: { type: 'string' },
          admittingProviderId: { type: 'string', format: 'uuid' },
          admittingDepartmentId: { type: 'string', format: 'uuid' },
          chiefComplaint: { type: 'string' },
          referralSource: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      responseSchema: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          encounter: { type: 'object' },
          error: { type: 'string' },
        },
      },
    },
    {
      name: 'updateStatus',
      description: 'Update encounter status (state transition)',
      permissions: ['encounter.status.transition'],
      requestSchema: {
        type: 'object',
        required: ['tenantId', 'encounterId', 'status', 'userId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          encounterId: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['registered', 'arrived', 'triaged', 'in_progress', 'on_hold', 'finished', 'cancelled']
          },
          reason: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      responseSchema: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          encounter: { type: 'object' },
          error: { type: 'string' },
        },
      },
    },
    {
      name: 'addDiagnosis',
      description: 'Add diagnosis (ICD-10/ICD-11) to encounter',
      permissions: ['encounter.diagnosis.add'],
      requestSchema: {
        type: 'object',
        required: ['tenantId', 'encounterId', 'code', 'system', 'userId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          encounterId: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          system: { type: 'string', enum: ['ICD-10', 'ICD-11', 'SNOMED-CT'] },
          display: { type: 'string' },
          isPrimary: { type: 'boolean' },
          onsetDate: { type: 'string', format: 'date-time' },
          clinicalStatus: { type: 'string' },
          verificationStatus: { type: 'string' },
          notes: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      responseSchema: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          encounter: { type: 'object' },
          error: { type: 'string' },
        },
      },
    },
    {
      name: 'assignProvider',
      description: 'Assign provider to encounter',
      permissions: ['encounter.provider.assign'],
      requestSchema: {
        type: 'object',
        required: ['tenantId', 'encounterId', 'providerId', 'role', 'userId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          encounterId: { type: 'string', format: 'uuid' },
          providerId: { type: 'string', format: 'uuid' },
          role: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      responseSchema: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          encounter: { type: 'object' },
          error: { type: 'string' },
        },
      },
    },
    {
      name: 'transferEncounter',
      description: 'Transfer encounter to another department/location',
      permissions: ['encounter.transfer'],
      requestSchema: {
        type: 'object',
        required: ['tenantId', 'encounterId', 'userId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          encounterId: { type: 'string', format: 'uuid' },
          toDepartmentId: { type: 'string', format: 'uuid' },
          toLocationId: { type: 'string', format: 'uuid' },
          reason: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      responseSchema: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          encounter: { type: 'object' },
          error: { type: 'string' },
        },
      },
    },
    {
      name: 'getEncounter',
      description: 'Get encounter by ID',
      permissions: ['encounter.read'],
      requestSchema: {
        type: 'object',
        required: ['tenantId', 'encounterId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          encounterId: { type: 'string', format: 'uuid' },
        },
      },
      responseSchema: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          encounter: { type: 'object' },
          error: { type: 'string' },
        },
      },
    },
    {
      name: 'searchEncounters',
      description: 'Search encounters with filters',
      permissions: ['encounter.search'],
      requestSchema: {
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
          limit: { type: 'number', minimum: 1, maximum: 100 },
          offset: { type: 'number', minimum: 0 },
        },
      },
      responseSchema: {
        type: 'object',
        required: ['success', 'encounters', 'total'],
        properties: {
          success: { type: 'boolean' },
          encounters: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
          error: { type: 'string' },
        },
      },
    },
  ],

  /**
   * Domain Events Published by Encounter Engine
   * 
   * Subscribers:
   * - Bed Engine (allocate bed on admission)
   * - Billing Engine (start billing clock)
   * - Nursing Engine (create care plan)
   * - Order Engine (enable ordering)
   * - Notification (notify patient/family)
   * - AI Engine (predictive analytics)
   * - Audit (compliance logging)
   */
  events: [
    {
      eventType: 'EncounterCreated',
      version: '1.0.0',
      description: 'New encounter registered in system',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId', 'encounterClass', 'status'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          encounterNumber: { type: 'string' },
          encounterClass: { type: 'string' },
          encounterType: { type: 'string' },
          priority: { type: 'string' },
          status: { type: 'string' },
          admittingProviderId: { type: 'string', format: 'uuid' },
          admittingDepartmentId: { type: 'string', format: 'uuid' },
          chiefComplaint: { type: 'string' },
          registeredAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    {
      eventType: 'EncounterArrived',
      version: '1.0.0',
      description: 'Patient arrived for encounter',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId', 'arrivedAt'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          arrivedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    {
      eventType: 'EncounterTriaged',
      version: '1.0.0',
      description: 'Encounter triaged (ESI score assigned)',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId', 'triagedAt'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          triagedAt: { type: 'string', format: 'date-time' },
          priority: { type: 'string' },
        },
      },
    },
    {
      eventType: 'EncounterStarted',
      version: '1.0.0',
      description: 'Clinical care started',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId', 'startedAt'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          startedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    {
      eventType: 'EncounterHeld',
      version: '1.0.0',
      description: 'Encounter placed on hold',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
        },
      },
    },
    {
      eventType: 'EncounterResumed',
      version: '1.0.0',
      description: 'Encounter resumed from hold',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
        },
      },
    },
    {
      eventType: 'EncounterFinished',
      version: '1.0.0',
      description: 'Encounter completed',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId', 'finishedAt'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          finishedAt: { type: 'string', format: 'date-time' },
          duration: { type: 'number' },
        },
      },
    },
    {
      eventType: 'EncounterCancelled',
      version: '1.0.0',
      description: 'Encounter cancelled',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId', 'cancelledAt'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          cancelledAt: { type: 'string', format: 'date-time' },
          cancellationReason: { type: 'string' },
        },
      },
    },
    {
      eventType: 'DiagnosisAdded',
      version: '1.0.0',
      description: 'Diagnosis added to encounter',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId', 'code', 'system'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          system: { type: 'string' },
          display: { type: 'string' },
          isPrimary: { type: 'boolean' },
        },
      },
    },
    {
      eventType: 'ProviderAssigned',
      version: '1.0.0',
      description: 'Provider assigned to encounter',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId', 'providerId', 'role'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          providerId: { type: 'string', format: 'uuid' },
          role: { type: 'string' },
        },
      },
    },
    {
      eventType: 'EncounterTransferred',
      version: '1.0.0',
      description: 'Encounter transferred to different department/location',
      schema: {
        type: 'object',
        required: ['encounterId', 'patientId'],
        properties: {
          encounterId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          fromDepartmentId: { type: 'string', format: 'uuid' },
          toDepartmentId: { type: 'string', format: 'uuid' },
          fromLocationId: { type: 'string', format: 'uuid' },
          toLocationId: { type: 'string', format: 'uuid' },
          reason: { type: 'string' },
        },
      },
    },
  ],

  /**
   * Dependencies on other engines
   */
  dependencies: [
    {
      engineId: 'mpi-engine',
      version: '>=1.0.0',
      reason: 'Patient identity resolution',
    },
  ],

  /**
   * Platform requirements
   */
  platformRequirements: {
    eventBus: true,
    contractRegistry: true,
    capabilityRegistry: true,
    auditLog: true,
    tenantIsolation: true,
  },
};
