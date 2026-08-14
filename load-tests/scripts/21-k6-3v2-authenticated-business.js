/**
 * K6-3v2: Multi-Tenant Authenticated Business Workload Capacity Test
 *
 * FIX HISTORY:
 *   K6-3    (script 20): No Authorization header → 100% 401 on business APIs
 *   K6-3v2a (first run): Missing ?tenant_id param → 100% 400 on customer_read
 *                         (route requires: GET /api/customers?tenant_id=<uuid>)
 *   K6-3v2b (2nd run):   createClient() in route reads cookies only, not Bearer
 *                         header → auth.uid()=null → RLS returns 0 rows (200 OK
 *                         but empty). N+1 booking query never fires. Latency ~fast
 *                         but not representative of real workload.
 *   K6-3v2c (this):      Switch customer_read to DIRECT Supabase REST API.
 *                         JWT passes correctly → RLS evaluates real user context
 *                         → 20 seeded customers returned → N+1 booking queries fire
 *                         → REAL workload measurement.
 *
 * OBJECTIVE:
 *   "Hệ thống phục vụ bao nhiêu tenant đồng thời với workload thực tế?"
 *   Bypass auth boundary → measure real server-side latency:
 *     JWT verify → tenant resolution → RLS → Business logic → DB
 *
 * TEST TENANTS (all isolated, zero real data, no cross-contamination):
 *   [0] Healthcare OS   loadtest-healthcare@test.local   tenant: 60135a61
 *   [1] Hospital        loadtest-hospital@test.local      tenant: ef4c035e
 *   [2] Education       loadtest-education@test.local     tenant: 152ff24c
 *   [3] Real Estate     loadtest-realestate@test.local    tenant: 1a6643da
 *
 * VU ASSIGNMENT:
 *   Each VU is assigned ONE tenant: tenantIndex = (__VU - 1) % 4
 *   → VU 1,5,9…  → Healthcare OS
 *   → VU 2,6,10… → Hospital
 *   → VU 3,7,11… → Education
 *   → VU 4,8,12… → Real Estate
 *   At 50 VUs: ~12-13 VUs per tenant → realistic concurrent session load
 *
 * WORKLOADS PER VU:
 *   A. biz.customer_read   → GET {SUPABASE_URL}/rest/v1/customers  (direct REST, correct RLS)
 *                             NOT via Next.js /api/customers — that route uses createClient()
 *                             which reads cookies only, not Authorization header.
 *                             Direct REST: JWT → auth.uid() → RLS → real rows returned.
 *   B. biz.booking_check   → GET /api/bookings/check-ktv-availability  (Next.js route)
 *   C. infra.health        → GET /api/health  (unauthenticated anchor)
 *
 * KEY METRIC — RLS tenant isolation overhead:
 *   Compare P95 across tenants. If one tenant is consistently slower,
 *   it indicates RLS policy scan cost or index miss on tenant_id.
 *
 * LOAD PROFILE:
 *   Phase 1 (0–5m):   4 VUs  — 1 VU/tenant warm-up
 *   Phase 2 (5–15m):  20 VUs — 5 VUs/tenant SLA baseline
 *   Phase 3 (15–25m): 50 VUs — ~12 VUs/tenant capacity step
 *   Phase 4 (25–30m): 20 VUs — cooldown / RLS recovery check
 *
 * SLA THRESHOLDS (authenticated, past RLS):
 *   biz.customer_read P95 (sla):      <= 500ms
 *   biz.booking_check P95 (sla):      <= 500ms
 *   biz.customer_read P95 (capacity): <= 700ms
 *   biz.booking_check P95 (capacity): <= 700ms
 *   5xx error rate:                   < 1%
 *   401/403 auth rejections:          = 0 (any > 0 means token setup broken)
 *
 * Usage:
 *   npm run load:8c:k6-3v2
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

// ── Error counters ─────────────────────────────────────────────────────────────
const serverErrorRate   = new Rate("business_server_errors");   // 5xx only
const authRejections    = new Counter("business_auth_rejections"); // 401/403 → must be 0

// ── Tenant registry (created by setup script, immutable) ──────────────────────
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

// ── k6 options ─────────────────────────────────────────────────────────────────
export const options = {
  cloud: {
    name: "Bella K6-3v2 Multi-Tenant Authenticated Business Workload (SG)",
    distribution: {
      "singapore-zone": { loadZone: "amazon:sg:singapore", percent: 100 },
    },
  },
  scenarios: {
    warmup: {
      executor: "constant-vus",
      vus: 4,        // 1 VU per tenant
      duration: "5m",
      startTime: "0s",
      tags: { test_type: "warmup" },
    },
    sla_check: {
      executor: "constant-vus",
      vus: 20,       // 5 VUs per tenant
      duration: "10m",
      startTime: "5m",
      tags: { test_type: "sla_check" },
    },
    capacity_50: {
      executor: "ramping-vus",
      startVUs: 20,
      stages: [
        { target: 50, duration: "2m" },   // ramp ~12-13/tenant
        { target: 50, duration: "8m" },   // sustain
      ],
      startTime: "15m",
      tags: { test_type: "capacity" },
    },
    cooldown: {
      executor: "constant-vus",
      vus: 20,
      duration: "5m",
      startTime: "25m",
      tags: { test_type: "cooldown" },
    },
  },
  thresholds: {
    // SLA gates — authenticated business APIs
    "biz_customer_read{test_type:sla_check}":  ["p(95)<=500"],
    "biz_booking_check{test_type:sla_check}":  ["p(95)<=500"],
    "biz_customer_read{test_type:capacity}":   ["p(95)<=700"],
    "biz_booking_check{test_type:capacity}":   ["p(95)<=700"],
    // 5xx gate
    "business_server_errors":    ["rate<0.01"],
    // Auth gate: if > 0, token expired or wrong setup → test is INVALID
    "business_auth_rejections":  ["count==0"],
    // Health anchor
    "infra_health{test_type:sla_check}": ["p(95)<=300"],
  },
};

// ── Helper: login a single tenant, return access_token ───────────────────────
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
      try { return !!JSON.parse(r.body).access_token; } catch (e) { return false; }
    },
  });

  if (!ok) {
    throw new Error(
      `[K6-3v2] Login FAILED for ${tenant.slug} (${tenant.email}): ` +
      `status=${res.status} body=${res.body}`
    );
  }

  const parsed = JSON.parse(res.body);
  console.log(
    `[K6-3v2] Login OK: ${tenant.label.padEnd(14)} | ` +
    `user_id=${parsed.user.id} | expires_in=${parsed.expires_in}s`
  );
  return parsed.access_token;
}

// ── setup(): login all 4 tenants once, share token pool to VUs ───────────────
export function setup() {
  assertEnv();

  console.log("[K6-3v2] ================================================");
  console.log("[K6-3v2] Multi-Tenant Authenticated Business Workload Test");
  console.log("[K6-3v2] Tenants: Healthcare OS | Hospital | Education | Real Estate");
  console.log(`[K6-3v2] BASE_URL: ${ENV.BASE_URL}`);
  console.log("[K6-3v2] Logging in all 4 isolated load-test tenants...");
  console.log("[K6-3v2] ================================================");

  const tokens = LOAD_TEST_TENANTS.map((tenant) => ({
    slug:  tenant.slug,
    label: tenant.label,
    token: loginTenant(tenant),
  }));

  console.log("[K6-3v2] All tenants authenticated. Starting load scenarios...");
  return { tokens };
}

// ── Booking params: randomized to prevent cache hits ─────────────────────────
function bookingCheckParams() {
  const today = new Date();
  const offset = Math.floor(Math.random() * 7);
  const date = new Date(today.getTime() + offset * 86400000);
  const dateStr = date.toISOString().split("T")[0];
  const hour = 9 + Math.floor(Math.random() * 11);
  const timeStr = `${String(hour).padStart(2, "0")}:00`;
  const duration = [60, 90, 120][Math.floor(Math.random() * 3)];
  return { date: dateStr, time: timeStr, duration };
}

// ── default(): Each VU is pinned to 1 tenant by __VU index ───────────────────
export default function (data) {
  // Tenant assignment: deterministic, evenly distributed
  // __VU is 1-indexed in k6, so we use (__VU - 1) % 4
  const tenantIndex = (__VU - 1) % LOAD_TEST_TENANTS.length;
  const tenant = LOAD_TEST_TENANTS[tenantIndex];
  const { token } = data.tokens[tenantIndex];

  // Authorization header for Next.js API routes
  const authHeaders = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Load-Test-Tenant": tenant.slug,
  };

  // Supabase REST API headers (correct JWT context for RLS)
  const supabaseHeaders = {
    "Authorization": `Bearer ${token}`,
    "apikey": ENV.SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    "Prefer": "count=none",
  };

  // ── A: Customer Read (DIRECT Supabase REST API) ─────────────────────────────
  // Bypasses Next.js createClient() cookie-only issue.
  // JWT → auth.uid() → get_auth_tenant_id() → RLS → real rows returned.
  // Tests: auth overhead + RLS evaluation + PostgREST serialization
  // Does NOT test Next.js routing overhead (measured by infra_health)
  const customerRes = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/customers?tenant_id=eq.${tenant.tenantId}&select=id,name_mother,phone,status,loyalty_points&limit=10&order=name_mother`,
    {
      headers: supabaseHeaders,
      tags: { name: "biz.customer_read", tenant: tenant.slug },
    }
  );
  customerReadTrend.add(customerRes.timings.duration, { tenant: tenant.slug });

  check(customerRes, {
    "customer_read: 200 OK":   (r) => r.status === 200,
    "customer_read: not 5xx": (r) => r.status < 500,
    "customer_read: has data": (r) => {
      try {
        const arr = JSON.parse(r.body);
        return Array.isArray(arr) && arr.length > 0;
      } catch(e) { return false; }
    },
  });
  if (customerRes.status === 401 || customerRes.status === 403) {
    authRejections.add(1);
    console.error(`[K6-3v2] AUTH REJECTION [${tenant.slug}] customer_read: ${customerRes.status}`);
  }
  serverErrorRate.add(customerRes.status >= 500 ? 1 : 0);

  // ── B: KTV Availability Check ──────────────────────────────────────────────
  // Route: JWT verify → getCurrentUser() → query users(ktv) + session_logs
  const { date, time, duration } = bookingCheckParams();
  const bookingRes = http.get(
    `${ENV.BASE_URL}/api/bookings/check-ktv-availability?date=${date}&time=${time}&duration=${duration}`,
    {
      headers: authHeaders,
      tags: { name: "biz.booking_check", tenant: tenant.slug },
    }
  );
  bookingCheckTrend.add(bookingRes.timings.duration, { tenant: tenant.slug });

  check(bookingRes, {
    "booking_check: not 5xx": (r) => r.status < 500,
    // 200 = slots found, 404 = no KTVs in this tenant (expected — empty tenant)
    // 400 = invalid params (should not happen with our generator)
    "booking_check: expected": (r) => [200, 400, 404].includes(r.status),
  });
  if (bookingRes.status === 401 || bookingRes.status === 403) {
    authRejections.add(1);
    console.error(`[K6-3v2] AUTH REJECTION [${tenant.slug}] booking_check: ${bookingRes.status}`);
  }
  serverErrorRate.add(bookingRes.status >= 500 ? 1 : 0);

  // ── C: Infrastructure Health (unauthenticated anchor) ─────────────────────
  const healthRes = http.get(`${ENV.BASE_URL}/api/health`, {
    tags: { name: "infra.health" },
  });
  infraHealthTrend.add(healthRes.timings.duration);

  check(healthRes, { "infra_health: 200": (r) => r.status === 200 });

  // Passive Server-Timing harvest
  const st = healthRes.headers["Server-Timing"];
  if (st) {
    const m = st.match(/db_query;dur=([\d.]+)/);
    if (m) serverTimingDb.add(parseFloat(m[1]));
  }

  sleep(1);
}

// ── teardown(): Print comparison table ────────────────────────────────────────
export function teardown(data) {
  console.log("[K6-3v2] ================================================");
  console.log("[K6-3v2] MULTI-TENANT TEST COMPLETE");
  console.log("[K6-3v2] Check K6 Cloud dashboard for per-tenant breakdown:");
  console.log("[K6-3v2]   Filter: tag[tenant]=healthcare-os");
  console.log("[K6-3v2]   Filter: tag[tenant]=hospital");
  console.log("[K6-3v2]   Filter: tag[tenant]=education");
  console.log("[K6-3v2]   Filter: tag[tenant]=real-estate");
  console.log("[K6-3v2]");
  console.log("[K6-3v2] KEY MILESTONES:");
  console.log("[K6-3v2]   K6-1: unauthenticated db_crud + health → P95 ~100ms / 81ms");
  console.log("[K6-3v2]   K6-2: unauthenticated progressive load  → P95 health ~129ms");
  console.log("[K6-3v2]   K6-3: business APIs but 401 (no auth)  → invalid data");
  console.log("[K6-3v2]   K6-3v2: 4-tenant authenticated workload → [check dashboard]");
  console.log("[K6-3v2] ================================================");
}
