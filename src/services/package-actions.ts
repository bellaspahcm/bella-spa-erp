'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';

export async function getPackages() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching packages:', error);
    return [];
  }
  return data || [];
}

export async function createPackage(packageData: any) {
  const supabase = await createClient();
  
  // Format data for DB
  const dbData = {
    name: packageData.name,
    price: parseInt(packageData.price?.toString().replace(/[^\d]/g, '') || '0'),
    duration: packageData.duration?.toString() || '90 phút/buổi',
    total_sessions: parseInt(packageData.sessions?.toString() || '10'),
    details: packageData.details || [],
    offer: packageData.offer || '',
    ktv_commission: parseInt(packageData.ktv_commission?.toString().replace(/[^\d]/g, '') || '150000'),
    status: 'active'
  };

  const { data, error } = await supabase
    .from('packages')
    .insert([dbData])
    .select();

  if (error) {
    console.error('Error creating package:', error);
    return { error: error.message };
  }

  if (data?.[0]) {
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'packages',
        record_id: data[0].id,
        new_data: data[0]
      });
    } catch (auditErr) {
      console.warn('Failed to record createPackage audit log:', auditErr);
    }
  }

  safeRevalidatePath('/dashboard/services');
  return { data: data?.[0] };
}

export async function updatePackage(id: string, packageData: any) {
  const supabase = await createClient();

  // Fetch existing package before update for audit trail
  let oldPackage = null;
  try {
    const { data: existing } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .single();
    oldPackage = existing;
  } catch (err) {
    console.warn('Failed to fetch old package for audit trail:', err);
  }
  
  // Format data for DB
  const dbData = {
    name: packageData.name,
    price: typeof packageData.price === 'string' ? parseInt(packageData.price.replace(/[^\d]/g, '')) : packageData.price,
    duration: packageData.duration,
    total_sessions: packageData.sessions,
    details: packageData.details,
    offer: packageData.offer,
    ktv_commission: typeof packageData.ktv_commission === 'string' ? parseInt(packageData.ktv_commission.replace(/[^\d]/g, '')) : packageData.ktv_commission,
    status: packageData.status || 'active'
  };

  const { data, error } = await supabase
    .from('packages')
    .update(dbData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating package:', error);
    return { error: error.message };
  }

  if (data?.[0]) {
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'packages',
        record_id: id,
        old_data: oldPackage,
        new_data: dbData
      });
    } catch (auditErr) {
      console.warn('Failed to record updatePackage audit log:', auditErr);
    }
  }

  safeRevalidatePath('/dashboard/services');
  return { data: data?.[0] };
}

export async function deletePackage(id: string) {
  const supabase = await createClient();

  // Fetch existing package before delete for audit trail
  let oldPackage = null;
  try {
    const { data: existing } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .single();
    oldPackage = existing;
  } catch (err) {
    console.warn('Failed to fetch old package for delete audit trail:', err);
  }

  const { error } = await supabase
    .from('packages')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting package:', error);
    return { error: error.message };
  }

  try {
    const { recordAuditLog } = await import('./audit-actions');
    await recordAuditLog({
      action: 'DELETE',
      table_name: 'packages',
      record_id: id,
      old_data: oldPackage
    });
  } catch (auditErr) {
    console.warn('Failed to record deletePackage audit log:', auditErr);
  }

  safeRevalidatePath('/dashboard/services');
  return { success: true };
}
