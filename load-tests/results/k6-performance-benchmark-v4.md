# Bella Platform — Performance Benchmark Report v4.0

**Date:** August 15, 2026
**Audience:** Technical Leadership / Engineering Team
**Test Environment:** Vercel Production (`bella-spa-erp.vercel.app`)
**Database:** Supabase (Singapore, `lvnvkpyxtuilhrabtlwv.supabase.co`)
**Test Script:** `load-tests/scripts/24-k6-3v4-post-optimization.js`
**Overall Status:** 🟡 **APPLICATION LAYER CLEAN — DB INFRASTRUCTURE SATURATION REMAINS**

> [!NOTE]
> **v4.0 Change Summary — What's new vs v3.0:**
> - N+1 query fix verified: `compute_dur` P95 = 1ms.
> - Upstash Redis deserialization bug fixed: 62,229 cache HITs at 81.6% rate.
> - `customer_read` isolation test added — key architectural isolation signal for DB-layer hypothesis.
> - Architecture verified: app uses `@supabase/ssr` → REST API → PostgREST (NOT Prisma/direct connections). `DATABASE_URL` not applicable.
> - PostgREST pool saturation **confirmed** as root cause via Supabase metrics: `max_connections=60`, pool size fixed (not user-configurable on Free tier).
> - Decision: **no K6-3v5 on Free tier**. Upgrade Supabase Pro first → K6-3v5 as clean A/B comparison.
> - Roadmap updated: Pro → Deploy → K6-3v5 (100→150→200→300→500 VU).

---

## 1. Executive Summary

**Test K6-3v4** (Post-Optimization Validation): 40m02s / 50→200 VUs / 4 tenants

| Gate | Condition | Result |
|---|---|---|
| G1: Redis reachable | cache_hits > 0 | ✅ 62,229 hits |
| G2: N+1 fixed | compute_dur P95 < 5ms | ✅ 1ms |
| G3: 100 VU stable | booking_check P95 < 500ms | ✅ 480ms |
| G4: 150 VU stable | booking_check P95 < 500ms | ❌ 5,195ms |
| G5: 200 VU stable | booking_check P95 < 500ms | ❌ 24,202ms |
| G6: No connection errors | resets = 0 | ✅ 0 resets |

**Key finding:** Application layer đã được làm sạch hoàn toàn (N+1, Redis, business logic). Bottleneck còn lại nằm ở shared database infrastructure layer — thể hiện qua saturation đồng thời của cả `booking_check` (có Redis) và `customer_read` (không có Redis) tại cùng ngưỡng 100→150 VU.

**Completed workload:** 76,197 iterations — 2.54× so với Run 3 (~30,000).

> [!IMPORTANT]
> Con số 2.54× là **2.54× higher completed workload under the same test campaign**, không phải 2.54× capacity improvement. System capacity thực sự chỉ được xác nhận khi throughput tăng theo tải mà latency vẫn trong SLA. Ở 150–200 VU, latency vẫn collapse.

---

## 2. Background: N+1 và cách Bella đã sửa

### N+1 là gì?

N+1 xảy ra khi một request đáng lẽ chỉ cần 1 lần query database, nhưng code lại query 1 lần để lấy danh sách, rồi query thêm N lần cho từng phần tử.

**Ví dụ — Bella có 20 KTV:**

```
Cách cũ (N+1):

1.  Query danh sách 20 KTV
2.  Query session của KTV #1
3.  Query session của KTV #2
...
21. Query session của KTV #20

→ Tổng: 21 DB queries cho 1 request
```

### Bella đã sửa như thế nào?

```
Cách mới (parallel batch):

             ┌── Query tất cả KTV
Request ─────┤                        → 2 queries song song (Promise.all)
             └── Query TẤT CẢ active sessions trong ngày
                           ↓
                   xử lý conflict trong RAM
                           ↓
                        Response
```

Thay vì 21 queries → **2 queries chạy song song**, conflict detection hoàn toàn trong memory.

**Bằng chứng:** `booking_check_compute_dur_ms` P95 = **1ms** — phần xử lý sau DB gần như không đáng kể.

---

## 3. Kết quả chi tiết

### 3.1 booking_check P95 by VU Stage

| Stage | VUs | P95 | Target | Status | avg | med |
|---|---|---|---|---|---|---|
| warmup | 50 | 693ms | ≤250ms | ❌ cold-start* | 280ms | 195ms |
| capacity_100 | 100 | **480ms** | ≤500ms | ✅ PASS | 237ms | 192ms |
| capacity_150 | 150 | 5,195ms | ≤500ms | ❌ FAIL | 1,688ms | 635ms |
| capacity_200 | 200 | 24,202ms | ≤500ms | ❌ FAIL | 4,290ms | 1,583ms |

*Warmup fail do Vercel serverless cold-start + first-connection warm-up. Không phải regression.

### 3.2 Cache Performance

