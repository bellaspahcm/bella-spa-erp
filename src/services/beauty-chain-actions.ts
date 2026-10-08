'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';
import type { Database, Json } from '@/types/database.types';
import { getCurrentUser } from './user-actions';

type OrgUnitRow = Pick<
  Database['public']['Tables']['org_units']['Row'],
  'id' | 'tenant_id' | 'unit_type' | 'name' | 'code' | 'parent_id' | 'is_active' | 'metadata'
>;
type OrgUnitInsert = Database['public']['Tables']['org_units']['Insert'];
type OrgRelationshipInsert = Database['public']['Tables']['org_relationships']['Insert'];
type OrgRelationshipRow = Pick<
  Database['public']['Tables']['org_relationships']['Row'],
  'id' | 'from_id' | 'to_id' | 'rel_type' | 'role' | 'since' | 'until'
>;
type PeopleDirectoryRow = Pick<
  Database['public']['Tables']['people_directory']['Row'],
  'id' | 'tenant_id' | 'user_id' | 'display_name' | 'person_type' | 'is_active'
>;
type PeopleDirectoryInsert = Database['public']['Tables']['people_directory']['Insert'];
type UserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'tenant_id' | 'email' | 'full_name' | 'role' | 'status'
>;
type AccessRow = Pick<
  Database['public']['Views']['user_org_unit_access']['Row'],
  'user_id' | 'org_unit_id' | 'access_source'
>;

type ChainActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type BeautyChainCompany = {
  id: string;
  name: string;
  code: string | null;
};

export type BeautyChainBranch = {
  id: string;
  name: string;
  code: string | null;
  companyId: string | null;
  staffCount: number;
};

export type BeautyChainStaff = {
  userId: string;
  personId: string | null;
  fullName: string;
  email: string;
  role: string;
  status: string | null;
  branchIds: string[];
};

export type BeautyChainSnapshot = {
  company: BeautyChainCompany | null;
  branches: BeautyChainBranch[];
  staff: BeautyChainStaff[];
};

export type CreateBeautyCompanyInput = {
  name: string;
  code?: string;
};

export type CreateBeautyBranchInput = {
  name: string;
  code?: string;
  companyId: string;
};

export type LinkBeautyStaffInput = {
  userId: string;
};

export type AssignBeautyStaffToBranchInput = {
  userId: string;
  branchId: string;
};

const STAFF_REL_TYPES = ['belongs_to', 'manages', 'participates_in'] as const;
const BEAUTY_CHAIN_PATH = '/dashboard/beauty-spa-v2/chain';
const AUTH_BACKED_STAFF_REQUIRED_ERROR =
  'Nhân sự này chưa có tài khoản đăng nhập hợp lệ. Vui lòng tạo hoặc khôi phục tài khoản đăng nhập trước khi gán vào chi nhánh.';

function normalizeText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function isAdminRole(role: string | null | undefined) {
  const normalized = role?.toLowerCase();
  return normalized === 'admin' || normalized === 'super_admin';
}

function toError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type BeautyChainAuth = { tenantId: string };

async function requireBeautyChainAdmin(): Promise<{ success: true; auth: BeautyChainAuth } | { success: false; error: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant_id) {
    return { success: false, error: 'Không xác định được tenant hiện tại.' };
  }
  if (!isAdminRole(currentUser.role)) {
    return { success: false, error: 'Chỉ quản trị viên tenant được quản lý chuỗi.' };
  }
  return {
    success: true,
    auth: {
      tenantId: currentUser.tenant_id,
    },
  };
}

function mapCompany(unit: OrgUnitRow): BeautyChainCompany {
  return {
    id: unit.id,
    name: unit.name,
    code: unit.code,
  };
}

function mapBranch(unit: OrgUnitRow, staffCount: number): BeautyChainBranch {
  return {
    id: unit.id,
    name: unit.name,
    code: unit.code,
    companyId: unit.parent_id,
    staffCount,
  };
}

