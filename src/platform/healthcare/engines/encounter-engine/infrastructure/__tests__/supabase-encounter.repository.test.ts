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

describe('SupabaseEncounterRepository - Integration Tests', () => {
  let repository: SupabaseEncounterRepository;

  const TENANT_A = 'tenant-integration-test-a';
  const TENANT_B = 'tenant-integration-test-b';
  const PATIENT_A = 'patient-test-a';
  const PATIENT_B = 'patient-test-b';
  const USER_ID = 'user-test-001';

  beforeAll(() => {
    repository = new SupabaseEncounterRepository();
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
        serviceProviderId: 'doctor-001',
        departmentId: 'dept-001',
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
        serviceProviderId: 'doctor-002',
        departmentId: 'dept-002',
        locationId: 'loc-002',
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
      const found = await repository.findById('non-existent-id', TENANT_A);
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
      const exists = await repository.exists('non-existent-id', TENANT_A);
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
      const sharedPatientId = 'patient-shared-id';

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
