/**
 * Redis Cache Debug Script
 * 
 * Purpose: Fire 5 sequential requests to check-ktv-availability
 *          and verify X-Cache header transitions: MISS → HIT → HIT → ...
 * 
 * Usage:
 *   k6 run load-tests/scripts/debug-redis-cache.js
 * 
 * Expected output (if Redis is working):
 *   Request 1: X-Cache=MISS  _cache=MISS
 *   Request 2: X-Cache=HIT   _cache=HIT   ← must be this within 15s TTL
 *   Request 3: X-Cache=HIT   _cache=HIT
 *   Request 4: X-Cache=HIT   _cache=HIT
 *   Request 5: X-Cache=HIT   _cache=HIT
 * 
 * If all 5 = MISS → Redis client is not writing/reading cache.
 */

import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = 'https://bella-spa-erp.vercel.app';
const SUPABASE_URL = 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0';
const ADMIN_EMAIL = 'loadtest-healthcare@test.local';
const ADMIN_PASSWORD = 'BellaSpaLoadTest2026!';

// Fixed params — same across all 5 requests to hit the same cache key
const TEST_DATE = '2026-08-20';
const TEST_TIME = '10:00';
const TEST_DURATION = '60';

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  // ── Step 1: Authenticate ─────────────────────────────────────────────────────
  console.log('=== [DEBUG] Authenticating... ===');
  const authRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
    }
  );

  if (authRes.status !== 200) {
    console.error(`[DEBUG] Auth FAILED: ${authRes.status} ${authRes.body}`);
    return;
  }

  const authData = JSON.parse(authRes.body);
  const accessToken = authData.access_token;
  console.log(`[DEBUG] Auth OK. Token: ${accessToken?.substring(0, 20)}...`);

  const headers = {
    'Cookie': `sb-lvnvkpyxtuilhrabtlwv-auth-token=${accessToken}`,
    'Authorization': `Bearer ${accessToken}`,
  };

  const url = `${BASE_URL}/api/bookings/check-ktv-availability?date=${TEST_DATE}&time=${TEST_TIME}&duration=${TEST_DURATION}`;
  console.log(`[DEBUG] Target URL: ${url}`);
  console.log('');

  // ── Step 2: Fire 5 sequential requests with same params ──────────────────────
  for (let i = 1; i <= 5; i++) {
    const t0 = Date.now();
    const res = http.get(url, { headers });
    const elapsed = Date.now() - t0;

    const xCache = res.headers['X-Cache'] || res.headers['x-cache'] || 'NOT_PRESENT';
    const xCacheKey = res.headers['X-Cache-Key'] || res.headers['x-cache-key'] || 'NOT_PRESENT';
    const serverTiming = res.headers['Server-Timing'] || res.headers['server-timing'] || 'NOT_PRESENT';

    let body = {};
    try { body = JSON.parse(res.body); } catch (e) { /* non-json */ }
    const cacheField = body._cache || 'NOT_IN_BODY';

    console.log(`[Request ${i}/5] ──────────────────────────────────────────`);
    console.log(`  Status:         ${res.status}`);
    console.log(`  Elapsed:        ${elapsed}ms`);
    console.log(`  X-Cache:        ${xCache}   ← MUST change to HIT after req 1`);
    console.log(`  _cache (body):  ${cacheField}`);
    console.log(`  X-Cache-Key:    ${xCacheKey}`);
    console.log(`  Server-Timing:  ${serverTiming}`);
    console.log(`  All Headers:    ${JSON.stringify(res.headers, null, 2)}`);
    console.log(`  Body:           ${res.body?.substring(0, 500)}`);

    if (res.status !== 200) {
      console.error(`  [ERROR] Non-200 response: ${res.body?.substring(0, 300)}`);
    }

    if (i === 1 && xCache !== 'MISS') {
      console.warn(`  [WARN] Expected MISS on first request but got: ${xCache}`);
    }
    if (i >= 2 && xCache !== 'HIT') {
      console.error(`  [FAIL] Redis NOT working: expected HIT on request ${i} but got: ${xCache}`);
    }
    if (i >= 2 && xCache === 'HIT') {
      console.log(`  [PASS] Redis HIT confirmed on request ${i} ✅`);
    }

    console.log('');

    // 1 second gap — well within 15s TTL
    if (i < 5) sleep(1);
  }

  console.log('=== [DEBUG] Done. Check X-Cache column above. ===');
}
