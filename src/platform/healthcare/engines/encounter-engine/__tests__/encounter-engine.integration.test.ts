/**
 * Encounter Engine - Integration Tests
 * 
 * Full-stack end-to-end verification:
 * Service → Repository → Database → Events → Contract Registry
 * 
 * Test Coverage:
 * 1. End-to-end persistence (real DB writes)
 * 2. Tenant isolation (cross-tenant protection)
 * 3. Transaction consistency (DB fail → no event)
 * 4. Event-after-persistence (event only after DB success)
 * 5. Failure paths (rollback, no partial state)
 * 
 * Constitution Compliance:
 * - Law 1: Encounter aggregate root
 * - Law 5: Event-First Architecture
 * - Law 8: Contract Registry validation
 * - Law 9: Zero regression guarantee (tenant isolation)
 * - Law 11: Strictly typed, no `any`
 * 
 * @module platform/healthcare/engines/encounter-engine/__tests__
 */

import { EncounterEngineService } from '../encounter-engine.service';
import { SupabaseEncounterRepository } from '../infrastructure/supabase-encounter.repository';
import { EventBusService } from '@/platform/host/event-bus/event-bus.service';
import { ContractRegistryService } from '@/platform/host/contract-registry/contract-registry.service';
import { ENCOUNTER_ENGINE_CONTRACT } from '@/platform/healthcare/contracts/encounter-engine.contract';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type {
  CreateEncounterRequest,
  UpdateEncounterStatusRequest,
  AddDiagnosisRequest,
} from '../encounter-engine.interface';

// =============================================================================
// Test Configuration
// =============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ✅ REAL test data (created by scripts/seed-healthcare-test-data.js)
const TENANT_A = '10000000-0000-0000-0000-000000000001'; // Healthcare Test Tenant A
const TENANT_B = '10000000-0000-0000-0000-000000000002'; // Healthcare Test Tenant B
const PATIENT_A = '20000000-0000-0000-0000-000000000001'; // Test Patient A1
const PATIENT_B = '20000000-0000-0000-0000-000000000003'; // Test Patient B1
const PROVIDER_A = '30000000-0000-0000-0000-000000000001'; // Dr. Test Provider A
const PROVIDER_B = '30000000-0000-0000-0000-000000000002'; // Dr. Test Provider B
const USER_ID = PROVIDER_A; // Use provider as user

// Skip integration tests if no Supabase credentials
const describeIntegration = SUPABASE_URL && SUPABASE_KEY ? describe : describe.skip;

// =============================================================================
// Test Suite
// =============================================================================

