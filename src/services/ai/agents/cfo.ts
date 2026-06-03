import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { SubAgentResponse } from '../types';

type ReconciliationReportRow = { status: string };

function assertReconciliationRows(data: unknown): ReconciliationReportRow[] {
  if (!Array.isArray(data)) {
    throw new Error("Invalid get_reconciliation_report response: expected an array");
  }
  return data as ReconciliationReportRow[];
}

export async function runCFOAgent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  activeDate: Date,
  formattedDate: string,
  firstDayOfMonth: string,
  lowerCommand: string
): Promise<SubAgentResponse> {
  console.log("[AI COO Service] Định tuyến tới: CFO Agent");

  let reportData: unknown = null;
  let reportType = "reconciliation";
  let summaryText = "";

  if (lowerCommand.includes("cân đối phát sinh") || lowerCommand.includes("trial balance")) {
    reportType = "trial_balance";
    const { data, error } = await supabase.rpc("get_trial_balance", {
      p_tenant_id: tenantId,
      p_as_of_date: formattedDate
    });
    if (error) {
      console.error("[CFO Agent] Lỗi khi lấy bảng cân đối phát sinh:", error);
      throw error;
    }
    reportData = data;
    summaryText = `Bảng cân đối tài khoản phát sinh tính đến ngày ${formattedDate} gồm ${(data || []).length} tài khoản kế toán hoạt động.`;
  } else if (lowerCommand.includes("kết quả kinh doanh") || lowerCommand.includes("income statement")) {
    reportType = "income_statement";
    const { data, error } = await supabase.rpc("get_income_statement", {
      p_tenant_id: tenantId,
      p_from_date: firstDayOfMonth,
      p_to_date: formattedDate
    });
    if (error) {
      console.error("[CFO Agent] Lỗi khi lấy báo cáo kết quả kinh doanh:", error);
      throw error;
    }
    reportData = data;
    summaryText = `Báo cáo kết quả hoạt động kinh doanh (Thông tư 133) từ ${firstDayOfMonth} đến ngày ${formattedDate}.`;
  } else if (lowerCommand.includes("lưu chuyển tiền tệ") || lowerCommand.includes("dòng tiền") || lowerCommand.includes("cash flow")) {
    reportType = "cash_flow";
    const { data, error } = await supabase.rpc("get_cash_flow_statement", {
      p_tenant_id: tenantId,
      p_from_date: firstDayOfMonth,
      p_to_date: formattedDate
    });
    if (error) {
      console.error("[CFO Agent] Lỗi khi lấy báo cáo lưu chuyển tiền tệ:", error);
      throw error;
    }
    reportData = data;
    summaryText = `Báo cáo lưu chuyển tiền tệ (gián tiếp) từ ngày ${firstDayOfMonth} đến ngày ${formattedDate}.`;
  } else if (lowerCommand.includes("p&l") || lowerCommand.includes("lợi nhuận gộp") || lowerCommand.includes("doanh thu chi phí")) {
    reportType = "pnl";
    const { data, error } = await supabase.rpc("get_consolidated_pnl", {
      p_from_date: firstDayOfMonth,
      p_to_date: formattedDate
    });
    if (error) {
      console.error("[CFO Agent] Lỗi khi lấy báo cáo P&L hợp nhất toàn chuỗi:", error);
      throw error;
    }
    reportData = data;
    summaryText = `Báo cáo doanh thu & lợi nhuận P&L toàn chuỗi từ ngày ${firstDayOfMonth} đến ngày ${formattedDate}.`;
  } else {
    const { data, error } = await supabase.rpc("get_reconciliation_report", {
      p_tenant_id: tenantId,
      p_from_date: firstDayOfMonth,
      p_to_date: formattedDate
    });
    if (error) {
      console.error("[CFO Agent] Lỗi đối soát sổ sách:", error);
      throw error;
    }
    const rows = assertReconciliationRows(data);
    reportData = rows;
    const diffCount = rows.filter((r) => r.status === "MAJOR_DIFF").length;
    summaryText = `Đã hoàn tất kiểm tra đối soát quỹ. Phát hiện ${diffCount} chênh lệch Sổ cái & Sổ quỹ lớn (> 1%) cần chú ý xử lý.`;
  }

  const rows = reportType === "reconciliation"
    ? assertReconciliationRows(reportData)
    : [];
  const hasMajorDiff = rows.some((r) => r.status === "MAJOR_DIFF");

  return {
    agent: "CFO (Trưởng phòng Tài chính - Kế toán)",
    period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    summary: summaryText,
    reportType,
    data: reportData,
    draftProposals: reportType === "reconciliation" && hasMajorDiff ? [
      {
        type: "reconciliation_audit",
        reason: "Phát hiện chênh lệch giữa Sổ cái kế toán và Sổ quỹ nghiệp vụ thực tế vượt ngưỡng 1%.",
        draftMessage: `[Cảnh báo Kế toán] Phát hiện chênh lệch quỹ tiền mặt đáng kể giữa nghiệp vụ spa và sổ cái kế toán trong kỳ. Yêu cầu bộ phận kế toán thực hiện rà soát chéo các hóa đơn thu chi trong ngày hôm nay.`
      }
    ] : []
  };
}