function buildSnapshot(params: {
  orgUnits: OrgUnitRow[];
  users: UserRow[];
  people: PeopleDirectoryRow[];
  relationships: OrgRelationshipRow[];
  accessRows: AccessRow[];
}): BeautyChainSnapshot {
  const company = params.orgUnits.find((unit) => unit.unit_type === 'company') ?? null;
  const branches = params.orgUnits.filter((unit) => unit.unit_type === 'branch');
  const personByUserId = new Map(
    params.people
      .filter((person) => person.user_id)
      .map((person) => [person.user_id as string, person]),
  );
  const branchIds = new Set(branches.map((branch) => branch.id));
  const staffBranchIdsByPersonId = new Map<string, Set<string>>();

  for (const rel of params.relationships) {
    if (!branchIds.has(rel.to_id)) continue;
    if (!STAFF_REL_TYPES.includes(rel.rel_type as (typeof STAFF_REL_TYPES)[number])) continue;
    if (rel.until && rel.until < new Date().toISOString().slice(0, 10)) continue;
    const set = staffBranchIdsByPersonId.get(rel.from_id) ?? new Set<string>();
    set.add(rel.to_id);
    staffBranchIdsByPersonId.set(rel.from_id, set);
  }

  const projectedBranchIdsByUserId = new Map<string, Set<string>>();
  for (const access of params.accessRows) {
    if (!access.user_id || !access.org_unit_id || !branchIds.has(access.org_unit_id)) continue;
    const set = projectedBranchIdsByUserId.get(access.user_id) ?? new Set<string>();
    set.add(access.org_unit_id);
    projectedBranchIdsByUserId.set(access.user_id, set);
  }

  const staff = params.users.map((user) => {
    const person = personByUserId.get(user.id) ?? null;
    const relationshipBranchIds = person ? staffBranchIdsByPersonId.get(person.id) : undefined;
    const projectionBranchIds = projectedBranchIdsByUserId.get(user.id);
    const branchIdsForUser = Array.from(relationshipBranchIds ?? projectionBranchIds ?? new Set<string>()).sort();

    return {
      userId: user.id,
      personId: person?.id ?? null,
      fullName: user.full_name || user.email,
      email: user.email,
      role: user.role,
      status: user.status,
      branchIds: branchIdsForUser,
    };
  });

  const staffCountByBranchId = new Map<string, number>();
  for (const member of staff) {
    for (const branchId of member.branchIds) {
      staffCountByBranchId.set(branchId, (staffCountByBranchId.get(branchId) ?? 0) + 1);
    }
  }

  return {
    company: company ? mapCompany(company) : null,
    branches: branches.map((branch) => mapBranch(branch, staffCountByBranchId.get(branch.id) ?? 0)),
    staff,
  };
}

export async function getBeautyChainSnapshot(): Promise<ChainActionResult<BeautyChainSnapshot>> {
  try {
    const auth = await requireBeautyChainAdmin();
    if (!auth.success) return { success: false, error: auth.error };
    const { tenantId } = auth.auth;

    const supabase = await createClient();
    const [orgUnitsResult, usersResult, peopleResult, relationshipsResult, accessResult] = await Promise.all([
      supabase
        .from('org_units')
        .select('id, tenant_id, unit_type, name, code, parent_id, is_active, metadata')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('unit_type', ['company', 'branch'])
        .order('unit_type')
        .order('name'),
      supabase
        .from('users')
        .select('id, tenant_id, email, full_name, role, status')
        .eq('tenant_id', tenantId)
        .neq('role', 'customer')
        .order('full_name'),
      supabase
        .from('people_directory')
        .select('id, tenant_id, user_id, display_name, person_type, is_active')
        .eq('tenant_id', tenantId)
        .eq('person_type', 'employee')
        .eq('is_active', true),
      supabase
        .from('org_relationships')
        .select('id, from_id, to_id, rel_type, role, since, until')
        .eq('tenant_id', tenantId)
        .eq('from_type', 'person')
        .eq('to_type', 'unit')
        .in('rel_type', [...STAFF_REL_TYPES]),
      supabase
        .from('user_org_unit_access')
        .select('user_id, org_unit_id, access_source')
        .eq('tenant_id', tenantId),
    ]);

    if (orgUnitsResult.error) return { success: false, error: orgUnitsResult.error.message };
    if (usersResult.error) return { success: false, error: usersResult.error.message };
    if (peopleResult.error) return { success: false, error: peopleResult.error.message };
    if (relationshipsResult.error) return { success: false, error: relationshipsResult.error.message };
    if (accessResult.error) return { success: false, error: accessResult.error.message };

    return {
      success: true,
      data: buildSnapshot({
        orgUnits: (orgUnitsResult.data ?? []) as OrgUnitRow[],
        users: (usersResult.data ?? []) as UserRow[],
        people: (peopleResult.data ?? []) as PeopleDirectoryRow[],
        relationships: (relationshipsResult.data ?? []) as OrgRelationshipRow[],
        accessRows: (accessResult.data ?? []) as AccessRow[],
      }),
    };
  } catch (error: unknown) {
    return { success: false, error: toError(error, 'Không thể tải Chain Management.') };
  }
}

