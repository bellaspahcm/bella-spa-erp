import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { SubAgentResponse } from '../types';
import { calculateRoyaltyAmount } from '@/lib/business-rules/franchise';

export async function runFranchiseAgent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  activeDate: Date,
  formattedDate: string,
  firstDayOfMonth: string
): Promise<SubAgentResponse> {
  console.log("[AI COO Service] Định tuyến tới: Franchise Agent");

  const { data: tenantConfig, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name, royalty_type, royalty_rate, royalty_fixed_amount, parent_tenant_id")
    .eq("id", tenantId)
    .single();

  if (tenantError) {
    console.error("[Franchise Agent] Lỗi khi lấy cấu hình tenant:", tenantError);
    throw tenantError;
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from("franchise_royalty_invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("month_year", { ascending: false });

  if (invoicesError) {
    console.error("[Franchise Agent] Lỗi khi truy vấn franchise_royalty_invoices:", invoicesError);
    throw invoicesError;
  }

  const { data: revenues, error: revenueError } = await supabase
    .from("revenue")
    .select("amount, received_date, status")
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed")
    .gte("received_date", firstDayOfMonth)
    .lte("received_date", formattedDate);

  if (revenueError) {
    console.error("[Franchise Agent] Lỗi khi truy vấn revenue:", revenueError);
    throw revenueError;
  }

  const totalRevenue = (revenues || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const expectedRoyalty = calculateRoyaltyAmount({
    grossRevenue: totalRevenue,
    royaltyType: tenantConfig.royalty_type,
    royaltyRate: tenantConfig.royalty_rate,
    royaltyFixedAmount: tenantConfig.royalty_fixed_amount,
  });

  const summaryText = `Đã hoàn tất phân tích đối soát Nhượng quyền. Chi nhánh "${tenantConfig.name}" áp dụng mô hình phí "${tenantConfig.royalty_type === 'percentage' ? `tỷ lệ phần trăm (${tenantConfig.royalty_rate}%)` : `cố định (${Number(tenantConfig.royalty_fixed_amount).toLocaleString('vi-VN')}đ)`}". Doanh thu thực tế tháng này đạt ${totalRevenue.toLocaleString('vi-VN')}đ, phí nhượng quyền thực tế tính toán là ${expectedRoyalty.toLocaleString('vi-VN')}đ. Ghi nhận ${(invoices || []).length} hóa đơn trong lịch sử.`;

  return {
    agent: "Franchise (Ban vận hành Nhượng quyền)",
    period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    summary: summaryText,
    data: {
      tenant_config: tenantConfig,
      invoices: invoices || [],
      revenues_count: revenues?.length || 0,
      actual_revenue: totalRevenue,
      calculated_royalty: expectedRoyalty
    },
    anomalies: (invoices || []).filter(inv => inv.status === "pending").map((inv) => ({
      type: "pending_royalty_invoice",
      invoice_number: inv.invoice_number,
      month_year: inv.month_year,
      calculated_amount: inv.calculated_amount,
      message: `Hóa đơn nhượng quyền ${inv.invoice_number} cho kỳ ${inv.month_year} trị giá ${Number(inv.calculated_amount).toLocaleString('vi-VN')}đ hiện đang ở trạng thái chưa thanh toán.`
    })),
    draftProposals: (invoices || []).filter(inv => inv.status === "pending").map((inv) => ({
      type: "royalty_payment_reminder",
      recipient: tenantConfig.name,
      reason: `Yêu cầu thanh toán hóa đơn nhượng quyền chưa xử lý ${inv.invoice_number}.`,
      draftMessage: `[Nhắc nhở Đối soát Nhượng quyền] Kính gửi Ban Giám Đốc chi nhánh ${tenantConfig.name}, bộ phận nhượng quyền Bella Spa thông báo hóa đơn phí nhượng quyền số ${inv.invoice_number} kỳ ${inv.month_year} trị giá ${Number(inv.calculated_amount).toLocaleString('vi-VN')}đ đang ở trạng thái chưa thanh toán. Kính đề nghị chi nhánh thực hiện thanh toán đối soát trước ngày quy định trong hợp đồng.`
    }))
  };
}
