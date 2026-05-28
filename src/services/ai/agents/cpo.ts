import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { SubAgentResponse } from '../types';

export async function runCPOAgent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  activeDate: Date
): Promise<SubAgentResponse> {
  console.log("[AI COO Service] Định tuyến tới: CPO Agent");

  const { data: inventoryItems, error: itemsError } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");

  if (itemsError) {
    console.error("[CPO Agent] Lỗi khi truy vấn inventory_items:", itemsError);
    throw itemsError;
  }

  const lowStockItems = (inventoryItems || []).filter(
    (item) => Number(item.stock_level || 0) < Number(item.min_stock_level || 0)
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: inventoryLogs, error: logsError } = await supabase
    .from("inventory_logs")
    .select("id, change_amount, reason, created_at, item_id, inventory_items!inventory_logs_item_id_fkey(name, unit, sku)")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  if (logsError) {
    console.error("[CPO Agent] Lỗi khi truy vấn inventory_logs:", logsError);
    throw logsError;
  }

  const summaryText = `Đã hoàn tất phân tích kho vận. Có ${lowStockItems.length} mặt hàng dưới mức tối thiểu cần nhập kho khẩn cấp. Lịch sử ghi nhận ${(inventoryLogs || []).length} biến động kho trong 30 ngày qua.`;

  return {
    agent: "CPO (Trưởng phòng Kho vận & Vật tư)",
    period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    summary: summaryText,
    data: {
      all_items: inventoryItems,
      low_stock: lowStockItems,
      logs: inventoryLogs
    },
    anomalies: lowStockItems.map((item) => ({
      type: "low_stock",
      item_name: item.name,
      sku: item.sku,
      stock_level: item.stock_level,
      min_stock_level: item.min_stock_level,
      message: `Mặt hàng "${item.name}" (SKU: ${item.sku}) đang có lượng tồn thực tế là ${item.stock_level} ${item.unit || ''}, dưới mức tối thiểu cảnh báo (${item.min_stock_level} ${item.unit || ''}).`
    })),
    draftProposals: lowStockItems.map((item) => ({
      type: "inventory_restock",
      recipient: "Bộ phận Mua sắm / Kho vận",
      reason: `Mặt hàng ${item.name} (SKU: ${item.sku}) chạm ngưỡng tồn kho tối thiểu.`,
      draftMessage: `[Đề xuất nhập kho] Kính gửi bộ phận mua sắm, hệ thống Bella Spa phát hiện mặt hàng "${item.name}" (SKU: ${item.sku}) hiện chỉ còn tồn ${item.stock_level} ${item.unit || ''}, dưới mức tối thiểu quy định (${item.min_stock_level} ${item.unit || ''}). Đề xuất lập đơn hàng nhập thêm ít nhất ${(Number(item.min_stock_level) * 2 - Number(item.stock_level))} ${item.unit || ''} để đảm bảo hoạt động không bị gián đoạn.`
    }))
  };
}
