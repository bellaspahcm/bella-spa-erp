import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { IOrgUnitContract, OrgUnit } from '@/platform/org-unit';

type PreschoolChainClient = SupabaseClient<Database>;
type OrgRelationshipRow = Pick<
  Database['public']['Tables']['org_relationships']['Row'],
  'to_id' | 'rel_type' | 'since' | 'until'
>;
type OrgUnitScope = Pick<OrgUnit, 'id' | 'unitType' | 'isActive' | 'parentId'>;
type OrgUnitContractScope = Pick<IOrgUnitContract, 'getOrgUnit' | 'getOrgUnits'>;

function getDefaultOrgUnitContract(): OrgUnitContractScope {
  const platform = require('@/platform/org-unit') as { orgUnitEngine: OrgUnitContractScope };
  return platform.orgUnitEngine;
}

export interface AssignPreschoolChainInput {
  readonly tenantId: string;
  readonly courseId: string;
  readonly enrollmentId: string;
  readonly branchId: string;
  readonly actorUserId: string;
  readonly requestId: string;
}

export interface PreschoolChainAssignmentDTO {
  readonly tenantId: string;
  readonly courseId: string;
  readonly enrollmentId: string;
  readonly branchId: string;
  readonly requestId: string;
  readonly assignedBy: string | null;
}

export interface PreschoolBranchOption {
  readonly id: string;
  readonly name: string;
  readonly code?: string;
}

export class PreschoolChainService {
  public constructor(
    private readonly client: PreschoolChainClient,
    private readonly orgUnits: OrgUnitContractScope = getDefaultOrgUnitContract(),
  ) {}

  public async listAccessibleBranches(
    tenantId: string,
    actorUserId: string,
  ): Promise<PreschoolBranchOption[]> {
    if (!tenantId) throw new Error('PRESCHOOL_CHAIN_TENANT_REQUIRED');
    if (!actorUserId) throw new Error('PRESCHOOL_CHAIN_ACTOR_REQUIRED');

    const branches = await this.orgUnits.getOrgUnits({
      tenantId,
      unitType: 'branch',
      isActive: true,
    });

    if (await this.hasTenantWideBranchAccess(tenantId, actorUserId)) {
      return this.toBranchOptions(branches);
    }

    const person = await this.getActivePersonForUser(tenantId, actorUserId);
    if (!person) return [];

    const relationships = await this.getActiveUnitRelationships(tenantId, person.id);
    const orgUnitScopes = await this.orgUnits.getOrgUnits({ tenantId, isActive: true });
    const accessibleBranches = branches.filter((branch) =>
      this.isBranchAccessible(branch.id, relationships, orgUnitScopes),
    );

    return this.toBranchOptions(accessibleBranches);
  }

