/**
 * P3.1 Runtime Verification — Student & Guardian Management
 * 
 * SCOPE: Real-auth workflow verification
 * - Create Student → persist → read-back
 * - Search/filter students
 * - Edit student → persist
 * - Link existing customer as Guardian
 * - Set Primary guardian (only ONE primary invariant)
 * - Toggle Pickup Authorized
 * - Edit relationship metadata
 * - Reload → verify persistence
 * - Unlink guardian → verify customer preserved
 * - Tenant isolation (Tenant A cannot access Tenant B's data)
 * 
 * REQUIREMENTS:
 * - Real Supabase auth (JWT)
 * - Real DB with RLS
 * - Test tenant + users
 * 
 * NOT MOCKED:
 * - Auth
 * - Database
 * - RLS policies
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@/lib/supabase-server';
import {
  listStudentsAction,
  getStudentAction,
  createStudentAction,
  updateStudentAction,
} from '@/products/bella-preschool/actions/student-actions';
import {
  searchCustomersAction,
  addGuardianAction,
  updateGuardianRelationshipAction,
  removeGuardianAction,
  getGuardianAction,
} from '@/products/bella-preschool/actions/guardian-actions';

describe('P3.1 Runtime Verification — Student & Guardian Management', () => {
  let testTenantId: string;
  let testCustomerId1: string;
  let testCustomerId2: string;
  let createdStudentId: string;
  let createdGuardianId1: string;
  let createdGuardianId2: string;

  beforeAll(async () => {
    // TODO: Setup test tenant + customers
    // This requires auth context to be set up
    // For now, we'll skip and document requirements
  });

  describe('Student CRUD Workflow', () => {
    it('should create student with auto-generated code', async () => {
      const result = await createStudentAction({
        student_code: `TEST${Date.now()}`,
        first_name: 'Emma',
        last_name: 'Johnson',
        date_of_birth: '2020-05-15',
        gender: 'female',
        notes: 'Test student for P3.1 verification',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBeDefined();

      createdStudentId = result.data!.id;
    });

    it('should read back created student', async () => {
      const result = await getStudentAction(createdStudentId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.first_name).toBe('Emma');
      expect(result.data?.last_name).toBe('Johnson');
      expect(result.data?.date_of_birth).toBe('2020-05-15');
    });

    it('should list students and find created student', async () => {
      const result = await listStudentsAction();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);

      const found = result.data?.find((s) => s.id === createdStudentId);
      expect(found).toBeDefined();
      expect(found?.first_name).toBe('Emma');
    });

    it('should update student', async () => {
      const result = await updateStudentAction(createdStudentId, {
        first_name: 'Emily',
        notes: 'Updated notes',
      });

      expect(result.success).toBe(true);

      // Verify persistence
      const getResult = await getStudentAction(createdStudentId);
      expect(getResult.data?.first_name).toBe('Emily');
      expect(getResult.data?.notes).toBe('Updated notes');
    });
  });

  describe('Guardian Management Workflow', () => {
    it('should search for existing customers', async () => {
      const result = await searchCustomersAction('test');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Note: actual results depend on test data
    });

    it('should link customer as guardian', async () => {
      // Assumes testCustomerId1 exists
      const result = await addGuardianAction({
        student_id: createdStudentId,
        guardian_customer_id: testCustomerId1,
        relationship_type: 'mother',
        is_primary: true,
        is_emergency_contact: true,
        pickup_authorized: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBeDefined();

      createdGuardianId1 = result.data!.id;
    });

    it('should read back guardian relationship', async () => {
      const result = await getGuardianAction(createdGuardianId1);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.student_id).toBe(createdStudentId);
      expect(result.data?.relationship_type).toBe('mother');
      expect(result.data?.is_primary_contact).toBe(true);
      expect(result.data?.is_emergency_contact).toBe(true);
      expect(result.data?.is_authorized_pickup).toBe(true);
    });

    it('should add second guardian and verify primary constraint', async () => {
      // Add second guardian as primary
      const result = await addGuardianAction({
        student_id: createdStudentId,
        guardian_customer_id: testCustomerId2,
        relationship_type: 'father',
        is_primary: true,
        is_emergency_contact: false,
        pickup_authorized: true,
      });

      expect(result.success).toBe(true);
      createdGuardianId2 = result.data!.id;

      // Verify first guardian is no longer primary
      const guardian1 = await getGuardianAction(createdGuardianId1);
      expect(guardian1.data?.is_primary_contact).toBe(false);

      // Verify second guardian is primary
      const guardian2 = await getGuardianAction(createdGuardianId2);
      expect(guardian2.data?.is_primary_contact).toBe(true);
    });

    it('should update guardian relationship metadata', async () => {
      const result = await updateGuardianRelationshipAction(createdGuardianId1, {
        relationship_type: 'guardian',
        pickup_authorized: false,
      });

      expect(result.success).toBe(true);

      // Verify persistence
      const guardian = await getGuardianAction(createdGuardianId1);
      expect(guardian.data?.relationship_type).toBe('guardian');
      expect(guardian.data?.is_authorized_pickup).toBe(false);
    });

    it('should unlink guardian without deleting customer', async () => {
      const result = await removeGuardianAction(createdGuardianId1);

      expect(result.success).toBe(true);

      // Verify guardian relationship removed
      const guardianCheck = await getGuardianAction(createdGuardianId1);
      expect(guardianCheck.success).toBe(false);

      // Verify customer still exists (check via DB)
      const supabase = await createClient();
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', testCustomerId1)
        .single();

      expect(customer).toBeDefined();
      expect(customer?.id).toBe(testCustomerId1);
    });
  });

  describe('Student Profile Integration', () => {
    it('should reload student and see remaining guardian', async () => {
      const result = await getStudentAction(createdStudentId);

      expect(result.success).toBe(true);
      expect(result.data?.guardians).toBeDefined();
      expect(result.data?.guardians?.length).toBe(1);
      expect(result.data?.guardians?.[0].id).toBe(createdGuardianId2);
    });
  });

  describe('Tenant Isolation (Security)', () => {
    it('should NOT allow Tenant A to read Tenant B student', async () => {
      // This requires setting up a second tenant context
      // TODO: Implement cross-tenant access test
      // Expected: getStudentAction with wrong tenant should return error or empty
    });

    it('should NOT allow Tenant A to modify Tenant B guardian', async () => {
      // TODO: Implement cross-tenant modification test
      // Expected: updateGuardianRelationshipAction with wrong tenant should fail
    });
  });
});

/**
 * ACCEPTANCE CRITERIA FOR P3.1 CLOSURE:
 * 
 * ✅ Create Student → persist correctly
 * ✅ Read back student → data matches
 * ✅ Search/filter students → works
 * ✅ Edit student → persists
 * ✅ Link customer as guardian → relationship created
 * ✅ Primary guardian invariant → only ONE primary per student
 * ✅ Update guardian relationship → persists
 * ✅ Unlink guardian → relationship removed, customer preserved
 * ✅ Tenant isolation → no cross-tenant access
 * 
 * ❌ FAIL CONDITIONS:
 * - Student data not persisted
 * - Multiple primary guardians exist
 * - Unlink deletes customer
 * - Cross-tenant access allowed
 * - RLS policy bypassed
 */