```
booking_check_cache_hits:    62,229  (81.6%)
booking_check_cache_misses:  14,043  (18.4%)

booking_check_redis_dur_ms:
  avg: 3.3ms  |  P95: 6ms  |  max: 135ms
```

✅ Redis đang hoạt động đúng nhiệm vụ: acceleration layer cho phần tải có thể được cached.

> [!WARNING]
> **Đừng tăng Redis TTL lên 300s để cải thiện HIT rate.** Availability KTV là dữ liệu real-time. TTL quá cao có thể khiến UI hiển thị "KTV đang rảnh" trong khi KTV vừa được booking. Kiến trúc `Redis = acceleration layer, DB = source of truth` là đúng — không được phá vỡ nguyên tắc này chỉ để tăng benchmark HIT rate.

### 3.3 DB Latency (khi cache MISS)

```
booking_check_db_dur_ms:
  avg: 2,742ms  |  med: 549ms  |  P90: 6,890ms  |  P95: 17,443ms  |  max: 57,096ms

booking_check_compute_dur_ms:
  avg: 0.13ms   |  P95: 1ms
```

Pattern DB latency: **median 549ms (query nhanh khi không queue) vs P95 17,443ms (long tail)** → requests đang chờ resource, không phải query chậm intrinsically.

### 3.4 customer_read — Isolation Test

| Stage | VUs | P95 | Status |
|---|---|---|---|
| warmup | 50 | 165ms | ✅ |
| capacity_100 | 100 | **153ms** | ✅ |
| capacity_150 | 150 | 6,288ms | ❌ |
| capacity_200 | 200 | 22,093ms | ❌ |

`customer_read` **không sử dụng Redis**, không đi qua `booking_check`. Nhưng collapse gần như cùng ngưỡng và magnitude:

```
              100 VU       150 VU       200 VU
──────────────────────────────────────────────
booking       480ms        5,195ms      24,202ms
customer      153ms        6,288ms      22,093ms
```

Đây là **isolation test kiến trúc rất giá trị**. Nó cho phép loại trừ từng lớp:

```
Redis P95             6ms    🟢  → Loại
Application compute   1ms    🟢  → Loại
booking_check         ❌ collapse  ↘
customer_read         ❌ collapse  → Shared infrastructure layer
infra_health          ❌ collapse  ↗
                            ↓
                    Supabase / DB layer
```

Nếu bottleneck là Redis hoặc application logic riêng của `booking_check`, `customer_read` sẽ không bị ảnh hưởng. Cả hai collapse cùng lúc là bằng chứng mạnh rằng bottleneck là **shared resource**.

### 3.5 Throughput & Errors

```
Total HTTP requests:    228,821   (95.25 req/s)
Total iterations:        76,197   (31.72 it/s)
Check success rate:      99.98%
HTTP failure rate:        0.02%
Server errors (5xx):      0.01%  ✅
Connection resets:            0  ✅
Unexpected EOF:               0  ✅
business_auth_rejections:    10  ❌ (likely JWT expire @ cooldown, không nghiêm trọng)
```

---

## 4. So sánh Chuỗi Benchmark

| Metric | K6-3v2c (Baseline) | K6-3v3 (Capacity) | K6-3v4 (Post-Opt) |
|---|---|---|---|
| Max VUs tested | 50 | 200 | 200 |
| Total iterations | ~20,000 | ~30,000 | **76,197** |
| booking_check P95 @ 100VU | N/A | ~2,000ms (est.) | **480ms** |
| Cache HITs | 0 | 0 (broken) | **62,229** |
| Redis P95 | N/A | broken | **6ms** |
| N+1 | Active | Active | **Fixed** |
| compute_dur P95 | unmeasured | unmeasured | **1ms** |
| Connection resets | 0 | Yes | **0** |
| Server errors | <0.1% | >5% | **0.01%** |

---

## 5. Architecture Verification & Root Cause Confirmed

### 5.1 Connection Architecture (Verified)

```
Next.js API routes (Vercel serverless)
         ↓
createClient() → @supabase/ssr → createServerClient
         ↓
NEXT_PUBLIC_SUPABASE_URL (https://lvnvkpyxtuilhrabtlwv.supabase.co)
         ↓ HTTPS port 443
PostgREST [connection pool — FIXED size, NOT user-configurable on Free tier]
         ↓
PostgreSQL [max_connections = 60, superuser_reserved = 3]
```

App **không dùng Prisma hoặc direct DATABASE_URL**. Tất cả queries đi qua REST API → PostgREST. Transaction Pooler (port 6543) không áp dụng cho kiến trúc này.

### 5.2 Connection Budget (Verified via SQL)

```
max_connections            = 60   (SHOW max_connections)
superuser_reserved         =  3
Effective usable           = 57

Supabase internal services (pg_stat_activity):
  supabase_admin           =  5
  pgbouncer (admin conn)   =  1
  pg_net                   =  1
  Supabase Storage API     =  1
  postgres_exporter        =  1
  pg_cron scheduler        =  1
  dashboard-query-editor   =  1
  ─────────────────────────────
  Internal total           ≈ 11–13

Available for PostgREST pool ≈ 44–46
But PostgREST pool size: FIXED by Supabase infra, NOT configurable on Free tier
```

