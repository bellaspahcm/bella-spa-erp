/**
 * Bella AI ERP CPO, CMO, and Franchise Agents Unit & Security Tests
 * 
 * Verifies:
 *   1. CPO (Warehouse/Inventory) Agent Routing, DB queries, and Gemini analysis.
 *   2. CMO (Customer/Marketing) Agent Routing, DB queries, and Gemini analysis.
 *   3. Franchise (Franchise Operations) Agent Routing, DB queries, and Gemini analysis.
 *   4. Zero Silent DB Failures: DB query errors propagate immediately.
 *   5. Mandatory Side-Effect Assertions: Every session writes logs inside the ai_agent_logs table.
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
      
      if (promptText.includes("CPO (Trưởng phòng Kho vận")) {
        executiveSummary = "Phân tích kho vận: Phát hiện 1 mặt hàng đang dưới mức tối thiểu cần nhập kho khẩn cấp.";
        anomaliesFound = ["Mặt hàng Dầu Massage Oliu (SKU: OIL-001) chỉ còn tồn 2 chai"];
        strategicRecommendations = ["Thiết lập hạn mức nhập hàng thông minh (Min-Max)"];
        draftActions = [
          {
            type: "inventory_restock",
            recipient: "Bộ phận Mua sắm / Kho vận",
            reason: "Mặt hàng Dầu Massage Oliu chạm ngưỡng tồn tối thiểu",
            draftMessage: "Cảnh báo nhập kho"
          }
        ];
      } else if (promptText.includes("CMO (Trưởng phòng Chăm sóc khách hàng")) {
        executiveSummary = "Phân tích CSKH: CSAT trung bình đạt 4.0/5 sao. Có 1 phản hồi tiêu cực cần xin lỗi khách hàng.";
        anomaliesFound = ["Khách hàng Nguyễn Thị Lan đánh giá KTV Hoa 3 sao"];
        strategicRecommendations = ["Liên hệ ngay lập tức với khách hàng để xin lỗi"];
        draftActions = [
          {
            type: "customer_apology",
            recipient: "Nguyễn Thị Lan",
            reason: "Đánh giá 3 sao",
            draftMessage: "Thư xin lỗi"
          }
        ];
      } else if (promptText.includes("Franchise (Ban vận hành Nhượng quyền")) {
        executiveSummary = "Phân tích Nhượng quyền: Chi nhánh Bella Spa Hà Nội có 1 hóa đơn nhượng quyền chưa thanh toán.";
        anomaliesFound = ["Hóa đơn nhượng quyền INV-FR-001 đang ở trạng thái pending"];
        strategicRecommendations = ["Gửi nhắc nhở thanh toán hóa đơn nhượng quyền"];
        draftActions = [
          {
            type: "royalty_payment_reminder",
            recipient: "Bella Spa Hà Nội",
            reason: "Chưa thanh toán INV-FR-001",
            draftMessage: "Nhắc nhở nợ phí"
          }
        ];
      }
    }
  } catch (e) {
    console.error("Error parsing mock fetch body in tests", e);
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

const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn();

jest.mock("../lib/supabase-server", () => ({
  createClient: jest.fn(() => Promise.resolve({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "auth-user-id" } }, error: null })
    },
    from: mockFrom,
    rpc: jest.fn().mockResolvedValue({ data: [], error: null })
  } as any))
}));

import { POST } from "../app/api/v1/ai/coo-orchestrator/route";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-uuid-123";
const ADMIN_USER = { id: "user-admin", tenant_id: TENANT_ID, role: "admin", full_name: "Boss CEO" };

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockReset();
  mockInsert.mockResolvedValue({ error: null });
  mockFrom.mockReset();
});

describe("AI CPO Sub-Agent (Warehouse & Inventory)", () => {
  it("routes to CPO agent, queries items and logs, and returns stock analysis", async () => {
    // Setup Mock Database Responses
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null })
        } as any;
      }
      if (table === "tenants") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { 
              id: TENANT_ID, 
              name: "Test Tenant", 
              status: "active",
              module_id: "spa",
              subscription_tier: "premium"
            }, 
            error: null 
          })
        } as any;
      }
      if (table === "ai_agent_configs") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { gemini_api_key: "TEST-GEMINI-KEY-123" }, error: null })
        } as any;
      }
      if (table === "inventory_items") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              { id: "item-1", name: "Dầu Massage Oliu", sku: "OIL-001", unit: "chai", stock_level: 2, min_stock_level: 10, tenant_id: TENANT_ID }
            ],
            error: null
          })
        } as any;
      }
      if (table === "inventory_logs") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              { id: "log-1", change_amount: -1, reason: "session_consumption", created_at: new Date().toISOString(), item_id: "item-1" }
            ],
            error: null
          })
        } as any;
      }
      if (table === "ai_agent_logs") {
        return {
          insert: mockInsert
        } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any;
    });

    const req = new Request("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "Báo cáo tồn kho vật tư và dầu massage" })
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.routedAgent).toBe("cpo");
    expect(body.analysis.executiveSummary).toContain("Phân tích kho vận");
    expect(body.analysis.anomaliesFound).toHaveLength(1);
    expect(body.analysis.anomaliesFound[0]).toContain("OIL-001");
    expect(body.draftActions).toHaveLength(1);
    expect(body.draftActions[0].type).toBe("inventory_restock");

    // Verify side-effect: log was inserted into ai_agent_logs (Rule 2)
    expect(mockFrom).toHaveBeenCalledWith("ai_agent_logs");
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: TENANT_ID,
      sender: "coo",
      user_id: ADMIN_USER.id
    }));
  });

  it("propagates CPO DB failures immediately (Zero Silent DB Failures)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null })
        } as any;
      }
      if (table === "tenants") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { 
              id: TENANT_ID, 
              name: "Test Tenant", 
              status: "active",
              module_id: "spa",
              subscription_tier: "premium"
            }, 
            error: null 
          })
        } as any;
      }
      if (table === "inventory_items") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Database connection timeout when accessing inventory" }
          })
        } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any;
    });

    const req = new Request("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "Xem báo cáo vật tư tồn kho" })
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("lỗi nghiêm trọng");
    expect(body.details).toContain("Database connection timeout when accessing inventory");
  });
});

describe("AI CMO Sub-Agent (Customer & Marketing)", () => {
  it("routes to CMO agent, queries reviews, CSAT, bookings and drafts apologies", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null })
        } as any;
      }
      if (table === "tenants") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { 
              id: TENANT_ID, 
              name: "Test Tenant", 
              status: "active",
              module_id: "spa",
              subscription_tier: "premium"
            }, 
            error: null 
          })
        } as any;
      }
      if (table === "ai_agent_configs") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { gemini_api_key: "TEST-GEMINI-KEY-123" }, error: null })
        } as any;
      }
      if (table === "bookings") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({
            data: [
              { id: "b-1", status: "completed", created_at: new Date().toISOString() },
              { id: "b-2", status: "inquiry", created_at: new Date().toISOString() }
            ],
            error: null
          })
        } as any;
      }
      if (table === "session_logs") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [
              {
                id: "sl-1",
                booking_id: "b-1",
                session_number: 1,
                assigned_date: new Date().toISOString().split('T')[0],
                assigned_time: "15:00:00",
                completed_date: new Date().toISOString().split('T')[0],
                status: "completed",
                notes: "Tốt",
                completed_by_ktv: { full_name: "Cao Thị Thuý Vân" },
                booking: {
                  package_name: "Tắm Bé Chuẩn Y Khoa Tại Nhà",
                  total_sessions: 30,
                  completed_sessions: 2,
                  customer: { name_mother: "Nguyễn Thị Lan" }
                }
              }
            ],
            error: null
          })
        } as any;
      }
      if (table === "session_reviews") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: "rev-1",
                rating: 3,
                note: "KTV Hoa làm chưa nhiệt tình",
                created_at: new Date().toISOString(),
                reviewer: { name_mother: "Nguyễn Thị Lan" },
                ktv: { full_name: "KTV Hoa" }
              }
            ],
            error: null
          })
        } as any;
      }
      if (table === "customers") {
        // Thenable builder — covers all 3 query shapes used by CMO Agent:
        //   .select(...).eq(...).gte(...).order(...)        → list of new customers
        //   .select("id", {count:"exact", head:true}).eq(...) → count
        //   .select(...).eq(...).order(...).limit(5)        → top loyal customers
        const builder: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          then: (onFulfilled: any) =>
            Promise.resolve({
              data: [
                { id: "c-1", name_mother: "Nguyễn Thị Lan", phone: "0912345678", loyalty_points: 100 }
              ],
              count: 12,
              error: null,
            }).then(onFulfilled),
        };
        return builder;
      }
      if (table === "ai_agent_logs") {
        return {
          insert: mockInsert
        } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any;
    });

    const req = new Request("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "Kiểm tra đánh giá hài lòng khách hàng và reviews" })
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.routedAgent).toBe("cmo");
    expect(body.analysis.executiveSummary).toContain("Phân tích CSKH");
    expect(body.analysis.anomaliesFound).toHaveLength(1);
    expect(body.analysis.anomaliesFound[0]).toContain("Nguyễn Thị Lan");
    expect(body.draftActions).toHaveLength(1);
    expect(body.draftActions[0].type).toBe("customer_apology");
  });

  it("propagates CMO DB failures immediately (Zero Silent DB Failures)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null })
        } as any;
      }
      if (table === "tenants") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { 
              id: TENANT_ID, 
              name: "Test Tenant", 
              status: "active",
              module_id: "spa",
              subscription_tier: "premium"
            }, 
            error: null 
          })
        } as any;
      }
      if (table === "bookings") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Access denied to bookings table" }
          })
        } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any;
    });

    const req = new Request("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "Kiểm tra tình hình chăm sóc khách hàng" })
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("lỗi nghiêm trọng");
    expect(body.details).toContain("Access denied to bookings table");
  });
});

describe("AI Franchise Sub-Agent (Franchise Operations)", () => {
  it("routes to franchise agent, queries royalty configurations and invoices, compares actual vs calculated royalty", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null })
        } as any;
      }
      if (table === "ai_agent_configs") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { gemini_api_key: "TEST-GEMINI-KEY-123" }, error: null })
        } as any;
      }
      if (table === "tenants") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: TENANT_ID, name: "Bella Spa Hà Nội", royalty_type: "percentage", royalty_rate: 10, royalty_fixed_amount: 0 },
            error: null
          })
        } as any;
      }
      if (table === "franchise_royalty_invoices") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              { id: "inv-1", invoice_number: "INV-FR-001", month_year: "2026-05-01", gross_revenue: 50000000, royalty_type: "percentage", royalty_rate: 10, calculated_amount: 5000000, status: "pending" }
            ],
            error: null
          })
        } as any;
      }
      if (table === "revenue") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({
            data: [
              { amount: 30000000, received_date: "2026-05-10", status: "confirmed" },
              { amount: 20000000, received_date: "2026-05-15", status: "confirmed" }
            ],
            error: null
          })
        } as any;
      }
      if (table === "ai_agent_logs") {
        return {
          insert: mockInsert
        } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any;
    });

    const req = new Request("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "đối soát nhượng quyền và kiểm tra royalty invoices" })
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.routedAgent).toBe("franchise");
    expect(body.analysis.executiveSummary).toContain("Phân tích Nhượng quyền");
    expect(body.analysis.anomaliesFound).toHaveLength(1);
    expect(body.analysis.anomaliesFound[0]).toContain("INV-FR-001");
    expect(body.draftActions).toHaveLength(1);
    expect(body.draftActions[0].type).toBe("royalty_payment_reminder");
  });

  it("propagates Franchise DB failures immediately (Zero Silent DB Failures)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: ADMIN_USER, error: null })
        } as any;
      }
      if (table === "tenants") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Tenant data fetch failed" }
          })
        } as any;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any;
    });

    const req = new Request("http://localhost/api/v1/ai/coo-orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "Kiểm tra tỷ lệ chi nhánh nhượng quyền" })
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Failed to fetch tenant configuration");
    expect(body.details || body.error).toContain("Tenant data fetch failed");
  });
});
