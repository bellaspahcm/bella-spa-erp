/**
 * LOAD TEST — gradual ramp up tới 50 VUs, kéo dài 5 phút.
 *
 * Mô phỏng tải bình thường của Bella Spa giờ cao điểm:
 *   - 10 chi nhánh × ~5 nhân viên active = 50 user đồng thời
 *   - Mỗi user mở dashboard, đọc danh sách khách/booking, refresh chart KPI
 *
 * Stages:
 *   0:00 → 1:00:  ramp 0  → 25 VU
 *   1:00 → 4:00:  giữ 50 VU (steady state)
 *   4:00 → 5:00:  ramp 50 → 0
 *
 * SLO: p95 < 500ms cho mọi endpoint dashboard.
 *
 * Chạy:
 *   k6 run load-tests/scripts/02-dashboard-load.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { BASE_THRESHOLDS } from "../config/thresholds.js";
import { loginViaApi, authHeaders } from "../helpers/auth.js";

export const options = {
  stages: [
    { duration: "1m", target: 25 },
    { duration: "30s", target: 50 },
    { duration: "2m30s", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: BASE_THRESHOLDS,
  tags: { test_type: "load", target: "dashboard" },
};

export function setup() {
  assertEnv();
  // Login 1 lần ở setup, share access_token cho mọi VU (mô phỏng session lâu dài)
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error("Cần SUPABASE_URL + SUPABASE_ANON_KEY để chạy dashboard load.");
  }
  const session = loginViaApi(ENV.ADMIN_EMAIL, ENV.ADMIN_PASSWORD);
  if (!session || !session.access_token) {
    throw new Error("Setup login failed — kiểm tra ADMIN_EMAIL/PASSWORD.");
  }
  return { accessToken: session.access_token };
}

export default function (data) {
  const headers = authHeaders(data.accessToken);

  group("dashboard.kpi_summary", () => {
    const res = http.get(
      `${ENV.SUPABASE_URL}/rest/v1/customers?select=id&limit=1`,
      { headers, tags: { name: "rest.customers.count" } },
    );
    check(res, { "customers 200": (r) => r.status === 200 });
  });

  group("dashboard.bookings_today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = http.get(
      `${ENV.SUPABASE_URL}/rest/v1/bookings?select=id,booking_number,status&start_date=eq.${today}&limit=50`,
      { headers, tags: { name: "rest.bookings.today" } },
    );
    check(res, { "bookings today 200": (r) => r.status === 200 });
  });

  group("dashboard.revenue_month", () => {
    const monthStart = new Date().toISOString().slice(0, 7) + "-01";
    const res = http.get(
      `${ENV.SUPABASE_URL}/rest/v1/revenue?select=amount&received_date=gte.${monthStart}&limit=200`,
      { headers, tags: { name: "rest.revenue.month" } },
    );
    check(res, { "revenue month 200": (r) => r.status === 200 });
  });

  group("dashboard.session_logs_recent", () => {
    const res = http.get(
      `${ENV.SUPABASE_URL}/rest/v1/session_logs?select=id,status,session_number&order=created_at.desc&limit=20`,
      { headers, tags: { name: "rest.session_logs.recent" } },
    );
    check(res, { "session_logs 200": (r) => r.status === 200 });
  });

  // User pause giữa các interaction (mô phỏng đọc + xử lý)
  sleep(Math.random() * 2 + 1); // 1-3 giây
}
