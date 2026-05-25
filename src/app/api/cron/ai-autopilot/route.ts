import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Daily Autopilot Audit Cron (22:00 Hằng ngày)
 * Quét lỗi GPS KTV trong ngày và lệch quỹ kế toán, chủ động gửi cảnh báo trực tiếp về Telegram CEO.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[AI Autopilot Cron] CRON_SECRET env var not set.");
    return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    console.warn("[AI Autopilot Cron] Unauthorized trigger attempt.");
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  console.log("[AI Autopilot Cron] Bắt đầu quét vận hành tự động hàng ngày...");

  try {
    const supabase = getAdminClient();

    // 1. Quét danh sách các tenant active
    const { data: tenants, error: tenantsErr } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("status", "active");

    if (tenantsErr) {
      throw new Error(`Failed to fetch tenants: ${tenantsErr.message}`);
    }

    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0];

    let tenantsChecked = 0;
    let alertsSent = 0;

    for (const tenant of tenants || []) {
      try {
        // 2. Tra cứu cấu hình AI Telegram của tenant
        const { data: config, error: configErr } = await supabase
          .from("ai_agent_configs")
          .select("telegram_bot_token, telegram_chat_id, is_active")
          .eq("tenant_id", tenant.id)
          .eq("is_active", true)
          .maybeSingle();

        if (configErr || !config || !config.telegram_bot_token || !config.telegram_chat_id) {
          continue; // Bỏ qua nếu tenant không cấu hình Telegram
        }

        tenantsChecked++;

        // 3. Thiết lập tenant context cho session
        await supabase.rpc("set_session_tenant", { p_tenant_id: tenant.id });

        // 4. CHRO: Quét bất thường GPS và đi trễ trong tháng hiện tại (tính đến ngày hôm nay)
        const { data: attendanceKpis, error: attErr } = await supabase.rpc("get_ai_attendance_kpis", {
          p_month_year: formattedDate
        });

        // 5. CFO: Đối soát chênh lệch sổ cái vs sổ quỹ trong ngày hôm nay
        const { data: reconReport, error: reconErr } = await supabase.rpc("get_reconciliation_report", {
          p_tenant_id: tenant.id,
          p_from_date: formattedDate,
          p_to_date: formattedDate
        });

        // Phân tích dữ liệu bất thường
        const gpsAnomalies = (attendanceKpis || []).filter((item: any) => Number(item.gps_anomaly_count || 0) > 0);
        const lateAnomalies = (attendanceKpis || []).filter((item: any) => Number(item.late_count || 0) > 2);
        const majorReconDiffs = (reconReport || []).filter((row: any) => row.status === "MAJOR_DIFF");

        // 6. Nếu phát hiện bất thường, gửi thông báo khẩn qua Telegram
        if (gpsAnomalies.length > 0 || lateAnomalies.length > 0 || majorReconDiffs.length > 0) {
          let alertText = `🚨 *[CẢNH BÁO AUTOPILOT HÀNG NGÀY]* 🚨\n`;
          alertText += `Chi nhánh: *${tenant.name}*\n`;
          alertText += `Ngày kiểm toán: *${formattedDate}*\n\n`;

          if (gpsAnomalies.length > 0) {
            alertText += `*⚠️ Bất thường Check-in GPS KTV:* \n`;
            gpsAnomalies.forEach((a: any) => {
              alertText += `- *${a.ktv_name}*: Có *${a.gps_anomaly_count} ca* định vị lệch vị trí nhà khách hàng.\n`;
            });
            alertText += `\n`;
          }

          if (lateAnomalies.length > 0) {
            alertText += `*⚠️ Vi phạm đi trễ nhiều ca:* \n`;
            lateAnomalies.forEach((a: any) => {
              alertText += `- *${a.ktv_name}*: Đi muộn *${a.late_count} ca* tính đến hôm nay.\n`;
            });
            alertText += `\n`;
          }

          if (majorReconDiffs.length > 0) {
            alertText += `*🔥 LỆCH QUỸ KẾ TOÁN LỚN (> 1%):* \n`;
            majorReconDiffs.forEach((row: any) => {
              alertText += `- *${row.category_label}*: Sổ quỹ ${row.legacy_amount.toLocaleString("vi-VN")}đ | Sổ cái ${row.ledger_amount.toLocaleString("vi-VN")}đ (Chênh lệch: *${row.diff_amount.toLocaleString("vi-VN")}đ* - *${row.diff_percent}%*)\n`;
            });
            alertText += `\n`;
          }

          alertText += `*💡 Đề xuất hành động:* \n`;
          alertText += `1. Bộ phận nhân sự chấn chỉnh ngay các KTV vi phạm GPS check-in.\n`;
          alertText += `2. Kế toán trưởng đối chiếu trực tiếp các hóa đơn doanh thu/chi phí bị lệch.\n`;
          alertText += `3. Truy cập Bella ERP Dashboard để ký duyệt các bản nháp giải trình do AI chuẩn bị.`;

          // Gửi tin nhắn — H4 FIX: decrypt bot token
          const botToken = decrypt(config.telegram_bot_token);
          const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
          const teleResponse = await fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: config.telegram_chat_id,
              text: alertText,
              parse_mode: "Markdown"
            })
          });

          if (!teleResponse.ok) {
            const errText = await teleResponse.text();
            console.error(`[AI Autopilot Cron] Lỗi gửi Telegram cho tenant ${tenant.name}:`, errText);
          } else {
            alertsSent++;
          }
        }

      } catch (innerErr: any) {
        console.error(`[AI Autopilot Cron] Lỗi xử lý tenant ${tenant.name}:`, innerErr?.message);
      }
    }

    const summary = {
      success: true,
      date: formattedDate,
      tenants_checked: tenantsChecked,
      alerts_sent: alertsSent
    };

    console.log("[AI Autopilot Cron] Hoàn thành:", JSON.stringify(summary));
    return NextResponse.json(summary);

  } catch (globalErr: any) {
    console.error("[AI Autopilot Cron] Lỗi nghiêm trọng toàn cục:", globalErr);
    return NextResponse.json(
      { success: false, error: globalErr?.message || "Autopilot cron failed." },
      { status: 500 }
    );
  }
}
