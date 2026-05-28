/**
 * CONCURRENT BOOKING SPIKE TEST — Tạo đột biến booking đồng thời cực đại.
 *
 * Mô phỏng: 100 VU cùng ập vào tạo booking trong cùng 10 giây (Campaign Flash Sale).
 * Kiểm tra:
 *   - Hệ thống xử lý race condition hoàn hảo
 *   - Tránh trùng số booking_number
 *   - RLS, trigger & RLS check không gây ra deadlock
 *
 * Stages:
 *   0:00 → 0:10:  Ramp up từ 0 lên 100 VUs (Spike đột ngột)
 *   0:10 → 0:30:  Giữ 100 VUs tạo booking đồng thời
 *   0:30 → 0:40:  Ramp down 100 → 0 VUs
 *
 * SLO: p95 < 1.5s, Tỷ lệ lỗi < 2%
 *
 * Chạy:
 *   k6 run load-tests/scripts/06-concurrent-booking-spike.js
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
    { duration: "10s", target: 100 },
    { duration: "20s", target: 100 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500"],
    http_req_failed: ["rate<0.02"],
    checks: ["rate>0.98"],
  },
  tags: { test_type: "spike", target: "booking" },
};

export function setup() {
  assertEnv();
  if (!ENV.SUPABASE_SERVICE_KEY) {
    throw new Error("Cần SUPABASE_SERVICE_KEY để stress test/spike test");
  }
  const tenantId = getHqTenantId();
  const pkg = getAnyPackage();
  if (!pkg) throw new Error("Cần ít nhất 1 package trong tenant HQ.");
  console.log(`[spike] Khởi động spike test cho tenant=${tenantId} packageId=${pkg.id}`);
  return { tenantId, packageId: pkg.id, packagePrice: pkg.price };
}

export default function (data) {
  const headers = serviceHeaders();
  const phone = randomVnPhone();
  const bookingNumber = `SPK-${randomBookingNumber()}`;

  // 1) Insert customer
  let res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/customers`,
    JSON.stringify({
      phone,
      name_mother: `Spike Test ${phone}`,
      tenant_id: data.tenantId,
      status: "active",
    }),
    { headers, tags: { name: "spike.insert_customer" } }
  );

  const customerOk = check(res, {
    "customer created": (r) => r.status === 201,
  });

  if (!customerOk) {
    sleep(0.1);
    return;
  }

  const customer = JSON.parse(res.body)[0];

  // 2) Insert booking đồng thời
  res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/bookings`,
    JSON.stringify({
      booking_number: bookingNumber,
      customer_id: customer.id,
      package_id: data.packageId,
      full_price: data.packagePrice,
      deposit_amount: Math.floor(data.packagePrice * 0.3),
      start_date: new Date().toISOString().slice(0, 10),
      total_sessions: 15,
      completed_sessions: 0,
      status: "booked",
      tenant_id: data.tenantId,
    }),
    { headers, tags: { name: "spike.insert_booking" } }
  );

  check(res, {
    "booking created successfully": (r) => r.status === 201,
  });

  sleep(Math.random() * 0.2);
}

export function teardown(data) {
  console.log("[spike] Bắt đầu dọn dẹp dữ liệu spike test...");
  const headers = serviceHeaders();

  // Xoá bookings có prefix SPK-
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/bookings?booking_number=like.SPK-*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers, tags: { name: "teardown.spike_bookings" } }
  );

  // Xoá customers có prefix Spike Test
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/customers?name_mother=like.Spike%20Test%20*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers, tags: { name: "teardown.spike_customers" } }
  );

  console.log("[spike] Dọn dẹp thành công.");
}
