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
      
      const totalAttended = present + late;
      const totalShifts = total > 0 ? total : (totalAttended + Number(item.absent_count || 0));
      
      let onTimeRateVal = 100;
      if (totalShifts > 0) {
        onTimeRateVal = (present / totalShifts) * 100;
      }
      const onTimeRate = onTimeRateVal.toFixed(1);
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

  // 5. Nạp GEMINI_API_KEY (ưu tiên Database config chi nhánh, rồi đến .env.local, rồi process.env)
  let geminiApiKey = process.env.GEMINI_API_KEY;

  // Lấy API key từ database (Bắt buộc cho Vercel Serverless nơi không lưu .env.local)
  try {
    const { data: configData } = await supabase
      .from("ai_agent_configs")
      .select("gemini_api_key")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();

    if (configData && configData.gemini_api_key) {
      geminiApiKey = configData.gemini_api_key.trim();
      console.log("[AI COO Service] Đã đọc GEMINI_API_KEY thành công từ Database chi nhánh:", tenantId);
    }
  } catch (dbErr) {
    console.error("[AI COO Service] Lỗi truy vấn API key từ Database:", dbErr);
  }

  // Fallback đọc từ file .env.local cho môi trường local dev
  if (!geminiApiKey || geminiApiKey.trim().length < 10) {
    try {
      const fs = require("fs");
      const path = require("path");
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        const match = envContent.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
        if (match && match[1]) {
          geminiApiKey = match[1].trim();
          console.log("[AI COO Service] Đã đọc GEMINI_API_KEY trực tiếp từ file .env.local thành công!");
        }
      }
    } catch (fsErr) {
      console.error("[AI COO Service] Không thể đọc trực tiếp từ .env.local:", fsErr);
    }
  }

  let executiveSummary = subAgentResponse?.summary || "Đang xử lý phân tích tổng quan chi nhánh.";
  let anomaliesFound = subAgentResponse?.anomalies || [];
  let draftActions = subAgentResponse?.draftProposals || [];
  let strategicRecommendations = routedTo === "chro" ? [
    "Ban hành quy chế thắt chặt bán kính nhận ca tắm bé (< 5km) cho KTV chi nhánh để tối ưu chi phí di chuyển.",
    "Yêu cầu KTV Lead tổ chức buổi chấn chỉnh ý thức tổ chức kỷ luật và quy trình Check-in GPS đúng vị trí nhà khách.",
    "Kích hoạt tính năng gửi tin nhắn nhắc nhở giải trình tự động qua Telegram/Zalo OA cho các KTV có bất thường cao nhất."
  ] : [
    "Định kỳ chạy đối soát quỹ đối chiếu với báo cáo doanh thu để kiểm tra sai lệch quỹ kế toán trước ngày 5 hàng tháng.",
    "Thắt chặt kiểm soát các chi phí vận hành biến động (dầu massage, khăn tắm bé hao hụt) của chi nhánh có biên lợi nhuận thấp.",
    "Rà soát lại việc ghi nhận sổ cái cho các khoản chiết khấu dịch vụ của các combo cao cấp."
  ];

  if (!geminiApiKey || geminiApiKey.trim().length < 10) {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.join(process.cwd(), ".env.local");
    const exists = fs.existsSync(envPath);
    let debugInfo = `Cwd: ${process.cwd()}, Path: ${envPath}, Exists: ${exists}`;
    if (exists) {
      try {
        const content = fs.readFileSync(envPath, "utf8");
        debugInfo += `, Content Length: ${content.length}`;
        const match = content.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
        debugInfo += `, Match Found: ${!!match}`;
        if (match) {
          debugInfo += `, Match[1] Length: ${match[1] ? match[1].trim().length : 0}`;
        }
      } catch (err: any) {
        debugInfo += `, Read Error: ${err.message}`;
      }
    }
    executiveSummary = `⚠️ Hệ thống chưa nạp được GEMINI_API_KEY hợp lệ từ file .env.local (Độ dài khóa tìm được: ${geminiApiKey ? geminiApiKey.trim().length : 0} ký tự). Chi tiết chẩn đoán: [${debugInfo}]. Vui lòng kiểm tra lại cấu hình key trong file .env.local ở thư mục gốc dự án.`;
  } else {
    try {
      console.log("[AI COO Service] Phát hiện GEMINI_API_KEY. Tiến hành gọi Gemini API cho phân tích thông minh...");
      const prompt = `Bạn là AI COO (Thư ký điều phối vận hành kiêm Trợ lý cấp cao của Tổng Giám Đốc/CEO) của hệ thống Spa cao cấp Bella Spa.
Nhiệm vụ của bạn là nhận câu lệnh ngôn ngữ tự nhiên của Tổng Giám Đốc, kết hợp với bộ dữ liệu thô vừa truy xuất từ hệ thống ERP chi nhánh để viết báo cáo tóm tắt phân tích sâu sắc, chính xác số liệu và đề xuất các quyết định thực tế.

Thông tin ngữ cảnh:
- Câu lệnh của Tổng Giám Đốc: "${command}"
- Bộ trợ lý chuyên môn đang phân tích: ${routedTo === 'chro' ? 'CHRO (Trưởng phòng Nhân sự - Tiền lương)' : 'CFO (Trưởng phòng Tài chính - Kế toán)'}
- Kỳ báo cáo: ${formattedDate}
- Dữ liệu thô từ Hệ thống ERP chi nhánh:
${JSON.stringify(subAgentResponse?.data, null, 2)}

Yêu cầu định dạng phản hồi:
Bạn phải trả về DUY NHẤT một chuỗi JSON hợp lệ (không chứa mã markdown \`\`\`json hay bất kỳ chữ nào ngoài JSON) có cấu trúc chính xác như sau:
{
  "executiveSummary": "Đoạn văn tóm tắt điều hành (khoảng 3-4 câu) bằng tiếng Việt cực kỳ chuyên nghiệp gửi đến Tổng Giám Đốc. Hãy phân tích trực tiếp các con số thực tế trong dữ liệu thô (ví dụ: chỉ rõ nhân sự KTV nào vi phạm GPS hay đi muộn ca tắm bé, hoặc báo cáo tài chính lãi lỗ cụ thể bao nhiêu, chênh lệch quỹ tiền mặt của tài khoản nào kế toán cần chú ý). Xưng hô lịch sự 'Tổng Giám Đốc' hoặc 'CEO' và dùng từ ngữ của một COO thực thụ.",
  "anomaliesFound": [
    "Mô tả bất thường 1 phát hiện từ số liệu (ví dụ: 'KTV Nguyễn Văn A đi muộn 3 lần trong kỳ công')",
    "Mô tả bất thường 2 phát hiện từ số liệu..."
  ],
  "strategicRecommendations": [
    "Gợi ý chiến lược 1 (chuỗi ngắn gọn, thực tế và hành động được ngay)",
    "Gợi ý chiến lược 2 (chuỗi ngắn gọn, thực tế...)",
    "Gợi ý chiến lược 3 (chuỗi ngắn gọn, thực tế...)"
  ],
  "draftActions": [
    {
      "type": "${routedTo === 'chro' ? 'attendance_warning' : 'reconciliation_audit'}",
      "recipient": "Tên đối tượng nhận (tên KTV hoặc bộ phận Kế toán)",
      "reason": "Lý do chi tiết phát hiện lỗi hoặc chênh lệch cần xử lý",
      "draftMessage": "Nội dung tin nhắn dự thảo chi tiết để gửi cho đối tượng qua Telegram/Zalo. Cần viết lịch sự nhưng nghiêm túc, chứa số liệu vi phạm hoặc con số chênh lệch cụ thể."
    }
  ]
}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const resData = await response.json();
        const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          const parsed = JSON.parse(textResponse);
          if (parsed.executiveSummary) executiveSummary = parsed.executiveSummary;
          if (parsed.anomaliesFound) anomaliesFound = parsed.anomaliesFound;
          if (parsed.strategicRecommendations) strategicRecommendations = parsed.strategicRecommendations;
          if (parsed.draftActions) draftActions = parsed.draftActions;
          console.log("[AI COO Service] Gọi Gemini thành công và phân tích số liệu thành công!");
        }
      } else {
        const errPayload = await response.json().catch(() => ({}));
        console.error("[AI COO Service] Gọi Gemini API thất bại, HTTP status:", response.status);
        executiveSummary = `⚠️ Gọi Gemini API thất bại (HTTP Status: ${response.status}). Phản hồi lỗi: ${JSON.stringify(errPayload)}`;
      }
    } catch (geminiErr: any) {
      console.error("[AI COO Service] Lỗi xảy ra trong quá trình gọi hoặc parse dữ liệu Gemini:", geminiErr);
      executiveSummary = `⚠️ Lỗi hệ thống khi gọi Gemini: ${geminiErr.message || geminiErr}`;
    }
  }

  // Lập báo cáo chiến lược tích hợp AI thật
  return {
    status: "success",
    timestamp: new Date().toISOString(),
    sender: "AI COO Agent (Thư ký Tổng giám đốc)",
    recipient: `CEO ${user.full_name}`,
    period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    routedAgent: routedTo,
    analysis: {
      executiveSummary: executiveSummary,
      anomaliesFound: anomaliesFound,
      fullData: subAgentResponse?.data || []
    },
    draftActions: draftActions,
    strategicRecommendations: strategicRecommendations
  };
}
