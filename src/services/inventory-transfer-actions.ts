'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { checkHqAuth } from './hq-actions';
import { revalidatePath } from 'next/cache';
import { safeRevalidatePath } from '@/lib/revalidate';
import { BUSINESS_RULES } from '@bella/shared';
import { InventoryError } from '@/core/lib/errors';
import type { Database, Json } from '@/types/database.types';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type InventoryItemInsert = Database['public']['Tables']['inventory_items']['Insert'];
type InventoryItemUpdate = Database['public']['Tables']['inventory_items']['Update'];
type InventoryLogInsert = Database['public']['Tables']['inventory_logs']['Insert'];
type InventoryTransferOrderInsert = Database['public']['Tables']['inventory_transfer_orders']['Insert'];
type InventoryTransferOrderUpdate = Database['public']['Tables']['inventory_transfer_orders']['Update'];
type InventoryTransferOrderRow = Database['public']['Tables']['inventory_transfer_orders']['Row'];
type TenantNameRow = Pick<Database['public']['Tables']['tenants']['Row'], 'id' | 'name'>;
type TransferLogReason = 'transfer_receipt' | 'transfer_shipment';

type TransferInventoryMutation = {
  itemId: string;
  previousStock: number;
  logReason: TransferLogReason;
  logNotes: string;
  tenantId: string;
  createdNewItem?: boolean;
};

function getErrorMessage(error: unknown, fallback = 'Lỗi hệ thống') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function transferItemsToJson(items: TransferOrderItem[]): Json {
  return items.map(item => ({
    name: item.name,
    sku: item.sku,
    qty: item.qty,
    unit: item.unit,
  }));
}

async function restoreInventoryStock(
  supabase: SupabaseClient,
  itemId: string,
  previousStock: number,
) {
  const rollbackPayload: InventoryItemUpdate = {
    stock_level: previousStock,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('inventory_items')
    .update(rollbackPayload)
    .eq('id', itemId);

  return error;
}

async function deleteTransferInventoryLog(
  supabase: SupabaseClient,
  mutation: TransferInventoryMutation,
) {
  const { error } = await supabase
    .from('inventory_logs')
    .delete()
    .eq('item_id', mutation.itemId)
    .eq('reason', mutation.logReason)
    .eq('tenant_id', mutation.tenantId)
    .eq('notes', mutation.logNotes);

  return error;
}

async function deleteInventoryItem(
  supabase: SupabaseClient,
  itemId: string,
) {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId);

  return error;
}

async function rollbackTransferInventoryMutations(
  supabase: SupabaseClient,
  mutations: TransferInventoryMutation[],
) {
  for (const mutation of [...mutations].reverse()) {
    if (mutation.createdNewItem) {
      const logError = await deleteTransferInventoryLog(supabase, mutation);
      if (logError) {
        return `delete log ${mutation.itemId} failed: ${logError.message}`;
      }

      const deleteItemError = await deleteInventoryItem(supabase, mutation.itemId);
      if (deleteItemError) {
        return `delete item ${mutation.itemId} failed: ${deleteItemError.message}`;
      }

      continue;
    }

    const stockError = await restoreInventoryStock(supabase, mutation.itemId, mutation.previousStock);
    if (stockError) {
      return `restore ${mutation.itemId} failed: ${stockError.message}`;
    }

    const logError = await deleteTransferInventoryLog(supabase, mutation);
    if (logError) {
      return `delete log ${mutation.itemId} failed: ${logError.message}`;
    }
  }

  return '';
}

function appendRollbackError(message: string, rollbackError: string) {
  return rollbackError ? `${message}; rollback failed: ${rollbackError}` : message;
}

export interface TransferOrderItem {
  name: string;
  sku: string;
  qty: number;
  unit: string;
}

export interface InventoryTransferOrder {
  id: string;
  order_number: string;
  requester_tenant_id: string;
  status: 'pending' | 'approved' | 'shipped' | 'completed' | 'cancelled';
  items: TransferOrderItem[];
  shipping_carrier: string | null;
  tracking_number: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  requester?: {
    id: string;
    name: string;
  } | null;
}

export type InventoryTransferOrdersResult =
  | { success: true; data: InventoryTransferOrder[] }
  | { success: false; error: string };