export async function createBeautyCompany(input: CreateBeautyCompanyInput): Promise<ChainActionResult<BeautyChainCompany>> {
  try {
    const auth = await requireBeautyChainAdmin();
    if (!auth.success) return { success: false, error: auth.error };
    const { tenantId } = auth.auth;

    const name = normalizeText(input.name);
    if (!name) return { success: false, error: 'Tên doanh nghiệp là bắt buộc.' };

    const supabase = await createClient();
    const existing = await supabase
      .from('org_units')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('unit_type', 'company')
      .eq('is_active', true)
      .maybeSingle();

    if (existing.error) return { success: false, error: existing.error.message };
    if (existing.data) return { success: false, error: 'Tenant đã có Company. MVP chỉ hỗ trợ một Company.' };

    const payload: OrgUnitInsert = {
      tenant_id: tenantId,
      unit_type: 'company',
      name,
      code: normalizeText(input.code),
      parent_id: null,
      is_active: true,
      metadata: { source: 'beauty_chain_mvp' } satisfies Json,
    };

    const { data, error } = await supabase
      .from('org_units')
      .insert(payload)
      .select('id, tenant_id, unit_type, name, code, parent_id, is_active, metadata')
      .single();

    if (error) return { success: false, error: error.message };
    await safeRevalidatePath(BEAUTY_CHAIN_PATH);
    return { success: true, data: mapCompany(data as OrgUnitRow) };
  } catch (error: unknown) {
    return { success: false, error: toError(error, 'Không thể tạo Company.') };
  }
}

export async function createBeautyBranch(input: CreateBeautyBranchInput): Promise<ChainActionResult<BeautyChainBranch>> {
  try {
    const auth = await requireBeautyChainAdmin();
    if (!auth.success) return { success: false, error: auth.error };
    const { tenantId } = auth.auth;

    const name = normalizeText(input.name);
    if (!name) return { success: false, error: 'Tên chi nhánh là bắt buộc.' };

    const supabase = await createClient();
    const company = await supabase
      .from('org_units')
      .select('id, tenant_id, unit_type, is_active')
      .eq('id', input.companyId)
      .eq('tenant_id', tenantId)
      .eq('unit_type', 'company')
      .eq('is_active', true)
      .maybeSingle();

    if (company.error) return { success: false, error: company.error.message };
    if (!company.data) return { success: false, error: 'Company không tồn tại trong tenant hiện tại.' };

    const payload: OrgUnitInsert = {
      tenant_id: tenantId,
      unit_type: 'branch',
      name,
      code: normalizeText(input.code),
      parent_id: input.companyId,
      is_active: true,
      metadata: { source: 'beauty_chain_mvp' } satisfies Json,
    };

    const { data, error } = await supabase
      .from('org_units')
      .insert(payload)
      .select('id, tenant_id, unit_type, name, code, parent_id, is_active, metadata')
      .single();

    if (error) return { success: false, error: error.message };
    await safeRevalidatePath(BEAUTY_CHAIN_PATH);
    return { success: true, data: mapBranch(data as OrgUnitRow, 0) };
  } catch (error: unknown) {
    return { success: false, error: toError(error, 'Không thể tạo chi nhánh.') };
  }
}

async function ensureStaffPerson(params: {
  tenantId: string;
  user: UserRow;
}): Promise<{ success: true; person: PeopleDirectoryRow } | { success: false; error: string }> {
  const supabase = await createClient();
  const existing = await supabase
    .from('people_directory')
    .select('id, tenant_id, user_id, display_name, person_type, is_active')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.user.id)
    .maybeSingle();

  if (existing.error) return { success: false, error: existing.error.message };
  if (existing.data) {
    const person = existing.data as PeopleDirectoryRow;
    if (!person.is_active) {
      const reactivate = await supabase
        .from('people_directory')
        .update({ is_active: true, display_name: params.user.full_name || params.user.email })
        .eq('id', person.id)
        .eq('tenant_id', params.tenantId)
        .select('id, tenant_id, user_id, display_name, person_type, is_active')
        .single();
      if (reactivate.error) return { success: false, error: reactivate.error.message };
      return { success: true, person: reactivate.data as PeopleDirectoryRow };
    }
    return { success: true, person };
  }

  const authGuard = await requireAuthBackedStaff(params.user);
  if (!authGuard.success) return { success: false, error: authGuard.error };

  const payload: PeopleDirectoryInsert = {
    tenant_id: params.tenantId,
    user_id: params.user.id,
    person_type: 'employee',
    display_name: params.user.full_name || params.user.email,
    is_active: true,
    metadata: { source: 'beauty_chain_mvp' } satisfies Json,
  };

  const inserted = await supabase
    .from('people_directory')
    .insert(payload)
    .select('id, tenant_id, user_id, display_name, person_type, is_active')
    .single();

  if (inserted.error) return { success: false, error: inserted.error.message };
  return { success: true, person: inserted.data as PeopleDirectoryRow };
}

