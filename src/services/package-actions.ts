'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';

export async function getPackages() {
  const supabase = (await createClient()) as any;
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
  const supabase = (await createClient()) as any;
  
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

  safeRevalidatePath('/dashboard/services');
  return { data: data?.[0] };
}

export async function updatePackage(id: string, packageData: any) {
  const supabase = (await createClient()) as any;
  
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

  safeRevalidatePath('/dashboard/services');
  return { data: data?.[0] };
}

export async function deletePackage(id: string) {
  const supabase = (await createClient()) as any;
  const { error } = await supabase
    .from('packages')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting package:', error);
    return { error: error.message };
  }

  safeRevalidatePath('/dashboard/services');
  return { success: true };
}
