'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type BellaSupabaseClient = SupabaseClient<Database>;
type OrgUnitRow = Pick<
  Database['public']['Tables']['org_units']['Row'],
  'id' | 'parent_id' | 'unit_type'
>;
type UserOrgUnitAccessRow = Pick<
  Database['public']['Views']['user_org_unit_access']['Row'],
  'access_source' | 'org_unit_id' | 'root_org_unit_id' | 'user_id'
>;

export type BeautyBranchContext = {
  branchId: string;
  rootOrgUnitId: string;
};

export type BeautyBranchContextResult =
  | { success: true; context: BeautyBranchContext }
  | { success: false; error: string };

function collectDescendantBranchIds(unitId: string, orgUnits: OrgUnitRow[]) {
  const branches = new Set<string>();
  const childrenByParent = new Map<string, OrgUnitRow[]>();

  for (const unit of orgUnits) {
    if (!unit.parent_id) continue;
    const siblings = childrenByParent.get(unit.parent_id) ?? [];
    siblings.push(unit);
    childrenByParent.set(unit.parent_id, siblings);
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
    if (currentUnit.unit_type === 'branch') {
      return currentUnit.id;
    }
    currentUnit = currentUnit.parent_id ? orgUnitById.get(currentUnit.parent_id) ?? null : null;
  }

  return null;
}

function collectAccessibleBranchIds(accessRows: UserOrgUnitAccessRow[], orgUnits: OrgUnitRow[]) {
  const orgUnitById = new Map(orgUnits.map(unit => [unit.id, unit]));
  const branchIds = new Set<string>();

  for (const access of accessRows) {
    if (!access.org_unit_id) continue;

    const relatedUnit = orgUnitById.get(access.org_unit_id);
    if (!relatedUnit) continue;

    const ancestorBranchId = findAncestorBranchId(relatedUnit.id, orgUnitById);
    if (ancestorBranchId) {
      branchIds.add(ancestorBranchId);
      continue;
    }

    for (const branchId of collectDescendantBranchIds(relatedUnit.id, orgUnits)) {
      branchIds.add(branchId);
    }
  }

  return branchIds;
}

export async function resolveSingleStaffBranchContext(params: {
  supabase: BellaSupabaseClient;
  tenantId: string;
  userId: string;
  asOfDate: string;
  branchId?: string | null;
  missingMessage?: string;
  ambiguousMessage?: string;
  unauthorizedMessage?: string;
}): Promise<BeautyBranchContextResult> {
  const {
    supabase,
    tenantId,
    userId,
    asOfDate,
    branchId,
    missingMessage = 'Không xác định được chi nhánh hợp lệ cho nhân sự này',
    ambiguousMessage = 'Nhân sự có nhiều chi nhánh khả dụng; vui lòng chọn chi nhánh',
    unauthorizedMessage = 'Không có quyền thao tác tại chi nhánh này',
  } = params;

  const [accessResult, orgUnitsResult] = await Promise.all([
    supabase
      .from('user_org_unit_access')
      .select('access_source, org_unit_id, root_org_unit_id, user_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId),
    supabase
      .from('org_units')
      .select('id, parent_id, unit_type')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
  ]);

  if (accessResult.error) {
    return { success: false, error: accessResult.error.message };
  }
  if (orgUnitsResult.error) {
    return { success: false, error: orgUnitsResult.error.message };
  }

  const orgUnitRows = (orgUnitsResult.data ?? []) as OrgUnitRow[];
  const accessibleBranchIds = collectAccessibleBranchIds(
    (accessResult.data ?? []) as UserOrgUnitAccessRow[],
    orgUnitRows,
  );

  if (branchId) {
    const requestedBranch = orgUnitRows.find(unit => unit.id === branchId && unit.unit_type === 'branch');
    if (!requestedBranch || !accessibleBranchIds.has(branchId)) {
      return { success: false, error: unauthorizedMessage };
    }
    return { success: true, context: { branchId, rootOrgUnitId: branchId } };
  }

  if (accessibleBranchIds.size === 0) {
    return { success: false, error: missingMessage };
  }
  if (accessibleBranchIds.size > 1) {
    return { success: false, error: ambiguousMessage };
  }

  const [resolvedBranchId] = Array.from(accessibleBranchIds);
  return { success: true, context: { branchId: resolvedBranchId, rootOrgUnitId: resolvedBranchId } };
}