describeIntegration('Encounter Engine - Integration Tests', () => {
  let service: EncounterEngineService;
  let repository: SupabaseEncounterRepository;
  let eventBus: EventBusService;
  let contractRegistry: ContractRegistryService;
  let supabase: ReturnType<typeof createClient<Database>>;
  let publishedEvents: Array<{ eventType: string; payload: unknown; tenantId: string }> = [];

  beforeAll(() => {
    // Initialize Supabase client
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);

    // Initialize Contract Registry
    contractRegistry = ContractRegistryService.getInstance();
    contractRegistry.registerContract(ENCOUNTER_ENGINE_CONTRACT);

    // Initialize Event Bus with event capture
    eventBus = new EventBusService();
    
    // Capture published events for verification
    const originalPublish = eventBus.publish.bind(eventBus);
    eventBus.publish = jest.fn(async (event) => {
      publishedEvents.push({
        eventType: event.eventType,
        payload: event.payload,
        tenantId: event.tenantId,
      });
      return originalPublish(event);
    });

    // Initialize Repository and Service
    repository = new SupabaseEncounterRepository(supabase);
    service = new EncounterEngineService(repository, eventBus);
  });

  beforeEach(() => {
    // Clear event capture
    publishedEvents = [];
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    await supabase
      .from('hc_encounters')
      .delete()
      .in('tenant_id', [TENANT_A, TENANT_B]);
  });

  // ===========================================================================
  // 1. End-to-End Persistence
  // ===========================================================================

  describe('End-to-End Persistence', () => {
    it('should persist encounter to database and publish event', async () => {
      const request: CreateEncounterRequest = {
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      };

      // 1. Create via service
      const result = await service.createEncounter(request);

      expect(result.success).toBe(true);
      expect(result.encounter).toBeDefined();

      const encounterId = result.encounter!.id;

      // 2. Verify database persistence
      const { data: dbEncounter, error } = await supabase
        .from('hc_encounters')
        .select('*')
        .eq('id', encounterId)
        .eq('tenant_id', TENANT_A)
        .single();

      expect(error).toBeNull();
      expect(dbEncounter).toBeDefined();
      expect(dbEncounter!.patient_party_id).toBe(PATIENT_A); // ✅ Correct column name
      expect(dbEncounter!.encounter_class).toBe('AMB');
      expect(dbEncounter!.status).toBe('planned');

      // 3. Verify event published
      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0].eventType).toBe('EncounterCreated');
      expect(publishedEvents[0].tenantId).toBe(TENANT_A);

      // 4. Verify event contract compliance
      const validationResult = contractRegistry.validateEvent(
        'encounter-engine',
        '1.0.0',
        'EncounterCreated',
        publishedEvents[0].payload
      );
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });

    it('should persist status transition and publish event', async () => {
      // 1. Create encounter
      const createResult = await service.createEncounter({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      const encounterId = createResult.encounter!.id;
      publishedEvents = []; // Clear create event

      // 2. Update status
      const updateResult = await service.updateStatus({
        tenantId: TENANT_A,
        encounterId,
        status: 'arrived',
        userId: USER_ID,
      });

      expect(updateResult.success).toBe(true);

      // 3. Verify DB updated
      const { data: dbEncounter } = await supabase
        .from('hc_encounters')
        .select('status')
        .eq('id', encounterId)
        .single();

      expect(dbEncounter!.status).toBe('arrived');

      // 4. Verify event published
      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0].eventType).toBe('EncounterArrived');
    });
  });

  // ===========================================================================
  // 2. Tenant Isolation
  // ===========================================================================

  describe('Tenant Isolation', () => {
    it('should prevent Tenant A from reading Tenant B encounter', async () => {
      // 1. Create encounter for Tenant B
      const createResult = await service.createEncounter({
        tenantId: TENANT_B,
        patientId: PATIENT_B,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      const encounterIdB = createResult.encounter!.id;

      // 2. Try to read with Tenant A credentials
      const readResult = await service.getEncounter({
        tenantId: TENANT_A, // Wrong tenant
        encounterId: encounterIdB,
      });

      expect(readResult.success).toBe(false);
      expect(readResult.error).toContain('not found');
      expect(readResult.encounter).toBeUndefined();
    });

    it('should prevent Tenant A from updating Tenant B encounter', async () => {
      // 1. Create encounter for Tenant B
      const createResult = await service.createEncounter({
        tenantId: TENANT_B,
        patientId: PATIENT_B,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      const encounterIdB = createResult.encounter!.id;

      // 2. Try to update with Tenant A credentials
      const updateResult = await service.updateStatus({
        tenantId: TENANT_A, // Wrong tenant
        encounterId: encounterIdB,
        status: 'arrived',
        userId: USER_ID,
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('not found');

      // 3. Verify DB not changed
      const { data: dbEncounter } = await supabase
        .from('hc_encounters')
        .select('status')
        .eq('id', encounterIdB)
        .single();

      expect(dbEncounter!.status).toBe('planned'); // Still original status
    });

    it('should ensure events maintain correct tenantId', async () => {
      // Create encounters for both tenants
      await service.createEncounter({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      await service.createEncounter({
        tenantId: TENANT_B,
        patientId: PATIENT_B,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      // Verify events have correct tenant isolation
      const tenantAEvents = publishedEvents.filter(e => e.tenantId === TENANT_A);
      const tenantBEvents = publishedEvents.filter(e => e.tenantId === TENANT_B);

      expect(tenantAEvents).toHaveLength(1);
      expect(tenantBEvents).toHaveLength(1);

      // No cross-tenant data leakage in events
      expect(tenantAEvents[0].tenantId).toBe(TENANT_A);
      expect(tenantBEvents[0].tenantId).toBe(TENANT_B);
    });
  });

  // ===========================================================================
  // 3. Transaction Consistency
  // ===========================================================================

  describe('Transaction Consistency', () => {
    it('should NOT publish event if database save fails', async () => {
      // Mock repository to fail on save
      const originalSave = repository.save;
      repository.save = jest.fn().mockRejectedValue(new Error('DB connection lost'));

      const request: CreateEncounterRequest = {
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      };

      // Attempt create
      const result = await service.createEncounter(request);

      // Service should fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toContain('DB connection lost');

      // NO event should be published
      expect(publishedEvents).toHaveLength(0);

      // Restore original
      repository.save = originalSave;
    });

    it('should NOT leave partial state if status transition fails', async () => {
      // 1. Create valid encounter
      const createResult = await service.createEncounter({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      const encounterId = createResult.encounter!.id;
      publishedEvents = [];

      // 2. Try invalid status transition (planned → finished, skipping arrived/in-progress)
      const updateResult = await service.updateStatus({
        tenantId: TENANT_A,
        encounterId,
        status: 'finished', // Invalid transition
        userId: USER_ID,
      });

      expect(updateResult.success).toBe(false);

      // 3. Verify DB not changed
      const { data: dbEncounter } = await supabase
        .from('hc_encounters')
        .select('status')
        .eq('id', encounterId)
        .single();

      expect(dbEncounter!.status).toBe('planned'); // Still original

      // 4. NO event published for failed transition
      expect(publishedEvents).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 4. Event-After-Persistence
  // ===========================================================================

  describe('Event-After-Persistence', () => {
    it('should publish event ONLY after successful DB write', async () => {
      // ✅ Clear events from previous tests
      publishedEvents = [];
      
      const request: CreateEncounterRequest = {
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      };

      // Track call order
      const callOrder: string[] = [];

      // ✅ Spy on methods without replacing implementation
      const saveSpy = jest.spyOn(repository, 'save');
      saveSpy.mockImplementationOnce(async (encounter) => {
        callOrder.push('DB_SAVE');
        // Call original implementation
        saveSpy.mockRestore();
        const result = await repository.save(encounter);
        // Re-spy for potential future calls
        jest.spyOn(repository, 'save');
        return result;
      });

      const publishSpy = jest.spyOn(eventBus, 'publish');
      publishSpy.mockImplementation(async (event) => {
        callOrder.push('EVENT_PUBLISH');
        // Don't call original - just record the call
        return Promise.resolve();
      });

      await service.createEncounter(request);

      // Verify call order: DB_SAVE must happen before EVENT_PUBLISH
      expect(callOrder).toEqual(['DB_SAVE', 'EVENT_PUBLISH']);

      // ✅ Restore spies
      saveSpy.mockRestore();
      publishSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 5. Failure Paths
  // ===========================================================================

  describe('Failure Paths', () => {
    it('should handle repository findById failure gracefully', async () => {
      const originalFindById = repository.findById;
      repository.findById = jest.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await service.updateStatus({
        tenantId: TENANT_A,
        encounterId: 'non-existent',
        status: 'arrived',
        userId: USER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(publishedEvents).toHaveLength(0);

      repository.findById = originalFindById;
    });

    it('should handle invalid diagnosis code', async () => {
      // 1. Create encounter
      const createResult = await service.createEncounter({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      const encounterId = createResult.encounter!.id;
      publishedEvents = [];

      // 2. Try invalid diagnosis
      const diagnosisResult = await service.addDiagnosis({
        tenantId: TENANT_A,
        encounterId,
        code: 'INVALID', // Too short for ICD-10
        system: 'ICD-10',
        isPrimary: true,
        userId: USER_ID,
      });

      expect(diagnosisResult.success).toBe(false);

      // 3. No event published for invalid diagnosis
      expect(publishedEvents).toHaveLength(0);
    });

    it('should handle event bus publish failure without breaking service', async () => {
      // Mock event bus to fail
      (eventBus.publish as jest.Mock).mockRejectedValueOnce(new Error('Event bus down'));

      const request: CreateEncounterRequest = {
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      };

      // Service should still succeed (events are fire-and-forget)
      const result = await service.createEncounter(request);

      expect(result.success).toBe(true);
      expect(result.encounter).toBeDefined();

      // Verify DB write happened despite event failure
      const { data: dbEncounter } = await supabase
        .from('hc_encounters')
        .select('*')
        .eq('id', result.encounter!.id)
        .single();

      expect(dbEncounter).toBeDefined();
    });
  });

  // ===========================================================================
  // Cross-Cutting: Search with Tenant Isolation
  // ===========================================================================

  describe('Search with Tenant Isolation', () => {
    beforeAll(async () => {
      // Create multiple encounters across tenants
      await service.createEncounter({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });

      await service.createEncounter({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterClass: 'EMER',
        encounterType: 'emergency',
        userId: USER_ID,
      });

      await service.createEncounter({
        tenantId: TENANT_B,
        patientId: PATIENT_B,
        encounterClass: 'AMB',
        encounterType: 'outpatient',
        userId: USER_ID,
      });
    });

    it('should only return encounters for requested tenant', async () => {
      const searchResult = await service.searchEncounters({
        tenantId: TENANT_A,
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.encounters).toBeDefined();

      // All results must belong to TENANT_A
      const allBelongToTenantA = searchResult.encounters!.every(
        (e) => e.tenantId === TENANT_A
      );
      expect(allBelongToTenantA).toBe(true);

      // Should NOT include TENANT_B encounters
      const hasTenantBData = searchResult.encounters!.some(
        (e) => e.patientId === PATIENT_B
      );
      expect(hasTenantBData).toBe(false);
    });

    it('should filter by patient within tenant', async () => {
      const searchResult = await service.searchEncounters({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.encounters!.length).toBeGreaterThan(0);

      // All results belong to same patient
      const allBelongToPatient = searchResult.encounters!.every(
        (e) => e.patientId === PATIENT_A
      );
      expect(allBelongToPatient).toBe(true);
    });
  });
});
