'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import type { Database, Json } from '@/types/database.types';

type PackageRow = Database['public']['Tables']['packages']['Row'];
type PackageInsert = Database['public']['Tables']['packages']['Insert'];
type PackageUpdate = Database['public']['Tables']['packages']['Update'];

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
  session_multiplier?: number | null;
};

type PackageActionResult = {
  data?: PackageRow;
  error?: string;
};

type DeletePackageResult = {
  success?: true;
  error?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function parseNumericValue(value: number | string | null | undefined, fallback: number) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value !== 'string') return fallback;

  const normalized = value.replace(/[^\d.-]/g, '');
  if (!normalized) return fallback;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDetails(details: PackageActionInput['details']) {
  if (Array.isArray(details)) return details;
  if (typeof details === 'string') {
    return details.split(',').map(detail => detail.trim()).filter(Boolean);
  }
  return [];
}

function buildPackageInsert(packageData: PackageActionInput): PackageInsert {
  const payload: PackageInsert = {
    name: packageData.name,
    price: parseNumericValue(packageData.price, 0),
    duration: packageData.duration?.toString() || '90 phút/buổi',
    total_sessions: parseNumericValue(packageData.total_sessions ?? packageData.sessions, 10),
    details: normalizeDetails(packageData.details),
    offer: packageData.offer || '',
    ktv_commission: parseNumericValue(packageData.ktv_commission, 150000),
    status: packageData.status || 'active',
  };

  if (packageData.tenant_id) payload.tenant_id = packageData.tenant_id;
  if (packageData.session_multiplier !== undefined) payload.session_multiplier = packageData.session_multiplier;

  return payload;
}

function buildPackageUpdate(packageData: Partial<PackageActionInput>): PackageUpdate {
  const payload: PackageUpdate = {};

  if (packageData.name !== undefined) payload.name = packageData.name;
  if (packageData.price !== undefined) payload.price = parseNumericValue(packageData.price, 0);
  if (packageData.duration !== undefined) payload.duration = packageData.duration?.toString() || '90 phút/buổi';
  if (packageData.total_sessions !== undefined || packageData.sessions !== undefined) {
    payload.total_sessions = parseNumericValue(packageData.total_sessions ?? packageData.sessions, 10);
  }
  if (packageData.details !== undefined) payload.details = normalizeDetails(packageData.details);
  if (packageData.offer !== undefined) payload.offer = packageData.offer || '';
  if (packageData.ktv_commission !== undefined) {
    payload.ktv_commission = parseNumericValue(packageData.ktv_commission, 150000);
  }
  if (packageData.status !== undefined) payload.status = packageData.status || 'active';
  if (packageData.tenant_id !== undefined) payload.tenant_id = packageData.tenant_id;
  if (packageData.session_multiplier !== undefined) payload.session_multiplier = packageData.session_multiplier;

  return payload;
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
) {
  const { error } = await supabase
    .from('packages')
    .delete()
    .eq('id', insertedId);

  return error?.message || null;
}

async function rollbackUpdatePackage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  packageId: string,
  oldPackage: PackageRow,
) {
  const restorePayload: PackageUpdate = oldPackage;
  const { error } = await supabase
    .from('packages')
    .update(restorePayload)
    .eq('id', packageId);

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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch packages: ${error.message}`);
  }
  return data || [];
}

export async function createPackage(packageData: PackageActionInput): Promise<PackageActionResult> {
  const supabase = await createClient();
  const dbData = buildPackageInsert(packageData);

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
      const rollbackError = await rollbackCreatePackage(supabase, insertedPackage.id);
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
  const supabase = await createClient();

  const { data: oldPackage, error: existingError } = await supabase
    .from('packages')
    .select('*')
    .eq('id', id)
    .single();

  if (existingError) {
    return { error: existingError.message };
  }
  if (!oldPackage) {
    return { error: 'Package not found' };
  }

  const dbData = buildPackageUpdate(packageData);
  const { data, error } = await supabase
    .from('packages')
    .update(dbData)
    .eq('id', id)
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
      const rollbackError = await rollbackUpdatePackage(supabase, id, oldPackage);
      return {
        error: withRollbackError(auditError, 'Failed to record updatePackage audit log', rollbackError),
      };
    }
  }

  safeRevalidatePath('/dashboard/services');
  return { data: updatedPackage };
}

export async function deletePackage(id: string): Promise<DeletePackageResult> {
  const supabase = await createClient();

  const { data: oldPackage, error: existingError } = await supabase
    .from('packages')
    .select('*')
    .eq('id', id)
    .single();

  if (existingError) {
    return { error: existingError.message };
  }
  if (!oldPackage) {
    return { error: 'Package not found' };
  }

  const { error } = await supabase
    .from('packages')
    .delete()
    .eq('id', id);

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
