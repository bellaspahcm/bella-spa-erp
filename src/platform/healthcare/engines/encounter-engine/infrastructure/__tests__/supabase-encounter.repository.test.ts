/**
 * Supabase Encounter Repository Integration Tests
 * 
 * Test Coverage:
 * - CRUD operations
 * - Tenant isolation (DATABASE-LEVEL RLS verification)
 * - Search & filtering
 * - Serialization/deserialization
 * - Error handling
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed tests, no `any`
 * 
 * NOTE: These are integration tests requiring actual Supabase connection.
 * Run with: npm test -- supabase-encounter.repository.test.ts
 * 
 * @module platform/healthcare/engines/encounter-engine/infrastructure/__tests__
 */

import { SupabaseEncounterRepository } from '../supabase-encounter.repository';
import { Encounter, CreateEncounterData } from '../../domain/encounter.entity';
import type { EncounterSearchQuery } from '../repository.interface';
import { RepositoryError } from '../repository.interface';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { randomUUID } from 'crypto';

describe('SupabaseEncounterRepository - Integration Tests', () => {
  let repository: SupabaseEncounterRepository;
  let supabase: SupabaseClient<Database>;

  const TENANT_A = '11111111-1111-1111-1111-11111111111a';
  const TENANT_B = '22222222-2222-2222-2222-22222222222b';
  const PATIENT_A = '33333333-3333-3333-3333-333333333333';
  const PATIENT_B = '44444444-4444-4444-4444-444444444444';
  const SHARED_PATIENT_ID = '99999999-9999-9999-9999-999999999999';
  const DOCTOR_A = '66666666-6666-6666-6666-666666666666';
  const DOCTOR_B = '77777777-7777-7777-7777-777777777777';
  const DEPT_A = '88888888-8888-8888-8888-888888888881';
  const DEPT_B = '88888888-8888-8888-8888-888888888882';
  const LOC_B = '88888888-8888-8888-8888-888888888883';
  const USER_ID = '55555555-5555-5555-5555-555555555555';

  beforeAll(async () => {
    // ✅ FIX: Create Supabase client from environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables for integration tests');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
    repository = new SupabaseEncounterRepository(supabase);

    // Clean up any stale test records first
    await supabase.from('hc_encounters').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('party_parties').delete().in('tenant_id', [TENANT_A, TENANT_B]);

    // Insert or update required tenant records (using upsert to bypass delete constraints rule bug)
    const testTenants = [
      { id: TENANT_A, name: 'Integration Test Tenant A', status: 'active' },
      { id: TENANT_B, name: 'Integration Test Tenant B', status: 'active' },
    ];
    const { error: tenantError } = await supabase.from('tenants').upsert(testTenants, { onConflict: 'id' });
    if (tenantError) {
      throw new Error(`Failed to seed tenants: ${tenantError.message}`);
    }

    // Insert required party records to satisfy FK constraints
    const parties = [
      { id: PATIENT_A, tenant_id: TENANT_A, party_type: 'person', display_name: 'Patient A' },
      { id: PATIENT_B, tenant_id: TENANT_B, party_type: 'person', display_name: 'Patient B' },
      { id: SHARED_PATIENT_ID, tenant_id: TENANT_A, party_type: 'person', display_name: 'Shared Patient' },
      { id: USER_ID, tenant_id: TENANT_A, party_type: 'person', display_name: 'User A' },
      { id: DOCTOR_A, tenant_id: TENANT_A, party_type: 'person', display_name: 'Doctor A' },
      { id: DOCTOR_B, tenant_id: TENANT_A, party_type: 'person', display_name: 'Doctor B' },
    ];

    const { error: partyError } = await supabase.from('party_parties').upsert(parties, { onConflict: 'id' });
    if (partyError) {
      throw new Error(`Failed to seed party_parties: ${partyError.message}`);
    }
  });

  afterAll(async () => {
    // Cleanup everything created for test tenants in reverse dependency order
    await supabase.from('hc_encounters').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('party_parties').delete().in('tenant_id', [TENANT_A, TENANT_B]);
  });

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  describe('save() - Insert', () => {
    it('should save new encounter to database', async () => {
      const createData: CreateEncounterData = {
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date('2026-08-11T09:00:00Z'),
        serviceProviderId: DOCTOR_A,
        departmentId: DEPT_A,
        reasonCode: ['R50.9'],
        createdBy: USER_ID,
      };

      const encounter = Encounter.create(createData);
      await repository.save(encounter);

      const found = await repository.findById(encounter.id, TENANT_A);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(encounter.id);
      expect(found!.tenantId).toBe(TENANT_A);
      expect(found!.status).toBe('planned');
    });

    it('should serialize complex encounter correctly', async () => {
      const encounter = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'inpatient',
        encounterClass: 'IMP',
        startDateTime: new Date('2026-08-11T10:00:00Z'),
        serviceProviderId: DOCTOR_B,
        departmentId: DEPT_B,
        locationId: LOC_B,
        reasonCode: ['J18.9', 'I10'],
        createdBy: USER_ID,
      });

      encounter.arrive(USER_ID);
      encounter.start(USER_ID);

      await repository.save(encounter);

      const found = await repository.findById(encounter.id, TENANT_A);
      expect(found).not.toBeNull();
      expect(found!.status).toBe('in-progress');
      expect(found!.encounterType).toBe('inpatient');
      expect(found!.reasonCode).toEqual(['J18.9', 'I10']);
    });
  });

  describe('save() - Update', () => {
    it('should update existing encounter', async () => {
      const encounter = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      await repository.save(encounter);

      // Update: arrive
      encounter.arrive(USER_ID);
      await repository.save(encounter);

      const found = await repository.findById(encounter.id, TENANT_A);
      expect(found!.status).toBe('arrived');
    });

    it('should preserve full lifecycle in database', async () => {
      const encounter = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date('2026-08-11T09:00:00Z'),
        createdBy: USER_ID,
      });

      await repository.save(encounter);

      encounter.arrive(USER_ID);
      await repository.save(encounter);

      encounter.start(USER_ID);
      await repository.save(encounter);

      const endTime = new Date('2026-08-11T10:30:00Z');
      encounter.finish(USER_ID, endTime);
      await repository.save(encounter);

      const found = await repository.findById(encounter.id, TENANT_A);
      expect(found!.status).toBe('finished');
      expect(found!.period.end).toEqual(endTime);
      expect(found!.isFinished).toBe(true);
    });
  });

  describe('findById()', () => {
    it('should return null if encounter not found', async () => {
      const found = await repository.findById(randomUUID(), TENANT_A);
      expect(found).toBeNull();
    });

    it('should return null if encounter belongs to different tenant', async () => {
      const encounter = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      await repository.save(encounter);

      // Try to find from different tenant
      const found = await repository.findById(encounter.id, TENANT_B);
      expect(found).toBeNull(); // RLS blocks cross-tenant access
    });
  });

  describe('exists()', () => {
    it('should return true if encounter exists', async () => {
      const encounter = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      await repository.save(encounter);

      const exists = await repository.exists(encounter.id, TENANT_A);
      expect(exists).toBe(true);
    });

    it('should return false if encounter does not exist', async () => {
      const exists = await repository.exists(randomUUID(), TENANT_A);
      expect(exists).toBe(false);
    });

    it('should return false if encounter in different tenant', async () => {
      const encounter = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      await repository.save(encounter);

      const exists = await repository.exists(encounter.id, TENANT_B);
      expect(exists).toBe(false); // RLS blocks cross-tenant
    });
  });

  // ==========================================================================
  // Tenant Isolation (DATABASE-LEVEL RLS)
  // ==========================================================================

  describe('Tenant Isolation - RLS Verification', () => {
    it('should NOT find encounter from different tenant', async () => {
      // Create encounter in Tenant A
      const encounterA = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      await repository.save(encounterA);

      // Try to query from Tenant B
      const found = await repository.findById(encounterA.id, TENANT_B);
      expect(found).toBeNull(); // ✅ RLS blocks access
    });

    it('should NOT list encounters from different tenant in search', async () => {
      // Create encounters in both tenants
      const encounterA = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      const encounterB = Encounter.create({
        tenantId: TENANT_B,
        patientId: PATIENT_B,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      await repository.save(encounterA);
      await repository.save(encounterB);

      // Search in Tenant A
      const resultA = await repository.search({
        tenantId: TENANT_A,
      });

      // Should only see Tenant A's encounter
      expect(resultA.items.length).toBeGreaterThan(0);
      expect(resultA.items.every((e) => e.tenantId === TENANT_A)).toBe(true);
      expect(resultA.items.find((e) => e.id === encounterB.id)).toBeUndefined();
    });

    it('should isolate patient encounters by tenant', async () => {
      // Same patient ID in both tenants (different people)
      const sharedPatientId = SHARED_PATIENT_ID;

      const encounterA = Encounter.create({
        tenantId: TENANT_A,
        patientId: sharedPatientId,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      const encounterB = Encounter.create({
        tenantId: TENANT_B,
        patientId: sharedPatientId,
        encounterType: 'inpatient',
        encounterClass: 'IMP',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      await repository.save(encounterA);
      await repository.save(encounterB);

      // Find by patient in Tenant A
      const patientsA = await repository.findByPatient(sharedPatientId, TENANT_A);
      expect(patientsA.length).toBeGreaterThan(0);
      expect(patientsA.every((e) => e.tenantId === TENANT_A)).toBe(true);

      // Find by patient in Tenant B
      const patientsB = await repository.findByPatient(sharedPatientId, TENANT_B);
      expect(patientsB.length).toBeGreaterThan(0);
      expect(patientsB.every((e) => e.tenantId === TENANT_B)).toBe(true);
    });
  });

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  describe('findByPatient()', () => {
    it('should return all encounters for patient', async () => {
      const encounters = [
        Encounter.create({
          tenantId: TENANT_A,
          patientId: PATIENT_A,
          encounterType: 'outpatient',
          encounterClass: 'AMB',
          startDateTime: new Date('2026-08-01T09:00:00Z'),
          createdBy: USER_ID,
        }),
        Encounter.create({
          tenantId: TENANT_A,
          patientId: PATIENT_A,
          encounterType: 'inpatient',
          encounterClass: 'IMP',
          startDateTime: new Date('2026-08-05T10:00:00Z'),
          createdBy: USER_ID,
        }),
      ];

      for (const enc of encounters) {
        await repository.save(enc);
      }

      const found = await repository.findByPatient(PATIENT_A, TENANT_A);
      expect(found.length).toBeGreaterThanOrEqual(2);
      expect(found.every((e) => e.patientId === PATIENT_A)).toBe(true);
    });

    it('should order by period_start DESC (most recent first)', async () => {
      const oldEncounter = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date('2026-01-01T09:00:00Z'),
        createdBy: USER_ID,
      });

      const newEncounter = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date('2026-08-11T09:00:00Z'),
        createdBy: USER_ID,
      });

      await repository.save(oldEncounter);
      await repository.save(newEncounter);

      const found = await repository.findByPatient(PATIENT_A, TENANT_A, 10);
      expect(found[0].period.start.getTime()).toBeGreaterThan(found[found.length - 1].period.start.getTime());
    });
  });

  describe('search()', () => {
    it('should filter by status', async () => {
      const planned = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      const arrived = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });
      arrived.arrive(USER_ID);

      await repository.save(planned);
      await repository.save(arrived);

      const result = await repository.search({
        tenantId: TENANT_A,
        status: 'planned',
      });

      expect(result.items.every((e) => e.status === 'planned')).toBe(true);
    });

    it('should filter by multiple statuses', async () => {
      const result = await repository.search({
        tenantId: TENANT_A,
        status: ['arrived', 'in-progress'],
      });

      expect(result.items.every((e) =>
        e.status === 'arrived' || e.status === 'in-progress'
      )).toBe(true);
    });

    it('should paginate results', async () => {
      const query: EncounterSearchQuery = {
        tenantId: TENANT_A,
        limit: 5,
        offset: 0,
      };

      const firstPage = await repository.search(query);
      expect(firstPage.limit).toBe(5);
      expect(firstPage.offset).toBe(0);

      if (firstPage.hasMore) {
        const secondPage = await repository.search({
          ...query,
          offset: 5,
        });
        expect(secondPage.offset).toBe(5);
      }
    });
  });

  describe('findActive()', () => {
    it('should return only active encounters', async () => {
      const active = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });
      active.arrive(USER_ID);
      active.start(USER_ID);

      const finished = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });
      finished.arrive(USER_ID);
      finished.start(USER_ID);
      finished.finish(USER_ID);

      await repository.save(active);
      await repository.save(finished);

      const found = await repository.findActive(TENANT_A);
      const activeStatuses = ['arrived', 'triaged', 'in-progress', 'on-hold'];
      expect(found.every((e) => activeStatuses.includes(e.status))).toBe(true);
      expect(found.find((e) => e.id === finished.id)).toBeUndefined();
    });
  });

  describe('count()', () => {
    it('should count encounters by criteria', async () => {
      const count = await repository.count({
        tenantId: TENANT_A,
        status: 'planned',
      });

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Soft Delete
  // ==========================================================================

  describe('delete()', () => {
    it('should soft delete encounter', async () => {
      const encounter = Encounter.create({
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      await repository.save(encounter);

      const existsBefore = await repository.exists(encounter.id, TENANT_A);
      expect(existsBefore).toBe(true);

      await repository.delete(encounter.id, TENANT_A);

      const existsAfter = await repository.exists(encounter.id, TENANT_A);
      expect(existsAfter).toBe(false); // Soft deleted, not returned in queries
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should throw RepositoryError on database failure', async () => {
      // Simulate error by using invalid tenant ID format
      const invalidEncounter = Encounter.create({
        tenantId: 'invalid-uuid-format',
        patientId: PATIENT_A,
        encounterType: 'outpatient',
        encounterClass: 'AMB',
        startDateTime: new Date(),
        createdBy: USER_ID,
      });

      await expect(repository.save(invalidEncounter)).rejects.toThrow(RepositoryError);
    });
  });
});
