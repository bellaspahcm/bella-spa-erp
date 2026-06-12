'use server';

import { createClient } from '@/lib/supabase-server';
import { checkHqAuth } from './hq-actions';
import { HqPackageTemplate } from '@/types/domain';
import { safeRevalidatePath } from '@/lib/revalidate';
import { getCurrentUser } from './user-actions';
import {
  buildHqPackageTemplatePayload,
  buildTemplateDistributionBasePayload,
  resolveDistributedPackagePrice,
  validateTenantPackagePriceOverride,
} from '@/lib/business-rules/service-package';
import type { Database } from '@/types/database.types';

type PackageRow = Database['public']['Tables']['packages']['Row'];
type PackageInsert = Database['public']['Tables']['packages']['Insert'];
type PackageUpdate = Database['public']['Tables']['packages']['Update'];
type TenantRow = Pick<Database['public']['Tables']['tenants']['Row'], 'id' | 'name'>;
type DistributionResult =
  | { tenantId: string; success: true; action: 'updated' | 'created'; packageId: string }
  | { tenantId: string; success: false; error: string };

function getErrorMessage(error: unknown, fallback = 'Unexpected error') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
  return fallback;
}

/**
 * Fetches all package templates designed by HQ
 */
export async function getHqPackageTemplates(): Promise<HqPackageTemplate[]> {
  const authResult = await checkHqAuth();
  if (!authResult.authorized) {
    throw new Error(authResult.error || 'Unauthorized');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('is_hq_template', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch HQ package templates: ${error.message}`);
  }

  return (data || []) as HqPackageTemplate[];
}

/**
 * Creates a brand new HQ package template
 */
export async function createHqPackageTemplate(templateData: Partial<HqPackageTemplate>) {
  try {
    const authResult = await checkHqAuth();
    if (!authResult.authorized) {
      return { success: false, error: authResult.error || 'Unauthorized' };
    }

    const supabase = await createClient();
    const hqTenantId = authResult.user?.tenant_id;

    if (!templateData.name) {
      return { success: false, error: 'Tên gói dịch vụ là bắt buộc.' };
    }

    const templatePayload = buildHqPackageTemplatePayload(templateData, {
      tenantId: hqTenantId,
      isHqTemplate: true,
    });
    if (!templatePayload.success) {
      return { success: false, error: templatePayload.error };
    }
    const dbData: PackageInsert = templatePayload.payload;

    const { data, error } = await supabase
      .from('packages')
      .insert([dbData])
      .select()
      .single();

    if (error) {
      console.error('[createHqPackageTemplate] DB Error:', error);
      return { success: false, error: error.message };
    }

    // Record Audit Log
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'packages',
        record_id: data.id,
        new_data: data
      });
    } catch (auditErr) {
      await supabase
        .from('packages')
        .delete()
        .eq('id', data.id);
      return {
        success: false,
        error: auditErr instanceof Error ? auditErr.message : 'Failed to record createHqPackageTemplate audit log'
      };
    }

    safeRevalidatePath('/hq');
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[createHqPackageTemplate] Exception:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Updates an HQ package template
 */
export async function updateHqPackageTemplate(id: string, templateData: Partial<HqPackageTemplate>) {
  try {
    const authResult = await checkHqAuth();
    if (!authResult.authorized) {
      return { success: false, error: authResult.error || 'Unauthorized' };
    }

    const supabase = await createClient();

    // Fetch old data for audit log
    const { data: oldPackage, error: oldPackageError } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .single();

    if (oldPackageError) {
      return { success: false, error: oldPackageError.message };
    }

    const templatePayload = buildHqPackageTemplatePayload(templateData);
    if (!templatePayload.success) {
      return { success: false, error: templatePayload.error };
    }
    const dbData: PackageUpdate = {
      ...templatePayload.payload,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('packages')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateHqPackageTemplate] DB Error:', error);
      return { success: false, error: error.message };
    }

    // Record Audit Log
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'packages',
        record_id: id,
        old_data: oldPackage,
        new_data: data
      });
    } catch (auditErr) {
      if (oldPackage) {
        await supabase
          .from('packages')
          .update(oldPackage)
          .eq('id', id);
      }
      return {
        success: false,
        error: auditErr instanceof Error ? auditErr.message : 'Failed to record updateHqPackageTemplate audit log'
      };
    }

    // Also auto-propagate non-overrideable configuration changes to distributed packages
    // For example, if allowed_franchise_override is false, we should force all distributed packages
    // to match the new template price. Let's do that in background.
    if (!dbData.allowed_franchise_override || dbData.price !== oldPackage?.price) {
      const distributionBase = buildTemplateDistributionBasePayload({
        id,
        ...templatePayload.payload,
      });
      const propagateData: PackageUpdate = {
        name: distributionBase.name,
        duration: distributionBase.duration,
        total_sessions: distributionBase.total_sessions,
        details: distributionBase.details,
        offer: distributionBase.offer,
        ktv_commission: distributionBase.ktv_commission,
        price_cap: distributionBase.price_cap,
        price_floor: distributionBase.price_floor,
        allowed_franchise_override: distributionBase.allowed_franchise_override,
      };
      if (distributionBase.session_multiplier !== undefined) {
        propagateData.session_multiplier = distributionBase.session_multiplier;
      }

      if (!dbData.allowed_franchise_override) {
        propagateData.price = resolveDistributedPackagePrice({
          template: templatePayload.payload,
        });
      }

      const { error: propagateError } = await supabase
        .from('packages')
        .update(propagateData)
        .eq('template_id', id);
      if (propagateError) {
        return { success: false, error: propagateError.message };
      }
    }

    safeRevalidatePath('/hq');
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[updateHqPackageTemplate] Exception:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Deletes an HQ package template
 */
export async function deleteHqPackageTemplate(id: string) {
  try {
    const authResult = await checkHqAuth();
    if (!authResult.authorized) {
      return { success: false, error: authResult.error || 'Unauthorized' };
    }

    const supabase = await createClient();

    // Fetch old data for audit log
    const { data: oldPackage, error: oldPackageError } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .single();

    if (oldPackageError) {
      return { success: false, error: oldPackageError.message };
    }

    // Delete
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[deleteHqPackageTemplate] DB Error:', error);
      return { success: false, error: error.message };
    }

    // Record Audit Log
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'DELETE',
        table_name: 'packages',
        record_id: id,
        old_data: oldPackage
      });
    } catch (auditErr) {
      if (oldPackage) {
        await supabase
          .from('packages')
          .insert([oldPackage]);
      }
      return {
        success: false,
        error: auditErr instanceof Error ? auditErr.message : 'Failed to record deleteHqPackageTemplate audit log'
      };
    }

    safeRevalidatePath('/hq');
    return { success: true };
  } catch (error: unknown) {
    console.error('[deleteHqPackageTemplate] Exception:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Distributes a package template to list of branch tenants
 */
export async function distributeTemplateToTenants(templateId: string, tenantIds: string[]) {
  try {
    const authResult = await checkHqAuth();
    if (!authResult.authorized) {
      return { success: false, error: authResult.error || 'Unauthorized' };
    }

    const supabase = await createClient();

    // Fetch the template package
    const { data: template, error: tErr } = await supabase
      .from('packages')
      .select('*')
      .eq('id', templateId)
      .eq('is_hq_template', true)
      .single();

    if (tErr || !template) {
      return { success: false, error: 'Không tìm thấy gói mẫu chuẩn.' };
    }

    const results: DistributionResult[] = [];

    for (const tenantId of tenantIds) {
      // Check if already distributed to this tenant
      const { data: existingPkg, error: existingPkgError } = await supabase
        .from('packages')
        .select('*')
        .eq('template_id', templateId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existingPkgError) {
        console.error('Failed to check template distribution for tenant %s:', tenantId, existingPkgError);
        results.push({ tenantId, success: false, error: existingPkgError.message });
        continue;
      }

      const dbData = buildTemplateDistributionBasePayload(template);

      if (existingPkg) {
        // Update existing distribution
        const updateData: PackageUpdate = { ...dbData };
        const resolvedPrice = resolveDistributedPackagePrice({
          template,
          existingPrice: existingPkg.price,
        });
        if (resolvedPrice !== existingPkg.price || template.allowed_franchise_override === false) {
          updateData.price = resolvedPrice;
        }

        const { error: upErr } = await supabase
          .from('packages')
          .update(updateData)
          .eq('id', existingPkg.id);

        if (upErr) {
          console.error('Failed to update template for tenant %s:', tenantId, upErr);
          results.push({ tenantId, success: false, error: upErr.message });
        } else {
          results.push({ tenantId, success: true, action: 'updated', packageId: existingPkg.id });
        }
      } else {
        // Insert new distribution
        const insertData = {
          ...dbData,
          price: resolveDistributedPackagePrice({ template }),
          tenant_id: tenantId
        };

        const { data: inserted, error: inErr } = await supabase
          .from('packages')
          .insert([insertData])
          .select()
          .single();

        if (inErr) {
          console.error('Failed to insert template for tenant %s:', tenantId, inErr);
          results.push({ tenantId, success: false, error: inErr.message });
        } else {
          results.push({ tenantId, success: true, action: 'created', packageId: inserted.id });
        }
      }
    }

    safeRevalidatePath('/hq');
    safeRevalidatePath('/dashboard/services');
    return { success: true, results };
  } catch (error: unknown) {
    console.error('[distributeTemplateToTenants] Exception:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Branch/Tenant specific action: allows branch admins to adjust price of distributed templates
 * If it's a regular package, let them update normally. If standard package, enforce floor/cap.
 */
export async function overrideTenantPackagePrice(packageId: string, newPrice: number) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Chưa đăng nhập.' };
    }

    const supabase = await createClient();

    // Fetch package to verify ownership and template constraints
    const { data: pkg, error: pErr } = await supabase
      .from('packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (pErr || !pkg) {
      return { success: false, error: 'Không tìm thấy gói dịch vụ.' };
    }

    // Verify tenant
    if (pkg.tenant_id !== currentUser.tenant_id && currentUser.role !== 'admin') {
      return { success: false, error: 'Bạn không có quyền chỉnh sửa gói dịch vụ này.' };
    }

    const priceValidation = validateTenantPackagePriceOverride({
      packageRow: pkg,
      newPrice,
    });
    if (!priceValidation.success) {
      return { success: false, error: priceValidation.error };
    }

    // Update
    const { data: updatedPkg, error: upErr } = await supabase
      .from('packages')
      .update({ price: priceValidation.price, updated_at: new Date().toISOString() })
      .eq('id', packageId)
      .select()
      .single();

    if (upErr) {
      console.error('[overrideTenantPackagePrice] Error:', upErr);
      return { success: false, error: upErr.message };
    }

    // Record Audit Log
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'packages',
        record_id: packageId,
        old_data: pkg,
        new_data: updatedPkg
      });
    } catch (auditErr) {
      await supabase
        .from('packages')
        .update(pkg)
        .eq('id', packageId);
      return {
        success: false,
        error: auditErr instanceof Error ? auditErr.message : 'Failed to record overrideTenantPackagePrice audit log'
      };
    }

    safeRevalidatePath('/dashboard/services');
    return { success: true, data: updatedPkg };
  } catch (error: unknown) {
    console.error('[overrideTenantPackagePrice] Exception:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Returns a matrix of HQ templates and how they are distributed to all tenants
 */
export async function getBrandDistributionMatrix() {
  const authResult = await checkHqAuth();
  if (!authResult.authorized) {
    throw new Error(authResult.error || 'Unauthorized');
  }

  const supabase = await createClient();

  const { data: templates, error: templatesError } = await supabase
    .from('packages')
    .select('*')
    .eq('is_hq_template', true)
    .order('name', { ascending: true });

  if (templatesError) {
    throw new Error(`Failed to fetch HQ package templates for distribution matrix: ${templatesError.message}`);
  }

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name')
    .order('name', { ascending: true });

  if (tenantsError) {
    throw new Error(`Failed to fetch tenants for distribution matrix: ${tenantsError.message}`);
  }

  const { data: distributed, error: distributedError } = await supabase
    .from('packages')
    .select('*')
    .not('template_id', 'is', null);

  if (distributedError) {
    throw new Error(`Failed to fetch distributed packages: ${distributedError.message}`);
  }

  const tenantNamesById = new Map((tenants || []).map((tenant: TenantRow) => [tenant.id, tenant.name]));

  return {
    templates: (templates || []) as HqPackageTemplate[],
    distributed: (distributed || []).map((d: PackageRow) => ({
      id: d.id,
      name: d.name,
      price: Number(d.price),
      tenant_id: d.tenant_id || '',
      tenant_name: d.tenant_id ? tenantNamesById.get(d.tenant_id) || 'Chi nhanh' : 'Chi nhanh',
      template_id: d.template_id || '',
      status: d.status || 'active'
    })),
    tenants: tenants || []
  };
}
