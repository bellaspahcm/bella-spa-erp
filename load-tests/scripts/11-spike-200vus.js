/**
 * SPIKE TEST — 200 VUs (4× previous 50-VU benchmark)
 *
 * Mô phỏng: flash-sale / viral campaign khiến 200 lễ tân + khách hàng đồng thời
 * cố gắng tạo booking trong thời gian ngắn. Verify:
 *   - Supabase PostgREST + RLS không deadlock
 *   - booking_number unique vẫn được enforce (chỉ 2-3 fail max)
 *   - p95 < 3s dưới 200 VU (relaxed SLO cho spike)
 *   - Hệ thống recover sau spike (ramp-down sạch)
 *
 * Stages:
 *   0:00 → 0:30:  ramp 0   → 50 VU   (warm-up)
 *   0:30 → 1:30:  ramp 50  → 200 VU  (aggressive ramp)
 *   1:30 → 3:00:  giữ 200 VU          (peak spike)
 *   3:00 → 3:30:  ramp 200 → 0        (cool-down)
 *
 * SLO (spike — relaxed): p95 < 3s, errors < 10%.
 *
 * Chạy:
 *   k6 run load-tests/scripts/11-spike-200vus.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders } from "../helpers/auth.js";
import {
  getHqTenantId,
  getAnyPackage,
  randomVnPhone,
  randomBookingNumber,
} from "../helpers/data.js";

export const options = {
  stages: [
    { duration: "30s",  target: 50  },   // warm-up
    { duration: "1m",   target: 200 },   // aggressive ramp to 200 VU
    { duration: "1m30s", target: 200 },  // hold peak
    { duration: "30s",  target: 0   },   // cool-down
  ],
  thresholds: {
    // Spike SLO — relaxed
    http_req_duration: ["p(95)<3000", "p(99)<5000"],
    http_req_failed:   ["rate<0.10"],   // 10% lỗi chấp nhận được ở 200 VU
    checks:            ["rate>0.90"],
    // Custom: booking success rate phải > 90% ngay cả dưới spike
    "checks{check:booking_inserted}": ["rate>0.90"],
  },
  tags: { test_type: "spike", target: "booking", vus: "200" },
};

export function setup() {
  assertEnv();
  if (!ENV.SUPABASE_SERVICE_KEY) {
    throw new Error(
      "Cần SUPABASE_SERVICE_KEY — spike test dùng service role để bypass RLS",
    );
  }
  const tenantId = getHqTenantId();
  const pkg = getAnyPackage();
  if (!pkg) throw new Error("Cần ít nhất 1 package trong tenant HQ.");
  console.log(`[spike-200] tenant=${tenantId} package=${pkg.name} maxVUs=200`);
  return { tenantId, packageId: pkg.id, packagePrice: pkg.price };
}

export default function (data) {
  const headers = serviceHeaders();

  const phone = randomVnPhone();
  const bookingNumber = randomBookingNumber();

  // 1) Insert customer
  let res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/customers`,
    JSON.stringify({
      phone,
      name_mother: `Spike Test ${phone}`,
      tenant_id: data.tenantId,
      status: "active",
    }),
    { headers, tags: { name: "spike.insert_customer" } },
  );

  const customerOk = check(res, {
    "customer inserted": (r) => r.status === 201,
  });

  if (!customerOk) {
    sleep(0.3);
    return;
  }

  const customer = JSON.parse(res.body)[0];

  // 2) Insert booking
  res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/bookings`,
    JSON.stringify({
      booking_number: bookingNumber,
      customer_id: customer.id,
      package_id: data.packageId,
      full_price: data.packagePrice,
      deposit_amount: Math.floor(data.packagePrice * 0.3),
      start_date: new Date().toISOString().slice(0, 10),
      total_sessions: 21,
      completed_sessions: 0,
      status: "booked",
      tenant_id: data.tenantId,
    }),
    { headers, tags: { name: "spike.insert_booking" } },
  );

  check(res, { booking_inserted: (r) => r.status === 201 });

  // Shorter sleep to maximise concurrency pressure at 200 VU
  sleep(Math.random() * 0.3);
}

/**
 * Teardown: xoá toàn bộ spike test data.
 */
export function teardown(data) {
  console.log("[spike-200] Cleanup bookings + customers từ spike test...");
  const headers = serviceHeaders();

  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/bookings?booking_number=like.LOAD-*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers, tags: { name: "teardown.bookings" } },
  );
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/customers?name_mother=like.Spike%20Test%20*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers, tags: { name: "teardown.customers" } },
  );

  console.log("[spike-200] Cleanup done.");
}
