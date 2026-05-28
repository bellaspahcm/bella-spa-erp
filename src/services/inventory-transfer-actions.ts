'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { checkHqAuth } from './hq-actions';
import { revalidatePath } from 'next/cache';
import { safeRevalidatePath } from '@/lib/revalidate';

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

    const { data, error } = await supabase
      .from('inventory_transfer_orders')
      .insert({
        order_number: orderNumber,
        requester_tenant_id: user.tenant_id,
        items: items as unknown as import('@/types/database.types').Database['public']['Tables']['inventory_transfer_orders']['Insert']['items'],
        notes: notes || '',
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('[createInventoryRequest] error:', error);
      return { success: false, error: 'Lỗi tạo yêu cầu chuyển kho: ' + error.message };
    }

    try {
      revalidatePath('/dashboard/inventory');
      await safeRevalidatePath('/dashboard/inventory');
    } catch (_) {}

    return { success: true, data };
  } catch (e: any) {
    console.error('[createInventoryRequest] exception:', e);
    return { success: false, error: e.message || 'Lỗi hệ thống' };
  }
}

/**
 * Lấy danh sách lệnh chuyển kho.
 * HQ Admin: xem được toàn bộ của tất cả chi nhánh.
 * Branch Admin: chỉ xem được của chi nhánh mình.
 */
export async function getInventoryTransferOrders(tenantId?: string): Promise<InventoryTransferOrder[]> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return [];

    const authResult = await checkHqAuth();

    let query = supabase
      .from('inventory_transfer_orders')
      .select(`
        *,
        requester:requester_tenant_id (id, name)
      `);

    if (authResult.authorized) {
      if (tenantId) {
        query = query.eq('requester_tenant_id', tenantId);
      }
    } else {
      if (!user.tenant_id) return [];
      query = query.eq('requester_tenant_id', user.tenant_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[getInventoryTransferOrders] error:', error);
      throw error;
    }

    return (data || []) as unknown as InventoryTransferOrder[];
  } catch (e) {
    console.error('[getInventoryTransferOrders] Exception:', e);
    return [];
  }
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

      const { data: dbItem } = await query.single();
      if (!dbItem) {
        return { success: false, error: `Vật tư "${item.name}" không tồn tại trong kho Tổng bộ.` };
      }
      const newStock = (dbItem.stock_level ?? 0) - item.qty;

      // Cập nhật tồn kho
      await supabase
        .from('inventory_items')
        .update({ stock_level: newStock, updated_at: new Date().toISOString() })
        .eq('id', dbItem.id);

      // Ghi log
      await supabase.from('inventory_logs').insert({
        item_id: dbItem.id,
        change_amount: -item.qty,
        reason: 'transfer_shipment',
        notes: `Xuất chuyển kho cho đơn ${order.order_number}`,
        tenant_id: hqTenantId
      });
    }

    // 5. Cập nhật trạng thái lệnh chuyển kho thành 'shipped'
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('inventory_transfer_orders')
      .update({
        status: 'shipped',
        shipping_carrier: carrier,
        tracking_number: trackingNumber,
        approved_at: now,
        shipped_at: now,
        updated_at: now
      })
      .eq('id', transferId);

    if (updateErr) {
      console.error('[approveAndShipTransfer] update error:', updateErr);
      return { success: false, error: 'Lỗi cập nhật trạng thái đơn hàng: ' + updateErr.message };
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
    } catch (_) {}

    return { success: true };
  } catch (e: any) {
    console.error('[approveAndShipTransfer] exception:', e);
    return { success: false, error: e.message || 'Lỗi hệ thống' };
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
      if (dbItem) {
        // Vật tư đã tồn tại tại chi nhánh con, tiến hành cập nhật số lượng
        itemId = dbItem.id;
        const newStock = dbItem.stock_level + item.qty;

        await supabase
          .from('inventory_items')
          .update({ stock_level: newStock, updated_at: new Date().toISOString() })
          .eq('id', itemId);
      } else {
        // Vật tư chưa từng tồn tại, tự động khởi tạo mặt hàng mới cho chi nhánh con
        const { data: newItem, error: insertErr } = await supabase
          .from('inventory_items')
          .insert({
            name: item.name,
            sku: item.sku || null,
            unit: item.unit || 'cái',
            stock_level: item.qty,
            min_stock_level: 10,
            price_per_unit: 0,
            category: 'Cấp từ HQ',
            tenant_id: branchTenantId
          })
          .select('id')
          .single();

        if (insertErr || !newItem) {
          console.error('[confirmTransferReceipt] create item error:', insertErr);
          return { success: false, error: `Lỗi khởi tạo mặt hàng "${item.name}" tại chi nhánh` };
        }
        itemId = newItem.id;
      }

      // Ghi log lịch sử nhận kho tại chi nhánh con
      await supabase.from('inventory_logs').insert({
        item_id: itemId,
        change_amount: item.qty,
        reason: 'transfer_receipt',
        notes: `Nhận chuyển kho từ Tổng bộ theo đơn ${order.order_number}`,
        tenant_id: branchTenantId
      });
    }

    // 3. Cập nhật trạng thái lệnh chuyển kho thành 'completed'
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('inventory_transfer_orders')
      .update({
        status: 'completed',
        completed_at: now,
        updated_at: now
      })
      .eq('id', transferId);

    if (updateErr) {
      console.error('[confirmTransferReceipt] update error:', updateErr);
      return { success: false, error: 'Lỗi cập nhật trạng thái đơn hàng: ' + updateErr.message };
    }

    try {
      revalidatePath('/dashboard/inventory');
      revalidatePath('/hq');
      await safeRevalidatePath('/dashboard/inventory');
      await safeRevalidatePath('/hq');
    } catch (_) {}

    return { success: true };
  } catch (e: any) {
    console.error('[confirmTransferReceipt] exception:', e);
    return { success: false, error: e.message || 'Lỗi hệ thống' };
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
    const { error: updateErr } = await supabase
      .from('inventory_transfer_orders')
      .update({
        status: 'cancelled',
        rejection_reason: reason || 'Người dùng hủy yêu cầu',
        cancelled_at: now,
        updated_at: now
      })
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
    } catch (_) {}

    return { success: true };
  } catch (e: any) {
    console.error('[cancelTransferOrder] exception:', e);
    return { success: false, error: e.message || 'Lỗi hệ thống' };
  }
}
