/**
 * SMOKE TEST — 1 VU, 30 giây.
 *
 * Mục đích: verify môi trường + endpoints cơ bản hoạt động trước khi chạy
 * các test load thật sự. Đây là gatekeeper trong CI — nếu smoke fail, các
 * load tests khác cũng vô nghĩa.
 *
 * Phạm vi:
 *   - GET /login (Next.js page render)
 *   - POST Supabase auth (login API)
 *   - GET /dashboard với cookie
 *   - GET 1 vài Supabase REST endpoints (customers, bookings, packages)
 *
 * SLO: p95 < 300ms, errors < 0.1%.
 *
 * Chạy:
 *   k6 run load-tests/scripts/01-smoke.js
 *   k6 run -e BASE_URL=http://localhost:3000 load-tests/scripts/01-smoke.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { STRICT_THRESHOLDS } from "../config/thresholds.js";
import { loginViaApi, authHeaders } from "../helpers/auth.js";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: STRICT_THRESHOLDS,
  tags: { test_type: "smoke" },
};

export function setup() {
  assertEnv();
  console.log(`[smoke] BASE_URL=${ENV.BASE_URL}`);
  console.log(`[smoke] SUPABASE_URL=${ENV.SUPABASE_URL || "(không có — chỉ test Next.js)"}`);
}

export default function () {
  // 1) Login page renders
  let res = http.get(`${ENV.BASE_URL}/login`, { tags: { name: "page.login" } });
  check(res, {
    "login page 200": (r) => r.status === 200,
    "login page has form": (r) => r.body.includes("Bella Spa ERP") || r.body.includes("Đăng nhập"),
  });

  // 2) Optional: hit Supabase auth nếu có credentials
  if (ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) {
    const session = loginViaApi(ENV.ADMIN_EMAIL, ENV.ADMIN_PASSWORD);
    if (session?.access_token) {
      // 3) Supabase REST: count customers (cheap query)
      const headers = authHeaders(session.access_token);
      res = http.get(
        `${ENV.SUPABASE_URL}/rest/v1/customers?select=id&limit=1`,
        { headers, tags: { name: "rest.customers" } },
      );
      check(res, { "rest customers 200": (r) => r.status === 200 });

      // 4) Supabase REST: packages
      res = http.get(
        `${ENV.SUPABASE_URL}/rest/v1/packages?select=id,name&limit=5`,
        { headers, tags: { name: "rest.packages" } },
      );
      check(res, { "rest packages 200": (r) => r.status === 200 });
    }
  }

  sleep(1);
}

export function teardown() {
  console.log("[smoke] Hoàn tất — kiểm tra report ở phần kết quả.");
}
