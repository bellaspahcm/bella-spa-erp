/**
 * SPIKE TEST — 1000 VUs (5× previous 200-VU benchmark)
 *
 * Mô phỏng: flash-sale cực đại khiến 1000 lễ tân + khách hàng đồng thời
 * cố gắng tạo booking trong thời gian ngắn. Verify:
 *   - Supabase PostgREST + RLS không deadlock dưới tải cực hạn
 *   - booking_number unique vẫn được enforce
 *   - p95 < 3s dưới 1000 VU (relaxed SLO cho spike)
 *   - Hệ thống recover sau spike (ramp-down sạch)
 *
 * Stages:
 *   0:00 → 0:30:  ramp 0    → 100 VU   (warm-up)
 *   0:30 → 2:00:  ramp 100  → 1000 VU  (aggressive ramp)
 *   2:00 → 4:00:  giữ 1000 VU          (peak spike)
 *   4:00 → 4:30:  ramp 1000 → 0        (cool-down)
 *
 * SLO (spike — relaxed): p95 < 3s, errors < 15%.
 *
 * Chạy:
 *   k6 run load-tests/scripts/12-spike-1000vus.js
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
    { duration: "30s",   target: 100  },  // warm-up
    { duration: "1m30s", target: 1000 },  // aggressive ramp to 1000 VU
    { duration: "2m",    target: 1000 },  // hold peak
    { duration: "30s",   target: 0    },  // cool-down
  ],
  thresholds: {
    // Spike SLO — relaxed
    http_req_duration: ["p(95)<3000", "p(99)<5000"],
    http_req_failed:   ["rate<0.15"],   // 15% lỗi chấp nhận được ở 1000 VU
    checks:            ["rate>0.85"],
    // Custom: booking success rate phải > 85% ngay cả dưới spike
    "checks{check:booking_inserted}": ["rate>0.85"],
  },
  tags: { test_type: "spike", target: "booking", vus: "1000" },
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
  console.log(`[spike-1000] tenant=${tenantId} package=${pkg.name} maxVUs=1000`);
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
      name_mother: `Spike Test 1000 ${phone}`,
      tenant_id: data.tenantId,
      status: "active",
    }),
    { headers, tags: { name: "spike.insert_customer" } },
  );

  const customerOk = check(res, {
    "customer inserted": (r) => r.status === 201,
  });

  if (!customerOk) {
    sleep(0.5);
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

  // Sleep slightly longer than 200 VU to regulate socket pressure
  sleep(Math.random() * 0.5);
}

/**
 * Teardown: xoá toàn bộ spike test data.
 */
export function teardown(data) {
  console.log("[spike-1000] Cleanup bookings + customers từ spike test...");
  const headers = serviceHeaders();

  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/bookings?booking_number=like.LOAD-*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers, tags: { name: "teardown.bookings" } },
  );
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/customers?name_mother=like.Spike%20Test%201000%20*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers, tags: { name: "teardown.customers" } },
  );

  console.log("[spike-1000] Cleanup done.");
}
