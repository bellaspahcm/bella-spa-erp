/**
 * PAYROLL CALCULATION STRESS TEST — Simulating concurrent payroll processing.
 *
 * Nghiệp vụ: Kích hoạt tính toán bảng lương (calculate_ktv_salary_sheet) 
 * cho KTV để đo lường khả năng xử lý tính toán chuyên sâu & tải DB.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders } from "../helpers/auth.js";
import { getHqTenantId } from "../helpers/data.js";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "30s", target: 10 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500"], // Tính lương cần nhiều phép tính & query, cho phép 1.5s
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  tags: { test_type: "stress", target: "payroll" },
};

export function setup() {
  assertEnv();
  const tenantId = getHqTenantId();
  return { tenantId };
}

export default function (data) {
  const headers = serviceHeaders();
  const url = `${ENV.SUPABASE_URL}/rest/v1/rpc/calculate_ktv_salary_sheet`;
  
  // Lấy kỳ lương tháng hiện tại
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  
  const payload = JSON.stringify({
    p_month_year: monthYear,
    p_tenant_id: data.tenantId,
  });

  const res = http.post(url, payload, {
    headers,
    tags: { name: "payroll.calculate_sheet" },
  });

  check(res, {
    "calculation status is 200": (r) => r.status === 200,
    "returns salary sheet array": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1);
}

export function teardown() {
  console.log("[payroll] Hoàn tất stress test tính lương.");
}
