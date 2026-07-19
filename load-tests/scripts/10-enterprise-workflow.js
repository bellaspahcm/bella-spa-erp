/**
 * ENTERPRISE WORKFLOW INTEGRATION TEST.
 *
 * Nghiệp vụ: Mô phỏng quy trình làm việc khép kín của một quản lý chi nhánh
 * hoặc quản trị viên cấp cao trong một phiên làm việc thực tế:
 *   1. Tạo mới khách hàng (CRM)
 *   2. Tính toán bảng lương KTV chi nhánh (HR Payroll)
 *   3. Gọi trợ lý ảo AI để phân tích vận hành & cảnh báo (AI Orchestrator)
 *   4. Xem báo cáo doanh thu & đối soát dòng tiền (Finance P&L)
 *
 * Script tự động dọn dẹp các khách hàng được tạo tạm thời sau khi kết thúc test.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders, loginViaApi, authHeaders } from "../helpers/auth.js";
import { getHqTenantId, randomVnPhone } from "../helpers/data.js";

export const options = {
  stages: [
    { duration: "10s", target: 5 },  // Tải tích hợp tăng dần lên 5 VUs
    { duration: "30s", target: 5 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2500"], // Cho phép tối đa 2.5s vì có cả AI và Payroll rpc
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  tags: { test_type: "stress", target: "enterprise_workflow" },
};

export function setup() {
  assertEnv();
  const tenantId = getHqTenantId();
  
  // Login lấy token để gọi AI Endpoint
  const session = loginViaApi(ENV.ADMIN_EMAIL, ENV.ADMIN_PASSWORD);
  if (!session || !session.access_token) {
    throw new Error("Không thể đăng nhập tài khoản Admin trong setup.");
  }
  
  return { tenantId, accessToken: session.access_token };
}

export default function (data) {
  const sHeaders = serviceHeaders();
  const aHeaders = authHeaders(data.accessToken);
  const now = new Date();
  
  // ==========================================
  // BƯỚC 1: Tạo mới một khách hàng (CRM)
  // ==========================================
  const customerPayload = JSON.stringify({
    name_mother: `Enterprise Guest ${now.getTime()}-${Math.floor(Math.random() * 1000)}`,
    phone: randomVnPhone(),
    notes: "LOAD-TEST-ENTERPRISE",
    tenant_id: data.tenantId
  });

  const cRes = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/customers`,
    customerPayload,
    { headers: sHeaders, tags: { name: "workflow.create_customer" } }
  );

  const customerCreated = check(cRes, {
    "create customer status 201": (r) => r.status === 201
  });

  if (!customerCreated) {
    sleep(1);
    return;
  }

  // ==========================================
  // BƯỚC 2: Tính lương KTV chi nhánh (HR Payroll)
  // ==========================================
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const payrollPayload = JSON.stringify({
    p_month_year: monthYear,
    p_tenant_id: data.tenantId
  });

  const pRes = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/rpc/calculate_ktv_salary_sheet`,
    payrollPayload,
    { headers: sHeaders, tags: { name: "workflow.calculate_payroll" } }
  );

  check(pRes, {
    "calculate payroll status 200": (r) => r.status === 200,
    "payroll is array": (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch (e) {
        return false;
      }
    }
  });

  // ==========================================
  // BƯỚC 3: Gọi trợ lý ảo AI phân tích vận hành (AI Assistant)
  // ==========================================
  const aiPayload = JSON.stringify({
    command: "Phân tích chấm công và tính lương KTV tháng này",
    monthYear: new Date().toISOString().split("T")[0]
  });

  const aiRes = http.post(
    `${ENV.BASE_URL}/api/v1/ai/coo-orchestrator`,
    aiPayload,
    { headers: aHeaders, tags: { name: "workflow.ai_orchestrator" } }
  );

  check(aiRes, {
    "AI orchestrator status 200": (r) => r.status === 200,
    "AI response structure check": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === "success" && typeof body.routedAgent === "string";
      } catch (e) {
        return false;
      }
    }
  });

  // ==========================================
  // BƯỚC 4: Xem báo cáo doanh thu & đối soát dòng tiền (Finance P&L)
  // ==========================================
  const fRes = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/revenue?select=id,amount&tenant_id=eq.${data.tenantId}&limit=10`,
    { headers: sHeaders, tags: { name: "workflow.get_revenue" } }
  );

  check(fRes, {
    "get revenue status 200": (r) => r.status === 200
  });

  sleep(2);
}

export function teardown(data) {
  const headers = serviceHeaders();
  console.log("[workflow] Đang dọn dẹp các khách hàng được tạo trong đợt test...");

  // Lấy danh sách khách hàng test để xóa
  const getRes = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/customers?select=id&notes=eq.LOAD-TEST-ENTERPRISE&tenant_id=eq.${data.tenantId}`,
    { headers }
  );

  if (getRes.status === 200) {
    const customers = JSON.parse(getRes.body);
    console.log(`[workflow] Phát hiện ${customers.length} khách hàng cần dọn dẹp.`);
    
    for (const c of customers) {
      http.del(
        `${ENV.SUPABASE_URL}/rest/v1/customers?id=eq.${c.id}`,
        null,
        { headers }
      );
    }
  }

  console.log("[workflow] Đã hoàn thành dọn dẹp workflow test data.");
}
