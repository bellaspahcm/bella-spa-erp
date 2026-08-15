/**
 * K6-3v4 Short: Post-Optimization Validation (Shortened Version for Quick Verification)
 * 
 * Target: https://bella-spa-erp.vercel.app
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";

// ── Per-metric Trends ──────────────────────────────────────────────────────────
const customerReadTrend  = new Trend("biz_customer_read");
const bookingCheckTrend  = new Trend("biz_booking_check");
const infraHealthTrend   = new Trend("infra_health");

const stRedisDur   = new Trend("booking_check_redis_dur_ms");
const stDbDur      = new Trend("booking_check_db_dur_ms");
const stComputeDur = new Trend("booking_check_compute_dur_ms");
const stTotalDur   = new Trend("booking_check_total_dur_ms");

const cacheHits   = new Counter("booking_check_cache_hits");
const cacheMisses = new Counter("booking_check_cache_misses");

const serverErrorRate = new Rate("business_server_errors");
const authRejections  = new Counter("business_auth_rejections");

// ── Tenant registry ──────────────────────────────────────────────────────────
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

// ── k6 options (Shortened for fast run) ────────────────────────────────────────
export const options = {
  scenarios: {
    warmup: {
      executor: "constant-vus",
      vus: 10,
      duration: "30s",
      startTime: "0s",
      tags: { test_type: "warmup" },
    },
    capacity_100: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { target: 30, duration: "15s" },
        { target: 30, duration: "30s" },
      ],
      startTime: "30s",
      tags: { test_type: "capacity_100" },
    },
    capacity_150: {
      executor: "ramping-vus",
      startVUs: 30,
      stages: [
        { target: 50, duration: "15s" },
        { target: 50, duration: "30s" },
      ],
      startTime: "1m15s",
      tags: { test_type: "capacity_150" },
    },
    capacity_200: {
      executor: "ramping-vus",
      startVUs: 50,
      stages: [
        { target: 80, duration: "15s" },
        { target: 80, duration: "30s" },
      ],
      startTime: "2m",
      tags: { test_type: "capacity_200" },
    },
    cooldown: {
      executor: "ramping-vus",
      startVUs: 80,
      stages: [
        { target: 10, duration: "15s" },
        { target: 10, duration: "15s" },
      ],
      startTime: "2m45s",
      tags: { test_type: "cooldown" },
    },
  },

  thresholds: {
    "biz_customer_read{test_type:capacity_100}":  ["p(95)<=500"],
    "biz_customer_read{test_type:capacity_200}":  ["p(95)<=500"],
    "biz_booking_check{test_type:capacity_100}":  ["p(95)<=500"],
    "biz_booking_check{test_type:capacity_200}":  ["p(95)<=500"],
    "business_server_errors":   ["rate<0.01"],
    "business_auth_rejections": ["count==0"],
    "booking_check_cache_hits": ["count>0"],
  },
};

// ── Helper: login ──────────────────────────────────────────────────────────────
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
    throw new Error(`Login FAILED for ${tenant.slug}`);
  }

  const parsed = JSON.parse(res.body);
  return parsed.access_token;
}

// ── Helper: parse Server-Timing header ────────────────────────────────────────
function parseServerTiming(header) {
  if (!header) return {};
  const result = {};
  for (const part of header.split(",")) {
    const m = part.trim().match(/^(\w+);dur=([\d.]+)/);
    if (m) result[m[1]] = parseFloat(m[2]);
  }
  return result;
}

// ── setup() ───────────────────────────────────────────────────────────────────
export function setup() {
  assertEnv();
  console.log("[K6-3v4-Short] Starting authentication...");
  const tokens = LOAD_TEST_TENANTS.map((tenant) => ({
    slug:  tenant.slug,
    label: tenant.label,
    token: loginTenant(tenant),
  }));
  console.log("[K6-3v4-Short] All tenants authenticated.");
  return { tokens };
}

// ── Booking params ─────────────────────────────────────────────────────────────
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

// ── default() ─────────────────────────────────────────────────────────────────
export default function (data) {
  const tenantIndex = (__VU - 1) % LOAD_TEST_TENANTS.length;
  const tenant      = LOAD_TEST_TENANTS[tenantIndex];
  const { token }   = data.tokens[tenantIndex];

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

  // 1. Customer Read
  const customerRes = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/customers?tenant_id=eq.${tenant.tenantId}&select=id,name_mother,phone,status,loyalty_points&limit=10&order=name_mother`,
    {
      headers: supabaseHeaders,
      tags: { name: "biz.customer_read", tenant: tenant.slug },
    }
  );
  customerReadTrend.add(customerRes.timings.duration, { tenant: tenant.slug });

  // 2. KTV Availability Check
  const { date, time, duration } = bookingCheckParams();
  const bookingRes = http.get(
    `${ENV.BASE_URL}/api/bookings/check-ktv-availability?date=${date}&time=${time}&duration=${duration}`,
    {
      headers: authHeaders,
      tags: { name: "biz.booking_check", tenant: tenant.slug },
    }
  );
  bookingCheckTrend.add(bookingRes.timings.duration, { tenant: tenant.slug });

  const xCache = bookingRes.headers["X-Cache"] || bookingRes.headers["x-cache"];
  if (xCache === "HIT") {
    cacheHits.add(1, { tenant: tenant.slug });
  } else {
    cacheMisses.add(1, { tenant: tenant.slug });
  }

  const serverTimingHeader = bookingRes.headers["Server-Timing"] || bookingRes.headers["server-timing"];
  const st = parseServerTiming(serverTimingHeader);
  if (st.redis   !== undefined) stRedisDur.add(st.redis,     { tenant: tenant.slug });
  if (st.db      !== undefined) stDbDur.add(st.db,           { tenant: tenant.slug });
  if (st.compute !== undefined) stComputeDur.add(st.compute,  { tenant: tenant.slug });
  if (st.total   !== undefined) stTotalDur.add(st.total,      { tenant: tenant.slug });

  check(bookingRes, {
    "booking_check: not 5xx":   (r) => r.status < 500,
    "booking_check: has X-Cache header": (r) => {
      const xc = r.headers["X-Cache"] || r.headers["x-cache"];
      return xc === "HIT" || xc === "MISS";
    },
  });

  serverErrorRate.add(bookingRes.status >= 500 ? 1 : 0);

  // 3. Health check
  const healthRes = http.get(`${ENV.BASE_URL}/api/health`, {
    tags: { name: "infra.health" },
  });
  infraHealthTrend.add(healthRes.timings.duration);

  sleep(1);
}
