/**
 * STRESS TEST — đẩy hệ thống đến giới hạn tạo booking đồng thời.
 *
 * Mô phỏng: race condition khi 20+ lễ tân cùng tạo booking trong cùng giây
 * (giả sử có chương trình KM "đặt nhanh kẻo lỡ"). Verify:
 *   - Hệ thống không crash khi concurrent INSERT
 *   - Mỗi booking đều có booking_number unique
 *   - Không có deadlock / RLS lock kéo dài
 *
 * Stages:
 *   0:00 → 0:30:  ramp 0  → 20 VU
 *   0:30 → 2:00:  giữ 50 VU (cao điểm)
 *   2:00 → 2:30:  ramp 50 → 0
 *
 * SLO (relaxed cho stress): p95 < 2s, errors < 5%.
 *
 * Chạy:
 *   k6 run load-tests/scripts/03-booking-stress.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { RELAXED_THRESHOLDS } from "../config/thresholds.js";
import { serviceHeaders } from "../helpers/auth.js";
import {
  getHqTenantId,
  getAnyPackage,
  randomVnPhone,
  randomBookingNumber,
} from "../helpers/data.js";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: Object.assign({}, RELAXED_THRESHOLDS, {
    // Custom: tỷ lệ insert booking thành công phải > 95%
    "checks{check:booking_inserted}": ["rate>0.95"],
  }),
  tags: { test_type: "stress", target: "booking" },
};

export function setup() {
  assertEnv();
  if (!ENV.SUPABASE_SERVICE_KEY) {
    throw new Error(
      "Cần SUPABASE_SERVICE_KEY — stress test dùng service role để bypass RLS",
    );
  }
  const tenantId = getHqTenantId();
  const pkg = getAnyPackage();
  if (!pkg) throw new Error("Cần ít nhất 1 package trong tenant HQ.");
  console.log(`[stress] tenant=${tenantId} package=${pkg.name}`);
  return { tenantId, packageId: pkg.id, packagePrice: pkg.price };
}

export default function (data) {
  const headers = serviceHeaders();

  // Mỗi VU iteration: tạo 1 customer + 1 booking link với nhau
  const phone = randomVnPhone();
  const bookingNumber = randomBookingNumber();

  // 1) Insert customer
  let res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/customers`,
    JSON.stringify({
      phone,
      name_mother: `Load Test ${phone}`,
      tenant_id: data.tenantId,
      status: "active",
    }),
    { headers, tags: { name: "stress.insert_customer" } },
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
    { headers, tags: { name: "stress.insert_booking" } },
  );

  check(res, { booking_inserted: (r) => r.status === 201 });

  // Mô phỏng user pause giữa các action
  sleep(Math.random() * 0.5);
}

/**
 * Teardown: xoá toàn bộ data đã tạo (filter theo prefix "LOAD-" booking +
 * "Load Test " customer name). Chạy 1 lần cuối test.
 */
export function teardown(data) {
  console.log("[stress] Cleanup bookings + customers tạo trong load test...");

  const headers = serviceHeaders();
  // Xoá bookings có booking_number prefix LOAD-
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/bookings?booking_number=like.LOAD-*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers, tags: { name: "teardown.bookings" } },
  );
  // Xoá customers có name_mother prefix "Load Test"
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/customers?name_mother=like.Load%20Test%20*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers, tags: { name: "teardown.customers" } },
  );

  console.log("[stress] Cleanup done.");
}
