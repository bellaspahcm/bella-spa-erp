'use server';

import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { safeRevalidatePath } from '@/lib/revalidate';
import {
  buildServicePackagePayload,
  buildServicePackageUpdatePayload,
} from '@/lib/business-rules/service-package';
import {
  TENANT_PRIMARY_BUSINESS_MODULE_KEYS,
  getDefaultTenantModuleKey,
  normalizeEnabledModulesForSave,
  type TenantEnabledModules,
  type TenantPrimaryBusinessModuleKey,
} from '@/lib/business-rules/tenant-modules';
import { getAuthorizedTenantUser } from '@/core/services/auth';
import type { Database, Json } from '@/types/database.types';

type PackageRow = Database['public']['Tables']['packages']['Row'];
type PackageInsert = Database['public']['Tables']['packages']['Insert'];
type PackageUpdate = Database['public']['Tables']['packages']['Update'];
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type PackageActionInput = {
  name: string;
  price?: number | string | null;
  duration?: number | string | null;
  sessions?: number | string | null;
  total_sessions?: number | string | null;
  details?: string[] | string | null;
  offer?: string | null;
  ktv_commission?: number | string | null;
  status?: string | null;
  tenant_id?: string | null;
  session_multiplier?: number | string | null;
  module_key?: string | null;
  service_kind?: string | null;
  service_category?: string | null;
  default_duration_minutes?: number | string | null;
  requires_resource?: boolean | null;
  default_resource_type?: string | null;
  before_after_required?: boolean | null;
  care_note_template?: string | null;
};

type PackageActionResult = {
  data?: PackageRow;
  error?: string;
};

type DeletePackageResult = {
  success?: true;
  error?: string;
};

const PACKAGE_READ_ROLES = ['admin', 'super_admin', 'admin_staff', 'hr', 'accountant'] as const;
const PACKAGE_MANAGE_ROLES = ['admin', 'super_admin', 'admin_staff'] as const;
const PACKAGE_MODULE_SCOPE_ERROR = 'Gói dịch vụ không thuộc module ngành được Admin HQ cấp cho tenant này.';
const PACKAGE_MODULE_SETUP_ERROR = 'Không thể tải cấu hình module ngành của đơn vị kinh doanh.';

type PackageTenantModuleScope = {
  enabledModules: TenantEnabledModules;
  enabledModuleKeys: TenantPrimaryBusinessModuleKey[];
  defaultModuleKey: TenantPrimaryBusinessModuleKey;
};

type TenantModuleScopeResult =
  | { success: true; scope: PackageTenantModuleScope }
  | { success: false; error: string };

type PackageModuleResult =
  | { success: true; moduleKey: TenantPrimaryBusinessModuleKey }
  | { success: false; error: string };
const PACKAGE_AUTH_ERROR = 'Không có quyền quản lý gói dịch vụ.';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function createPackageDataClient(): Promise<SupabaseClient> {
  if (process.env.NODE_ENV === 'test') {
    return createClient();
  }

  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  if (!url || !serviceKey) {
    return createClient();
  }

  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  return createAdminClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseClient;
}

function isServicePackageModuleKey(value: unknown): value is TenantPrimaryBusinessModuleKey {
  return typeof value === 'string'
    && TENANT_PRIMARY_BUSINESS_MODULE_KEYS.includes(value as TenantPrimaryBusinessModuleKey);
}

function getEnabledModuleKeys(enabledModules: TenantEnabledModules) {
  return TENANT_PRIMARY_BUSINESS_MODULE_KEYS
    .filter(moduleKey => enabledModules[moduleKey])
    .map(moduleKey => moduleKey === 'babycare' ? 'baby_care' : moduleKey);
}

