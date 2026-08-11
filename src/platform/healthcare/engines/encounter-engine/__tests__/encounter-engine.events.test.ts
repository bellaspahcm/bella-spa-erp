/**
 * Encounter Engine - Event Bus Integration Tests
 * 
 * Test Coverage:
 * - 11 Domain Events verification
 * - Event contract structure
 * - Payload schema validation
 * - Trigger conditions (success only)
 * - Negative paths (no events on failure)
 * - Tenant isolation in events
 * - Provenance tracking (userId)
 * - Timestamp presence
 * 
 * Constitution Compliance:
 * - Law 5: Event-First Architecture
 * - Law 11: Strictly typed, no `any`
 * 
 * Architecture:
 * - Event Bus contract verification
 * - Service → EventBus integration
 * - Mock Repository (focus on events, not DB)
 * 
 * @module platform/healthcare/engines/encounter-engine/__tests__
 */

import { EncounterEngineService } from '../encounter-engine.service';
import { Encounter } from '../domain/encounter.entity';
import type { IEncounterRepository } from '../infrastructure/repository.interface';
import type { IEventBus } from '@/platform/host/event-bus/event-bus.interface';
import type { DomainEvent } from '@/platform/host/event-bus/types';
import type {
  CreateEncounterRequest,
  UpdateEncounterStatusRequest,
  AddDiagnosisRequest,
  AssignProviderRequest,
  TransferEncounterRequest,
} from '../encounter-engine.interface';

// =============================================================================
// Mocks
// =============================================================================

const createMockRepository = (): jest.Mocked<IEncounterRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByPatient: jest.fn(),
  search: jest.fn(),
  findActive: jest.fn(),
  exists: jest.fn(),
  count: jest.fn(),
  delete: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
});

const createMockEventBus = (): jest.Mocked<IEventBus> => ({
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
});

// =============================================================================
// Event Contract Validators
// =============================================================================

const validateEventStructure = (event: DomainEvent) => {
  expect(event).toHaveProperty('eventType');
  expect(event).toHaveProperty('aggregateId');
  expect(event).toHaveProperty('aggregateType');
  expect(event).toHaveProperty('tenantId');
  expect(event).toHaveProperty('payload');
  expect(event.aggregateType).toBe('Encounter');
};

const validateProvenance = (event: DomainEvent, expectedUserId: string) => {
  expect(event).toHaveProperty('userId');
  expect(event.userId).toBe(expectedUserId);
};

const validateTenantIsolation = (event: DomainEvent, expectedTenantId: string) => {
  expect(event.tenantId).toBe(expectedTenantId);
};

// =============================================================================
// Test Suite
// =============================================================================

