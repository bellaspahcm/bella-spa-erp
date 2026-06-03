'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './user-actions';
import type { Database } from '@/types/database.types';

type InventoryItemInsert = Database['public']['Tables']['inventory_items']['Insert'];
type InventoryItemUpdate = Database['public']['Tables']['inventory_items']['Update'];
type InventoryLogInsert = Database['public']['Tables']['inventory_logs']['Insert'];
type PackageMaterialInsert = Database['public']['Tables']['package_materials']['Insert'];
type PackageMaterialRow = Database['public']['Tables']['package_materials']['Row'];

function getErrorMessage(error: unknown, fallback = 'Lỗi hệ thống') {
  return error instanceof Error ? error.message : fallback;
}

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

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseWithTenant>>['supabase'];

async function deleteInventoryItemById(
  supabase: SupabaseClient,
  itemId: string,
  tenantId: string,
) {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId)
    .eq('tenant_id', tenantId);

  return error;
}

// ─── READ: apply tenant filter when available, never early-return ──────────────

export async function getInventoryItems() {
  const { supabase, tenantId } = await getSupabaseWithTenant();

  let query = supabase.from('inventory_items').select('*').order('name');
  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch inventory items: ${error.message}`);
  }
  return data || [];
}

export async function getInventoryLogs(limit = 50) {
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
  if (error) {
    throw new Error(`Failed to fetch inventory logs: ${error.message}`);
  }
  return data || [];
}

export async function getInventoryLogsByDateRange(dateFrom: string, dateTo: string) {
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
  if (error) {
    throw new Error(`Failed to fetch inventory logs by date range: ${error.message}`);
  }
  return data || [];
}

export async function getInventorySummary() {
  const { supabase, tenantId } = await getSupabaseWithTenant();

  let query = supabase
    .from('inventory_items')
    .select('stock_level, min_stock_level, price_per_unit');

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch inventory summary: ${error.message}`);
  }
  if (!data) return { totalItems: 0, lowStockCount: 0, totalValue: 0 };

  return {
    totalItems: data.length,
    lowStockCount: data.filter((i) => Number(i.stock_level) <= Number(i.min_stock_level)).length,
    totalValue: data.reduce((sum: number, i) => sum + Number(i.stock_level) * Number(i.price_per_unit), 0)
  };
}

