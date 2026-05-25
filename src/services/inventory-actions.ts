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

// ─── Helper: get supabase client + optional tenant_id ─────────────────────────
async function getSupabaseWithTenant() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const user = await getCurrentUser();
  return { supabase, tenantId: user?.tenant_id || null, userId: user?.id || null };
}

// ─── READ: apply tenant filter when available, never early-return ──────────────

export async function getInventoryItems() {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();

    let query = supabase.from('inventory_items').select('*').order('name');
    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data, error } = await query;
    if (error) { console.error('[getInventoryItems]', error); return []; }
    return data || [];
  } catch (e) {
    console.error('[getInventoryItems]', e);
    return [];
  }
}

export async function getInventoryLogs(limit = 50) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();

    let query = supabase
      .from('inventory_logs')
      .select(`
        id, change_amount, reason, notes, created_at,
        inventory_items!inventory_logs_item_id_fkey(name, unit)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data, error } = await query;
    if (error) { console.error('[getInventoryLogs]', error); return []; }
    return data || [];
  } catch (e) {
    console.error('[getInventoryLogs]', e);
    return [];
  }
}

export async function getInventoryLogsByDateRange(dateFrom: string, dateTo: string) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();

    // dateTo: extend to end of day
    const dateToEnd = dateTo + 'T23:59:59';

    let query = supabase
      .from('inventory_logs')
      .select(`
        id, change_amount, reason, notes, created_at,
        inventory_items!inventory_logs_item_id_fkey(name, unit)
      `)
      .gte('created_at', dateFrom)
      .lte('created_at', dateToEnd)
      .order('created_at', { ascending: false });

    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data, error } = await query;
    if (error) { console.error('[getInventoryLogsByDateRange]', error); return []; }
    return data || [];
  } catch (e) {
    console.error('[getInventoryLogsByDateRange]', e);
    return [];
  }
}

export async function getInventorySummary() {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();

    let query = supabase
      .from('inventory_items')
      .select('stock_level, min_stock_level, price_per_unit');

    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data, error } = await query;
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

export async function getPackageMaterials(packageId: string) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();

    let query = supabase
      .from('package_materials')
      .select(`
        id, quantity_per_session,
        inventory_items!package_materials_item_id_fkey(id, name, unit, stock_level, price_per_unit)
      `)
      .eq('package_id', packageId);

    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data, error } = await query;
    if (error) { console.error('[getPackageMaterials]', error); return []; }
    return data || [];
  } catch (e) {
    console.error('[getPackageMaterials]', e);
    return [];
  }
}

// ─── WRITE: still require auth (needed for audit trail + tenant scoping) ───────

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
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({ ...item, tenant_id: tenantId })
      .select()
      .single();

    if (error) { console.error('[addInventoryItem]', error); return { success: false, error: 'Không thể thêm vật tư' }; }

    revalidatePath('/dashboard/inventory');
    return { success: true, data };
  } catch (e) {
    console.error('[addInventoryItem]', e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

export async function restockItem(itemId: string, amount: number, notes?: string) {
  try {
    const { supabase, tenantId, userId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };

    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('stock_level')
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !item) return { success: false, error: 'Không tìm thấy vật tư' };

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ stock_level: Number(item.stock_level) + Number(amount) })
      .eq('id', itemId)
      .eq('tenant_id', tenantId);

    if (updateError) return { success: false, error: 'Lỗi cập nhật tồn kho' };

    await supabase.from('inventory_logs').insert({
      item_id: itemId,
      change_amount: amount,
      reason: 'restock',
      notes: notes || 'Nhập hàng',
      created_by: userId,
      tenant_id: tenantId
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
    const { supabase, tenantId, userId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };

    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('stock_level')
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !item) return { success: false, error: 'Không tìm thấy vật tư' };

    const newStock = Math.max(0, Number(item.stock_level) - Number(amount));

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ stock_level: newStock })
      .eq('id', itemId)
      .eq('tenant_id', tenantId);

    if (updateError) return { success: false, error: 'Lỗi cập nhật tồn kho' };

    await supabase.from('inventory_logs').insert({
      item_id: itemId,
      change_amount: -amount,
      reason: 'session_consumption',
      session_log_id: sessionLogId || null,
      notes: notes || 'Tiêu hao buổi liệu trình',
      created_by: userId,
      tenant_id: tenantId
    });

    revalidatePath('/dashboard/inventory');
    return { success: true, newStock };
  } catch (e) {
    console.error('[consumeInventory]', e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

// ─── Auto-consume khi hoàn thành buổi ─────────────────────────────────────────
export async function autoConsumeForSession(packageId: string, sessionLogId: string) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };

    const materials = await getPackageMaterials(packageId);
    let totalCost = 0;

    const results = await Promise.allSettled(
      materials.map((mat: any) => {
        const cost = Number(mat.quantity_per_session || 0) * Number(mat.inventory_items?.price_per_unit || 0);
        totalCost += cost;
        return consumeInventory(
          mat.inventory_items?.id,
          mat.quantity_per_session,
          sessionLogId,
          'Tự động tiêu hao buổi liệu trình'
        );
      })
    );

    // Enqueue INVENTORY_CONSUMED outbox event if totalCost > 0
    if (totalCost > 0) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const activeClient = serviceRoleKey
        ? (() => {
            const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
            return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
          })()
        : supabase;

      const { error: outboxError } = await activeClient.rpc('enqueue_accounting_event', {
        p_tenant_id: tenantId,
        p_event_type: 'INVENTORY_CONSUMED',
        p_reference_type: 'SESSION_LOG',
        p_reference_id: sessionLogId,
        p_payload: {
          amount: totalCost,
          description: `Vật tư tiêu hao ca trị liệu, buổi ID: ${sessionLogId}`,
          branchId: null
        }
      });

      if (outboxError) {
        console.error('[autoConsumeForSession] Failed to enqueue INVENTORY_CONSUMED event:', outboxError);
      } else {
        console.log('[autoConsumeForSession] Successfully enqueued INVENTORY_CONSUMED event for session:', sessionLogId, 'cost:', totalCost);
      }
    }

    return { success: true, processed: results.length, totalCost };
  } catch (e) {
    console.error('[autoConsumeForSession]', e);
    return { success: false, error: 'Lỗi tiêu hao tự động' };
  }
}