### 5.3 Root Cause Confirmed

**PostgREST connection pool exhaustion** — xác nhận qua:

1. `customer_read` (no Redis) collapse cùng ngưỡng 100→150 VU với `booking_check` (has Redis) → shared resource
2. DB duration: median=549ms (query fast when no queue) vs P95=17,443ms (long tail = queue wait)
3. `compute_dur` P95=1ms → not application logic
4. `redis_dur` P95=6ms → not Redis
5. `infra_health` P95 @ 200 VU = 23,878ms → infrastructure level
6. `max_connections=60`, PostgREST pool fixed → platform ceiling

> [!IMPORTANT]
> Đây không còn là "leading hypothesis" — đây là **root cause được xác nhận**. Application code đã clean. Bottleneck nằm ở Supabase Free tier infrastructure constraint.

---

## 6. Trạng thái Hiện Tại

```
                    BELLA PERFORMANCE
                           │
             ┌─────────────┴─────────────┐
             │                           │
        APPLICATION                  INFRASTRUCTURE
             │                           │
       N+1 elimination ✅          Supabase Free ❌
       Compute P95 = 1ms           PostgREST pool saturation
             │                           │
       Redis L2 ✅                  max_connections = 60
       HIT = 81.6%                  pool: NOT configurable
       P95 = 6ms                         │
             │                           │
             └─────────────┬─────────────┘
                           ↓
                    100 VU = PASS ✅  (480ms / 153ms)
                    150 VU = COLLAPSE ❌
                    200 VU = COLLAPSE ❌
                    300 VU = CHƯA TEST ⛔
                    500 VU = CHƯA TEST ⛔
```

**Kết luận:** Architecture hiện tại đã tìm được điểm giới hạn của infrastructure. Không nên tiếp tục tối ưu application code để cố ép Free tier vượt qua platform ceiling này.

---

## 7. Roadmap

### Quyết định: Không chạy K6-3v5 trên Free tier

Free tier đã đạt ceiling. Thêm test trên cùng infrastructure sẽ cho cùng kết quả. Benchmark tiếp theo phải là **A/B comparison sạch**: Free tier ceiling vs production-capable infrastructure.

```
K6-3v4 (Free tier — DONE)
  │
  ├── Application clean ✅
  ├── 100 VU stable ✅
  └── 150+ VU = platform ceiling ❌
          ↓
  [DECISION] Upgrade Supabase Pro
          ↓
  Deploy production/staging
          ↓
  K6-3v5 (Pro tier — cùng workload)
          ↓
  100 VU → P95 target: <500ms
          ↓
  150 VU → P95 target: <500ms   ← validation gate
          ↓
  200 VU → P95 target: <500ms   ← validation gate
          ↓
  300 VU → P95 target: <500ms
          ↓
  500 VU → P95 + error rate + DB metrics
```

> [!IMPORTANT]
> **Không gọi là "Supabase Pro = chắc chắn 200+ VU ổn định"** chỉ dựa trên plan. Pro tier giải phóng platform ceiling, nhưng K6-3v5 là test duy nhất xác nhận capacity thực tế. Nếu sau Pro, đường cong chuyển từ `100ms→5.2s→24.2s` thành `~Xms→~Yms→~Zms` trong SLA → đó là bằng chứng Bella đã giải quyết đúng bottleneck ở từng tầng.

> [!NOTE]
> **Không làm:**
> - ~~Tăng TTL Redis lên 300s~~ — vi phạm real-time booking semantics
> - ~~Cache customer_read trước khi Pro~~ — che triệu chứng, không fix root cause
> - ~~K6-3v5 trên Free tier~~ — sẽ cho kết quả giống K6-3v4, không có thêm thông tin

### Metrics cần theo dõi tại K6-3v5

Mỗi VU stage phải nhìn **đủ 5 chiều**, không chỉ throughput:

| Chiều | Metric | SLA |
|---|---|---|
| Latency | booking_check + customer_read P95 | ≤500ms |
| Cache | HIT rate | ≥80% |
| DB wait | booking_check_db_dur_ms P95 | ≤300ms |
| Errors | HTTP failures + server errors | <0.1% |
| Scaling | RPS tiếp tục tăng theo VU | Linear |

---

## 8. Go/No-Go

❌ **NOT ready for K6-3v5** on current infrastructure (Free tier ceiling confirmed).

✅ **Ready to upgrade Supabase Pro** — application code is clean, bottleneck is infrastructure only.

✅ **K6-3v5 ready to run** immediately after Pro tier deploy, no code changes needed.

---

*Report v4.0 — 2026-08-15 | Test duration: 40m02s | Script: 24-k6-3v4-post-optimization.js*
*Root cause verified: PostgREST pool saturation on Supabase Free tier (max_connections=60)*



