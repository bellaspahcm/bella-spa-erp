/**
 * Bella AI ERP System Integration & Security Tests
 * 
 * Verifies:
 *   1. Role-Based Access Control (RBAC): restricts to Admin & Accountant only.
 *   2. COO Agent Intelligent Intent Routing: Chro vs Cfo.
 *   3. Safe RPC call integration (calculate_ktv_salary_sheet, get_reconciliation_report, get_trial_balance).
 *   4. Zero Silent DB Failures: DB RPC errors propagate immediately.
 *   5. Mandatory Side-Effect Assertions: Every session creates logs inside ai_agent_logs table.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }), { virtual: true });
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }), { virtual: true });

// Mock global fetch for Gemini API calls
global.fetch = jest.fn().mockImplementation((url, options) => {
  let executiveSummary = "Báo cáo tóm tắt phân tích chung.";
  let anomaliesFound: any[] = [];
  let strategicRecommendations = ["Khuyến nghị chung"];
  let draftActions: any[] = [];

  try {
    if (options && options.body) {
      const body = JSON.parse(options.body);
      const promptText = body.contents?.[0]?.parts?.[0]?.text || "";
      
      if (promptText.includes("CHRO") || promptText.includes("Nhân sự") || promptText.includes("lương")) {
        executiveSummary = "Đã hoàn tất phân tích 1 hồ sơ KTV của chi nhánh. Phát hiện 1 trường hợp cần lưu ý kỷ luật lao động hoặc có khấu trừ vi phạm lớn.";
        anomaliesFound = [{ name: "KTV Hoa", gpsAnomaly: 3, totalSalary: 8250000 }];
        strategicRecommendations = ["Ban hành quy chế thắt chặt bán kính nhận ca tắm bé (< 5km) cho KTV chi nhánh để tối ưu chi phí di chuyển."];
        draftActions = [
          {
            type: "attendance_warning",
            recipient: "KTV Hoa",
            reason: "Bị phạt vi phạm",
            draftMessage: "Cảnh báo"
          }
        ];
      } else if (promptText.includes("CFO") || promptText.includes("tài chính") || promptText.includes("kế toán")) {
        executiveSummary = "Báo cáo tóm tắt: Bảng cân đối tài khoản phát sinh hoạt động bình thường.";
        anomaliesFound = [];
        strategicRecommendations = ["Định kỳ chạy đối soát quỹ đối chiếu với báo cáo doanh thu để kiểm tra sai lệch quỹ kế toán"];
        draftActions = [];
      }
    }
  } catch (e) {
    console.error("Error parsing mock fetch body", e);
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  executiveSummary,
                  anomaliesFound,
                  strategicRecommendations,
                  draftActions
                })
              }
            ]
          }
        }
      ]
    })
  });
}) as any;

const mockRpc = jest.fn();
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn(() => ({
  insert: mockInsert,
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { id: "user-id", role: "admin", tenant_id: "tenant-id", full_name: "CEO Admin" }, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: { gemini_api_key: "TEST-GEMINI-KEY-123" }, error: null })
}) as any);

jest.mock("../lib/supabase-server", () => ({
  createClient: jest.fn(() => Promise.resolve({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "auth-user-id" } }, error: null })
    },
    from: mockFrom,
    rpc: mockRpc
  } as any))
}));

import { POST } from "../app/api/v1/ai/coo-orchestrator/route";
import { POST as approvePOST } from "../app/api/v1/ai/action-approval/route";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-uuid-123";
const ADMIN_USER = { id: "user-admin", tenant_id: TENANT_ID, role: "admin", full_name: "Boss CEO" };
const ACCOUNTANT_USER = { id: "user-acct", tenant_id: TENANT_ID, role: "accountant", full_name: "Chief Accountant" };
const KTV_USER = { id: "user-ktv", tenant_id: TENANT_ID, role: "ktv", full_name: "Staff KTV" };

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockReset();
  mockInsert.mockReset();
  mockInsert.mockResolvedValue({ error: null });
});

describe("AI COO Orchestrator Security & RBAC Guard", () => {
  it("allows admin user to call orchestrator", async () => {
    // Mock user profile
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    // Mock RPC calls for general analysis
    mockRpc.mockResolvedValue({ data: [], error: null });

    const req = new NextRequest("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      body: JSON.stringify({ command: "Kiểm tra vận hành chung" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sender).toContain("AI COO Agent");
  });

  it("allows accountant user to call orchestrator", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ACCOUNTANT_USER, error: null }),
      insert: mockInsert
    } as any));

    mockRpc.mockResolvedValue({ data: [], error: null });

    const req = new NextRequest("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      body: JSON.stringify({ command: "Kiểm tra vận hành chung" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("blocks and rejects KTV user (non-admin)", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: KTV_USER, error: null }),
      insert: mockInsert
    } as any));

    const req = new NextRequest("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      body: JSON.stringify({ command: "Kiểm tra lương của tôi" })
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Quyền hạn không hợp lệ");
  });
});

describe("AI COO Orchestrator Routing & RPC execution", () => {
  it("routes human-resource command to CHRO agent and calls salary and attendance RPCs", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    // Mock RPC responses
    mockRpc.mockImplementation((fnName) => {
      if (fnName === "get_ai_attendance_kpis") {
        return Promise.resolve({
          data: [
            { ktv_id: "ktv-1", ktv_name: "KTV Hoa", total_shifts: 20, present_count: 19, late_count: 1, absent_count: 0, gps_anomaly_count: 3 }
          ],
          error: null
        });
      }
      if (fnName === "calculate_ktv_salary_sheet") {
        return Promise.resolve({
          data: [
            { ktv_id: "ktv-1", ktv_name: "KTV Hoa", base_salary: 5000000, session_bonus: 2000000, rating_bonus: 500000, kpi_bonus: 1000000, deductions: 250000, advances: 0, total_salary: 8250000, total_sessions: 20, status: "draft" }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new NextRequest("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      body: JSON.stringify({ command: "Phân tích chấm công và tính lương KTV tháng này" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.routedAgent).toBe("chro");
    expect(body.analysis.executiveSummary).toContain("phân tích 1 hồ sơ KTV");
    expect(body.analysis.anomaliesFound).toHaveLength(1);
    expect(body.analysis.anomaliesFound[0].name).toBe("KTV Hoa");
    expect(body.analysis.anomaliesFound[0].gpsAnomaly).toBe(3);
    expect(body.analysis.anomaliesFound[0].totalSalary).toBe(8250000);

    // Verify side-effect: ai_agent_logs must be created (Rule 2)
    expect(mockFrom).toHaveBeenCalledWith("ai_agent_logs");
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: TENANT_ID,
      sender: "coo",
      user_id: ADMIN_USER.id
    }));
  });

  it("routes accounting command to CFO agent and calls trial balance RPC", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    mockRpc.mockImplementation((fnName) => {
      if (fnName === "get_trial_balance") {
        return Promise.resolve({
          data: [
            { account_code: "111", account_name: "Tiền mặt", debit_balance: 10000000, credit_balance: 0 }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new NextRequest("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      body: JSON.stringify({ command: "Xuất bảng cân đối phát sinh" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.routedAgent).toBe("cfo");
    expect(body.analysis.executiveSummary).toContain("Bảng cân đối tài khoản phát sinh");
  });

  it("preserves CFO reconciliation proposal when Gemini returns empty draftActions", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    mockRpc.mockImplementation((fnName) => {
      if (fnName === "get_reconciliation_report") {
        return Promise.resolve({
          data: [
            { status: "MAJOR_DIFF", reference_id: "cash-1", difference_amount: 250000 }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new NextRequest("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      body: JSON.stringify({ command: "Đối soát sổ cái và sổ quỹ" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.routedAgent).toBe("cfo");
    expect(body.draftActions).toEqual([
      expect.objectContaining({
        type: "reconciliation_audit",
      })
    ]);
  });

  it("keeps sub-agent data when Gemini enrichment fails", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    mockRpc.mockImplementation((fnName) => {
      if (fnName === "get_trial_balance") {
        return Promise.resolve({
          data: [
            { account_code: "111", account_name: "Tiền mặt", debit_balance: 10000000, credit_balance: 0 }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({ error: "Gemini unavailable" }),
    });

    const req = new NextRequest("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      body: JSON.stringify({ command: "Xuất bảng cân đối phát sinh" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.analysis.executiveSummary).toContain("HTTP Status: 503");
    expect(body.analysis.fullData).toEqual([
      expect.objectContaining({
        account_code: "111",
        debit_balance: 10000000,
      })
    ]);
  });
});

describe("AI COO Orchestrator Error propagation (Zero Silent DB Failures)", () => {
  it("propagates database RPC error immediately without swallowing it", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    // Mock RPC error
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Database connection timeout in get_ai_attendance_kpis" }
    });

    const req = new NextRequest("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      body: JSON.stringify({ command: "Kiểm tra chấm công KTV" })
    });

    const res = await POST(req);
    expect(res.status).toBe(500); // Server error, not 200
    const body = await res.json();
    expect(body.error).toContain("lỗi nghiêm trọng");
    expect(body.details).toContain("Database connection timeout");
  });

  it("returns 500 when required ai_agent_logs insert fails", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    mockRpc.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValueOnce({ error: { message: "ai log insert failed" } });

    const req = new NextRequest("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      body: JSON.stringify({ command: "Kiểm tra vận hành chung" })
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.details).toContain("ai log insert failed");
  });
});

describe("AI Action Approval Security & Side-Effects", () => {
  it("restricts action approval to admin & accountant only", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: KTV_USER, error: null }),
      insert: mockInsert
    } as any));

    const req = new NextRequest("http://localhost/api/v1/ai/action-approval", {
      method: "POST",
      body: JSON.stringify({
        type: "attendance_warning",
        recipient: "KTV Hoa",
        reason: "GPS Lệch",
        draftMessage: "Nhắc nhở"
      })
    });

    const res = await approvePOST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Quyền hạn không hợp lệ");
  });

  it("rejects invalid approval payload without notification or audit side effects", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    const req = new NextRequest("http://localhost/api/v1/ai/action-approval", {
      method: "POST",
      body: JSON.stringify({
        type: "attendance_warning",
        recipient: "KTV Hoa",
        draftMessage: "Cảnh báo vi phạm GPS"
      })
    });

    const res = await approvePOST(req);
    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalledWith("app_notifications");
    expect(mockFrom).not.toHaveBeenCalledWith("ai_agent_logs");
  });

  it("returns 500 when approval notification creation fails", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    const notificationInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "notification insert failed" }
        })
      })
    });

    mockFrom.mockImplementation((table?: string) => {
      if (table === "app_notifications") {
        return { insert: notificationInsert } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
        insert: mockInsert
      } as any;
    });

    const req = new NextRequest("http://localhost/api/v1/ai/action-approval", {
      method: "POST",
      body: JSON.stringify({
        type: "attendance_warning",
        recipient: "KTV Hoa",
        reason: "GPS Lệch",
        draftMessage: "Cảnh báo vi phạm GPS"
      })
    });

    const res = await approvePOST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.details).toContain("notification insert failed");
    expect(mockFrom).not.toHaveBeenCalledWith("ai_agent_logs");
  });

  it("rolls back the notification when approval audit log insert fails", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    const notificationInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "notif-uuid" }, error: null })
      })
    });
    const notificationDelete = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      then: (onfulfilled: any) => Promise.resolve({ error: null }).then(onfulfilled)
    });
    const auditInsert = jest.fn().mockResolvedValue({ error: { message: "audit insert failed" } });

    mockFrom.mockImplementation((table?: string) => {
      if (table === "app_notifications") {
        return {
          insert: notificationInsert,
          delete: notificationDelete,
        } as any;
      }
      if (table === "ai_agent_logs") {
        return { insert: auditInsert } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      } as any;
    });

    const req = new NextRequest("http://localhost/api/v1/ai/action-approval", {
      method: "POST",
      body: JSON.stringify({
        type: "attendance_warning",
        recipient: "KTV Hoa",
        reason: "GPS Lệch",
        draftMessage: "Cảnh báo vi phạm GPS"
      })
    });

    const res = await approvePOST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.details).toContain("audit insert failed");
    expect(notificationDelete).toHaveBeenCalled();
  });

  it("reports rollback failure when approval audit log insert and notification delete both fail", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    const notificationInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "notif-uuid" }, error: null })
      })
    });
    const notificationDelete = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      then: (onfulfilled: any) => Promise.resolve({ error: { message: "notification rollback failed" } }).then(onfulfilled)
    });
    const auditInsert = jest.fn().mockResolvedValue({ error: { message: "audit insert failed" } });

    mockFrom.mockImplementation((table?: string) => {
      if (table === "app_notifications") {
        return {
          insert: notificationInsert,
          delete: notificationDelete,
        } as any;
      }
      if (table === "ai_agent_logs") {
        return { insert: auditInsert } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      } as any;
    });

    const req = new NextRequest("http://localhost/api/v1/ai/action-approval", {
      method: "POST",
      body: JSON.stringify({
        type: "attendance_warning",
        recipient: "KTV Hoa",
        reason: "GPS Lệch",
        draftMessage: "Cảnh báo vi phạm GPS"
      })
    });

    const res = await approvePOST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.details).toContain("audit insert failed");
    expect(body.details).toContain("notification rollback failed");
  });

  it("inserts system notification and writes audit log upon approval", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null }),
      insert: mockInsert
    } as any));

    // Mock successful insert for app_notifications and ai_agent_logs
    mockFrom.mockImplementation((table?: string) => {
      if (table === "app_notifications") {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: "notif-uuid" }, error: null })
        } as any;
      }
      if (table === "ai_agent_logs") {
        return {
          insert: jest.fn().mockResolvedValue({ error: null })
        } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null })
      } as any;
    });

    const req = new NextRequest("http://localhost/api/v1/ai/action-approval", {
      method: "POST",
      body: JSON.stringify({
        type: "attendance_warning",
        recipient: "KTV Hoa",
        reason: "GPS Lệch",
        draftMessage: "Cảnh báo vi phạm GPS"
      })
    });

    const res = await approvePOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.notificationId).toBe("notif-uuid");
  });
});