async function requireAuthBackedStaff(user: UserRow): Promise<{ success: true } | { success: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      success: false,
      error: 'Hệ thống chưa cấu hình Supabase Admin để xác minh tài khoản đăng nhập của nhân sự.',
    };
  }

  const { data, error } = await admin.auth.admin.getUserById(user.id);
  if (error || !data?.user) {
    return { success: false, error: AUTH_BACKED_STAFF_REQUIRED_ERROR };
  }

  return { success: true };
}

export async function linkBeautyStaffPerson(input: LinkBeautyStaffInput): Promise<ChainActionResult<BeautyChainStaff>> {
  try {
    const auth = await requireBeautyChainAdmin();
    if (!auth.success) return { success: false, error: auth.error };
    const { tenantId } = auth.auth;

    const supabase = await createClient();
    const userResult = await supabase
      .from('users')
      .select('id, tenant_id, email, full_name, role, status')
      .eq('id', input.userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (userResult.error) return { success: false, error: userResult.error.message };
    if (!userResult.data) return { success: false, error: 'Nhân sự không tồn tại trong tenant hiện tại.' };

    const user = userResult.data as UserRow;
    const personResult = await ensureStaffPerson({ tenantId, user });
    if (!personResult.success) return { success: false, error: personResult.error };

    await safeRevalidatePath(BEAUTY_CHAIN_PATH);
    return {
      success: true,
      data: {
        userId: user.id,
        personId: personResult.person.id,
        fullName: user.full_name || user.email,
        email: user.email,
        role: user.role,
        status: user.status,
        branchIds: [],
      },
    };
  } catch (error: unknown) {
    return { success: false, error: toError(error, 'Không thể link nhân sự.') };
  }
}

export async function assignBeautyStaffToBranch(
  input: AssignBeautyStaffToBranchInput,
): Promise<ChainActionResult<{ relationshipId: string; personId: string; branchId: string }>> {
  try {
    const auth = await requireBeautyChainAdmin();
    if (!auth.success) return { success: false, error: auth.error };
    const { tenantId } = auth.auth;

    const supabase = await createClient();
    const [userResult, branchResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, tenant_id, email, full_name, role, status')
        .eq('id', input.userId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase
        .from('org_units')
        .select('id, tenant_id, unit_type, name, code, parent_id, is_active, metadata')
        .eq('id', input.branchId)
        .eq('tenant_id', tenantId)
        .eq('unit_type', 'branch')
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    if (userResult.error) return { success: false, error: userResult.error.message };
    if (branchResult.error) return { success: false, error: branchResult.error.message };
    if (!userResult.data) return { success: false, error: 'Nhân sự không tồn tại trong tenant hiện tại.' };
    if (!branchResult.data) return { success: false, error: 'Chi nhánh không tồn tại trong tenant hiện tại.' };

    const user = userResult.data as UserRow;
    const personResult = await ensureStaffPerson({ tenantId, user });
    if (!personResult.success) return { success: false, error: personResult.error };

    const existing = await supabase
      .from('org_relationships')
      .select('id, from_id, to_id, rel_type, role, since, until')
      .eq('tenant_id', tenantId)
      .eq('from_id', personResult.person.id)
      .eq('from_type', 'person')
      .eq('to_id', input.branchId)
      .eq('to_type', 'unit')
      .eq('rel_type', 'belongs_to')
      .maybeSingle();

    if (existing.error) return { success: false, error: existing.error.message };
    if (existing.data) {
      const relationship = existing.data as OrgRelationshipRow;
      await safeRevalidatePath(BEAUTY_CHAIN_PATH);
      return {
        success: true,
        data: {
          relationshipId: relationship.id,
          personId: personResult.person.id,
          branchId: input.branchId,
        },
      };
    }

    const payload: OrgRelationshipInsert = {
      tenant_id: tenantId,
      from_id: personResult.person.id,
      from_type: 'person',
      to_id: input.branchId,
      to_type: 'unit',
      rel_type: 'belongs_to',
      role: user.role,
      since: new Date().toISOString().slice(0, 10),
      metadata: { source: 'beauty_chain_mvp' } satisfies Json,
    };

    const inserted = await supabase
      .from('org_relationships')
      .insert(payload)
      .select('id, from_id, to_id, rel_type, role, since, until')
      .single();

    if (inserted.error) return { success: false, error: inserted.error.message };
    await safeRevalidatePath(BEAUTY_CHAIN_PATH);
    return {
      success: true,
      data: {
        relationshipId: (inserted.data as OrgRelationshipRow).id,
        personId: personResult.person.id,
        branchId: input.branchId,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: toError(error, 'Không thể gán nhân sự vào chi nhánh.') };
  }
}
