/**
 * Encounter Engine Service Unit Tests
 * 
 * Test Coverage:
 * - Business orchestration (NOT infrastructure)
 * - Repository interaction (MOCKED)
 * - Event publishing (MOCKED)
 * - Error handling
 * - Tenant isolation
 * - State transition validation
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, no `any`
 * 
 * Architecture:
 * - Service Layer tests
 * - Mock Repository (no real DB)
 * - Mock EventBus (no real events)
 * - Focus: Business logic orchestration
 * 
 * @module platform/healthcare/engines/encounter-engine/__tests__
 */

import { EncounterEngineService } from '../encounter-engine.service';
import { Encounter } from '../domain/encounter.entity';
import type { IEncounterRepository } from '../infrastructure/repository.interface';
import type { IEventBus } from '@/platform/host/event-bus/event-bus.interface';
import type {
  CreateEncounterRequest,
  UpdateEncounterStatusRequest,
  AddDiagnosisRequest,
  AssignProviderRequest,
  TransferEncounterRequest,
  GetEncounterRequest,
  SearchEncountersRequest,
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
// Test Suite
// =============================================================================

describe('EncounterEngineService - Unit Tests', () => {
  let service: EncounterEngineService;
  let mockRepository: jest.Mocked<IEncounterRepository>;
  let mockEventBus: jest.Mocked<IEventBus>;

  const TENANT_ID = 'tenant-test-001';
  const PATIENT_ID = 'patient-test-001';
  const USER_ID = 'user-test-001';

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockEventBus = createMockEventBus();
    service = new EncounterEngineService(mockRepository, mockEventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. createEncounter()
  // ===========================================================================

  describe('createEncounter()', () => {
    const validRequest: CreateEncounterRequest = {
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      encounterClass: 'AMB',
      encounterType: 'outpatient',
      userId: USER_ID,
    };

    it('should create encounter and return success', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.save.mockResolvedValue(mockEncounter);

      const result = await service.createEncounter(validRequest);

      expect(result.success).toBe(true);
      expect(result.encounter).toBeDefined();
      expect(result.encounter?.tenantId).toBe(TENANT_ID);
      expect(result.encounter?.patientId).toBe(PATIENT_ID);
      expect(result.encounter?.status).toBe('planned');
    });

    it('should save encounter to repository', async () => {
      mockRepository.save.mockResolvedValue({} as Encounter);

      await service.createEncounter(validRequest);

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          patientId: PATIENT_ID,
        })
      );
    });

    it('should publish EncounterCreated event', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.save.mockResolvedValue(mockEncounter);

      await service.createEncounter(validRequest);

      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EncounterCreated',
          aggregateType: 'Encounter',
          tenantId: TENANT_ID,
        })
      );
    });

    it('should NOT publish event if save fails', async () => {
      mockRepository.save.mockRejectedValue(new Error('DB error'));

      const result = await service.createEncounter(validRequest);

      expect(result.success).toBe(false);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should reject missing tenantId', async () => {
      const invalidRequest = { ...validRequest, tenantId: '' };

      const result = await service.createEncounter(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tenant ID');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should reject missing patientId', async () => {
      const invalidRequest = { ...validRequest, patientId: '' };

      const result = await service.createEncounter(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Patient ID');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      mockRepository.save.mockRejectedValue(new Error('Connection timeout'));

      const result = await service.createEncounter(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 2. getEncounter()
  // ===========================================================================

  describe('getEncounter()', () => {
    const encounterId = 'encounter-001';
    const request: GetEncounterRequest = {
      tenantId: TENANT_ID,
      encounterId,
    };

    it('should return encounter if found', async () => {
      const mockEncounter = Encounter.create({
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      mockRepository.findById.mockResolvedValue(mockEncounter);

      const result = await service.getEncounter(request);

      expect(result.success).toBe(true);
      expect(result.encounter).toBeDefined();
      expect(result.encounter?.id).toBe(mockEncounter.id);
    });

    it('should return error if encounter not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getEncounter(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should enforce tenant isolation', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await service.getEncounter(request);

      expect(mockRepository.findById).toHaveBeenCalledWith(
        encounterId,
        TENANT_ID
      );
    });
  });

  // ===========================================================================
  // 3. updateStatus()
  // ===========================================================================

  describe('updateStatus()', () => {
    const encounterId = 'encounter-001';

    it('should transition from planned to arrived', async () => {
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
        encounterId,
        status: 'arrived',
        userId: USER_ID,
      };

      const result = await service.updateStatus(request);

      expect(result.success).toBe(true);
      expect(result.encounter?.status).toBe('arrived');
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should reject invalid state transition', async () => {
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
        encounterId,
        status: 'finished', // Invalid: planned → finished
        userId: USER_ID,
      };

      const result = await service.updateStatus(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('transition');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should publish status change event', async () => {
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
        encounterId,
        status: 'arrived',
        userId: USER_ID,
      };

      await service.updateStatus(request);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: expect.stringMatching(/Arrived|StatusChanged/),
        })
      );
    });
  });

  // ===========================================================================
  // 4. addDiagnosis()
  // ===========================================================================

  describe('addDiagnosis()', () => {
    const encounterId = 'encounter-001';

    it('should add valid diagnosis', async () => {
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
        encounterId,
        code: 'J18.9',
        system: 'ICD-10',
        display: 'Pneumonia, unspecified',
        isPrimary: true,
        userId: USER_ID,
      };

      const result = await service.addDiagnosis(request);

      expect(result.success).toBe(true);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'DiagnosisAdded',
        })
      );
    });

    it('should reject invalid diagnosis code format', async () => {
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
        encounterId,
        code: 'INVALID',
        system: 'ICD-10',
        isPrimary: true,
        userId: USER_ID,
      };

      const result = await service.addDiagnosis(request);

      expect(result.success).toBe(false);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 5. assignProvider()
  // ===========================================================================

  describe('assignProvider()', () => {
    const encounterId = 'encounter-001';

    it('should assign provider successfully', async () => {
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
        encounterId,
        providerId: 'doctor-001',
        role: 'attending',
        userId: USER_ID,
      };

      const result = await service.assignProvider(request);

      expect(result.success).toBe(true);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ProviderAssigned',
        })
      );
    });

    it('should reject empty provider ID', async () => {
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
        encounterId,
        providerId: '',
        role: 'attending',
        userId: USER_ID,
      };

      const result = await service.assignProvider(request);

      expect(result.success).toBe(false);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 6. transferEncounter()
  // ===========================================================================

  describe('transferEncounter()', () => {
    const encounterId = 'encounter-001';

    it('should transfer encounter successfully', async () => {
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
        encounterId,
        toDepartmentId: 'dept-002',
        toLocationId: 'loc-002',
        userId: USER_ID,
      };

      const result = await service.transferEncounter(request);

      expect(result.success).toBe(true);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EncounterTransferred',
        })
      );
    });

    it('should require both department and location', async () => {
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
        encounterId,
        toDepartmentId: 'dept-002',
        // Missing toLocationId
        userId: USER_ID,
      };

      const result = await service.transferEncounter(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('toDepartmentId and toLocationId');
    });
  });

  // ===========================================================================
  // 7. searchEncounters()
  // ===========================================================================

  describe('searchEncounters()', () => {
    it('should search and return results', async () => {
      const mockResults = {
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      };

      mockRepository.search.mockResolvedValue(mockResults);

      const request: SearchEncountersRequest = {
        tenantId: TENANT_ID,
        status: 'planned',
      };

      const result = await service.searchEncounters(request);

      expect(result.success).toBe(true);
      expect(result.encounters).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should pass filters to repository', async () => {
      mockRepository.search.mockResolvedValue({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      });

      const request: SearchEncountersRequest = {
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        status: 'in-progress',
        limit: 20,
        offset: 10,
      };

      await service.searchEncounters(request);

      expect(mockRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          patientId: PATIENT_ID,
          status: 'in-progress',
          limit: 20,
          offset: 10,
        })
      );
    });
  });
});
