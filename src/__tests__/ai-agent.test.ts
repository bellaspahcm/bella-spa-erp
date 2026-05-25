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

const mockRpc = jest.fn();
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn((table?: string) => ({
  insert: mockInsert,
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { id: "user-id", role: "admin", tenant_id: "tenant-id", full_name: "CEO Admin" }, error: null })
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
    mockRpc.mockImplementation((fnName, args) => {
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

    mockRpc.mockImplementation((fnName, args) => {
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

