'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './user-actions';

export async function getInventoryItems() {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  
  if (!user) return [];

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('name');
  
  if (error) {
    console.error('Error fetching inventory items:', error);
    throw new Error('Không thể tải dữ liệu kho');
  }
  return data || [];
}

export async function getInventoryLogs(limit = 20) {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('inventory_logs')
    .select('*, inventory_items(name, unit)')
    .eq('tenant_id', user.tenant_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching inventory logs:', error);
    throw new Error('Không thể tải lịch sử kho');
  }
  return data || [];
}

export async function restockItem(itemId: string, amount: number, notes?: string) {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  
  if (!user) throw new Error('Chưa đăng nhập');
  
  // Update stock level
  const { data: item, error: fetchError } = await supabase
    .from('inventory_items')
    .select('stock_level, tenant_id')
    .eq('id', itemId)
    .eq('tenant_id', user.tenant_id)
    .single();
    
  if (fetchError) {
    console.error('Error fetching item for restock:', fetchError);
    throw new Error('Không tìm thấy vật tư');
  }
  
  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ stock_level: Number(item.stock_level) + Number(amount) })
    .eq('id', itemId)
    .eq('tenant_id', user.tenant_id);
    
  if (updateError) {
    console.error('Error updating stock level:', updateError);
    throw new Error('Lỗi khi cập nhật số lượng tồn kho');
  }
  
  // Log the action
  const { error: logError } = await supabase
    .from('inventory_logs')
    .insert({
      item_id: itemId,
      change_amount: amount,
      reason: 'restock',
      notes: notes || 'Nhập hàng định kỳ',
      tenant_id: user.tenant_id
    });
    
  if (logError) {
    console.error('Error logging restock:', logError);
    // Don't throw here as the stock was already updated, but maybe we should roll back?
    // For now just log it
  }
  
  revalidatePath('/dashboard/inventory');
  return { success: true };
}

export async function getPackageMaterials(packageId: string) {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('package_materials')
    .select('*, inventory_items(name, unit)')
    .eq('package_id', packageId)
    .eq('tenant_id', user.tenant_id);
    
  if (error) {
    console.error('Error fetching package materials:', error);
    throw new Error('Không thể tải định mức vật tư');
  }
  return data || [];
}