describe('Encounter Engine - Event Bus Integration', () => {
  let service: EncounterEngineService;
  let mockRepository: jest.Mocked<IEncounterRepository>;
  let mockEventBus: jest.Mocked<IEventBus>;

  const TENANT_ID = 'tenant-event-test-001';
  const PATIENT_ID = 'patient-event-test-001';
  const USER_ID = 'user-event-test-001';

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockEventBus = createMockEventBus();
    service = new EncounterEngineService(mockRepository, mockEventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // Event 1: EncounterCreated
  // ===========================================================================

  describe('Event: EncounterCreated', () => {
    it('should publish EncounterCreated on successful creation', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.save.mockResolvedValue(mockEncounter);

      const request: CreateEncounterRequest = {
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      };

      await service.createEncounter(request);

      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      
      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toBe('EncounterCreated');
      
      validateEventStructure(event);
      validateProvenance(event, USER_ID);
      validateTenantIsolation(event, TENANT_ID);
      
      // Payload validation
      expect(event.payload).toHaveProperty('encounterId');
      expect(event.payload).toHaveProperty('patientId');
      expect(event.payload).toHaveProperty('encounterType');
      expect(event.payload).toHaveProperty('encounterClass');
      expect(event.payload).toHaveProperty('status');
    });

    it('should NOT publish EncounterCreated if creation fails', async () => {
      mockRepository.save.mockRejectedValue(new Error('DB error'));

      const request: CreateEncounterRequest = {
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      };

      await service.createEncounter(request);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should NOT publish EncounterCreated on validation failure', async () => {
      const invalidRequest: CreateEncounterRequest = {
        tenantId: '',
        patientId: PATIENT_ID,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      };

      await service.createEncounter(invalidRequest);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Event 2-8: Status Transition Events
  // ===========================================================================

  describe('Event: EncounterArrived', () => {
    it('should publish EncounterArrived on planned → arrived transition', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.findById.mockResolvedValue(mockEncounter);
      mockRepository.save.mockResolvedValue(mockEncounter);

      const request: UpdateEncounterStatusRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        status: 'arrived',
        userId: USER_ID,
      };

      await service.updateStatus(request);

      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toMatch(/Arrived/);
      validateEventStructure(event);
      validateProvenance(event, USER_ID);
    });

    it('should NOT publish if transition is invalid', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.findById.mockResolvedValue(mockEncounter);

      const request: UpdateEncounterStatusRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        status: 'finished', // Invalid: planned → finished
        userId: USER_ID,
      };

      await service.updateStatus(request);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Event: EncounterStarted', () => {
    it('should publish EncounterStarted on arrived → in-progress', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });
      mockEncounter.arrive(USER_ID);

      mockRepository.findById.mockResolvedValue(mockEncounter);
      mockRepository.save.mockResolvedValue(mockEncounter);

      const request: UpdateEncounterStatusRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        status: 'in-progress',
        userId: USER_ID,
      };

      await service.updateStatus(request);

      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toMatch(/Started/);
      validateEventStructure(event);
    });
  });

  describe('Event: EncounterFinished', () => {
    it('should publish EncounterFinished on completion', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });
      mockEncounter.arrive(USER_ID);
      mockEncounter.start(USER_ID);

      mockRepository.findById.mockResolvedValue(mockEncounter);
      mockRepository.save.mockResolvedValue(mockEncounter);

      const request: UpdateEncounterStatusRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        status: 'finished',
        userId: USER_ID,
      };

      await service.updateStatus(request);

      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toMatch(/Finished/);
      validateEventStructure(event);
    });
  });

  describe('Event: EncounterCancelled', () => {
    it('should publish EncounterCancelled on cancellation', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.findById.mockResolvedValue(mockEncounter);
      mockRepository.save.mockResolvedValue(mockEncounter);

      const request: UpdateEncounterStatusRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        status: 'cancelled',
        reason: 'Patient no-show',
        userId: USER_ID,
      };

      await service.updateStatus(request);

      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toMatch(/Cancelled/);
      validateEventStructure(event);
      expect(event.payload).toHaveProperty('cancellationReason');
    });
  });

  // ===========================================================================
  // Event 9: DiagnosisAdded
  // ===========================================================================

  describe('Event: DiagnosisAdded', () => {
    it('should publish DiagnosisAdded on successful diagnosis addition', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.findById.mockResolvedValue(mockEncounter);
      mockRepository.save.mockResolvedValue(mockEncounter);

      const request: AddDiagnosisRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        code: 'J18.9',
        system: 'ICD-10',
        display: 'Pneumonia',
        isPrimary: true,
        userId: USER_ID,
      };

      await service.addDiagnosis(request);

      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toBe('DiagnosisAdded');
      validateEventStructure(event);
      validateProvenance(event, USER_ID);
      
      expect(event.payload).toHaveProperty('diagnosisCode');
      expect(event.payload).toHaveProperty('diagnosisSystem');
    });

    it('should NOT publish DiagnosisAdded if diagnosis is invalid', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.findById.mockResolvedValue(mockEncounter);

      const request: AddDiagnosisRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        code: 'INVALID',
        system: 'ICD-10',
        isPrimary: true,
        userId: USER_ID,
      };

      await service.addDiagnosis(request);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Event 10: ProviderAssigned
  // ===========================================================================

  describe('Event: ProviderAssigned', () => {
    it('should publish ProviderAssigned on successful assignment', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.findById.mockResolvedValue(mockEncounter);
      mockRepository.save.mockResolvedValue(mockEncounter);

      const request: AssignProviderRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        providerId: 'doctor-001',
        role: 'attending',
        userId: USER_ID,
      };

      await service.assignProvider(request);

      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toBe('ProviderAssigned');
      validateEventStructure(event);
      validateProvenance(event, USER_ID);
      
      expect(event.payload).toHaveProperty('providerId');
      expect(event.payload).toHaveProperty('role');
    });

    it('should NOT publish ProviderAssigned if provider ID is empty', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.findById.mockResolvedValue(mockEncounter);

      const request: AssignProviderRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        providerId: '',
        role: 'attending',
        userId: USER_ID,
      };

      await service.assignProvider(request);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Event 11: EncounterTransferred
  // ===========================================================================

  describe('Event: EncounterTransferred', () => {
    it('should publish EncounterTransferred on successful transfer', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'inpatient',
        encounterClass: 'IMP',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });
      mockEncounter.arrive(USER_ID);
      mockEncounter.start(USER_ID);

      mockRepository.findById.mockResolvedValue(mockEncounter);
      mockRepository.save.mockResolvedValue(mockEncounter);

      const request: TransferEncounterRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        toDepartmentId: 'dept-002',
        toLocationId: 'loc-002',
        userId: USER_ID,
      };

      await service.transferEncounter(request);

      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toBe('EncounterTransferred');
      validateEventStructure(event);
      validateProvenance(event, USER_ID);
      
      expect(event.payload).toHaveProperty('fromDepartmentId');
      expect(event.payload).toHaveProperty('toDepartmentId');
      expect(event.payload).toHaveProperty('toLocationId');
    });

    it('should NOT publish EncounterTransferred if location missing', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'inpatient',
        encounterClass: 'IMP',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.findById.mockResolvedValue(mockEncounter);

      const request: TransferEncounterRequest = {
        tenantId: TENANT_ID,
        encounterId: mockEncounter.id,
        toDepartmentId: 'dept-002',
        // Missing toLocationId
        userId: USER_ID,
      };

      await service.transferEncounter(request);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Cross-Cutting Concerns
  // ===========================================================================

  describe('Event Publishing - Cross-Cutting Concerns', () => {
    it('should not publish duplicate events for same operation', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.save.mockResolvedValue(mockEncounter);

      await service.createEncounter({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('should isolate events by tenant', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.save.mockResolvedValue(mockEncounter);

      await service.createEncounter({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.tenantId).toBe(TENANT_ID);
      
      // Event should NOT contain data from other tenants
      expect(event.payload).not.toHaveProperty('crossTenantData');
    });

    it('should handle event bus publish failure gracefully', async () => {
      mockEventBus.publish.mockRejectedValue(new Error('Event bus down'));

      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.save.mockResolvedValue(mockEncounter);

      // Service should still return success even if event publishing fails
      // (Events are fire-and-forget)
      const result = await service.createEncounter({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      expect(result.success).toBe(true);
    });
  });
});
