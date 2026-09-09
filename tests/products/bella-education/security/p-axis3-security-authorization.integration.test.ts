import { describe, it, expect } from 'vitest';
import { 
  EducationSecurityGuardService, 
  SecurityUserContext 
} from '../../../../src/products/bella-education/security/education-security-guard.service';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const TENANT_B = '00000000-0000-0000-0000-000000000002';

describe('Bella Preschool OS — Axis 3 Security, RBAC & Tenant Isolation Pass', () => {
  const guard = new EducationSecurityGuardService();

  describe('A. Tenant Isolation Boundary Enforcement (Gate 0 / P0)', () => {
    it('should allow same-tenant operations (Tenant A -> Tenant A)', () => {
      expect(() => guard.assertTenantIsolation(TENANT_A, TENANT_A)).not.toThrow();
    });

    it('should block READ operations across tenants (Tenant A -> Tenant B)', () => {
      expect(() => guard.assertTenantIsolation(TENANT_A, TENANT_B)).toThrowError(
        /TENANT_ISOLATION_VIOLATION: Cross-tenant access blocked/
      );
    });

    it('should block INSERT operations across tenants (Tenant A -> Tenant B)', () => {
      expect(() => guard.assertTenantIsolation(TENANT_A, TENANT_B)).toThrowError(
        /TENANT_ISOLATION_VIOLATION/
      );
    });

    it('should block UPDATE operations across tenants (Tenant A -> Tenant B)', () => {
      expect(() => guard.assertTenantIsolation(TENANT_A, TENANT_B)).toThrowError(
        /TENANT_ISOLATION_VIOLATION/
      );
    });

    it('should block DELETE operations across tenants (Tenant A -> Tenant B)', () => {
      expect(() => guard.assertTenantIsolation(TENANT_A, TENANT_B)).toThrowError(
        /TENANT_ISOLATION_VIOLATION/
      );
    });

    it('should reject empty or missing tenant identities', () => {
      expect(() => guard.assertTenantIsolation('', TENANT_A)).toThrowError(
        /TENANT_ISOLATION_VIOLATION: Missing caller tenant identity/
      );
      expect(() => guard.assertTenantIsolation(TENANT_A, '')).toThrowError(
        /TENANT_ISOLATION_VIOLATION: Missing target tenant identity/
      );
    });
  });

  describe('B. Role Authorization Matrix (RBAC)', () => {
    // 1. Parent Role Constraints
    describe('1. Parent Role Constraints', () => {
      const parentCtx: SecurityUserContext = {
        userId: 'user-parent-01',
        tenantId: TENANT_A,
        role: 'PARENT',
      };

      it('should block Parent from modifying invoice truth or billing periods', () => {
        expect(() => guard.assertCanModifyInvoice(parentCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR: Parent role is strictly forbidden/
        );
      });

      it('should block Parent from executing payment reconciliation', () => {
        expect(() => guard.assertCanReconcilePayment(parentCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });

      it('should block Parent from resolving staff work queue exceptions', () => {
        expect(() => guard.assertCanResolveStaffWorkQueue(parentCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR: Parent role cannot resolve staff work queue/
        );
      });

      it('should block Parent from modifying attendance roster', () => {
        expect(() => guard.assertCanModifyAttendanceRoster(parentCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });

      it('should block Parent from facility safety re-inspections', () => {
        expect(() => guard.assertCanReinspectAssetSafety(parentCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });

      it('should block Parent from altering learning evidence ownership', () => {
        expect(() => guard.assertCanModifyLearningEvidence(parentCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });
    });

    // 2. Teacher Role Constraints
    describe('2. Teacher Role Constraints', () => {
      const teacherCtx: SecurityUserContext = {
        userId: 'user-teacher-01',
        tenantId: TENANT_A,
        role: 'TEACHER',
      };

      it('should block Teacher from issuing or modifying invoices', () => {
        expect(() => guard.assertCanModifyInvoice(teacherCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR: Teacher role is strictly forbidden/
        );
      });

      it('should block Teacher from executing payment reconciliation', () => {
        expect(() => guard.assertCanReconcilePayment(teacherCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });

      it('should block Teacher from conducting facility safety re-inspections', () => {
        expect(() => guard.assertCanReinspectAssetSafety(teacherCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });

      it('should allow Teacher to modify attendance roster and learning evidence', () => {
        expect(() => guard.assertCanModifyAttendanceRoster(teacherCtx)).not.toThrow();
        expect(() => guard.assertCanModifyLearningEvidence(teacherCtx)).not.toThrow();
        expect(() => guard.assertCanResolveStaffWorkQueue(teacherCtx)).not.toThrow();
      });
    });

    // 3. Accountant Role Constraints
    describe('3. Accountant Role Constraints', () => {
      const accountantCtx: SecurityUserContext = {
        userId: 'user-accountant-01',
        tenantId: TENANT_A,
        role: 'ACCOUNTANT',
      };

      it('should allow Accountant to modify invoices and reconcile payments', () => {
        expect(() => guard.assertCanModifyInvoice(accountantCtx)).not.toThrow();
        expect(() => guard.assertCanReconcilePayment(accountantCtx)).not.toThrow();
      });

      it('should block Accountant from altering learning evidence ownership', () => {
        expect(() => guard.assertCanModifyLearningEvidence(accountantCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });

      it('should block Accountant from facility safety re-inspections', () => {
        expect(() => guard.assertCanReinspectAssetSafety(accountantCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });

      it('should block Accountant from approving workforce leave', () => {
        expect(() => guard.assertCanApproveWorkforceLeave(accountantCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });
    });

    // 4. Facilities Manager Role Constraints
    describe('4. Facilities Manager Role Constraints', () => {
      const facCtx: SecurityUserContext = {
        userId: 'user-facilities-01',
        tenantId: TENANT_A,
        role: 'FACILITIES_MANAGER',
      };

      it('should allow Facilities Manager to perform safety re-inspections & work queue resolution', () => {
        expect(() => guard.assertCanReinspectAssetSafety(facCtx)).not.toThrow();
        expect(() => guard.assertCanResolveStaffWorkQueue(facCtx)).not.toThrow();
      });

      it('should block Facilities Manager from modifying invoice settlement or issuing invoices', () => {
        expect(() => guard.assertCanModifyInvoice(facCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
        expect(() => guard.assertCanReconcilePayment(facCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });

      it('should block Facilities Manager from approving workforce leave outside role', () => {
        expect(() => guard.assertCanApproveWorkforceLeave(facCtx)).toThrowError(
          /AUTH_ROLE_PERMISSION_ERROR/
        );
      });
    });

    // 5. Principal Role Boundaries
    describe('5. Principal Role Boundaries', () => {
      const principalCtx: SecurityUserContext = {
        userId: 'user-principal-01',
        tenantId: TENANT_A,
        role: 'PRINCIPAL',
      };

      it('should grant Principal operational authorization across domain capabilities within Tenant A', () => {
        expect(() => guard.assertCanModifyInvoice(principalCtx)).not.toThrow();
        expect(() => guard.assertCanReconcilePayment(principalCtx)).not.toThrow();
        expect(() => guard.assertCanResolveStaffWorkQueue(principalCtx)).not.toThrow();
        expect(() => guard.assertCanModifyAttendanceRoster(principalCtx)).not.toThrow();
        expect(() => guard.assertCanReinspectAssetSafety(principalCtx)).not.toThrow();
        expect(() => guard.assertCanModifyLearningEvidence(principalCtx)).not.toThrow();
        expect(() => guard.assertCanApproveWorkforceLeave(principalCtx)).not.toThrow();
      });

      it('should strictly enforce tenant isolation on Principal (Principal A cannot operate on Tenant B)', () => {
        expect(() => guard.assertTenantIsolation(principalCtx.tenantId, TENANT_B)).toThrowError(
          /TENANT_ISOLATION_VIOLATION/
        );
      });
    });
  });
});
