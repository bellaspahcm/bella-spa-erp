import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runCOOOrchestrator } from "@/services/ai-coo-service";
import { canUseAiCopilotRole } from "@/lib/business-rules/permissions";

// Cấu trúc yêu cầu của CEO
interface COORequest {
  command: string;      // Nội dung câu lệnh ngôn ngữ tự nhiên từ CEO
  branchId?: string;    // Chi nhánh cụ thể (nếu có, không thì lấy tenant mặc định của user)
  monthYear?: string;   // Định dạng 'YYYY-MM-DD' hoặc 'YYYY-MM' để phân tích kỳ báo cáo
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" && message ? message : "Lỗi hệ thống.";
  }
  return "Lỗi hệ thống.";
}

export async function POST(request: NextRequest) {
  console.log("[AI COO Orchestrator] Nhận yêu cầu phân tích tại:", new Date().toISOString());

  try {
    // 1. Xác thực người dùng đang đăng nhập thông qua cookies (Đảm bảo RLS được kích hoạt tự động)
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[AI COO Orchestrator] Lỗi xác thực người dùng:", authError);
      return NextResponse.json({ error: "Yêu cầu đăng nhập để truy cập hệ thống AI." }, { status: 401 });
    }

    // 2. Tra cứu vai trò và tenant của người gọi để thực thi phân quyền bảo mật cấp cao (RBAC)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, role, tenant_id, full_name")
      .eq("id", authUser.id)
      .single();

    if (userError || !userData) {
      console.error("[AI COO Orchestrator] Không tìm thấy hồ sơ người dùng trong hệ thống:", userError);
      return NextResponse.json({ error: "Tài khoản của bạn không tồn tại trong hệ thống Bella ERP." }, { status: 403 });
    }

    if (!userData.tenant_id) {
      console.error("[AI COO Orchestrator] Không tìm thấy chi nhánh hoạt động của người dùng.");
      return NextResponse.json({ error: "Tài khoản của bạn không được gán cho một chi nhánh hợp lệ." }, { status: 403 });
    }

    // Chỉ cho phép admin hoặc accountant chi nhánh/HQ gọi bộ điều phối AI COO
    if (!canUseAiCopilotRole(userData.role)) {
      console.warn(`[AI COO Orchestrator] Người dùng ${userData.full_name} với vai trò ${userData.role} bị từ chối truy cập.`);
      return NextResponse.json({ error: "Quyền hạn không hợp lệ. Chỉ có Tổng giám đốc (Admin) và Kế toán trưởng mới có quyền điều phối AI COO." }, { status: 403 });
    }

    // 3. Đọc dữ liệu từ request body
    const body: COORequest = await request.json();
    const { command, monthYear } = body;

    if (!command || command.trim() === "") {
      return NextResponse.json({ error: "Vui lòng cung cấp câu lệnh phân tích cho AI." }, { status: 400 });
    }

    console.log(`[AI COO Orchestrator] CEO ${userData.full_name} gửi lệnh: "${command}"`);

    // 4. Gọi lõi điều phối Multi-Agent dịch vụ chuyên sâu
    const executiveReport = await runCOOOrchestrator(
      supabase,
      command,
      userData.tenant_id,
      {
        id: userData.id,
        full_name: userData.full_name || "Admin",
        role: userData.role
      },
      monthYear
    );

    return NextResponse.json(executiveReport);

  } catch (error: unknown) {
    console.error("[AI COO Orchestrator] Lỗi ngoại lệ nghiêm trọng:", error);
    // Trả về lỗi rõ ràng để hệ thống kiểm thử tự động nhận diện lập tức
    return NextResponse.json(
      { error: "Đã xảy ra lỗi nghiêm trọng trong quá trình xử lý của AI Orchestrator.", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
