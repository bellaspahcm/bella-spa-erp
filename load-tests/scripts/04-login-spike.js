/**
 * SPIKE TEST — đột biến traffic login.
 *
 * Mô phỏng: Sáng 8h, toàn bộ ~100 nhân viên các chi nhánh đồng loạt login.
 * Verify rate limit + auth endpoint chịu được spike.
 *
 * Stages (spike pattern):
 *   0:00 → 0:10:  ramp 0   → 5   (baseline normal)
 *   0:10 → 0:20:  ramp 5   → 100 (SPIKE)
 *   0:20 → 0:50:  giữ 100  VU
 *   0:50 → 1:00:  ramp 100 → 5
 *   1:00 → 1:30:  giữ 5    (recovery — verify hệ thống không bị nghẽn)
 *
 * SLO: p95 login < 1s, error rate < 2% (rate limit khi spike có thể từ chối
 * vài request — chấp nhận được nếu < 2%).
 *
 * Chạy:
 *   k6 run load-tests/scripts/04-login-spike.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";

export const options = {
  stages: [
    { duration: "10s", target: 5 },
    { duration: "10s", target: 100 }, // SPIKE
    { duration: "30s", target: 100 },
    { duration: "10s", target: 5 },
    { duration: "30s", target: 5 },
  ],
  thresholds: {
    "http_req_duration{name:auth.login}": ["p(95)<1000", "p(99)<3000"],
    "http_req_failed{name:auth.login}": ["rate<0.02"],
    "rate_limited_count": ["count<200"], // mong < 200 requests bị 429
  },
  tags: { test_type: "spike", target: "auth" },
};

const rateLimitedCount = new Counter("rate_limited_count");

export function setup() {
  assertEnv();
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error("Cần SUPABASE_URL + SUPABASE_ANON_KEY");
  }
}

export default function () {
  // Mỗi VU dùng email admin để login (mô phỏng tài khoản chung cho test)
  const res = http.post(
    `${ENV.SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: ENV.ADMIN_EMAIL,
      password: ENV.ADMIN_PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        apikey: ENV.SUPABASE_ANON_KEY,
      },
      tags: { name: "auth.login" },
    },
  );

  check(res, {
    "login 200 or 429 (rate limited)": (r) => r.status === 200 || r.status === 429,
    "login NOT 5xx (server error)": (r) => r.status < 500,
  });

  if (res.status === 429) {
    rateLimitedCount.add(1);
  }

  // Login không có sleep — mô phỏng burst thật
}
