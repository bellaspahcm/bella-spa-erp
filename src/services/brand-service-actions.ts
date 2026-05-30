'use server';

import { createClient } from '@/lib/supabase-server';
import { checkHqAuth } from './hq-actions';
import { HqPackageTemplate } from '@/types/domain';
import { safeRevalidatePath } from '@/lib/revalidate';
import { getCurrentUser } from './user-actions';

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

    const dbData = {
      name: templateData.name,
      price: Number(templateData.price || 0),
      duration: templateData.duration || '90 phút/buổi',
      total_sessions: Number(templateData.total_sessions || 10),
      details: templateData.details || [],
      offer: templateData.offer || '',
      ktv_commission: Number(templateData.ktv_commission || 150000),
      status: 'active',
      is_hq_template: true,
      tenant_id: hqTenantId, // templates belong to the HQ tenant group
      price_cap: templateData.price_cap ? Number(templateData.price_cap) : null,
      price_floor: templateData.price_floor ? Number(templateData.price_floor) : null,
      allowed_franchise_override: templateData.allowed_franchise_override !== false
    };

    // Validation
    if (dbData.price_floor && dbData.price_cap && dbData.price_floor > dbData.price_cap) {
      return { success: false, error: 'Giá sàn không được lớn hơn giá trần.' };
    }

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
  } catch (error: any) {
    console.error('[createHqPackageTemplate] Exception:', error);
    return { success: false, error: error.message };
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

    const dbData = {
      name: templateData.name,
      price: Number(templateData.price || 0),
      duration: templateData.duration,
      total_sessions: Number(templateData.total_sessions),
      details: templateData.details || [],
      offer: templateData.offer || '',
      ktv_commission: Number(templateData.ktv_commission),
      price_cap: templateData.price_cap ? Number(templateData.price_cap) : null,
      price_floor: templateData.price_floor ? Number(templateData.price_floor) : null,
      allowed_franchise_override: templateData.allowed_franchise_override !== false,
      updated_at: new Date().toISOString()
    };

    // Validation
    if (dbData.price_floor && dbData.price_cap && dbData.price_floor > dbData.price_cap) {
      return { success: false, error: 'Giá sàn không được lớn hơn giá trần.' };
    }

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
    if (!dbData.allowed_franchise_override || templateData.price !== oldPackage?.price) {
      const propagateData: any = {
        name: dbData.name,
        duration: dbData.duration,
        total_sessions: dbData.total_sessions,
        details: dbData.details,
        offer: dbData.offer,
        ktv_commission: dbData.ktv_commission,
        price_cap: dbData.price_cap,
        price_floor: dbData.price_floor,
        allowed_franchise_override: dbData.allowed_franchise_override
      };

      if (!dbData.allowed_franchise_override) {
        propagateData.price = dbData.price;
      }

      await supabase
        .from('packages')
        .update(propagateData)
        .eq('template_id', id);
    }

    safeRevalidatePath('/hq');
    return { success: true, data };
  } catch (error: any) {
    console.error('[updateHqPackageTemplate] Exception:', error);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error('[deleteHqPackageTemplate] Exception:', error);
    return { success: false, error: error.message };
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

    const results = [];

    for (const tenantId of tenantIds) {
      // Check if already distributed to this tenant
      const { data: existingPkg } = await supabase
        .from('packages')
        .select('*')
        .eq('template_id', templateId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const dbData = {
        name: template.name,
        duration: template.duration,
        total_sessions: template.total_sessions,
        details: template.details,
        offer: template.offer,
        ktv_commission: template.ktv_commission,
        is_hq_template: false,
        template_id: template.id,
        price_cap: template.price_cap,
        price_floor: template.price_floor,
        allowed_franchise_override: template.allowed_franchise_override,
        status: 'active'
      };

      if (existingPkg) {
        // Update existing distribution
        const updateData: any = { ...dbData };
        // If not allowed override or existing price is out of bounds, reset it
        if (!template.allowed_franchise_override) {
          updateData.price = template.price;
        } else {
          // Verify existing price is within floor/cap
          const price = Number(existingPkg.price);
          if (template.price_floor && price < Number(template.price_floor)) {
            updateData.price = template.price_floor;
          } else if (template.price_cap && price > Number(template.price_cap)) {
            updateData.price = template.price_cap;
          }
        }

        const { error: upErr } = await supabase
          .from('packages')
          .update(updateData)
          .eq('id', existingPkg.id);

        if (upErr) {
          console.error(`Failed to update template for tenant ${tenantId}:`, upErr);
          results.push({ tenantId, success: false, error: upErr.message });
        } else {
          results.push({ tenantId, success: true, action: 'updated', packageId: existingPkg.id });
        }
      } else {
        // Insert new distribution
        const insertData = {
          ...dbData,
          price: template.price, // Default price
          tenant_id: tenantId
        };

        const { data: inserted, error: inErr } = await supabase
          .from('packages')
          .insert([insertData])
          .select()
          .single();

        if (inErr) {
          console.error(`Failed to insert template for tenant ${tenantId}:`, inErr);
          results.push({ tenantId, success: false, error: inErr.message });
        } else {
          results.push({ tenantId, success: true, action: 'created', packageId: inserted.id });
        }
      }
    }

    safeRevalidatePath('/hq');
    safeRevalidatePath('/dashboard/services');
    return { success: true, results };
  } catch (error: any) {
    console.error('[distributeTemplateToTenants] Exception:', error);
    return { success: false, error: error.message };
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

    // If template, validate limits
    if (pkg.template_id) {
      if (!pkg.allowed_franchise_override) {
        return { success: false, error: 'Gói dịch vụ chuẩn này được khóa giá cố định bởi HQ, không thể sửa đổi.' };
      }

      if (pkg.price_floor && newPrice < Number(pkg.price_floor)) {
        return { 
          success: false, 
          error: `Giá bán lẻ không được thấp hơn giá sàn quy định (${Number(pkg.price_floor).toLocaleString('vi-VN')} VNĐ)` 
        };
      }

      if (pkg.price_cap && newPrice > Number(pkg.price_cap)) {
        return { 
          success: false, 
          error: `Giá bán lẻ không được vượt quá giá trần quy định (${Number(pkg.price_cap).toLocaleString('vi-VN')} VNĐ)` 
        };
      }
    }

    // Update
    const { data: updatedPkg, error: upErr } = await supabase
      .from('packages')
      .update({ price: newPrice, updated_at: new Date().toISOString() })
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
  } catch (error: any) {
    console.error('[overrideTenantPackagePrice] Exception:', error);
    return { success: false, error: error.message };
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

  const { data: distributed, error: distributedError } = await supabase
    .from('packages')
    .select('*, tenants(name)')
    .not('template_id', 'is', null);

  if (distributedError) {
    throw new Error(`Failed to fetch distributed packages: ${distributedError.message}`);
  }

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name')
    .order('name', { ascending: true });

  if (tenantsError) {
    throw new Error(`Failed to fetch tenants for distribution matrix: ${tenantsError.message}`);
  }

  return {
    templates: (templates || []) as HqPackageTemplate[],
    distributed: (distributed || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      price: Number(d.price),
      tenant_id: d.tenant_id,
      tenant_name: d.tenants?.name || 'Chi nhánh',
      template_id: d.template_id,
      status: d.status
    })),
    tenants: tenants || []
  };
}
