'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import {
  buildServicePackagePayload,
  buildServicePackageUpdatePayload,
} from '@/lib/business-rules/service-package';
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function buildPackageInsert(packageData: PackageActionInput): PackageInsert {
  return buildServicePackagePayload(packageData);
}

function buildPackageUpdate(packageData: Partial<PackageActionInput>): PackageUpdate {
  return buildServicePackageUpdatePayload(packageData);
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