export async function getPackageMaterials(packageId: string) {
  const { supabase, tenantId } = await getSupabaseWithTenant();

  let query = supabase
    .from('package_materials')
    .select(`
      id, quantity_per_session, item_id,
      inventory_items!package_materials_item_id_fkey(id, name, unit, stock_level, price_per_unit)
    `)
    .eq('package_id', packageId);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch package materials for package ${packageId}: ${error.message}`);
  }
  return data || [];
}

// ─── CRUD: Định mức tiêu hao vật tư theo gói ───────────────────────────────────
/**
 * Đồng bộ định mức tiêu hao của một gói liệu trình.
 * `rows` chứa danh sách { item_id, quantity_per_session } hiện hành.
 * Hàm sẽ:
 *   - xóa toàn bộ định mức cũ của package_id này;
 *   - chèn lại các định mức mới (dòng có quantity_per_session > 0).
 * Trả về { success, error? } để caller có thể assert side-effect (tuân thủ AGENTS.md §1).
 */
export async function upsertPackageMaterials(
  packageId: string,
  rows: Array<{ item_id: string; quantity_per_session: number }>
) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };
    if (!packageId) return { success: false, error: 'Thiếu mã gói' };

    const { data: existingRows, error: existingError } = await supabase
      .from('package_materials')
      .select('*')
      .eq('package_id', packageId)
      .eq('tenant_id', tenantId);

    if (existingError) {
      console.error('[upsertPackageMaterials.snapshot]', existingError);
      return { success: false, error: 'Lỗi đọc định mức cũ: ' + existingError.message };
    }

    // 1. Xóa toàn bộ định mức cũ của gói trong tenant này
    const { error: deleteError } = await supabase
      .from('package_materials')
      .delete()
      .eq('package_id', packageId)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      console.error('[upsertPackageMaterials.delete]', deleteError);
      return { success: false, error: 'Lỗi xóa định mức cũ: ' + deleteError.message };
    }

    // 2. Lọc các dòng hợp lệ (item_id không rỗng, quantity > 0)
    const validRows: PackageMaterialInsert[] = rows
      .filter(r => r.item_id && Number(r.quantity_per_session) > 0)
      .map(r => ({
        tenant_id: tenantId,
        package_id: packageId,
        item_id: r.item_id,
        quantity_per_session: Number(r.quantity_per_session),
      }));

    if (validRows.length === 0) {
      revalidatePath('/dashboard/services');
      return { success: true, inserted: 0 };
    }

    const { error: insertError } = await supabase
      .from('package_materials')
      .insert(validRows);

    if (insertError) {
      console.error('[upsertPackageMaterials.insert]', insertError);
      const restoreRows: PackageMaterialInsert[] = ((existingRows || []) as PackageMaterialRow[]).map(row => ({
        tenant_id: row.tenant_id,
        package_id: row.package_id,
        item_id: row.item_id,
        quantity_per_session: row.quantity_per_session,
      }));

      if (restoreRows.length > 0) {
        const { error: restoreError } = await supabase
          .from('package_materials')
          .insert(restoreRows);

        if (restoreError) {
          console.error('[upsertPackageMaterials.restore]', restoreError);
          return {
            success: false,
            error: 'Lỗi lưu định mức mới: ' + insertError.message
              + '; rollback failed: ' + restoreError.message,
          };
        }
      }

      return { success: false, error: 'Lỗi lưu định mức mới: ' + insertError.message };
    }

    revalidatePath('/dashboard/services');
    return { success: true, inserted: validRows.length };
  } catch (e: unknown) {
    console.error('[upsertPackageMaterials]', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Kiểm kê tồn kho cuối tháng ────────────────────────────────────────────────
/**
 * Trả về báo cáo kiểm kê tồn kho cho tháng/năm chỉ định.
 * Mỗi item: { item_id, name, unit, stock_level (live), nhap, tieu_hao, expected }
 * - nhap   = tổng change_amount > 0 trong tháng
 * - tieu_hao = tổng |change_amount| với change_amount < 0 trong tháng
 * - expected = stock_level hiện tại (đã cộng/trừ xong)
 */
export async function getMonthlyReconciliation(year: number, month: number) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false as const, error: 'Chưa đăng nhập', items: [] };

    const monthStr = String(month).padStart(2, '0');
    const dateFrom = `${year}-${monthStr}-01T00:00:00`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateTo = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    const [itemsRes, logsRes] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id, name, unit, stock_level, price_per_unit')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabase
        .from('inventory_logs')
        .select('item_id, change_amount, reason, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo),
    ]);

    if (itemsRes.error) {
      console.error('[getMonthlyReconciliation.items]', itemsRes.error);
      return { success: false as const, error: 'Lỗi tải vật tư', items: [] };
    }
    if (logsRes.error) {
      console.error('[getMonthlyReconciliation.logs]', logsRes.error);
      return { success: false as const, error: 'Lỗi tải log', items: [] };
    }

    const logsByItem: Record<string, { nhap: number; tieu_hao: number }> = {};
    for (const lg of logsRes.data || []) {
      const k = lg.item_id;
      if (!logsByItem[k]) logsByItem[k] = { nhap: 0, tieu_hao: 0 };
      const amt = Number(lg.change_amount || 0);
      if (amt > 0) logsByItem[k].nhap += amt;
      else logsByItem[k].tieu_hao += Math.abs(amt);
    }

    const items = (itemsRes.data || []).map((it) => {
      const m = logsByItem[it.id] || { nhap: 0, tieu_hao: 0 };
      return {
        item_id: it.id,
        name: it.name,
        unit: it.unit,
        price_per_unit: Number(it.price_per_unit || 0),
        nhap: m.nhap,
        tieu_hao: m.tieu_hao,
        expected: Number(it.stock_level || 0),
      };
    });

    return { success: true as const, items };
  } catch (e: unknown) {
    console.error('[getMonthlyReconciliation]', e);
    return { success: false as const, error: getErrorMessage(e), items: [] };
  }
}

/**
 * Lưu kết quả kiểm kê cuối tháng.
 * `entries` là mảng { item_id, actual_stock, notes? }.
 * Với mỗi item:
 *   - Tính variance = actual - expected (lấy expected từ stock_level hiện hành).
 *   - Cập nhật inventory_items.stock_level = actual.
 *   - Ghi 1 dòng inventory_logs(reason='monthly_reconciliation', change_amount=variance).
 * Nếu variance = 0 → vẫn ghi log để xác nhận đã kiểm kê (notes = "Khớp sổ").
 */
export async function saveMonthlyReconciliation(
  year: number,
  month: number,
  entries: Array<{ item_id: string; actual_stock: number; notes?: string }>
) {
  try {
    const { supabase, tenantId, userId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập', processed: 0 };
    if (!entries || entries.length === 0) {
      return { success: false, error: 'Chưa nhập số lượng thực tế nào', processed: 0 };
    }

    const periodLabel = `${String(month).padStart(2, '0')}/${year}`;
    let processed = 0;
    const failures: string[] = [];

    for (const entry of entries) {
      if (!entry.item_id) {
        failures.push('Thiếu mã vật tư');
        continue;
      }
      const actual = Number(entry.actual_stock);
      if (!Number.isFinite(actual) || actual < 0) {
        failures.push(`Item ${entry.item_id}: số liệu không hợp lệ`);
        continue;
      }

      // Đọc tồn hệ thống hiện hành
      const { data: itemRow, error: fetchErr } = await supabase
        .from('inventory_items')
        .select('stock_level, name, unit')
        .eq('id', entry.item_id)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchErr || !itemRow) {
        failures.push(`Item ${entry.item_id}: không tìm thấy`);
        continue;
      }

      const expected = Number(itemRow.stock_level || 0);
      const variance = actual - expected;

      // Cập nhật stock_level về số thực tế
      const updatePayload: InventoryItemUpdate = {
        stock_level: actual,
        updated_at: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update(updatePayload)
        .eq('id', entry.item_id)
        .eq('tenant_id', tenantId);

      if (updateErr) {
        failures.push(`Item ${itemRow.name}: lỗi cập nhật - ${updateErr.message}`);
        continue;
      }

      // Ghi log kiểm kê (luôn ghi để có audit, kể cả khi variance = 0)
      const noteText = variance === 0
        ? `Kiểm kê tháng ${periodLabel}: khớp sổ${entry.notes ? ' - ' + entry.notes : ''}`
        : `Kiểm kê tháng ${periodLabel}: thực tế ${actual} vs dự kiến ${expected} (${variance > 0 ? '+' : ''}${variance} ${itemRow.unit})${entry.notes ? ' - ' + entry.notes : ''}`;

      const logPayload: InventoryLogInsert = {
        item_id: entry.item_id,
        change_amount: variance,
        reason: 'monthly_reconciliation',
        notes: noteText,
        created_by: userId,
        tenant_id: tenantId,
      };

      const { error: logErr } = await supabase.from('inventory_logs').insert(logPayload);

      if (logErr) {
        const rollbackPayload: InventoryItemUpdate = {
          stock_level: expected,
          updated_at: new Date().toISOString(),
        };
        const { error: rollbackErr } = await supabase
          .from('inventory_items')
          .update(rollbackPayload)
          .eq('id', entry.item_id)
          .eq('tenant_id', tenantId);
        const rollbackNote = rollbackErr ? `; rollback failed - ${rollbackErr.message}` : '';
        failures.push(`Item ${itemRow.name}: lỗi ghi log - ${logErr.message}${rollbackNote}`);
        continue;
      }

      processed++;
    }

    revalidatePath('/dashboard/inventory');

    if (failures.length > 0) {
      return {
        success: false,
        processed,
        failed: failures.length,
        error: `Đã kiểm kê ${processed} mặt hàng; ${failures.length} lỗi: ${failures.slice(0, 3).join('; ')}`,
      };
    }
    return { success: true, processed, failed: 0 };
  } catch (e: unknown) {
    console.error('[saveMonthlyReconciliation]', e);
    return { success: false, error: getErrorMessage(e), processed: 0, failed: entries?.length || 0 };
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
    const { supabase, tenantId, userId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };
    if (!item.name || !item.unit) return { success: false, error: 'Nhập tên và đơn vị' };

    const initialStock = Number(item.stock_level || 0);
    if (!Number.isFinite(initialStock) || initialStock < 0) {
      return { success: false, error: 'Tồn kho ban đầu không hợp lệ' };
    }

    const insertPayload: InventoryItemInsert = {
      ...item,
      stock_level: initialStock,
      tenant_id: tenantId,
    };

    const { data, error } = await supabase
      .from('inventory_items')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[addInventoryItem]', error);
      return { success: false, error: 'Không thể thêm vật tư: ' + error.message };
    }

    if (initialStock > 0) {
      const logPayload: InventoryLogInsert = {
        item_id: data.id,
        change_amount: initialStock,
        reason: 'initial',
        notes: 'Tồn kho ban đầu',
        created_by: userId,
        tenant_id: tenantId,
      };

      const { error: logError } = await supabase.from('inventory_logs').insert(logPayload);
      if (logError) {
        const rollbackError = await deleteInventoryItemById(supabase, data.id, tenantId);
        return {
          success: false,
          error: rollbackError
            ? `Lỗi ghi log tồn kho ban đầu: ${logError.message}; rollback thất bại: ${rollbackError.message}`
            : `Lỗi ghi log tồn kho ban đầu: ${logError.message}`,
        };
      }
    }

    revalidatePath('/dashboard/inventory');
    return { success: true, data };
  } catch (e: unknown) {
    console.error('[addInventoryItem]', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function restockItem(itemId: string, amount: number, notes?: string) {
  try {
    const { supabase, tenantId, userId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };
    const numericAmount = Number(amount);
    if (!itemId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Số lượng nhập kho không hợp lệ' };
    }

    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('stock_level')
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !item) return { success: false, error: 'Không tìm thấy vật tư' };

    const previousStock = Number(item.stock_level || 0);
    const updatePayload: InventoryItemUpdate = { stock_level: previousStock + numericAmount };

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update(updatePayload)
      .eq('id', itemId)
      .eq('tenant_id', tenantId);

    if (updateError) return { success: false, error: 'Lỗi cập nhật tồn kho' };

    const logPayload: InventoryLogInsert = {
      item_id: itemId,
      change_amount: numericAmount,
      reason: 'restock',
      notes: notes || 'Nhập hàng',
      created_by: userId,
      tenant_id: tenantId
    };

    const { error: logError } = await supabase.from('inventory_logs').insert(logPayload);
    if (logError) {
      const rollbackPayload: InventoryItemUpdate = { stock_level: previousStock };
      const { error: rollbackError } = await supabase
        .from('inventory_items')
        .update(rollbackPayload)
        .eq('id', itemId)
        .eq('tenant_id', tenantId);
      return {
        success: false,
        error: rollbackError
          ? `Lỗi ghi log nhập kho: ${logError.message}; rollback thất bại: ${rollbackError.message}`
          : `Lỗi ghi log nhập kho: ${logError.message}`,
      };
    }

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
    const numericAmount = Number(amount);
    if (!itemId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Số lượng tiêu hao không hợp lệ' };
    }

    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('name, stock_level')
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !item) return { success: false, error: 'Không tìm thấy vật tư' };

    const previousStock = Number(item.stock_level || 0);
    if (previousStock < numericAmount) {
      return { success: false, error: `Mặt hàng "${item.name}" không đủ tồn kho (Hiện có: ${item.stock_level}, Cần tiêu hao: ${numericAmount})` };
    }

    const newStock = previousStock - numericAmount;
    const updatePayload: InventoryItemUpdate = { stock_level: newStock };

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update(updatePayload)
      .eq('id', itemId)
      .eq('tenant_id', tenantId);

    if (updateError) return { success: false, error: 'Lỗi cập nhật tồn kho' };

    const logPayload: InventoryLogInsert = {
      item_id: itemId,
      change_amount: -numericAmount,
      reason: 'session_consumption',
      session_log_id: sessionLogId || null,
      notes: notes || 'Tiêu hao buổi liệu trình',
      created_by: userId,
      tenant_id: tenantId
    };

    const { error: logError } = await supabase.from('inventory_logs').insert(logPayload);
    if (logError) {
      const rollbackPayload: InventoryItemUpdate = { stock_level: previousStock };
      const { error: rollbackError } = await supabase
        .from('inventory_items')
        .update(rollbackPayload)
        .eq('id', itemId)
        .eq('tenant_id', tenantId);
      return {
        success: false,
        error: rollbackError
          ? `Lỗi ghi log tiêu hao: ${logError.message}; rollback thất bại: ${rollbackError.message}`
          : `Lỗi ghi log tiêu hao: ${logError.message}`,
      };
    }

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

    // Đọc cấu hình từ bảng tenants để kiểm tra chế độ trừ kho tự động
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('salary_config')
      .eq('id', tenantId)
      .single();
    if (tenantError) {
      return { success: false, error: `Lỗi tải cấu hình tự động trừ kho: ${tenantError.message}` };
    }

    const salaryConfig = (tenantData?.salary_config as Record<string, unknown> | null) || {};
    const isAutoConsumeEnabled = !!salaryConfig.auto_consume_inventory;

    if (!isAutoConsumeEnabled) {
      console.log(`[autoConsumeForSession] Auto-consumption is disabled for tenant ${tenantId}. Bypassing.`);
      return { success: true, bypassed: true };
    }

    const materials = await getPackageMaterials(packageId);
    let totalCost = 0;
    const consumedItems: Array<{ id: string; qty: number }> = [];

    for (const mat of materials) {
      const qty = Number(mat.quantity_per_session || 0);
      const itemId = mat.inventory_items?.id;
      if (!itemId || qty <= 0) continue;

      const cost = qty * Number(mat.inventory_items?.price_per_unit || 0);
      totalCost += cost;

      const consumeResult = await consumeInventory(
        itemId,
        qty,
        sessionLogId,
        'Tự động tiêu hao buổi liệu trình'
      );

      if (!consumeResult.success) {
        console.warn(`[autoConsumeForSession] Consume failed for item ${itemId}, rolling back consumed items...`);
        // Rollback lại các mặt hàng đã trừ của session này
        const rollbackResult = await rollbackInventoryConsumption(sessionLogId);
        const rollbackError = rollbackResult.success ? '' : `; rollback thất bại: ${rollbackResult.error}`;
        return { success: false, error: `${consumeResult.error || 'Kho không đủ nguyên liệu'}${rollbackError}` };
      }
      consumedItems.push({ id: itemId, qty });
    }

    // Enqueue INVENTORY_CONSUMED outbox event if totalCost > 0
    if (totalCost > 0) {
      const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
      await enqueueWithAutoClient(
        supabase,
        {
          tenantId,
          eventType: 'INVENTORY_CONSUMED',
          referenceType: 'SESSION_LOG',
          referenceId: sessionLogId,
          payload: {
            amount: totalCost,
            description: `Vật tư tiêu hao ca trị liệu, buổi ID: ${sessionLogId}`,
            // TODO Phase 29: dùng branch_id thực khi multi-branch
            branchId: tenantId,
          },
        },
        '[autoConsumeForSession]'
      );
    }

    return { success: true, processed: consumedItems.length, totalCost };
  } catch (e: unknown) {
    console.error('[autoConsumeForSession]', e);
    // Hủy bỏ và hoàn kho nếu gặp lỗi hệ thống giữa chừng
    const rollbackResult = await rollbackInventoryConsumption(sessionLogId);
    const rollbackError = rollbackResult.success ? '' : `; rollback thất bại: ${rollbackResult.error}`;
    return { success: false, error: `${getErrorMessage(e, 'Lỗi tiêu hao tự động')}${rollbackError}` };
  }
}

/**
 * Hoàn trả tồn kho vật tư khi hoàn tác ca làm việc (Rollback)
 */
export async function rollbackInventoryConsumption(sessionLogId: string) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };

    // 1. Lấy toàn bộ logs tiêu hao của session này
    const { data: logs, error: fetchErr } = await supabase
      .from('inventory_logs')
      .select('id, item_id, change_amount')
      .eq('session_log_id', sessionLogId)
      .eq('reason', 'session_consumption')
      .eq('tenant_id', tenantId);

    if (fetchErr) {
      console.error('[rollbackInventoryConsumption] Error fetching logs:', fetchErr);
      return { success: false, error: fetchErr.message };
    }

    if (!logs || logs.length === 0) {
      return { success: true, processed: 0 };
    }

    // 2. Hoàn trả kho cho từng mặt hàng
    for (const log of logs) {
      const { data: item, error: itemErr } = await supabase
        .from('inventory_items')
        .select('stock_level')
        .eq('id', log.item_id)
        .eq('tenant_id', tenantId)
        .single();

      if (itemErr || !item) {
        return { success: false, error: itemErr?.message || `Không tìm thấy vật tư ${log.item_id} để hoàn kho` };
      }

      const updatePayload: InventoryItemUpdate = {
        stock_level: Number(item.stock_level) + Math.abs(Number(log.change_amount)),
      };
      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update(updatePayload)
        .eq('id', log.item_id)
        .eq('tenant_id', tenantId);

      if (updateErr) {
        return { success: false, error: `Lỗi hoàn kho vật tư ${log.item_id}: ${updateErr.message}` };
      }
    }

    // 3. Xóa các logs này
    const logIds = logs.map(l => l.id);
    const { error: deleteErr } = await supabase
      .from('inventory_logs')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', logIds);

    if (deleteErr) {
      console.error('[rollbackInventoryConsumption] Error deleting logs:', deleteErr);
      return { success: false, error: deleteErr.message };
    }

    return { success: true, processed: logs.length };
  } catch (e: unknown) {
    console.error('[rollbackInventoryConsumption] Error:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}
