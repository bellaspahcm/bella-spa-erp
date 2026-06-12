import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { runCOOOrchestrator } from "@/services/ai-coo-service";
import { decrypt } from "@/lib/crypto";
import { timingSafeEqual } from "crypto";
import { requireSupabaseAdminEnv } from "@/lib/supabase-admin-env";

export const dynamic = "force-dynamic";

interface TelegramWebhookPayload {
  message?: {
    text?: unknown;
    chat?: {
      id?: unknown;
    } | null;
  } | null;
}

interface AnomalySummary {
  name: string;
  gpsAnomaly: number;
  late: number;
  deductions: number;
}

function getAdminClient() {
  const { url, adminKey } = requireSupabaseAdminEnv();
  return createClient<Database>(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lỗi hệ thống trong Telegram webhook.";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeAnomaly(value: unknown): AnomalySummary | string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "Bất thường chưa xác định";

  const anomaly = value as Record<string, unknown>;
  return {
    name: typeof anomaly.name === "string" ? anomaly.name : "Bất thường chưa xác định",
    gpsAnomaly: readNumber(anomaly.gpsAnomaly),
    late: readNumber(anomaly.late),
    deductions: readNumber(anomaly.deductions),
  };
}

function formatAnomalyLine(value: unknown, idx: number) {
  const anomaly = normalizeAnomaly(value);
  if (typeof anomaly === "string") {
    return `${idx + 1}. ${anomaly}\n`;
  }

  return `${idx + 1}. *${anomaly.name}*: ${anomaly.gpsAnomaly > 0 ? `Lệch GPS ${anomaly.gpsAnomaly} ca.` : ''} ${anomaly.late > 0 ? `Đi muộn ${anomaly.late} ca.` : ''} ${anomaly.deductions > 0 ? `Khấu trừ ${anomaly.deductions.toLocaleString('vi-VN')}đ.` : ''}\n`;
}

/**
 * API Telegram Webhook
 * Tiếp nhận tin nhắn `/coo <lệnh>` từ CEO qua Group Telegram, phân tích và phản hồi lập tức.
 */
export async function POST(request: NextRequest) {
  console.log("[Telegram Webhook] Nhận update từ Telegram...");

  try {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get("authorization");
      const headerSecret = request.headers.get("x-telegram-webhook-secret");
      const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
      const providedSecret = headerSecret || bearerSecret;

      if (!secureCompare(webhookSecret, providedSecret || "")) {
        console.warn("[Telegram Webhook] Unauthorized request.");
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const payload = (await request.json()) as TelegramWebhookPayload;
    const message = payload?.message;

    if (!message || !message.text || !message.chat) {
      // Trả về 200 ok để Telegram không gửi lại cập nhật lỗi
      return NextResponse.json({ ok: true, status: "ignored" });
    }

    const chatId = String(message.chat.id);
    const text = String(message.text).trim();

    // Chỉ xử lý các câu lệnh bắt đầu bằng /coo
    if (!text.toLowerCase().startsWith("/coo")) {
      return NextResponse.json({ ok: true, status: "ignored_no_prefix" });
    }

    const cleanCommand = text.replace(/^\/coo\s*/i, "").trim();
    if (!cleanCommand) {
      return NextResponse.json({ ok: true, status: "ignored_empty_command" });
    }

    console.log(`[Telegram Webhook] Nhận câu lệnh: "${cleanCommand}" từ Chat ID: ${chatId}`);

    const supabase = getAdminClient();

    // 1. Kiểm tra cấu hình AI của chi nhánh theo telegram_chat_id
    const { data: config, error: configError } = await supabase
      .from("ai_agent_configs")
      .select("tenant_id, telegram_bot_token, telegram_chat_id, is_active")
      .eq("telegram_chat_id", chatId)
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !config) {
      console.warn('[Telegram Webhook] Không tìm thấy cấu hình AI hoạt động cho Chat ID %s', chatId, configError);
      return NextResponse.json({ ok: true, status: "no_active_config" });
    }

    // 2. Thiết lập tenant context cho session (Tránh lỗi RLS và đảm bảo phân lập dữ liệu)
    const { error: tenantSetError } = await supabase.rpc("set_session_tenant", {
      p_tenant_id: config.tenant_id
    });

    if (tenantSetError) {
      console.error("[Telegram Webhook] Không thể thiết lập tenant context:", tenantSetError);
      throw tenantSetError; // Zero Silent DB Failures
    }

    // 3. Tra cứu admin/accountant user đại diện của chi nhánh để làm ngữ cảnh
    // ⚠️ H3 FIX: Reject sớm nếu không có admin (tránh fake UUID violate FK constraint)
    const { data: userRep, error: userRepErr } = await supabase
      .from("users")
      .select("id, full_name, role")
      .eq("tenant_id", config.tenant_id)
      .in("role", ["admin", "super_admin", "accountant"])
      .limit(1)
      .maybeSingle();

    if (userRepErr || !userRep) {
      console.warn(`[Telegram Webhook] Chi nhánh ${config.tenant_id} không có admin/accountant nào để xử lý.`);
      return NextResponse.json({
        ok: false,
        status: "no_admin_user",
        message: "Chi nhánh chưa có admin/kế toán để xử lý lệnh AI. Vui lòng tạo tài khoản admin trước."
      });
    }

    const executorUser = userRep;

    // 4. Chạy logic lõi AI COO Orchestrator
    const result = await runCOOOrchestrator(
      supabase,
      cleanCommand,
      config.tenant_id,
      {
        id: executorUser.id,
        full_name: executorUser.full_name || "Telegram User",
        role: executorUser.role
      }
    );

    // 5. Định dạng tin nhắn phản hồi dạng Markdown đẹp đẽ
    const emojiHeader = result.routedAgent === "chro" ? "👥 [CHRO Agent - Nhân sự & Lương]" : "💰 [CFO Agent - Tài chính & Kế toán]";
    let replyText = `*${result.sender}*\n`;
    replyText += `Kính gửi: *${result.recipient}*\n`;
    replyText += `Kỳ báo cáo: *${result.period}*\n`;
    replyText += `Phòng ban xử lý: *${emojiHeader}*\n\n`;
    
    replyText += `*📊 Tóm tắt Phân tích:*\n${result.analysis.executiveSummary}\n\n`;

    if (result.analysis.anomaliesFound && result.analysis.anomaliesFound.length > 0) {
      replyText += `*⚠️ Phát hiện Bất thường:* \n`;
      result.analysis.anomaliesFound.forEach((anomaly, idx) => {
        replyText += formatAnomalyLine(anomaly, idx);
      });
      replyText += `\n`;
    }

    if (result.strategicRecommendations && result.strategicRecommendations.length > 0) {
      replyText += `*💡 Đề xuất Cải tiến:* \n`;
      result.strategicRecommendations.forEach((r: string) => {
        replyText += `${r}\n`;
      });
    }

    if (result.draftActions && result.draftActions.length > 0) {
      replyText += `\n*📝 Dự thảo Hành động Mức A (Human-in-the-loop):*\n`;
      replyText += `Hệ thống đã lập sẵn ${result.draftActions.length} thông báo nhắc nhở/giải trình trên Dashboard Bella ERP. Vui lòng đăng nhập hệ thống để duyệt gửi đi.`;
    }

    // 6. Gửi trả tin nhắn về Telegram Group thông qua Telegram Bot API
    // ⚠️ H4 FIX: Decrypt bot token (lưu encrypted bằng AES-256-GCM trong DB)
    if (config.telegram_bot_token) {
      const botToken = decrypt(config.telegram_bot_token);
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const teleResponse = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          parse_mode: "Markdown"
        })
      });

      if (!teleResponse.ok) {
        const errorText = await teleResponse.text();
        console.error(`[Telegram Webhook] Lỗi khi gửi tin nhắn Telegram Bot API:`, errorText);
      } else {
        console.log(`[Telegram Webhook] Đã gửi báo cáo phản hồi thành công qua Telegram.`);
      }
    }

    return NextResponse.json({ ok: true, status: "success" });

  } catch (err: unknown) {
    console.error("[Telegram Webhook] Ngoại lệ nghiêm trọng:", err);
    // Trả về 200 ok nhưng báo lỗi để tránh Telegram retry liên tục làm treo webhook
    return NextResponse.json({ ok: false, error: getErrorMessage(err) }, { status: 200 });
  }
}