function normalizeTenantId(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function assertClientTenantScope(inputTenantId: string | null | undefined, authTenantId: string) {
  const normalizedInputTenantId = normalizeTenantId(inputTenantId);
  if (!normalizedInputTenantId || normalizedInputTenantId === authTenantId) return null;
  return 'Không thể thao tác gói dịch vụ ngoài đơn vị kinh doanh hiện tại.';
}

function buildPackageInsert(packageData: PackageActionInput): PackageInsert {
  return buildServicePackagePayload(packageData);
}

function buildPackageUpdate(packageData: Partial<PackageActionInput>): PackageUpdate {
  return buildServicePackageUpdatePayload(packageData);
}

async function getTenantModuleScope(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<TenantModuleScopeResult> {
  const { data, error } = await supabase
    .from('tenants')
    .select('enabled_modules')
    .eq('id', tenantId)
    .single();

  if (error) {
    return { success: false, error: `${PACKAGE_MODULE_SETUP_ERROR}: ${error.message}` };
  }
  if (!data) {
    return { success: false, error: PACKAGE_MODULE_SETUP_ERROR };
  }

  const enabledModules = normalizeEnabledModulesForSave(data.enabled_modules);
  return {
    success: true,
    scope: {
      enabledModules,
      enabledModuleKeys: getEnabledModuleKeys(enabledModules),
      defaultModuleKey: getDefaultTenantModuleKey(enabledModules),
    },
  };
}

function resolvePackageModuleForTenant(
  requestedModuleKey: string | null | undefined,
  scope: PackageTenantModuleScope,
): PackageModuleResult {
  const normalizedRequestedModule = requestedModuleKey?.trim().toLowerCase();
  const targetModule = normalizedRequestedModule === 'baby_care' ? 'babycare' : normalizedRequestedModule;
  const moduleKey = isServicePackageModuleKey(targetModule)
    ? targetModule
    : scope.defaultModuleKey;

  if (!scope.enabledModules[moduleKey]) {
    return { success: false, error: PACKAGE_MODULE_SCOPE_ERROR };
  }

  return { success: true, moduleKey };
}

function toAuditJson(value: PackageRow | PackageInsert | PackageUpdate): Json {
  return value as Json;
}

async function recordPackageAudit(payload: {
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  old_data?: Json;
  new_data?: Json;
}) {
  const { recordAuditLog } = await import('./audit-actions');
  return recordAuditLog({
    action: payload.action,
    table_name: 'packages',
    record_id: payload.record_id,
    old_data: payload.old_data,
    new_data: payload.new_data,
  });
}

async function rollbackCreatePackage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  insertedId: string,
  tenantId: string,
) {
  const { error } = await supabase
    .from('packages')
    .delete()
    .eq('id', insertedId)
    .eq('tenant_id', tenantId);

  return error?.message || null;
}

async function rollbackUpdatePackage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  packageId: string,
  oldPackage: PackageRow,
  tenantId: string,
) {
  const restorePayload: PackageUpdate = oldPackage;
  const { error } = await supabase
    .from('packages')
    .update(restorePayload)
    .eq('id', packageId)
    .eq('tenant_id', tenantId);

  return error?.message || null;
}

async function rollbackDeletePackage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  oldPackage: PackageRow,
) {
  const restorePayload: PackageInsert = oldPackage;
  const { error } = await supabase
    .from('packages')
    .insert([restorePayload]);

  return error?.message || null;
}

function withRollbackError(error: unknown, fallback: string, rollbackError: string | null) {
  const actionError = getErrorMessage(error, fallback);
  return rollbackError ? `${actionError}; Rollback failed: ${rollbackError}` : actionError;
}

