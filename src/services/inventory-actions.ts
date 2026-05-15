'use client';

import { createClient } from '@/lib/supabase-client';

export async function getInventoryItems() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data;
}

export async function getInventoryLogs(limit = 20) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inventory_logs')
    .select('*, inventory_items(name, unit)')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
}

export async function restockItem(itemId: string, amount: number, notes?: string) {
  const supabase = createClient();
  
  // Update stock level
  const { data: item, error: fetchError } = await supabase
    .from('inventory_items')
    .select('stock_level, tenant_id')
    .eq('id', itemId)
    .single();
    
  if (fetchError) throw fetchError;
  
  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ stock_level: Number(item.stock_level) + Number(amount) })
    .eq('id', itemId);
    
  if (updateError) throw updateError;
  
  // Log the action
  const { error: logError } = await supabase
    .from('inventory_logs')
    .insert({
      item_id: itemId,
      change_amount: amount,
      reason: 'restock',
      notes: notes || 'Nhập hàng định kỳ',
      tenant_id: item.tenant_id
    });
    
  if (logError) throw logError;
  
  return { success: true };
}

export async function getPackageMaterials(packageId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('package_materials')
    .select('*, inventory_items(name, unit)')
    .eq('package_id', packageId);
    
  if (error) throw error;
  return data;
}
