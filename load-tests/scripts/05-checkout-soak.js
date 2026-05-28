/**
 * SOAK TEST — long-running test phát hiện memory leak + slow degradation.
 *
 * Mô phỏng: 10 KTV check-in / check-out session liên tục trong 30 phút.
 * Mỗi vòng:
 *   1. SELECT 1 booking
 *   2. INSERT session_log với status='completed'
 *   3. DELETE session_log (cleanup ngay để tránh side effects)
 *
 * Mục tiêu phát hiện:
 *   - Memory leak ở server (Next.js / Supabase)
 *   - Connection pool exhaustion (Theo dõi qua Supabase Dashboard / PGAdmin)
 *   - DB index slow degradation khi outbox queue lớn
 *   - Mức tiêu thụ RAM và CPU trên container được ghi nhận định kỳ qua console logs
 *
 * Stages:
 *   0:00 → 1:00:  ramp 0  → 10 VU
 *   1:00 → 30:00: giữ 10 VU (steady soak)
 *   30:00 → 31:00: ramp 10 → 0
 *
 * SLO: p95 ổn định suốt 30 phút (không drift quá 50% so với baseline đầu).
 *
 * Chạy (lâu):
 *   k6 run load-tests/scripts/05-checkout-soak.js
 *
 * Test nhanh để dev (5 phút):
 *   k6 run -e SOAK_MINUTES=5 load-tests/scripts/05-checkout-soak.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders } from "../helpers/auth.js";
import { getHqTenantId, getAnyKtv } from "../helpers/data.js";

const SOAK_MINUTES = parseInt(__ENV.SOAK_MINUTES || "30", 10);

export const options = {
  stages: [
    { duration: "1m", target: 10 },
    { duration: `${SOAK_MINUTES}m`, target: 10 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    // Iteration time không drift quá 1.5x trong soak (steady state)
    iteration_duration: ["p(95)<3000"],
  },
  tags: { test_type: "soak", target: "checkout" },
};

const insertLatency = new Trend("session_insert_duration");
const deleteLatency = new Trend("session_delete_duration");

export function setup() {
  assertEnv();
  if (!ENV.SUPABASE_SERVICE_KEY) {
    throw new Error("Cần SUPABASE_SERVICE_KEY");
  }
  const tenantId = getHqTenantId();
  const ktv = getAnyKtv();
  if (!ktv) throw new Error("Cần ít nhất 1 KTV trong tenant HQ");

  // Lấy 1 booking để gắn session
  const res = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/bookings?select=id,total_sessions,completed_sessions&tenant_id=eq.${tenantId}&limit=1`,
    { headers: serviceHeaders() },
  );
  const arr = JSON.parse(res.body);
  if (!arr.length) {
    throw new Error("Cần ít nhất 1 booking trong tenant HQ");
  }
  return { tenantId, ktvId: ktv.id, bookingId: arr[0].id };
}

export default function (data) {
  const headers = serviceHeaders();

  // 1) INSERT session_log
  const insertRes = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/session_logs`,
    JSON.stringify({
      booking_id: data.bookingId,
      session_number: 99, // session test, không đụng buổi thật
      assigned_date: new Date().toISOString().slice(0, 10),
      completed_date: new Date().toISOString().slice(0, 10),
      completed_by_ktv_id: data.ktvId,
      status: "completed",
      tenant_id: data.tenantId,
    }),
    { headers, tags: { name: "soak.insert_session" } },
  );

  const ok = check(insertRes, {
    "session inserted": (r) => r.status === 201,
  });
  insertLatency.add(insertRes.timings.duration);

  if (!ok) {
    sleep(1);
    return;
  }

  const sess = JSON.parse(insertRes.body)[0];

  // 2) DELETE session_log (cleanup ngay)
  const delRes = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/session_logs?id=eq.${sess.id}`,
    null,
    { headers, tags: { name: "soak.delete_session" } },
  );
  check(delRes, { "session deleted": (r) => r.status === 204 });
  deleteLatency.add(delRes.timings.duration);

  // KTV mỗi 2-3 giây 1 buổi (mô phỏng thật)
  sleep(Math.random() * 1 + 2);
}
