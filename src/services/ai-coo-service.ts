import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

export interface COOAnalysisResult {
  status: string;
  timestamp: string;
  sender: string;
  recipient: string;
  period: string;
  routedAgent: string;
  analysis: {
    executiveSummary: string;
    anomaliesFound: any[];
    fullData: any[];
  };
  draftActions: any[];
  strategicRecommendations: string[];
}

/**
 * Lõi điều phối AI COO Orchestrator
 * Chạy an toàn với Supabase Client truyền vào (hỗ trợ cả Cookies Auth và Service Role)
 */
export async function runCOOOrchestrator(
  supabase: SupabaseClient<Database>,
  command: string,
  tenantId: string,
  user: { id: string; full_name: string; role: string },
  monthYear?: string
): Promise<COOAnalysisResult> {
  const activeDate = monthYear ? new Date(monthYear) : new Date();
  const formattedDate = activeDate.toISOString().split('T')[0];
  const firstDayOfMonth = new Date(activeDate.getFullYear(), activeDate.getMonth(), 1).toISOString().split('T')[0];
  
  const lowerCommand = command.toLowerCase();
  let routedTo = "coo";
  let subAgentResponse: any = null;

  // Định tuyến phân tích
  const isHrRelated = lowerCommand.includes("nhân sự") || 
                      lowerCommand.includes("lương") || 
                      lowerCommand.includes("chấm công") || 
                      lowerCommand.includes("ktv") || 
                      lowerCommand.includes("kpi") || 
                      lowerCommand.includes("ca làm");

  const isFinanceRelated = lowerCommand.includes("tài chính") || 
                           lowerCommand.includes("kế toán") || 
                           lowerCommand.includes("doanh thu") || 
                           lowerCommand.includes("chi phí") || 
                           lowerCommand.includes("lợi nhuận") || 
                           lowerCommand.includes("quỹ") || 
                           lowerCommand.includes("đối soát") ||
                           lowerCommand.includes("cân đối") ||
                           lowerCommand.includes("phát sinh") ||
                           lowerCommand.includes("sổ cái") ||
                           lowerCommand.includes("sổ quỹ") ||
                           lowerCommand.includes("p&l") ||
                           lowerCommand.includes("trial balance") ||
                           lowerCommand.includes("income statement") ||
                           lowerCommand.includes("cash flow");

  if (isHrRelated) {
    routedTo = "chro";
    console.log("[AI COO Service] Định tuyến tới: CHRO Agent");

    // 1. Quét chấm công & định vị GPS của KTV
    const { data: attendanceKpis, error: rpcError } = await supabase.rpc("get_ai_attendance_kpis", {
      p_month_year: formattedDate
    });

    if (rpcError) {
      console.error("[CHRO Agent] Lỗi khi gọi RPC get_ai_attendance_kpis:", rpcError);
      throw rpcError; // Zero Silent DB Failures
    }

    // 2. Tính toán bảng lương KTV chi tiết
    const { data: salarySheet, error: salaryError } = await supabase.rpc("calculate_ktv_salary_sheet", {
      p_month_year: formattedDate
    });

    if (salaryError) {
      console.error("[CHRO Agent] Lỗi khi gọi RPC calculate_ktv_salary_sheet:", salaryError);
      throw salaryError; // Zero Silent DB Failures
    }

    // Phân tích dữ liệu KTV
    const kpiSummary = (attendanceKpis || []).map((item: any) => {
      const total = Number(item.total_shifts || 0);
      const late = Number(item.late_count || 0);
      const present = Number(item.present_count || 0);
      const gpsAnomaly = Number(item.gps_anomaly_count || 0);
      
      const onTimeRate = total > 0 ? (((present - late) / total) * 100).toFixed(1) : "100";
      const sInfo = (salarySheet || []).find((s: any) => s.ktv_id === item.ktv_id);

      return {
        name: item.ktv_name,
        shifts: total,
        present: present,
        late: late,
        absent: item.absent_count,
        gpsAnomaly: gpsAnomaly,
        onTimeRate: `${onTimeRate}%`,
        baseSalary: sInfo ? Number(sInfo.base_salary) : 0,
        sessionBonus: sInfo ? Number(sInfo.session_bonus) : 0,
        ratingBonus: sInfo ? Number(sInfo.rating_bonus) : 0,
        kpiBonus: sInfo ? Number(sInfo.kpi_bonus) : 0,
        deductions: sInfo ? Number(sInfo.deductions) : 0,
        advances: sInfo ? Number(sInfo.advances) : 0,
        totalSalary: sInfo ? Number(sInfo.total_salary) : 0,
        status: gpsAnomaly > 2 ? "🔴 Bất thường GPS cao" : (late > 3 ? "🟡 Trễ ca nhiều" : "🟢 Tốt")
      };
    });

    const anomalies = kpiSummary.filter((k: any) => k.gpsAnomaly > 0 || k.late > 2 || k.deductions > 200000);

    subAgentResponse = {
      agent: "CHRO (Trưởng phòng Nhân sự - Tiền lương)",
      period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
      summary: `Đã hoàn tất phân tích ${kpiSummary.length} hồ sơ KTV của chi nhánh. Phát hiện ${anomalies.length} trường hợp cần lưu ý kỷ luật lao động hoặc có khấu trừ vi phạm lớn.`,
      data: kpiSummary,
      anomalies: anomalies,
      draftProposals: anomalies.map((a: any) => ({
        type: "attendance_warning",
        recipient: a.name,
        reason: `${a.late > 0 ? `Đi muộn ${a.late} ca. ` : ''}${a.gpsAnomaly > 0 ? `Lệch định vị GPS ${a.gpsAnomaly} ca tắm bé. ` : ''}${a.deductions > 0 ? `Bị phạt vi phạm ${a.deductions.toLocaleString('vi-VN')}đ.` : ''}`,
        draftMessage: `[Thông báo hệ thống] Kính gửi KTV ${a.name}, bộ phận nhân sự Bella Spa phát hiện bạn có ${a.late > 0 ? `${a.late} ca đi muộn` : ''}${a.gpsAnomaly > 0 ? ` và ${a.gpsAnomaly} ca lệch định vị GPS` : ''} trong kỳ tính công này. Số tiền phạt vi phạm dự kiến là ${a.deductions.toLocaleString('vi-VN')}đ. Vui lòng gửi giải trình phản hồi trong vòng 24h.`
      }))
    };

  } else if (isFinanceRelated) {
    routedTo = "cfo";
    console.log("[AI COO Service] Định tuyến tới: CFO Agent");

    let reportData: any = null;
    let reportType = "reconciliation";
    let summaryText = "";

    // Phân tích từ khóa gọi báo cáo TT133
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
    } 
    else if (lowerCommand.includes("kết quả kinh doanh") || lowerCommand.includes("income statement")) {
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
    } 
    else if (lowerCommand.includes("lưu chuyển tiền tệ") || lowerCommand.includes("dòng tiền") || lowerCommand.includes("cash flow")) {
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
    }
    else if (lowerCommand.includes("p&l") || lowerCommand.includes("lợi nhuận gộp") || lowerCommand.includes("doanh thu chi phí")) {
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
    }
    else {
      // Mặc định đối soát sổ cái kế toán và sổ quỹ thu chi
      const { data, error } = await supabase.rpc("get_reconciliation_report", {
        p_tenant_id: tenantId,
        p_from_date: firstDayOfMonth,
        p_to_date: formattedDate
      });
      if (error) {
        console.error("[CFO Agent] Lỗi đối soát sổ sách:", error);
        throw error;
      }
      reportData = data;
      const diffCount = (data || []).filter((r: any) => r.status === "MAJOR_DIFF").length;
      summaryText = `Đã hoàn tất kiểm tra đối soát quỹ. Phát hiện ${diffCount} chênh lệch Sổ cái & Sổ quỹ lớn (> 1%) cần chú ý xử lý.`;
    }

    subAgentResponse = {
      agent: "CFO (Trưởng phòng Tài chính - Kế toán)",
      period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
      summary: summaryText,
      reportType: reportType,
      data: reportData,
      draftProposals: reportType === "reconciliation" && (reportData || []).some((r: any) => r.status === "MAJOR_DIFF") ? [
        {
          type: "reconciliation_audit",
          reason: "Phát hiện chênh lệch giữa Sổ cái kế toán và Sổ quỹ nghiệp vụ thực tế vượt ngưỡng 1%.",
          draftMessage: `[Cảnh báo Kế toán] Phát hiện chênh lệch quỹ tiền mặt đáng kể giữa nghiệp vụ spa và sổ cái kế toán trong kỳ. Yêu cầu bộ phận kế toán thực hiện rà soát chéo các hóa đơn thu chi trong ngày hôm nay.`
        }
      ] : []
    };

  } else {
    // COO xử lý tổng quan
    subAgentResponse = {
      agent: "General Operation",
      summary: "AI COO đã tiếp nhận lệnh vận hành tổng và đang chuẩn bị dữ liệu.",
      data: null
    };
  }

  const responseSummary = subAgentResponse ? subAgentResponse.summary : "Đã hoàn thành phân tích.";

  // Ghi nhật ký phân tích vào bảng ai_agent_logs (Side-effect log bắt buộc)
  const { error: logError } = await supabase.from("ai_agent_logs").insert({
    tenant_id: tenantId,
    user_id: user.id || null,
    sender: "coo",
    message: `CEO ra lệnh: "${command}". Định tuyến tới ${routedTo}. Kết quả: ${responseSummary}`,
    metadata: {
      command: command,
      routed_to: routedTo,
      active_date: formattedDate,
      sub_agent_data: subAgentResponse
    }
  });

  if (logError) {
    console.error("[AI COO Service] Lỗi chèn nhật ký AI log:", logError);
    throw logError; // Zero Silent DB Failures
  }

  // Lập báo cáo chiến lược
  return {
    status: "success",
    timestamp: new Date().toISOString(),
    sender: "AI COO Agent (Thư ký Tổng giám đốc)",
    recipient: `CEO ${user.full_name}`,
    period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    routedAgent: routedTo,
    analysis: {
      executiveSummary: subAgentResponse?.summary || "Đang xử lý phân tích tổng quan chi nhánh.",
      anomaliesFound: subAgentResponse?.anomalies || [],
      fullData: subAgentResponse?.data || []
    },
    draftActions: subAgentResponse?.draftProposals || [],
    strategicRecommendations: routedTo === "chro" ? [
      "1. Ban hành quy chế thắt chặt bán kính nhận ca tắm bé (< 5km) cho KTV chi nhánh để tối ưu chi phí di chuyển.",
      "2. Yêu cầu KTV Lead tổ chức buổi chấn chỉnh ý thức tổ chức kỷ luật và quy trình Check-in GPS đúng vị trí nhà khách.",
      "3. Kích hoạt tính năng gửi tin nhắn nhắc nhở giải trình tự động qua Telegram/Zalo OA cho các KTV có bất thường cao nhất."
    ] : [
      "1. Định kỳ chạy đối soát quỹ đối chiếu với báo cáo doanh thu để kiểm tra sai lệch quỹ kế toán trước ngày 5 hàng tháng.",
      "2. Thắt chặt kiểm soát các chi phí vận hành biến động (dầu massage, khăn tắm bé hao hụt) của chi nhánh có biên lợi nhuận thấp.",
      "3. Rà soát lại việc ghi nhận sổ cái cho các khoản chiết khấu dịch vụ của các combo cao cấp."
    ]
  };
}