  public async assignEnrollmentToBranch(input: AssignPreschoolChainInput): Promise<PreschoolChainAssignmentDTO> {
    this.assertRequired(input);

    const branch = await this.getBranchOrThrow(input.tenantId, input.branchId);
    await this.assertUserCanAccessBranch(input.tenantId, input.actorUserId, branch.id);
    await this.assertNoConflictingCourseBranch(input.tenantId, input.courseId, branch.id);

    const courseRow = {
      tenant_id: input.tenantId,
      course_id: input.courseId,
      branch_id: branch.id,
      assigned_by: input.actorUserId,
      updated_at: new Date().toISOString(),
    };
    const { error: courseError } = await this.client
      .from('preschool_chain_course_branch_assignments')
      .upsert(courseRow, { onConflict: 'tenant_id,course_id' });

    if (courseError) {
      throw new Error(`PRESCHOOL_CHAIN_COURSE_ASSIGNMENT_FAILED: ${courseError.message}`);
    }

    const assignmentRow = {
      tenant_id: input.tenantId,
      enrollment_id: input.enrollmentId,
      course_id: input.courseId,
      branch_id: branch.id,
      request_id: input.requestId,
      assigned_by: input.actorUserId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.client
      .from('preschool_chain_enrollment_branch_assignments')
      .upsert(assignmentRow, { onConflict: 'tenant_id,enrollment_id' })
      .select('tenant_id, enrollment_id, course_id, branch_id, request_id, assigned_by')
      .single();

    if (error || !data) {
      throw new Error(`PRESCHOOL_CHAIN_ENROLLMENT_ASSIGNMENT_FAILED: ${error?.message ?? 'no assignment returned'}`);
    }

    return {
      tenantId: data.tenant_id,
      courseId: data.course_id,
      enrollmentId: data.enrollment_id,
      branchId: data.branch_id,
      requestId: data.request_id,
      assignedBy: data.assigned_by,
    };
  }

  public async getEnrollmentChain(
    tenantId: string,
    enrollmentId: string,
  ): Promise<PreschoolChainAssignmentDTO | null> {
    const { data, error } = await this.client
      .from('preschool_chain_enrollment_branch_assignments')
      .select('tenant_id, enrollment_id, course_id, branch_id, request_id, assigned_by')
      .eq('tenant_id', tenantId)
      .eq('enrollment_id', enrollmentId)
      .maybeSingle();

    if (error) {
      throw new Error(`PRESCHOOL_CHAIN_READBACK_FAILED: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return {
      tenantId: data.tenant_id,
      courseId: data.course_id,
      enrollmentId: data.enrollment_id,
      branchId: data.branch_id,
      requestId: data.request_id,
      assignedBy: data.assigned_by,
    };
  }

  private assertRequired(input: AssignPreschoolChainInput): void {
    if (!input.tenantId) throw new Error('PRESCHOOL_CHAIN_TENANT_REQUIRED');
    if (!input.courseId) throw new Error('PRESCHOOL_CHAIN_COURSE_REQUIRED');
    if (!input.enrollmentId) throw new Error('PRESCHOOL_CHAIN_ENROLLMENT_REQUIRED');
    if (!input.branchId) throw new Error('PRESCHOOL_CHAIN_BRANCH_REQUIRED');
    if (!input.actorUserId) throw new Error('PRESCHOOL_CHAIN_ACTOR_REQUIRED');
    if (!input.requestId) throw new Error('PRESCHOOL_CHAIN_REQUEST_REQUIRED');
  }

  private async getBranchOrThrow(tenantId: string, branchId: string): Promise<OrgUnitScope> {
    const branch = await this.orgUnits.getOrgUnit(branchId, tenantId);

    if (!branch || branch.unitType !== 'branch' || !branch.isActive) {
      throw new Error('PRESCHOOL_CHAIN_BRANCH_NOT_ACTIVE_IN_TENANT');
    }

    return branch;
  }

  private async assertNoConflictingCourseBranch(tenantId: string, courseId: string, branchId: string): Promise<void> {
    const { data, error } = await this.client
      .from('preschool_chain_course_branch_assignments')
      .select('branch_id')
      .eq('tenant_id', tenantId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (error) {
      throw new Error(`PRESCHOOL_CHAIN_COURSE_BRANCH_LOOKUP_FAILED: ${error.message}`);
    }
    if (data && data.branch_id !== branchId) {
      throw new Error('PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT');
    }
  }

  private async assertUserCanAccessBranch(tenantId: string, userId: string, branchId: string): Promise<void> {
    if (await this.hasTenantWideBranchAccess(tenantId, userId)) {
      return;
    }

    const person = await this.getActivePersonForUser(tenantId, userId);
    if (!person) {
      throw new Error('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED');
    }

    const [relationships, orgUnits] = await Promise.all([
      this.getActiveUnitRelationships(tenantId, person.id),
      this.orgUnits.getOrgUnits({ tenantId, isActive: true }),
    ]);

    if (!this.isBranchAccessible(branchId, relationships, orgUnits)) {
      throw new Error('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED');
    }
  }

  private async hasTenantWideBranchAccess(tenantId: string, userId: string): Promise<boolean> {
    const { data: user, error: userError } = await this.client
      .from('users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      throw new Error(`PRESCHOOL_CHAIN_USER_LOOKUP_FAILED: ${userError.message}`);
    }

    const role = user?.role?.toLowerCase();
    return role === 'admin' || role === 'super_admin';
  }

  private async getActivePersonForUser(tenantId: string, userId: string): Promise<{ id: string } | null> {
    const { data: person, error: personError } = await this.client
      .from('people_directory')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (personError) {
      throw new Error(`PRESCHOOL_CHAIN_PERSON_LOOKUP_FAILED: ${personError.message}`);
    }

    return person;
  }

  private async getActiveUnitRelationships(tenantId: string, personId: string): Promise<OrgRelationshipRow[]> {
    const { data, error } = await this.client
      .from('org_relationships')
      .select('to_id, rel_type, since, until')
      .eq('tenant_id', tenantId)
      .eq('from_id', personId)
      .eq('from_type', 'person')
      .eq('to_type', 'unit')
      .in('rel_type', ['belongs_to', 'manages', 'participates_in']);

    if (error) {
      throw new Error(`PRESCHOOL_CHAIN_RELATIONSHIP_LOOKUP_FAILED: ${error.message}`);
    }

    const today = new Date().toISOString().slice(0, 10);
    return (data ?? []).filter((relationship) => {
      const startsBeforeToday = !relationship.since || relationship.since <= today;
      const endsAfterToday = !relationship.until || relationship.until >= today;
      return startsBeforeToday && endsAfterToday;
    });
  }

  private isBranchAccessible(
    branchId: string,
    relationships: readonly OrgRelationshipRow[],
    orgUnits: readonly OrgUnitScope[],
  ): boolean {
    const childrenByParent = new Map<string, string[]>();
    for (const unit of orgUnits) {
      if (!unit.parentId) continue;
      const children = childrenByParent.get(unit.parentId) ?? [];
      children.push(unit.id);
      childrenByParent.set(unit.parentId, children);
    }

    const visited = new Set<string>();
    const queue = relationships.map((relationship) => relationship.to_id);
    while (queue.length > 0) {
      const unitId = queue.shift();
      if (!unitId || visited.has(unitId)) continue;
      if (unitId === branchId) return true;
      visited.add(unitId);
      queue.push(...(childrenByParent.get(unitId) ?? []));
    }

    return false;
  }

  private toBranchOptions(branches: readonly Pick<OrgUnit, 'id' | 'name' | 'code'>[]): PreschoolBranchOption[] {
    return branches
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'));
  }
}
