'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './user-actions';

// ─── Schema (verified 2026-05-15) ──────────────────────────────────────────────
// inventory_items:   id, tenant_id, name, sku, unit, stock_level, min_stock_level,
//                    price_per_unit, category, notes, created_at, updated_at
// inventory_logs:    id, tenant_id, item_id (→ inventory_items), change_amount,
//                    reason, session_log_id (→ session_logs), notes, created_by (→ users), created_at
// package_materials: id, tenant_id, package_id (→ packages), item_id (→ inventory_items),
//                    quantity_per_session, created_at
// ───────────────────────────────────────────────────────────────────────────────

export async function getInventoryItems() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const user = await getCurrentUser();
    if (!user?.tenant_id) return [];

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .order('name');

    if (error) {
      console.error('[getInventoryItems]', error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('[getInventoryItems]', e);
    return [];
  }
}

export async function getInventoryLogs(limit = 20) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const user = await getCurrentUser();
    if (!user?.tenant_id) return [];

    const { data, error } = await supabase
      .from('inventory_logs')
      .select(`
        id, change_amount, reason, notes, created_at,
        inventory_items!inventory_logs_item_id_fkey(name, unit)
      `)
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[getInventoryLogs]', error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('[getInventoryLogs]', e);
    return [];
  }
}

export async function addInventoryItem(item: {
  name: string;
  sku?: string;
  unit: string;
  stock_level: number;
  min_stock_level: number;
  price_per_unit: number;
  category?: string;
  notes?: string;
}) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const user = await getCurrentUser();
    if (!user?.tenant_id) return { success: false, error: 'Chưa đăng nhập' };

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({ ...item, tenant_id: user.tenant_id })
      .select()
      .single();

    if (error) {
      console.error('[addInventoryItem]', error);
      return { success: false, error: 'Không thể thêm vật tư' };
    }

    revalidatePath('/dashboard/inventory');
    return { success: true, data };
  } catch (e) {
    console.error('[addInventoryItem]', e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

export async function restockItem(itemId: string, amount: number, notes?: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const user = await getCurrentUser();
    if (!user?.tenant_id) return { success: false, error: 'Chưa đăng nhập' };

    // Fetch current stock
    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('stock_level')
      .eq('id', itemId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (fetchError || !item) {
      console.error('[restockItem] fetch:', fetchError);
      return { success: false, error: 'Không tìm thấy vật tư' };
    }

    // Update stock level
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ stock_level: Number(item.stock_level) + Number(amount) })
      .eq('id', itemId)
      .eq('tenant_id', user.tenant_id);

    if (updateError) {
      console.error('[restockItem] update:', updateError);
      return { success: false, error: 'Lỗi cập nhật tồn kho' };
    }

    // Log the restock action
    await supabase.from('inventory_logs').insert({
      item_id: itemId,
      change_amount: amount,
      reason: 'restock',
      notes: notes || 'Nhập hàng',
      created_by: user.id,
      tenant_id: user.tenant_id
    });

    revalidatePath('/dashboard/inventory');
    return { success: true };
  } catch (e) {
    console.error('[restockItem]', e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

export async function consumeInventory(
  itemId: string,
  amount: number,
  sessionLogId?: string,
  notes?: string
) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const user = await getCurrentUser();
    if (!user?.tenant_id) return { success: false, error: 'Chưa đăng nhập' };

    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('stock_level')
      .eq('id', itemId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (fetchError || !item) {
      return { success: false, error: 'Không tìm thấy vật tư' };
    }

    const newStock = Math.max(0, Number(item.stock_level) - Number(amount));

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ stock_level: newStock })
      .eq('id', itemId)
      .eq('tenant_id', user.tenant_id);

    if (updateError) {
      return { success: false, error: 'Lỗi cập nhật tồn kho' };
    }

    await supabase.from('inventory_logs').insert({
      item_id: itemId,
      change_amount: -amount,                 // âm = tiêu hao
      reason: 'session_consumption',
      session_log_id: sessionLogId || null,
      notes: notes || 'Tiêu hao buổi liệu trình',
      created_by: user.id,
      tenant_id: user.tenant_id
    });

    revalidatePath('/dashboard/inventory');
    return { success: true, newStock };
  } catch (e) {
    console.error('[consumeInventory]', e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

export async function getPackageMaterials(packageId: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const user = await getCurrentUser();
    if (!user?.tenant_id) return [];

    const { data, error } = await supabase
      .from('package_materials')
      .select(`
        id, quantity_per_session,
        inventory_items!package_materials_item_id_fkey(id, name, unit, stock_level)
      `)
      .eq('package_id', packageId)
      .eq('tenant_id', user.tenant_id);

    if (error) {
      console.error('[getPackageMaterials]', error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('[getPackageMaterials]', e);
    return [];
  }
}

// Auto-consume vật tư khi hoàn thành buổi liệu trình
export async function autoConsumeForSession(packageId: string, sessionLogId: string) {
  try {
    const materials = await getPackageMaterials(packageId);
    const results = await Promise.allSettled(
      materials.map((mat: any) =>
        consumeInventory(
          mat.inventory_items?.id,
          mat.quantity_per_session,
          sessionLogId,
          `Tự động tiêu hao buổi liệu trình`
        )
      )
    );
    return { success: true, processed: results.length };
  } catch (e) {
    console.error('[autoConsumeForSession]', e);
    return { success: false, error: 'Lỗi tiêu hao tự động' };
  }
}

export async function getInventorySummary() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = (await createClient()) as any;
    const user = await getCurrentUser();
    if (!user?.tenant_id) return { totalItems: 0, lowStockCount: 0, totalValue: 0 };

    const { data, error } = await supabase
      .from('inventory_items')
      .select('stock_level, min_stock_level, price_per_unit')
      .eq('tenant_id', user.tenant_id);

    if (error || !data) return { totalItems: 0, lowStockCount: 0, totalValue: 0 };

    return {
      totalItems: data.length,
      lowStockCount: data.filter((i: any) => Number(i.stock_level) <= Number(i.min_stock_level)).length,
      totalValue: data.reduce((sum: number, i: any) => sum + Number(i.stock_level) * Number(i.price_per_unit), 0)
    };
  } catch (e) {
    console.error('[getInventorySummary]', e);
    return { totalItems: 0, lowStockCount: 0, totalValue: 0 };
  }
}