const transferStatuses = new Set<InventoryTransferOrder['status']>([
  'pending',
  'approved',
  'shipped',
  'completed',
  'cancelled',
]);

function normalizeTransferStatus(status: string): InventoryTransferOrder['status'] {
  if (transferStatuses.has(status as InventoryTransferOrder['status'])) {
    return status as InventoryTransferOrder['status'];
  }

  throw new InventoryError(`Trạng thái chuyển kho không hợp lệ: ${status}`, 'INVENTORY_TRANSFER_INVALID_STATUS', { status });
}

function normalizeTransferItems(items: Json): TransferOrderItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

      const rawItem = item as Record<string, unknown>;
      const qty = Number(rawItem.qty ?? 0);

      return {
        name: String(rawItem.name ?? ''),
        sku: String(rawItem.sku ?? ''),
        qty: Number.isFinite(qty) ? qty : 0,
        unit: String(rawItem.unit ?? ''),
      };
    })
    .filter((item): item is TransferOrderItem => item !== null);
}

function mapTransferOrderRow(
  row: InventoryTransferOrderRow,
  tenantsById: Map<string, TenantNameRow>,
): InventoryTransferOrder {
  const requester = tenantsById.get(row.requester_tenant_id);

  return {
    id: row.id,
    order_number: row.order_number,
    requester_tenant_id: row.requester_tenant_id,
    status: normalizeTransferStatus(row.status),
    items: normalizeTransferItems(row.items),
    shipping_carrier: row.shipping_carrier,
    tracking_number: row.tracking_number,
    notes: row.notes,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    approved_at: row.approved_at,
    shipped_at: row.shipped_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    requester: requester ? { id: requester.id, name: requester.name } : null,
  };
}

/**
 * Chi nhánh tạo yêu cầu cung ứng vật tư gửi lên HQ.
 */
