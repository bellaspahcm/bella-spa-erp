/**
 * Bella Education OS — Axis 3 Security, Authorization & Tenant Isolation Guard
 * File: src/products/bella-education/security/education-security-guard.service.ts
 *
 * Implements 3 Security Layers for Preschool OS:
 * Layer 1: UI Permission Mapping & Role Component Guards
 * Layer 2: Application / Server Action Guard (Strict AUTH_ROLE_PERMISSION_ERROR & TENANT_ISOLATION_VIOLATION)
 * Layer 3: Database & Repository Level Tenant Boundary Assertions
 */

export type EducationRole = 'PRINCIPAL' | 'TEACHER' | 'ACCOUNTANT' | 'PARENT' | 'FACILITIES_MANAGER';

export interface SecurityUserContext {
  userId: string;
  tenantId: string;
  role: EducationRole;
}

export class EducationSecurityGuardService {
  /**
   * Layer 3 & Layer 2: Assert Tenant Isolation Boundary (Gate 0 / P0)
   * Prevents cross-tenant access between Tenant A and Tenant B across READ, INSERT, UPDATE, DELETE.
   */
  public assertTenantIsolation(callerTenantId: string, targetTenantId: string): void {
    if (!callerTenantId || callerTenantId.trim() === '') {
      throw new Error('TENANT_ISOLATION_VIOLATION: Missing caller tenant identity');
    }
    if (!targetTenantId || targetTenantId.trim() === '') {
      throw new Error('TENANT_ISOLATION_VIOLATION: Missing target tenant identity');
    }
    if (callerTenantId !== targetTenantId) {
      throw new Error(
        `TENANT_ISOLATION_VIOLATION: Cross-tenant access blocked. Caller tenant '${callerTenantId}' cannot operate on target tenant '${targetTenantId}'.`
      );
    }
  }

  /**
   * Layer 2: Assert Role Authorization for Finance Invoices & Billing Operations
   * Parent, Teacher, Facilities Manager CANNOT modify invoice truth or issue invoices.
   */
  public assertCanModifyInvoice(ctx: SecurityUserContext): void {
    if (ctx.role === 'PARENT') {
      throw new Error('AUTH_ROLE_PERMISSION_ERROR: Parent role is strictly forbidden from modifying invoice truth or billing periods');
    }
    if (ctx.role === 'TEACHER') {
      throw new Error('AUTH_ROLE_PERMISSION_ERROR: Teacher role is strictly forbidden from issuing invoices or modifying financial contracts');
    }
    if (ctx.role === 'FACILITIES_MANAGER') {
      throw new Error('AUTH_ROLE_PERMISSION_ERROR: Facilities Manager role is forbidden from modifying financial billing data');
    }
  }

  /**
   * Layer 2: Assert Role Authorization for Payment Reconciliation
   * Only Accountant and Principal can perform payment reconciliation.
   */
  public assertCanReconcilePayment(ctx: SecurityUserContext): void {
    if (ctx.role !== 'ACCOUNTANT' && ctx.role !== 'PRINCIPAL') {
      throw new Error(
        `AUTH_ROLE_PERMISSION_ERROR: Role '${ctx.role}' is not authorized to execute payment reconciliation or create receipt fingerprints`
      );
    }
  }

  /**
   * Layer 2: Assert Role Authorization for Staff Work Queue Exception Resolution
   * Parent CANNOT resolve staff work queue exceptions.
   */
  public assertCanResolveStaffWorkQueue(ctx: SecurityUserContext): void {
    if (ctx.role === 'PARENT') {
      throw new Error('AUTH_ROLE_PERMISSION_ERROR: Parent role cannot resolve staff work queue operational exceptions');
    }
  }

  /**
   * Layer 2: Assert Role Authorization for Attendance Roster Modification
   * Only Teacher and Principal can modify daily attendance roll-call.
   */
  public assertCanModifyAttendanceRoster(ctx: SecurityUserContext): void {
    if (ctx.role !== 'TEACHER' && ctx.role !== 'PRINCIPAL') {
      throw new Error(`AUTH_ROLE_PERMISSION_ERROR: Role '${ctx.role}' is forbidden from modifying class attendance rosters`);
    }
  }

  /**
   * Layer 2: Assert Role Authorization for Facility Safety Re-inspection
   * Only Facilities Manager and Principal can perform independent safety re-inspection and restore operational state.
   */
  public assertCanReinspectAssetSafety(ctx: SecurityUserContext): void {
    if (ctx.role !== 'FACILITIES_MANAGER' && ctx.role !== 'PRINCIPAL') {
      throw new Error(
        `AUTH_ROLE_PERMISSION_ERROR: Role '${ctx.role}' is forbidden from conducting facility safety re-inspections or restoring out-of-service assets`
      );
    }
  }

  /**
   * Layer 2: Assert Role Authorization for Learning Evidence Ownership & Portfolio Publishing
   * Only Teacher and Principal can manage learning evidence ownership and publish developmental portfolios.
   */
  public assertCanModifyLearningEvidence(ctx: SecurityUserContext): void {
    if (ctx.role !== 'TEACHER' && ctx.role !== 'PRINCIPAL') {
      throw new Error(
        `AUTH_ROLE_PERMISSION_ERROR: Role '${ctx.role}' is forbidden from altering learning evidence ownership or publishing portfolios`
      );
    }
  }

  /**
   * Layer 2: Assert Role Authorization for Workforce Shift & Leave Approval
   * Facilities Manager & Accountant CANNOT approve teacher workforce leave outside their role.
   */
  public assertCanApproveWorkforceLeave(ctx: SecurityUserContext): void {
    if (ctx.role !== 'PRINCIPAL' && ctx.role !== 'TEACHER') {
      throw new Error(
        `AUTH_ROLE_PERMISSION_ERROR: Role '${ctx.role}' is not authorized to approve workforce leave or substitute teacher coverage`
      );
    }
  }
}
