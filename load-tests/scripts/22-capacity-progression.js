/**
 * K6-22: Capacity Progression — Tìm Breaking Point
 *
 * OBJECTIVE:
 *   Cùng workload như K6-3v2c (21-k6-3v2-authenticated-business.js),
 *   cùng code version, cùng tenants — chỉ khác VU level.
 *
 *   Mục tiêu KHÔNG phải là "PASS" — mục tiêu là tìm:
 *     1. Saturation point: VU mà P95 bắt đầu tăng phi tuyến
 *     2. Error onset:      VU mà error rate > 1%
 *     3. Collapse point:   VU mà throughput < 50% baseline
 *
 *   Baseline đã xác lập (K6-3v2c @ 50 VU):
 *     customer_read P95  : ~65 ms
 *     booking_check P95  : ~206 ms (overall)
 *     infra_health  P95  : < 200 ms
 *     Error rate         : 0.00%
 *     Peak RPS           : 121.08
 *
 * LOAD PROFILE (5 stages — KHÔNG thay đổi giữa các mức):
 *
 *   Warmup    0–5m    50 VU   (khớp với K6-3v2c baseline — anchor)
 *   Step 1    5–15m   100 VU  (x2 baseline)
 *   Step 2   15–25m   200 VU  (x4 baseline)
 *   Step 3   25–35m   300 VU  (x6 — stress territory)
 *   Step 4   35–50m   500 VU  (x10 — breaking point exploration)
 *   Cooldown 50–55m    50 VU  (recovery check: có về baseline không?)
 *
 *   Mỗi step: 3m ramp + 7m sustain để đọc số ổn định.
 *   Tổng thời gian: ~55 phút.
 *
 * WORKLOADS (giữ nguyên 100% từ K6-3v2c):
 *   A. biz.customer_read   → Supabase REST API trực tiếp, JWT → RLS → rows
 *   B. biz.booking_check   → Next.js route, JWT → getCurrentUser() → DB
 *   C. infra.health        → Unauthenticated anchor (Server-Timing harvest)
 *
 * TENANTS (bất biến):
 *   [0] Healthcare OS   loadtest-healthcare@test.local   60135a61
 *   [1] Hospital        loadtest-hospital@test.local      ef4c035e
 *   [2] Education       loadtest-education@test.local     152ff24c
 *   [3] Real Estate     loadtest-realestate@test.local    1a6643da
 *
 * VU ASSIGNMENT: (__VU - 1) % 4 — mỗi VU pin vào 1 tenant duy nhất.
 *   500 VU → 125 VU/tenant — đây sẽ là áp lực thật sự lên từng tenant.
 *
 * THRESHOLDS — Đặt để QUAN SÁT, không phải để "PASS tất cả":
 *   Baseline  @warmup  : P95 ≤ 200ms (nếu fail → test environment vấn đề)
 *   SLA       @step1   : customer_read P95 ≤ 500ms
 *   SLA       @step2   : customer_read P95 ≤ 800ms  (nới lỏng, expected degradation)
 *   Hard stop           : error rate > 10% (hệ thống sụp)
 *   Auth gate           : auth_rejections == 0 (nếu > 0 → token setup sai → invalid)
 *
 * PHÂN TÍCH SAU KHI CHẠY:
 *   Nhìn vào Grafana K6 Cloud dashboard, lọc theo tag test_phase:
 *     warmup / step1 / step2 / step3 / step4 / cooldown
 *   So sánh P95, P99, RPS, error_rate tại mỗi bước.
 *   Vẽ đường cong degradation: P95 vs VU count.
 *
 * ĐỪNG FIX BOTTLENECK TRONG LÚC CHẠY.
 *   Giữ nguyên code version d90f1fc9 cho toàn bộ run này.
 *   Sau khi có kết quả, mới fix → chạy lại → so sánh trước/sau.
 *
 * Usage:
 *   npm run load:k6:capacity       (local k6 binary, nếu có)
 *   npm run load:k6:capacity:cloud  (K6 Cloud — khuyên dùng)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";

// ── Per-metric trends ──────────────────────────────────────────────────────────
const customerReadTrend = new Trend("biz_customer_read");
const bookingCheckTrend = new Trend("biz_booking_check");
const infraHealthTrend  = new Trend("infra_health");
const serverTimingDb    = new Trend("server_timing_db_query_ms");
const serverTimingTotal = new Trend("server_timing_next_handler_ms");

// ── Error counters ─────────────────────────────────────────────────────────────
const serverErrorRate   = new Rate("business_server_errors");    // 5xx
const authRejections    = new Counter("business_auth_rejections"); // 401/403 → must be 0

// ── Tenant registry — bất biến từ K6-3v2c ─────────────────────────────────────
const LOAD_TEST_TENANTS = [
  {
    slug:     "healthcare-os",
    label:    "Healthcare OS",
    email:    "loadtest-healthcare@test.local",
    tenantId: "60135a61-d8a0-47f2-a0d9-835ff0bd437e",
  },
  {
    slug:     "hospital",
    label:    "Hospital",
    email:    "loadtest-hospital@test.local",
    tenantId: "ef4c035e-9115-4955-9a4e-45a7afee3322",
  },
  {
    slug:     "education",
    label:    "Education",
    email:    "loadtest-education@test.local",
    tenantId: "152ff24c-8956-49f6-8cca-517fcba3bb1e",
  },
  {
    slug:     "real-estate",
    label:    "Real Estate",
    email:    "loadtest-realestate@test.local",
    tenantId: "1a6643da-3806-4793-a301-7a6d60b0d888",
  },
];

const LOAD_TEST_PASSWORD = "BellaSpaLoadTest2026!";

// ── k6 options: 6 scenarios tương ứng 6 phases ────────────────────────────────
export const options = {
  cloud: {
    name: "Bella K6-22 Capacity Progression 50→100→200→300→500 VU (SG)",
    distribution: {
      "singapore-zone": { loadZone: "amazon:sg:singapore", percent: 100 },
    },
  },

  scenarios: {
    // Phase 0: Warmup @ 50 VU — anchor với K6-3v2c baseline
    warmup: {
      executor: "constant-vus",
      vus: 50,
      duration: "5m",
      startTime: "0s",
      tags: { test_phase: "warmup", vu_level: "50" },
    },

    // Phase 1: 100 VU — x2 baseline
    step1_100vu: {
      executor: "ramping-vus",
      startVUs: 50,
      stages: [
        { target: 100, duration: "3m" },   // ramp
        { target: 100, duration: "7m" },   // sustain — đọc số ổn định
      ],
      startTime: "5m",
      tags: { test_phase: "step1", vu_level: "100" },
    },

    // Phase 2: 200 VU — x4 baseline
    step2_200vu: {
      executor: "ramping-vus",
      startVUs: 100,
      stages: [
        { target: 200, duration: "3m" },   // ramp
        { target: 200, duration: "7m" },   // sustain
      ],
      startTime: "15m",
      tags: { test_phase: "step2", vu_level: "200" },
    },

    // Phase 3: 300 VU — stress territory
    step3_300vu: {
      executor: "ramping-vus",
      startVUs: 200,
      stages: [
        { target: 300, duration: "3m" },   // ramp
        { target: 300, duration: "7m" },   // sustain
      ],
      startTime: "25m",
      tags: { test_phase: "step3", vu_level: "300" },
    },

    // Phase 4: 500 VU — breaking point exploration
    // Nếu error > 10% trong giai đoạn này → BÌNH THƯỜNG, đó là thông tin ta cần
    step4_500vu: {
      executor: "ramping-vus",
      startVUs: 300,
      stages: [
        { target: 500, duration: "5m" },   // ramp chậm hơn — quan sát từng bước
        { target: 500, duration: "10m" },  // sustain — cho đủ dữ liệu
      ],
      startTime: "35m",
      tags: { test_phase: "step4", vu_level: "500" },
    },

    // Phase 5: Cooldown — giảm về 50 VU, kiểm tra recovery
    // Câu hỏi: sau khi bị đẩy tới 500 VU, hệ thống có tự phục hồi về baseline không?
    cooldown: {
      executor: "ramping-vus",
      startVUs: 500,
      stages: [
        { target: 50, duration: "2m" },   // ramp down
        { target: 50, duration: "3m" },   // observe recovery
      ],
      startTime: "50m",
      tags: { test_phase: "cooldown", vu_level: "50" },
    },
  },

  thresholds: {
    // ── Baseline gate (warmup) — nếu fail → environment có vấn đề, stop ngay ──
    // Warmup phải khớp K6-3v2c: nếu không → test này invalid
    "biz_customer_read{test_phase:warmup}": ["p(95)<=200"],
    "infra_health{test_phase:warmup}":      ["p(95)<=300"],

    // ── SLA gates tại step1 (100 VU) ─────────────────────────────────────────
    // Tăng gấp đôi tải, cho phép P95 tăng 2x so với baseline
    "biz_customer_read{test_phase:step1}":  ["p(95)<=500"],
    "biz_booking_check{test_phase:step1}":  ["p(95)<=500"],

    // ── Capacity gates tại step2 (200 VU) ────────────────────────────────────
    // Nới lỏng: x4 tải, P95 tăng 4x so với baseline vẫn acceptable
    "biz_customer_read{test_phase:step2}":  ["p(95)<=800"],
    "biz_booking_check{test_phase:step2}":  ["p(95)<=800"],

    // ── Stress gates tại step3, step4 — QUAN SÁT KHÔNG PHẢI PASS ──────────────
    // Thresholds đặt cao để KHÔNG dừng sớm — muốn quan sát toàn bộ hành vi
    "biz_customer_read{test_phase:step3}":  ["p(95)<=3000"],  // quan sát
    "biz_customer_read{test_phase:step4}":  ["p(95)<=5000"],  // breaking point

    // ── Hard abort: error rate > 10% toàn bộ run ─────────────────────────────
    // Nếu toàn bộ test (không phải chỉ step4) > 10% → environment sập
    "business_server_errors": ["rate<0.10"],

    // ── Auth gate: nếu > 0 → token setup sai → kết quả không đáng tin ────────
    "business_auth_rejections": ["count==0"],

    // ── Recovery gate tại cooldown ────────────────────────────────────────────
    // Sau khi giảm tải, P95 phải về gần baseline trong 5 phút
    "biz_customer_read{test_phase:cooldown}": ["p(95)<=300"],
  },
};

// ── Helper: login ─────────────────────────────────────────────────────────────
function loginTenant(tenant) {
  const url = `${ENV.SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res = http.post(
    url,
    JSON.stringify({ email: tenant.email, password: LOAD_TEST_PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        "apikey": ENV.SUPABASE_ANON_KEY,
      },
      tags: { name: `auth.login.${tenant.slug}` },
    }
  );

  const ok = check(res, {
    [`setup[${tenant.slug}]: login 200`]: (r) => r.status === 200,
    [`setup[${tenant.slug}]: has token`]: (r) => {
      try { return !!JSON.parse(r.body).access_token; } catch { return false; }
    },
  });

  if (!ok) {
    throw new Error(
      `[K6-22] Login FAILED for ${tenant.slug} (${tenant.email}): ` +
      `status=${res.status} body=${res.body}`
    );
  }

  const parsed = JSON.parse(res.body);
  console.log(
    `[K6-22] Login OK: ${tenant.label.padEnd(14)} | ` +
    `user_id=${parsed.user.id} | expires_in=${parsed.expires_in}s`
  );
  return parsed.access_token;
}

// ── setup(): Login một lần duy nhất — token dùng cho toàn bộ 55 phút ─────────
// NOTE: K6-3v2c token expires_in = 3600s (1h). 55 phút test = safe.
export function setup() {
  assertEnv();

  console.log("[K6-22] =====================================================");
  console.log("[K6-22] CAPACITY PROGRESSION: 50 → 100 → 200 → 300 → 500 VU");
  console.log("[K6-22] Code version: d90f1fc9 (KHÔNG thay đổi giữa các bước)");
  console.log("[K6-22] Baseline: K6-3v2c @ 50VU → customer_read P95 = 65ms");
  console.log("[K6-22] Mục tiêu: tìm saturation point, error onset, collapse");
  console.log(`[K6-22] BASE_URL: ${ENV.BASE_URL}`);
  console.log("[K6-22] =====================================================");

  const tokens = LOAD_TEST_TENANTS.map((tenant) => ({
    slug:  tenant.slug,
    label: tenant.label,
    token: loginTenant(tenant),
  }));

  console.log("[K6-22] 4 tenants authenticated. Progression starting...");
  console.log("[K6-22] Per-tenant load tại peak (500 VU): ~125 VU/tenant");
  return { tokens };
}

// ── Booking params: randomized ────────────────────────────────────────────────
function bookingCheckParams() {
  const today  = new Date();
  const offset = Math.floor(Math.random() * 7);
  const date   = new Date(today.getTime() + offset * 86400000);
  const dateStr = date.toISOString().split("T")[0];
  const hour   = 9 + Math.floor(Math.random() * 11);
  const timeStr = `${String(hour).padStart(2, "0")}:00`;
  const duration = [60, 90, 120][Math.floor(Math.random() * 3)];
  return { date: dateStr, time: timeStr, duration };
}

// ── default(): Giữ nguyên 100% từ K6-3v2c ────────────────────────────────────
export default function (data) {
  const tenantIndex = (__VU - 1) % LOAD_TEST_TENANTS.length;
  const tenant = LOAD_TEST_TENANTS[tenantIndex];
  const { token } = data.tokens[tenantIndex];

  const authHeaders = {
    "Authorization":     `Bearer ${token}`,
    "Content-Type":      "application/json",
    "X-Load-Test-Tenant": tenant.slug,
  };

  const supabaseHeaders = {
    "Authorization": `Bearer ${token}`,
    "apikey":        ENV.SUPABASE_ANON_KEY,
    "Content-Type":  "application/json",
    "Prefer":        "count=none",
  };

  // ── A: Customer Read (Supabase REST — đúng RLS context) ──────────────────
  const customerRes = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/customers` +
    `?tenant_id=eq.${tenant.tenantId}` +
    `&select=id,name_mother,phone,status,loyalty_points` +
    `&limit=10&order=name_mother`,
    {
      headers: supabaseHeaders,
      tags: { name: "biz.customer_read", tenant: tenant.slug },
    }
  );
  customerReadTrend.add(customerRes.timings.duration, { tenant: tenant.slug });

  check(customerRes, {
    "customer_read: 200 OK":   (r) => r.status === 200,
    "customer_read: not 5xx":  (r) => r.status < 500,
    "customer_read: has data": (r) => {
      try {
        const arr = JSON.parse(r.body);
        return Array.isArray(arr) && arr.length > 0;
      } catch { return false; }
    },
  });

  if (customerRes.status === 401 || customerRes.status === 403) {
    authRejections.add(1);
    console.error(`[K6-22] AUTH REJECTION [${tenant.slug}] customer_read: ${customerRes.status}`);
  }
  serverErrorRate.add(customerRes.status >= 500 ? 1 : 0);

  // ── B: Booking Check (Next.js route) ─────────────────────────────────────
  const { date, time, duration } = bookingCheckParams();
  const bookingRes = http.get(
    `${ENV.BASE_URL}/api/bookings/check-ktv-availability` +
    `?date=${date}&time=${time}&duration=${duration}`,
    {
      headers: authHeaders,
      tags: { name: "biz.booking_check", tenant: tenant.slug },
    }
  );
  bookingCheckTrend.add(bookingRes.timings.duration, { tenant: tenant.slug });

  check(bookingRes, {
    "booking_check: not 5xx":  (r) => r.status < 500,
    "booking_check: expected": (r) => [200, 400, 404].includes(r.status),
  });

  if (bookingRes.status === 401 || bookingRes.status === 403) {
    authRejections.add(1);
    console.error(`[K6-22] AUTH REJECTION [${tenant.slug}] booking_check: ${bookingRes.status}`);
  }
  serverErrorRate.add(bookingRes.status >= 500 ? 1 : 0);

  // ── C: Health Anchor + Server-Timing harvest ──────────────────────────────
  const healthRes = http.get(`${ENV.BASE_URL}/api/health`, {
    tags: { name: "infra.health" },
  });
  infraHealthTrend.add(healthRes.timings.duration);
  check(healthRes, { "infra_health: 200": (r) => r.status === 200 });

  // Harvest Server-Timing: db_query và next_handler (thêm từ K6-3v2c)
  const st = healthRes.headers["Server-Timing"];
  if (st) {
    const dbMatch  = st.match(/db_query;dur=([\d.]+)/);
    const hdlMatch = st.match(/next_handler;dur=([\d.]+)/);
    if (dbMatch)  serverTimingDb.add(parseFloat(dbMatch[1]));
    if (hdlMatch) serverTimingTotal.add(parseFloat(hdlMatch[1]));
  }

  sleep(1);
}

// ── teardown(): In hướng dẫn phân tích ───────────────────────────────────────
export function teardown(data) {
  console.log("[K6-22] =====================================================");
  console.log("[K6-22] CAPACITY PROGRESSION COMPLETE");
  console.log("[K6-22]");
  console.log("[K6-22] CÁCH PHÂN TÍCH KẾT QUẢ:");
  console.log("[K6-22]   Mở K6 Cloud dashboard → filter theo tag test_phase:");
  console.log("[K6-22]     warmup  → P95 ≈ baseline K6-3v2c (65ms customer_read)");
  console.log("[K6-22]     step1   → 100 VU: P95 có tăng? Bao nhiêu?");
  console.log("[K6-22]     step2   → 200 VU: P95 tăng phi tuyến chưa?");
  console.log("[K6-22]     step3   → 300 VU: Error rate > 0 chưa?");
  console.log("[K6-22]     step4   → 500 VU: Breaking point ở đây không?");
  console.log("[K6-22]     cooldown→ Sau khi giảm về 50 VU, P95 có recover?");
  console.log("[K6-22]");
  console.log("[K6-22] METRICS CẦN GHI VÀO BENCHMARK REPORT:");
  console.log("[K6-22]   biz_customer_read P95 tại mỗi step");
  console.log("[K6-22]   biz_booking_check P95 tại mỗi step");
  console.log("[K6-22]   business_server_errors rate tại mỗi step");
  console.log("[K6-22]   server_timing_db_query_ms P95 tại mỗi step");
  console.log("[K6-22]   RPS (requests/s) tại mỗi step");
  console.log("[K6-22]");
  console.log("[K6-22] BASELINE SO SÁNH (K6-3v2c @ 50 VU):");
  console.log("[K6-22]   customer_read P95  : ~65 ms");
  console.log("[K6-22]   booking_check P95  : ~206 ms");
  console.log("[K6-22]   infra_health  P95  : < 200 ms");
  console.log("[K6-22]   error rate         : 0.00%");
  console.log("[K6-22]   peak RPS           : 121.08");
  console.log("[K6-22] =====================================================");
}
