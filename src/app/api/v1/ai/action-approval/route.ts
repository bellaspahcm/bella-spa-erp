import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";

type AppNotificationInsert = Database["public"]["Tables"]["app_notifications"]["Insert"];
type AIAgentLogInsert = Database["public"]["Tables"]["ai_agent_logs"]["Insert"];

interface ApprovalRequest {
  type: string;
  recipient: string;
  reason: string;
  draftMessage: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" && message ? message : "Lỗi hệ thống.";
  }
  return "Lỗi hệ thống.";
}

function appendRollbackError(message: string, rollbackError?: string) {
  return rollbackError ? `${message}; rollback failed: ${rollbackError}` : message;
}

export async function POST(request: NextRequest) {
  console.log("[AI Action Approval] Nhận yêu cầu duyệt hành động nháp...");

  try {
    // 1. Xác thực người dùng đang đăng nhập thông qua cookies
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[AI Action Approval] Lỗi xác thực người dùng:", authError);
      return NextResponse.json({ error: "Yêu cầu đăng nhập để truy cập tính năng phê duyệt." }, { status: 401 });
    }

    // 2. Tra cứu vai trò và tenant của người gọi (Chỉ Admin và Accountant được phê duyệt)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, role, tenant_id, full_name")
      .eq("id", authUser.id)
      .single();

    if (userError || !userData) {
      console.error("[AI Action Approval] Không tìm thấy hồ sơ người dùng:", userError);
      return NextResponse.json({ error: "Tài khoản của bạn không tồn tại trên hệ thống." }, { status: 403 });
    }

    if (!userData.tenant_id) {
      return NextResponse.json({ error: "Tài khoản của bạn không được liên kết với chi nhánh hợp lệ." }, { status: 403 });
    }

    if (!["admin", "super_admin", "accountant"].includes(userData.role)) {
      console.warn(`[AI Action Approval] Người dùng ${userData.full_name} với vai trò ${userData.role} cố gắng phê duyệt.`);
      return NextResponse.json({ error: "Quyền hạn không hợp lệ. Chỉ có Admin/Super Admin/Kế toán trưởng mới có quyền phê duyệt hành động của AI." }, { status: 403 });
    }

    // 3. Đọc dữ liệu từ request body
    const body: ApprovalRequest = await request.json();
    const { type, recipient, reason, draftMessage } = body;

    if (!type || !recipient || !reason || !draftMessage) {
      return NextResponse.json({ error: "Vui lòng cung cấp đầy đủ thông tin hành động nháp." }, { status: 400 });
    }

    console.log(`[AI Action Approval] CEO ${userData.full_name} phê duyệt hành động: "${type}" cho "${recipient}"`);

    // 4. Tạo thông báo hệ thống chính thức (Side-effect 1)
    const notificationPayload: AppNotificationInsert = {
      tenant_id: userData.tenant_id,
      type: type,
      title: `Phê duyệt từ CEO: Giải trình ${type === "attendance_warning" ? "chấm công KTV" : "đối soát quỹ"}`,
      message: draftMessage,
      data: {
        recipient: recipient,
        reason: reason,
        approved_by: userData.full_name
      },
      is_read: false
    };

    const { data: notif, error: notifError } = await supabase
      .from("app_notifications")
      .insert(notificationPayload)
      .select("id")
      .single();

    if (notifError) {
      console.error("[AI Action Approval] Lỗi khi tạo thông báo hệ thống:", notifError);
      throw notifError; // Zero Silent DB Failures
    }

    // 5. Ghi nhật ký audit logs (Side-effect 2)
    const logPayload: AIAgentLogInsert = {
      tenant_id: userData.tenant_id,
      user_id: userData.id,
      sender: "ceo",
      message: `CEO ${userData.full_name} chính thức phê duyệt hành động nháp "${type}" cho "${recipient}". Lý do: ${reason}`,
      metadata: {
        action_type: type,
        recipient: recipient,
        notification_id: notif.id,
        reason: reason
      }
    };

    const { error: logError } = await supabase
      .from("ai_agent_logs")
      .insert(logPayload);

    if (logError) {
      console.error("[AI Action Approval] Lỗi khi ghi audit log:", logError);
      const { error: rollbackError } = await supabase
        .from("app_notifications")
        .delete()
        .eq("id", notif.id)
        .eq("tenant_id", userData.tenant_id);

      throw new Error(appendRollbackError(logError.message, rollbackError?.message));
    }

    return NextResponse.json({
      success: true,
      message: "Hành động đã được phê duyệt và gửi đi thành công.",
      notificationId: notif.id
    });

  } catch (error: unknown) {
    console.error("[AI Action Approval] Lỗi ngoại lệ nghiêm trọng:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi nghiêm trọng khi xử lý phê duyệt hành động.", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