export async function getPackages(): Promise<PackageRow[]> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: PACKAGE_READ_ROLES,
    errorMessage: PACKAGE_AUTH_ERROR,
  });
  if (!auth.ok) {
    throw new Error(auth.error);
  }

  const supabase = await createPackageDataClient();
  const moduleScope = await getTenantModuleScope(supabase, auth.tenantId);
  if (!moduleScope.success) {
    throw new Error(moduleScope.error);
  }

  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .in('module_key', moduleScope.scope.enabledModuleKeys)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch packages: ${error.message}`);
  }
  return data || [];
}

export async function createPackage(packageData: PackageActionInput): Promise<PackageActionResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: PACKAGE_MANAGE_ROLES,
    errorMessage: PACKAGE_AUTH_ERROR,
  });
  if (!auth.ok) {
    return { error: auth.error };
  }

  const tenantScopeError = assertClientTenantScope(packageData.tenant_id, auth.tenantId);
  if (tenantScopeError) {
    return { error: tenantScopeError };
  }

  const supabase = await createPackageDataClient();
  const moduleScope = await getTenantModuleScope(supabase, auth.tenantId);
  if (!moduleScope.success) {
    return { error: moduleScope.error };
  }

  const scopedModule = resolvePackageModuleForTenant(packageData.module_key, moduleScope.scope);
  if (!scopedModule.success) {
    return { error: scopedModule.error };
  }

  const dbData = buildPackageInsert({
    ...packageData,
    tenant_id: auth.tenantId,
    module_key: scopedModule.moduleKey,
  });
  if ((dbData.module_key as unknown) === 'babycare') {
    dbData.module_key = 'baby_care';
  }

  const { data, error } = await supabase
    .from('packages')
    .insert([dbData])
    .select();

  if (error) {
    return { error: error.message };
  }

  const insertedPackage = data?.[0];
  if (insertedPackage) {
    try {
      await recordPackageAudit({
        action: 'INSERT',
        record_id: insertedPackage.id,
        new_data: toAuditJson(insertedPackage),
      });
    } catch (auditError) {
      const rollbackError = await rollbackCreatePackage(supabase, insertedPackage.id, auth.tenantId);
      return {
        error: withRollbackError(auditError, 'Failed to record createPackage audit log', rollbackError),
      };
    }
  }

  safeRevalidatePath('/dashboard/services');
  return { data: insertedPackage };
}

export async function updatePackage(
  id: string,
  packageData: Partial<PackageActionInput>,
): Promise<PackageActionResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: PACKAGE_MANAGE_ROLES,
    errorMessage: PACKAGE_AUTH_ERROR,
  });
  if (!auth.ok) {
    return { error: auth.error };
  }

  const tenantScopeError = assertClientTenantScope(packageData.tenant_id, auth.tenantId);
  if (tenantScopeError) {
    return { error: tenantScopeError };
  }

  const supabase = await createPackageDataClient();
  const moduleScope = await getTenantModuleScope(supabase, auth.tenantId);
  if (!moduleScope.success) {
    return { error: moduleScope.error };
  }

  const { data: oldPackage, error: existingError } = await supabase
    .from('packages')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .single();

  if (existingError) {
    return { error: existingError.message };
  }
  if (!oldPackage) {
    return { error: 'Package not found' };
  }

  const currentModule = resolvePackageModuleForTenant(oldPackage.module_key, moduleScope.scope);
  if (!currentModule.success) {
    return { error: currentModule.error };
  }

  const nextModule = packageData.module_key === undefined
    ? currentModule
    : resolvePackageModuleForTenant(packageData.module_key, moduleScope.scope);
  if (!nextModule.success) {
    return { error: nextModule.error };
  }

  const dbData = buildPackageUpdate({
    ...packageData,
    tenant_id: undefined,
  });
  if (packageData.module_key !== undefined) {
    dbData.module_key = nextModule.moduleKey === 'babycare'
      ? 'baby_care'
      : (nextModule.moduleKey as PackageUpdate['module_key']);
  }

  const { data, error } = await supabase
    .from('packages')
    .update(dbData)
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select();

  if (error) {
    return { error: error.message };
  }

  const updatedPackage = data?.[0];
  if (updatedPackage) {
    try {
      await recordPackageAudit({
        action: 'UPDATE',
        record_id: id,
        old_data: toAuditJson(oldPackage),
        new_data: toAuditJson(dbData),
      });
    } catch (auditError) {
      const rollbackError = await rollbackUpdatePackage(supabase, id, oldPackage, auth.tenantId);
      return {
        error: withRollbackError(auditError, 'Failed to record updatePackage audit log', rollbackError),
      };
    }
  }

  safeRevalidatePath('/dashboard/services');
  return { data: updatedPackage };
}

export async function deletePackage(id: string): Promise<DeletePackageResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: PACKAGE_MANAGE_ROLES,
    errorMessage: PACKAGE_AUTH_ERROR,
  });
  if (!auth.ok) {
    return { error: auth.error };
  }

  const supabase = await createPackageDataClient();
  const moduleScope = await getTenantModuleScope(supabase, auth.tenantId);
  if (!moduleScope.success) {
    return { error: moduleScope.error };
  }

  const { data: oldPackage, error: existingError } = await supabase
    .from('packages')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .single();

  if (existingError) {
    return { error: existingError.message };
  }
  if (!oldPackage) {
    return { error: 'Package not found' };
  }

  const currentModule = resolvePackageModuleForTenant(oldPackage.module_key, moduleScope.scope);
  if (!currentModule.success) {
    return { error: currentModule.error };
  }

  const { error } = await supabase
    .from('packages')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenantId);

  if (error) {
    return { error: error.message };
  }

  try {
    await recordPackageAudit({
      action: 'DELETE',
      record_id: id,
      old_data: toAuditJson(oldPackage),
    });
  } catch (auditError) {
    const rollbackError = await rollbackDeletePackage(supabase, oldPackage);
    return {
      error: withRollbackError(auditError, 'Failed to record deletePackage audit log', rollbackError),
    };
  }

  safeRevalidatePath('/dashboard/services');
  return { success: true };
}
