'use server';

import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { getCurrentUser } from './user-actions';

type OrgUnitRow = Pick<
  Database['public']['Tables']['org_units']['Row'],
  'id' | 'tenant_id' | 'unit_type' | 'name' | 'code' | 'parent_id' | 'is_active'
>;
type AccessRow = Pick<
  Database['public']['Views']['user_org_unit_access']['Row'],
  'access_source' | 'org_unit_id' | 'root_org_unit_id' | 'tenant_id' | 'user_id'
>;

export type BeautyRuntimeBranch = {
  id: string;
  name: string;
  code: string | null;
  accessSource: string | null;
  rootOrgUnitId: string | null;
};

export type BeautyRuntimeBranchContext = {
  branches: BeautyRuntimeBranch[];
  activeBranchId: string | null;
  requiresSelection: boolean;
};

type RuntimeBranchActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const TENANT_WIDE_BRANCH_ROLES = new Set(['admin', 'super_admin']);

function isTenantWideRole(role: string | null | undefined) {
  return TENANT_WIDE_BRANCH_ROLES.has(role?.toLowerCase() ?? '');
}

function collectDescendantBranchIds(unitId: string, orgUnits: OrgUnitRow[]) {
  const branches = new Set<string>();
  const childrenByParent = new Map<string, OrgUnitRow[]>();

  for (const unit of orgUnits) {
    if (!unit.parent_id) continue;
    const children = childrenByParent.get(unit.parent_id) ?? [];
    children.push(unit);
    childrenByParent.set(unit.parent_id, children);
  }

  const queue = [...(childrenByParent.get(unitId) ?? [])];
  while (queue.length > 0) {
    const unit = queue.shift();
    if (!unit) continue;
    if (unit.unit_type === 'branch') {
      branches.add(unit.id);
      continue;
    }
    queue.push(...(childrenByParent.get(unit.id) ?? []));
  }

  return branches;
}

function findAncestorBranchId(unitId: string, orgUnitById: Map<string, OrgUnitRow>) {
  let currentUnit = orgUnitById.get(unitId) ?? null;

  while (currentUnit) {
    if (currentUnit.unit_type === 'branch') return currentUnit.id;
    currentUnit = currentUnit.parent_id ? orgUnitById.get(currentUnit.parent_id) ?? null : null;
  }

  return null;
}

function branchIdsFromAccess(accessRows: AccessRow[], orgUnits: OrgUnitRow[]) {
  const orgUnitById = new Map(orgUnits.map((unit) => [unit.id, unit]));
  const branchIds = new Map<string, AccessRow>();

  for (const access of accessRows) {
    if (!access.org_unit_id) continue;
    const unit = orgUnitById.get(access.org_unit_id);
    if (!unit) continue;

    const ancestorBranchId = findAncestorBranchId(unit.id, orgUnitById);
    if (ancestorBranchId) {
      branchIds.set(ancestorBranchId, access);
      continue;
    }

    for (const descendantBranchId of collectDescendantBranchIds(unit.id, orgUnits)) {
      branchIds.set(descendantBranchId, access);
    }
  }

  return branchIds;
}

function toRuntimeBranches(
  orgUnits: OrgUnitRow[],
  accessByBranchId: Map<string, AccessRow>,
  tenantWide: boolean,
): BeautyRuntimeBranch[] {
  return orgUnits
    .filter((unit) => unit.unit_type === 'branch')
    .filter((unit) => tenantWide || accessByBranchId.has(unit.id))
    .map((unit) => {
      const access = accessByBranchId.get(unit.id);
      return {
        id: unit.id,
        name: unit.name,
        code: unit.code,
        accessSource: tenantWide ? 'tenant_admin' : access?.access_source ?? null,
        rootOrgUnitId: tenantWide ? unit.id : access?.root_org_unit_id ?? access?.org_unit_id ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export async function getBeautyRuntimeBranchContext(
  selectedBranchId?: string | null,
): Promise<RuntimeBranchActionResult<BeautyRuntimeBranchContext>> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant_id) {
    return { success: false, error: 'Không xác định được tenant hiện tại.' };
  }

  const tenantId = currentUser.tenant_id;
  const supabase = await createClient();
  const tenantWide = isTenantWideRole(currentUser.role);

  const orgUnitsQuery = supabase
    .from('org_units')
    .select('id, tenant_id, unit_type, name, code, parent_id, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const [orgUnitsResult, accessResult] = await Promise.all([
    orgUnitsQuery,
    tenantWide
      ? Promise.resolve({ data: [] as AccessRow[], error: null })
      : supabase
        .from('user_org_unit_access')
        .select('access_source, org_unit_id, root_org_unit_id, tenant_id, user_id')
        .eq('tenant_id', tenantId)
        .eq('user_id', currentUser.id),
  ]);

  if (orgUnitsResult.error) return { success: false, error: orgUnitsResult.error.message };
  if (accessResult.error) return { success: false, error: accessResult.error.message };

  const orgUnits = (orgUnitsResult.data ?? []) as OrgUnitRow[];
  const accessByBranchId = branchIdsFromAccess((accessResult.data ?? []) as AccessRow[], orgUnits);
  const branches = toRuntimeBranches(orgUnits, accessByBranchId, tenantWide);
  const requestedBranchId = selectedBranchId ?? null;
  const selectedIsAllowed = requestedBranchId ? branches.some((branch) => branch.id === requestedBranchId) : false;
  const activeBranchId: string | null = selectedIsAllowed
    ? requestedBranchId
    : branches.length === 1
      ? branches[0]?.id ?? null
      : null;

  return {
    success: true,
    data: {
      branches,
      activeBranchId,
      requiresSelection: branches.length > 1 && !activeBranchId,
    },
  };
}

export async function selectBeautyRuntimeBranch(
  branchId: string,
): Promise<RuntimeBranchActionResult<{ activeBranchId: string }>> {
  const context = await getBeautyRuntimeBranchContext(branchId);
  if (!context.success) return context;
  if (context.data.activeBranchId !== branchId) {
    return { success: false, error: 'Không có quyền thao tác tại chi nhánh này.' };
  }

  return { success: true, data: { activeBranchId: branchId } };
}