export async function createInventoryRequest(items: TransferOrderItem[], notes?: string) {
  try {
    if (!items || items.length === 0) {
      return { success: false, error: 'Danh sách vật tư yêu cầu không được để trống' };
    }

    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập' };
    if (!user.tenant_id) return { success: false, error: 'Không xác định được chi nhánh hoạt động' };

    // Sinh mã yêu cầu độc nhất: TRF-YYYYMM-XXXX
    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `TRF-${dateStr}-${rand}`;

    const insertPayload: InventoryTransferOrderInsert = {
      order_number: orderNumber,
      requester_tenant_id: user.tenant_id,
      items: transferItemsToJson(items),
      notes: notes || '',
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('inventory_transfer_orders')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[createInventoryRequest] error:', error);
      return { success: false, error: 'Lỗi tạo yêu cầu chuyển kho: ' + error.message };
    }

    try {
      revalidatePath('/dashboard/inventory');
      await safeRevalidatePath('/dashboard/inventory');
    } catch {}

    return { success: true, data };
  } catch (e: unknown) {
    console.error('[createInventoryRequest] exception:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

/**
 * Lấy danh sách lệnh chuyển kho.
 * HQ Admin: xem được toàn bộ của tất cả chi nhánh.
 * Branch Admin: chỉ xem được của chi nhánh mình.
 */
export async function getInventoryTransferOrdersResult(tenantId?: string): Promise<InventoryTransferOrdersResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return { success: true, data: [] };

    const authResult = await checkHqAuth();

    let query = supabase
      .from('inventory_transfer_orders')
      .select('*');

    if (authResult.authorized) {
      if (tenantId) {
        query = query.eq('requester_tenant_id', tenantId);
      }
    } else {
      if (!user.tenant_id) return { success: true, data: [] };
      query = query.eq('requester_tenant_id', user.tenant_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[getInventoryTransferOrders] error:', error);
      return { success: false, error: 'Lỗi tải danh sách chuyển kho: ' + error.message };
    }

    const rows = (data || []) as InventoryTransferOrderRow[];
    const requesterIds = new Set(rows.map((row) => row.requester_tenant_id));
    let tenantsById = new Map<string, TenantNameRow>();

    if (requesterIds.size > 0) {
      const { data: tenantRows, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name');

      if (tenantError) {
        console.error('[getInventoryTransferOrders] tenants error:', tenantError);
        return { success: false, error: 'Lỗi tải tên chi nhánh chuyển kho: ' + tenantError.message };
      }

      tenantsById = new Map(
        ((tenantRows || []) as TenantNameRow[])
          .filter((tenant) => requesterIds.has(tenant.id))
          .map((tenant) => [tenant.id, tenant]),
      );
    }

    return {
      success: true,
      data: rows.map((row) => mapTransferOrderRow(row, tenantsById)),
    };
  } catch (e) {
    console.error('[getInventoryTransferOrders] Exception:', e);
    return { success: false, error: getErrorMessage(e, 'Lỗi tải danh sách chuyển kho') };
  }
}

export async function getInventoryTransferOrders(tenantId?: string): Promise<InventoryTransferOrder[]> {
  const result = await getInventoryTransferOrdersResult(tenantId);

  if (!result.success) {
    throw new InventoryError(result.error, 'INVENTORY_TRANSFER_FETCH_FAILED', { tenantId });
  }

  return result.data;
}

/**
 * HQ Admin phê duyệt và giao hàng lệnh chuyển kho.
 * Trừ kho vật tư tại HQ (Bella Spa Headquarter).
 */
export async function approveAndShipTransfer(transferId: string, carrier: string, trackingNumber: string) {
  try {
    if (!carrier || !trackingNumber) {
      return { success: false, error: 'Vui lòng cung cấp đơn vị vận chuyển và mã vận đơn' };
    }

    const authResult = await checkHqAuth();
    if (!authResult.authorized) {
      return { success: false, error: 'Chỉ Admin Tổng bộ mới có quyền phê duyệt & xuất kho giao hàng' };
    }

    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập' };

    // 1. Tìm thông tin lệnh chuyển kho
    const { data: order, error: orderErr } = await supabase
      .from('inventory_transfer_orders')
      .select('*')
      .eq('id', transferId)
      .single();

    if (orderErr || !order) {
      return { success: false, error: 'Không tìm thấy lệnh chuyển kho' };
    }

    if (order.status !== 'pending') {
      return { success: false, error: `Lệnh chuyển kho đang ở trạng thái "${order.status}", không thể giao hàng` };
    }

    // 2. Tìm Tenant ID của HQ (Bella Spa Headquarter)
    const { data: hqTenant, error: hqTenantErr } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'Bella Spa Headquarter')
      .single();

    if (hqTenantErr || !hqTenant) {
      return { success: false, error: 'Không tìm thấy thông tin kho hàng của Tổng bộ' };
    }

    const hqTenantId = hqTenant.id;
    const items = order.items as unknown as TransferOrderItem[];

    // 3. Kiểm tra số lượng tồn kho tại Tổng bộ trước khi trừ
    for (const item of items) {
      let query = supabase
        .from('inventory_items')
        .select('id, name, stock_level')
        .eq('tenant_id', hqTenantId);

      if (item.sku) {
        query = query.eq('sku', item.sku);
      } else {
        query = query.eq('name', item.name);
      }

      const { data: dbItem, error: fetchErr } = await query.maybeSingle();

      if (fetchErr || !dbItem) {
        return { 
          success: false, 
          error: `Tổng bộ không có mặt hàng "${item.name}" (SKU: ${item.sku || 'N/A'}) trong kho` 
        };
      }

      if (dbItem.stock_level < item.qty) {
        return { 
          success: false, 
          error: `Số lượng tồn kho tại Tổng bộ không đủ cho mặt hàng "${item.name}". Hiện tại còn ${dbItem.stock_level}, cần xuất ${item.qty}` 
        };
      }
    }

    // 4. Trừ kho Tổng bộ & ghi log lịch sử xuất kho
    const shipmentMutations: TransferInventoryMutation[] = [];
    for (const item of items) {
      let query = supabase
        .from('inventory_items')
        .select('id, stock_level')
        .eq('tenant_id', hqTenantId);

      if (item.sku) {
        query = query.eq('sku', item.sku);
      } else {
        query = query.eq('name', item.name);
      }

      const { data: dbItem, error: fetchErr } = await query.single();
      if (fetchErr) {
        return { success: false, error: `Lỗi đọc tồn kho Tổng bộ cho "${item.name}": ${fetchErr.message}` };
      }
      if (!dbItem) {
        return { success: false, error: `Vật tư "${item.name}" không tồn tại trong kho Tổng bộ.` };
      }
      const previousStock = Number(dbItem.stock_level ?? 0);
      const newStock = previousStock - item.qty;

      // Cập nhật tồn kho
      const stockUpdatePayload: InventoryItemUpdate = {
        stock_level: newStock,
        updated_at: new Date().toISOString(),
      };
      const { error: stockUpdateErr } = await supabase
        .from('inventory_items')
        .update(stockUpdatePayload)
        .eq('id', dbItem.id);

      if (stockUpdateErr) {
        return { success: false, error: `Lỗi trừ kho Tổng bộ cho "${item.name}": ${stockUpdateErr.message}` };
      }

      // Ghi log
      const logNotes = `Xuất chuyển kho cho đơn ${order.order_number}`;
      const logPayload: InventoryLogInsert = {
        item_id: dbItem.id,
        change_amount: -item.qty,
        reason: 'transfer_shipment',
        notes: logNotes,
        tenant_id: hqTenantId,
      };
      const { error: logErr } = await supabase.from('inventory_logs').insert(logPayload);

      if (logErr) {
        const rollbackErr = await restoreInventoryStock(supabase, dbItem.id, previousStock);
        const priorRollbackErr = await rollbackTransferInventoryMutations(supabase, shipmentMutations);
        const rollbackParts = [
          rollbackErr ? `current item restore failed: ${rollbackErr.message}` : '',
          priorRollbackErr,
        ].filter(Boolean);
        const rollbackNote = rollbackParts.length > 0 ? `; rollback failed: ${rollbackParts.join('; ')}` : '';
        return {
          success: false,
          error: `Lỗi ghi log xuất kho cho "${item.name}": ${logErr.message}${rollbackNote}`,
        };
      }

      shipmentMutations.push({
        itemId: dbItem.id,
        previousStock,
        logReason: 'transfer_shipment',
        logNotes,
        tenantId: hqTenantId,
      });
    }

    // 5. Cập nhật trạng thái lệnh chuyển kho thành 'shipped'
    const now = new Date().toISOString();
    const orderUpdatePayload: InventoryTransferOrderUpdate = {
      status: 'shipped',
      shipping_carrier: carrier,
      tracking_number: trackingNumber,
      approved_at: now,
      shipped_at: now,
      updated_at: now,
    };
    const { error: updateErr } = await supabase
      .from('inventory_transfer_orders')
      .update(orderUpdatePayload)
      .eq('id', transferId);

    if (updateErr) {
      console.error('[approveAndShipTransfer] update error:', updateErr);
      const rollbackErr = await rollbackTransferInventoryMutations(supabase, shipmentMutations);
      return {
        success: false,
        error: appendRollbackError('Lỗi cập nhật trạng thái đơn hàng: ' + updateErr.message, rollbackErr),
      };
    }

    // 6. Gửi cảnh báo Notification, Email & Zalo ZNS cho chi nhánh nhận hàng
    try {
      const { data: branchUsers } = await supabase
        .from('users')
        .select('id, email, phone')
        .eq('tenant_id', order.requester_tenant_id)
        .eq('role', 'admin');

      const { data: branchTenant } = await supabase
        .from('tenants')
        .select('name, contact_phone, email')
        .eq('id', order.requester_tenant_id)
        .single();
        
      if (branchUsers && branchUsers.length > 0) {
        for (const branchAdmin of branchUsers) {
          // 6.1 In-app Notification
          await supabase.from('Notification').insert({
            id: `ship_${transferId}_${branchAdmin.id}_${Date.now()}`,
            userId: branchAdmin.id,
            title: 'Hàng Đang Vận Chuyển',
            message: `Lệnh chuyển kho ${order.order_number} đã được Tổng bộ xuất xưởng. Đơn vị: ${carrier}, Mã vận đơn: ${trackingNumber}. Vui lòng kiểm tra kho khi nhận được.`,
            type: 'system',
            tenantId: order.requester_tenant_id,
            isRead: false,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // 6.2 Zalo/Email alerts (Mocking Zalo ZNS / Email delivery for logs)
      const contactPhone = branchTenant?.contact_phone || branchUsers?.[0]?.phone;
      const contactEmail = branchTenant?.email || branchUsers?.[0]?.email;
      
      console.log(`[Alert] Đã gửi thông báo Email tới chi nhánh ${branchTenant?.name} (${contactEmail}) về vận đơn ${trackingNumber}`);
      console.log(`[Alert] Đã gửi thông báo Zalo ZNS tới chi nhánh (Phone: ${contactPhone}) về lệnh ${order.order_number}`);
      
    } catch (alertErr) {
      console.error('[approveAndShipTransfer] alert error:', alertErr);
      // Non-blocking error, allow process to complete
    }

    try {
      revalidatePath('/dashboard/inventory');
      revalidatePath('/hq');
      await safeRevalidatePath('/dashboard/inventory');
      await safeRevalidatePath('/hq');
    } catch {}

    return { success: true };
  } catch (e: unknown) {
    console.error('[approveAndShipTransfer] exception:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

/**
 * Chi nhánh xác nhận nhận hàng.
 * Cộng kho vật tư tại chi nhánh con (tự động khởi tạo nếu chưa có).
 */
export async function confirmTransferReceipt(transferId: string) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập' };

    // 1. Tìm thông tin lệnh chuyển kho
    const { data: order, error: orderErr } = await supabase
      .from('inventory_transfer_orders')
      .select('*')
      .eq('id', transferId)
      .single();

    if (orderErr || !order) {
      return { success: false, error: 'Không tìm thấy lệnh chuyển kho' };
    }

    // Xác thực quyền: Chỉ chi nhánh yêu cầu mới được nhận hàng
    if (order.requester_tenant_id !== user.tenant_id) {
      return { success: false, error: 'Quyền truy cập bị từ chối. Chỉ chi nhánh yêu cầu mới có quyền xác nhận nhận hàng.' };
    }

    if (order.status !== 'shipped') {
      return { success: false, error: `Lệnh chuyển kho đang ở trạng thái "${order.status}", không thể xác nhận nhận hàng` };
    }

    const items = order.items as unknown as TransferOrderItem[];
    const branchTenantId = user.tenant_id;
    const receiptMutations: TransferInventoryMutation[] = [];

    // 2. Thực hiện cộng kho vật tư tại chi nhánh & ghi log lịch sử
    for (const item of items) {
      let query = supabase
        .from('inventory_items')
        .select('id, stock_level')
        .eq('tenant_id', branchTenantId);

      if (item.sku) {
        query = query.eq('sku', item.sku);
      } else {
        query = query.eq('name', item.name);
      }

      const { data: dbItem, error: fetchErr } = await query.maybeSingle();

      let itemId = '';
      if (fetchErr) {
        return { success: false, error: `Lỗi đọc tồn kho chi nhánh cho "${item.name}": ${fetchErr.message}` };
      }

      let previousStock: number | null = null;
      let createdNewItem = false;
      if (dbItem) {
        // Vật tư đã tồn tại tại chi nhánh con, tiến hành cập nhật số lượng
        itemId = dbItem.id;
        previousStock = Number(dbItem.stock_level ?? 0);
        const newStock = previousStock + item.qty;

        const stockUpdatePayload: InventoryItemUpdate = {
          stock_level: newStock,
          updated_at: new Date().toISOString(),
        };
        const { error: stockUpdateErr } = await supabase
          .from('inventory_items')
          .update(stockUpdatePayload)
          .eq('id', itemId);

        if (stockUpdateErr) {
          return { success: false, error: `Lỗi cộng kho chi nhánh cho "${item.name}": ${stockUpdateErr.message}` };
        }
      } else {
        // Vật tư chưa từng tồn tại, tự động khởi tạo mặt hàng mới cho chi nhánh con
        const { data: newItem, error: insertErr } = await supabase
          .from('inventory_items')
          .insert({
            name: item.name,
            sku: item.sku || null,
            unit: item.unit || 'cái',
            stock_level: item.qty,
            min_stock_level: BUSINESS_RULES.INVENTORY.LOW_STOCK_THRESHOLD,
            price_per_unit: 0,
            category: 'Cấp từ HQ',
            tenant_id: branchTenantId
          } satisfies InventoryItemInsert)
          .select('id')
          .single();

        if (insertErr || !newItem) {
          console.error('[confirmTransferReceipt] create item error:', insertErr);
          return { success: false, error: `Lỗi khởi tạo mặt hàng "${item.name}" tại chi nhánh` };
        }
        itemId = newItem.id;
        createdNewItem = true;
      }

      // Ghi log lịch sử nhận kho tại chi nhánh con
      const logNotes = `Nhận chuyển kho từ Tổng bộ theo đơn ${order.order_number}`;
      const logPayload: InventoryLogInsert = {
        item_id: itemId,
        change_amount: item.qty,
        reason: 'transfer_receipt',
        notes: logNotes,
        tenant_id: branchTenantId,
      };
      const { error: logErr } = await supabase.from('inventory_logs').insert(logPayload);

      if (logErr) {
        const rollbackErr = createdNewItem
          ? await deleteInventoryItem(supabase, itemId)
          : previousStock === null
            ? null
            : await restoreInventoryStock(supabase, itemId, previousStock);
        const priorRollbackErr = await rollbackTransferInventoryMutations(supabase, receiptMutations);
        const rollbackParts = [
          rollbackErr ? `current item rollback failed: ${rollbackErr.message}` : '',
          priorRollbackErr,
        ].filter(Boolean);
        const rollbackNote = rollbackParts.length > 0 ? `; rollback failed: ${rollbackParts.join('; ')}` : '';
        return {
          success: false,
          error: `Lỗi ghi log nhận kho cho "${item.name}": ${logErr.message}${rollbackNote}`,
        };
      }

      receiptMutations.push({
        itemId,
        previousStock: createdNewItem ? 0 : Number(previousStock ?? 0),
        logReason: 'transfer_receipt',
        logNotes,
        tenantId: branchTenantId,
        createdNewItem,
      });
    }

    // 3. Cập nhật trạng thái lệnh chuyển kho thành 'completed'
    const now = new Date().toISOString();
    const orderUpdatePayload: InventoryTransferOrderUpdate = {
      status: 'completed',
      completed_at: now,
      updated_at: now,
    };
    const { error: updateErr } = await supabase
      .from('inventory_transfer_orders')
      .update(orderUpdatePayload)
      .eq('id', transferId);

    if (updateErr) {
      console.error('[confirmTransferReceipt] update error:', updateErr);
      const rollbackErr = await rollbackTransferInventoryMutations(supabase, receiptMutations);
      return {
        success: false,
        error: appendRollbackError('Lỗi cập nhật trạng thái đơn hàng: ' + updateErr.message, rollbackErr),
      };
    }

    try {
      revalidatePath('/dashboard/inventory');
      revalidatePath('/hq');
      await safeRevalidatePath('/dashboard/inventory');
      await safeRevalidatePath('/hq');
    } catch {}

    return { success: true };
  } catch (e: unknown) {
    console.error('[confirmTransferReceipt] exception:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

/**
 * Hủy yêu cầu chuyển kho (khi trạng thái đang là pending).
 */
export async function cancelTransferOrder(transferId: string, reason?: string) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập' };

    const { data: order, error: orderErr } = await supabase
      .from('inventory_transfer_orders')
      .select('*')
      .eq('id', transferId)
      .single();

    if (orderErr || !order) {
      return { success: false, error: 'Không tìm thấy lệnh chuyển kho' };
    }

    if (order.status !== 'pending') {
      return { success: false, error: `Lệnh chuyển kho đã ở trạng thái "${order.status}", không thể hủy` };
    }

    // Kiểm tra quyền hạn: HQ Admin hoặc Branch Admin sở hữu đơn hàng
    const authResult = await checkHqAuth();
    if (!authResult.authorized && order.requester_tenant_id !== user.tenant_id) {
      return { success: false, error: 'Quyền truy cập bị từ chối' };
    }

    const now = new Date().toISOString();
    const orderUpdatePayload: InventoryTransferOrderUpdate = {
      status: 'cancelled',
      rejection_reason: reason || 'Người dùng hủy yêu cầu',
      cancelled_at: now,
      updated_at: now,
    };
    const { error: updateErr } = await supabase
      .from('inventory_transfer_orders')
      .update(orderUpdatePayload)
      .eq('id', transferId);

    if (updateErr) {
      console.error('[cancelTransferOrder] error:', updateErr);
      return { success: false, error: 'Lỗi hủy yêu cầu: ' + updateErr.message };
    }

    try {
      revalidatePath('/dashboard/inventory');
      revalidatePath('/hq');
      await safeRevalidatePath('/dashboard/inventory');
      await safeRevalidatePath('/hq');
    } catch {}

    return { success: true };
  } catch (e: unknown) {
    console.error('[cancelTransferOrder] exception:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}
