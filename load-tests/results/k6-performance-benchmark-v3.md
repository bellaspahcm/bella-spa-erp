# Bella Platform — Performance Benchmark Report v3.0

**Date:** August 14, 2026  
**Audience:** Technical Leadership / Engineering Team  
**Test Environment:** Vercel Staging (Singapore Region, `bella-spa-erp.vercel.app`)  
**Database:** Supabase (Singapore, `lvnvkpyxtuilhrabtlwv.supabase.co`)  
**Overall Status:** 🟡 **SATURATION IDENTIFIED — OPTIMIZATION REQUIRED BEFORE HIGHER-SCALE VALIDATION**

> [!NOTE]
> **v3.0 Change Summary** — Corrections from v2.0:
> - **Executive Summary** bổ sung RPS throughput plateau analysis — bằng chứng mạnh nhất về saturation.
> - **Redis cache key** mở rộng để bao gồm toàn bộ inputs ảnh hưởng đến availability (branch, service, v.v.), thay vì chỉ 4 tham số.
> - **Redis TTL** được làm rõ là starting point cần benchmark, không phải con số cố định.
> - **Redis = Optimization Hypothesis** cho đến khi K6-3v4 xác minh, không phải confirmed fix.
> - **Concurrency protection** được nhấn mạnh: phải xác minh database-level locking/constraint trước khi triển khai Redis vào production.
> - **Progress Tracker B1**: Acceptance criterion mở rộng thành điều kiện kép (hit rate + DB reduction + P95 + correctness).
> - **Progress Tracker B2**: "Active connections giảm >50%" hạ xuống expected observation, không còn là hard gate.
> - **K6-3v4**: Bổ sung throughput scaling target (RPS phải tiếp tục tăng) + cache metrics + Server-Timing.

---

## 1. Executive Summary

This document consolidates all load testing results from two test runs conducted on **August 14, 2026**:

- **Test K6-3v2c** (Baseline): 30 min / 50 VUs / 4 tenants → **PASS** (all 7 thresholds)
- **Test K6-3v3** (Capacity): 30 min / 100→200 VUs / 4 tenants → **FAIL** (SLA violated)

**Key findings:**

| Metric | K6-3v2c (50 VUs) | K6-3v3 @100 VUs | K6-3v3 @200 VUs |
| :--- | :---: | :---: | :---: |
| Total Requests | 110,740 | ~32,000 | ~38,000 |
| Peak RPS (throughput) | 121.08 req/s | ~210 req/s | ~215 req/s |
| HTTP Errors | 0 (0.00%) | 0 (0.00%) | ⚠️ Connection resets |
| `biz_customer_read` P95 | 282 ms ✅ | < 500 ms ✅ | **> 800 ms** ❌ |
| `biz_booking_check` P95 | 230 ms ✅ | **593.93 ms** ❌ | **5,785.45 ms** ❌ |
| `infra_health` P95 | 48 ms ✅ | ✅ | ❌ |
| Auth Rejections (401/403) | 0 ✅ | 0 ✅ | 0 ✅ |
| Thresholds | 7/7 PASS | FAIL | FAIL |

### 1.1. Strongest Bottleneck Evidence — Throughput Plateau

Bằng chứng mạnh nhất về saturation không phải latency spike — mà là **throughput gần như không tăng** khi VU tăng gấp đôi:

| VU Scale-up | VU tăng | RPS tăng | Nhận xét |
| :--- | :---: | :---: | :--- |
| 50 → 100 VUs | **+100%** | **+73%** (121→210) | Gần tuyến tính — hệ thống còn headroom |
| 100 → 200 VUs | **+100%** | **+2.4%** (210→215) | ⚠️ **Throughput bão hòa** — hệ thống không absorb thêm load |

Trong khi RPS hầu như không tăng (210→215), `biz_booking_check` P95 tăng **9.7×** (594ms→5,785ms). Đây là dấu hiệu điển hình của **queueing collapse**: tất cả concurrency bổ sung chuyển thành queue wait time thay vì thêm throughput. Hệ thống đang bị giới hạn bởi một resource/processing path cụ thể ở mức ~210 RPS với workload này.

### 1.2. Phạm vi kết luận

> [!IMPORTANT]
> "Saturation begins around 100 VUs" là nhận định dựa trên **workload cụ thể này** (3 API, 4 tenants, 1s sleep per VU, staging environment). Đây không phải giới hạn tuyệt đối của Bella Platform. Workload khác, infrastructure khác, hoặc sau optimization có thể cho kết quả khác.

**Giá trị thực sự của K6-3v3:** Test đã xác định được *nơi* và *cách* hệ thống bắt đầu không scale tuyến tính, và cung cấp baseline đo lường để so sánh sau optimization. Đây là outcome có giá trị của performance engineering — không phải thất bại.

---

## 2. Test Configuration

### Test K6-3v2c — Baseline (50 VUs)

**Script:** [21-k6-3v2-authenticated-business.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/21-k6-3v2-authenticated-business.js)

| Scenario | VUs | Duration | Start |
| :--- | :---: | :---: | :---: |
| warmup | 4 | 5m | 0s |
| sla_check | 20 | 10m | 5m |
| capacity_50 | 20→50 | 10m | 15m |
| cooldown | 20 | 5m | 25m |

### Test K6-3v3 — Capacity (100 & 200 VUs)

**Script:** [23-k6-3v3-100-200vus.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/23-k6-3v3-100-200vus.js)

| Scenario | VUs | Duration | Start |
| :--- | :---: | :---: | :---: |
| warmup | 50 | 5m | 0s |
| capacity_100 | 50→100 | 10m | 5m |
| capacity_200 | 100→200 | 10m | 15m |
| cooldown | 200→50 | 5m | 25m |

**Workload per VU (identical across both tests):**
- **A.** `biz.customer_read` → `GET {SUPABASE_URL}/rest/v1/customers` (JWT + RLS, direct PostgREST)
- **B.** `biz.booking_check` → `GET /api/bookings/check-ktv-availability` (Next.js route)
- **C.** `infra.health` → `GET /api/health` (unauthenticated anchor + Server-Timing harvest)

---

## 3. Performance Saturation Data

| VU Level | Est. RPS | `biz_booking_check` P95 | Δ latency | `biz_customer_read` P95 | HTTP Errors | Zone |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 20 VUs | ~47 | **65 ms** | — | **92 ms** | 0 | 🟢 Comfort |
| 50 VUs | ~121 | **230 ms** | +3.5× | **282 ms** | 0 | 🟢 Stable |
| 100 VUs | ~210 | **593.93 ms** | +2.6× | < 500 ms | 0 | 🟡 Saturation begins |
| 200 VUs | ~215 | **5,785.45 ms** | +9.7× | > 800 ms | ⚠️ Resets | 🔴 Overload |

**Cooldown recovery:** Sau khi hạ tải về 50 VUs, latency của cả hai metric hồi phục về dưới 300 ms trong window 5 phút quan sát → **không có suy giảm hiệu năng dai dẳng trong cửa sổ cooldown đã quan sát**. Lưu ý: đây chưa đủ để kết luận không có memory leak. Cần soak test 2–4 giờ để theo dõi heap growth, RSS, và GC pattern theo thời gian.

---

## 4. Suspected Bottlenecks (Chưa Confirmed — Cần Evidence từ Phase A)

> [!WARNING]
> Các phân tích dưới đây là **suspected root causes** dựa trên k6 warning logs và observed behavior. Chúng chưa được xác minh bằng Supabase monitoring data, Vercel function logs, hoặc database query traces. Không triển khai fix cho đến khi có evidence từ Phase A.

### 4.1. Suspected #1 — Database / PostgREST Connection Saturation

**k6 warning evidence:**
```
WARN[1251] Request Failed
error="read tcp 192.168.1.216:56980->172.64.149.246:443: wsarecv:
An existing connection was forcibly closed by the remote host."
```

**Phân tích:** `Forcibly closed by the remote host` xuất hiện tại phase 200 VUs gợi ý khả năng Supabase PostgREST hoặc Postgres backend đang reset TCP connections do overload hoặc pool exhaustion. Tuy nhiên, số lượng VUs không trực tiếp bằng số lượng DB connections — PostgREST có connection pooling riêng, VU thực hiện request tuần tự nên connection có thể được tái sử dụng.

**Evidence cần thu thập để confirm:**
- Supabase Dashboard → Database → **Active connections** tại đúng timestamp test
- Supabase Dashboard → Database → **Connection pool utilization** và **Waiting connections**
- PostgREST logs: pool wait time, timeout pattern
- Database CPU và transaction latency metrics
- **Xác nhận ngay:** `SUPABASE_URL` trong Vercel env đang dùng **Direct** (port 5432) hay **Pooler/Supavisor** (port 6543)?
- Vercel → Functions → **Concurrent invocations** tại cùng timestamp

### 4.2. Suspected #2 — Serverless / Upstream Connection Failure

**k6 warning evidence:**
```
WARN[1071] Request Failed
error="Get \"https://bella-spa-erp.vercel.app/api/health\": unexpected EOF"
```

**Phân tích:** `unexpected EOF` là **symptom**, không phải root cause. Có thể xuất phát từ: serverless function bị kill khi đạt `maxDuration`, upstream DB latency cao khiến handler block, infrastructure-level connection closure (load balancer, CDN edge), cold start cascade, hoặc network interruption.

**Evidence cần thu thập từ Vercel:**
- Function duration distribution tại timestamp WARN
- **Terminated invocations** (timeout kill) — nếu có → confirm timeout root cause
- Memory usage, cold start count, 5xx error breakdown
- Nếu function duration thấp nhưng EOF vẫn xuất hiện → suspect infrastructure/proxy layer

### 4.3. Suspected #3 — `biz_booking_check` Heavy Execution Path

**Observed:** `booking_check` P95 tăng **9.7×** khi VU tăng 2× (100→200), trong khi `customer_read` chỉ tăng ~3×. Độ chênh lệch cực lớn cho thấy `/api/bookings/check-ktv-availability` có execution path phức tạp hơn rất nhiều so với direct PostgREST query.

**Các nguyên nhân có thể (chưa confirm):** N+1 queries, thiếu index, lock contention, query planner chọn sai plan khi load tăng, RLS policy overhead, multiple DB round-trips, serialization overhead, external dependencies trong handler.

**Evidence cần thu thập:**
```sql
-- Dùng pg_stat_statements để lấy SQL thực tế được gọi
SELECT query, calls, mean_exec_time, max_exec_time, total_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%ktv%'
   OR query ILIKE '%booking%'
   OR query ILIKE '%availability%'
   OR query ILIKE '%session%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Sau khi có SQL thực tế, chạy `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` dưới **đúng user context** (với JWT active để RLS được kích hoạt) để xem execution plan thực sự.

> [!CAUTION]
> **Không tạo index theo giả thuyết.** Index không đúng column hoặc không phù hợp query pattern có thể không giúp ích và làm chậm write operations. Quy trình đúng: slow SQL → EXPLAIN ANALYZE → confirm Sequential Scan → tạo index có mục tiêu → EXPLAIN lại → k6 re-test.

---

## 5. Optimization Roadmap

### Phase A — Diagnose (Ưu tiên đầu tiên)

```
A1. Supabase Dashboard
    → Database: active connections, pool utilization, waiting connections
    → Query Performance: slowest queries trong timeframe test

A2. Vercel Function Logs
    → Filter theo timestamp WARN[1071] và WARN[1251]
    → Xem: function duration, terminated invocations, cold start, 5xx breakdown

A3. Application-level tracing
    → Thêm Server-Timing headers vào /api/bookings/check-ktv-availability
    → Đo từng sub-step: redis-lookup, db-query, compute, total

A4. Database query identification
    → pg_stat_statements để lấy SQL thực tế của booking_check
    → EXPLAIN (ANALYZE, BUFFERS) với đúng authenticated user context

A5. Connection string audit
    → Xác nhận SUPABASE_URL trong Vercel đang dùng direct (5432) hay pooler (6543)

A6. Concurrency protection audit (QUAN TRỌNG — xem Phase B1 note)
    → Kiểm tra booking creation có database-level constraint hay row locking
    → Xác minh race condition protection trước khi Redis được triển khai vào production
```

---

### Phase B — Fix Bottlenecks

**Phase B chạy song song với Phase A** đối với B1 (Redis). Các optimization B2–B3 chờ evidence từ Phase A.

---

#### B1. Redis Availability Read Cache

> [!IMPORTANT]
> **Redis = Optimization Hypothesis** — không phải confirmed fix. Redis có khả năng giảm trực tiếp số lần `/api/bookings/check-ktv-availability` phải đi xuống DB (dựa trên evidence rõ ràng: 230ms→5,785ms với đây là read-heavy route). Tuy nhiên, tác động thực tế chỉ được xác nhận sau K6-3v4.

**Kiến trúc bắt buộc — Redis là Acceleration Layer, không phải Source of Truth:**

```
User Request (check-ktv-availability)
          │
          ▼
    Redis Lookup
    (xem cache key design bên dưới)
          │
    ┌─────┴─────┐
    │           │
  HIT          MISS
    │           │
    │      Supabase DB
    │      (calculate availability)
    │           │
    │      Redis SET (TTL: starting 15s — xem note)
    │           │
    └─────┬─────┘
          │
    Response to Client
    Headers: X-Cache: HIT/MISS, Server-Timing: redis;dur=N,db;dur=N,compute;dur=N
          │
          ▼
    ━━━ BOUNDARY: Redis HIT không cấp quyền tạo booking ━━━
          │
    [Khi user thực sự CREATE booking]
          │
          ▼
    Supabase Transaction
    (REVALIDATE availability inside transaction — là authority cuối cùng)
          │
    COMMIT → invalidate cache keys liên quan
```

**Nguyên tắc kiến trúc bắt buộc:**
1. **Redis trả lời:** "Tại thời điểm cache được tạo, KTV này có vẻ available."
2. **Database transaction trả lời:** "Ngay lúc này booking có thực sự được phép commit hay không?"
3. **Redis HIT không được là điều kiện đủ** để tạo booking.

---

**Cache Key Design — phải bao gồm toàn bộ inputs ảnh hưởng availability:**

> [!CAUTION]
> Cache key `tenantId + date + time + duration` có thể không đủ nếu availability còn phụ thuộc vào branch, service type, technician skill, booking type, gender preference, v.v. Nguyên tắc: **tất cả inputs ảnh hưởng đến output phải có mặt trong cache key**.

```typescript
// BAD — chỉ 4 params, có thể trả stale data sai khi inputs khác nhau
const cacheKey = `ktv:avail:${tenantId}:${date}:${time}:${duration}`;

// GOOD — bao gồm toàn bộ discriminating inputs
function buildAvailabilityCacheKey(params: AvailabilityParams): string {
  return [
    'ktv:availability:v1',   // version prefix cho cache invalidation khi schema đổi
    params.tenantId,
    params.branchId,         // nếu có multi-branch
    params.serviceId,        // loại dịch vụ ảnh hưởng KTV required
    params.date,
    params.startTime,
    params.duration,
    params.businessRuleVersion ?? 'default',  // nếu business rules thay đổi
    // Thêm bất kỳ input nào khác ảnh hưởng đến kết quả availability
  ].join(':');
}

// Key ví dụ:
// "ktv:availability:v1:tenant-abc:branch-01:service-massage:2026-08-14:10:00:60:default"
```

**Luôn kiểm tra với team:** route `check-ktv-availability` hiện tại đang nhận những query params nào? Tất cả đều phải vào cache key.

---

**TTL là starting point, không phải con số cố định:**

```typescript
// Starting point — cần benchmark sau K6-3v4
const CACHE_TTL_SECONDS = 15;

// Sau K6-3v4, benchmark TTL 5s / 10s / 15s / 30s
// và đo: cache hit ratio, DB query reduction, P95, stale response incidents
// Mục tiêu: TTL dài nhất vẫn đảm bảo business correctness chấp nhận được
```

---

**Concurrency Protection — kiểm tra trước khi triển khai vào production:**

> [!CAUTION]
> **Race condition risk nếu không có database-level guarantee:**
> ```
> Request A → Redis HIT (KTV available) → prepare booking
> Request B → Redis HIT (KTV available) → prepare booking
> Request A → INSERT booking cho KTV → COMMIT
> Request B → INSERT booking cho KTV → COMMIT  ← Double booking!
> ```
> `Transactional revalidation` trong code chỉ an toàn nếu có **row-level locking** hoặc **exclusion constraint** tại Postgres. Phải xác minh A6 trước khi Redis đi vào production booking flow.

```typescript
// Pattern đúng — revalidation PHẢI có locking
const booking = await db.transaction(async (trx) => {
  // SELECT ... FOR UPDATE hoặc exclusion constraint phải ngăn concurrent insert
  const stillAvailable = await checkKtvAvailabilityWithLock(trx, params);
  if (!stillAvailable) throw new ConflictError('KTV no longer available');
  return await createBooking(trx, bookingData);
});

// Sau COMMIT thành công → invalidate cache
const keysToInvalidate = buildInvalidationKeys(tenantId, date, /* affected slots */);
await redis.del(...keysToInvalidate);
```

---

#### B2. DB Connection / Pooler (Nếu Phase A confirm connection exhaustion)

Nếu Supabase metrics xác nhận connection exhaustion hoặc A5 confirm direct connection đang được dùng:

```
# Đổi DATABASE_URL trong Vercel env sang Supabase Pooler (Transaction Mode)
# Từ Direct (port 5432):
postgresql://postgres:pass@db.xxxx.supabase.co:5432/postgres

# Sang Pooler (port 6543, transaction mode):
postgresql://postgres.xxxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

> [!CAUTION]
> PgBouncer Transaction Mode không hỗ trợ `SET LOCAL`, `LISTEN/NOTIFY`, Named Prepared Statements. Kiểm tra codebase trước khi đổi.

#### B3. Query Optimization (Nếu Phase A confirm heavy query)

Chỉ sau khi EXPLAIN ANALYZE xác nhận Sequential Scan hoặc N+1:

```sql
-- Ví dụ có mục tiêu — chỉ tạo sau khi confirm slow path từ EXPLAIN
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_<table>_<specific_columns>
  ON public.<table> (<col1>, <col2>)
  WHERE <condition>;  -- Partial index nếu phù hợp
```

#### B4. Serverless Timeout Config (Diagnostic only)

`maxDuration = 30` **không làm route nhanh hơn**. Nó chỉ cho phép function chạy lâu hơn trước khi bị timeout kill — đây là biện pháp diagnostic/protective trong khi điều tra bottleneck thực sự, không phải performance optimization. Sau khi B1+B2+B3 hoàn thành và P95 về dưới 500ms, default `maxDuration` là đủ.

---

### Phase C — K6-3v4 Validation

> [!IMPORTANT]
> **Giữ workload giống hệt K6-3v3**: cùng endpoints, cùng tenant distribution, cùng request mix, cùng 1s sleep, cùng authentication, cùng region, cùng duration, cùng thresholds. Chỉ thay đổi system implementation. Đây là điều kiện để kết luận "improvement attributable to optimization."

**Mục tiêu K6-3v4 — Dual Criteria (Latency + Throughput):**

| Level | `biz_booking_check` P95 | `biz_customer_read` P95 | Est. RPS | Error Rate |
| :---: | :---: | :---: | :---: | :---: |
| 50 VUs | < 300 ms | < 350 ms | > 110 | 0.00% |
| 100 VUs | **< 500 ms** | **< 500 ms** | **> 190** | 0.00% |
| 150 VUs | **< 500 ms** | **< 500 ms** | **> 280** | 0.00% |
| 200 VUs | **< 500 ms** | **< 500 ms** | **> 370** | 0.00% |

**Throughput phải tiếp tục scale tuyến tính** — nếu P95 đẹp nhưng RPS vẫn plateau ở ~215, bottleneck vẫn còn:

```
Connection reset = 0
Unexpected EOF   = 0
RPS phải tăng monotonically với VU (không plateau)
```

**Metrics bổ sung bắt buộc trong K6-3v4** (không có trong K6-3v3):

```javascript
// Thêm vào k6 script
const cacheHit = new Counter('booking_check_cache_hit');
const cacheMiss = new Counter('booking_check_cache_miss');
const dbQueryTime = new Trend('booking_check_db_duration');

// Đọc từ Server-Timing response header
// Server-Timing: redis;dur=2, db;dur=18, compute;dur=3
```

**Target evidence sau K6-3v4 nếu Redis hoạt động đúng:**

```
BEFORE (K6-3v3 @200 VUs):    AFTER (K6-3v4 @200 VUs target):
biz_booking_check P95: 5,785ms  →  < 500ms
RPS: ~215                        →  ~370+ (linear scaling)
Cache hit rate: N/A              →  > 70%
DB calls for booking_check: 100% →  < 30% (>70% served from Redis)
Connection resets: ⚠️ present    →  0
Unexpected EOF: ⚠️ present       →  0
```

---

## 6. Progress Tracker

| # | Task | Phase | Status | Acceptance Criterion |
| :---: | :--- | :---: | :---: | :--- |
| A1 | Supabase connection metrics audit | A | ⬜ | Screenshot active connections, pool utilization, wait queue tại timestamp test |
| A2 | Vercel function logs analysis | A | ⬜ | EOF source được xác định (timeout kill / infra / proxy) |
| A3 | Server-Timing thêm vào booking_check | A | ✅ | `Server-Timing: redis;dur=N,db;dur=N,compute;dur=N,total;dur=N` headers — đã implement trong route |
| A4 | SQL thực tế từ pg_stat_statements | A | ⬜ | SQL của booking_check được identify |
| A5 | EXPLAIN ANALYZE với authenticated context | A | ⬜ | Execution plan (Sequential/Index Scan) được xem |
| A6 | Connection string audit + concurrency check | A | ⬜ | Direct vs Pooler confirmed; DB-level booking constraint verified |
| B1 | Redis Availability Cache + N+1 fix + invalidation | B | 🔄 **In Progress** | ① Cache hit > 70% **AND** ② DB calls cho booking_check giảm đáng kể **AND** ③ P95 cải thiện trong k6 test **AND** ④ Không phát sinh booking correctness regression |
| B1a | N+1 → Batch query (1 query/request thay vì N) | B | ✅ | Đã refactor trong `check-ktv-availability/route.ts` — 1 batch session query + in-memory filter |
| B1b | Redis cache + Server-Timing headers | B | ✅ | `getCache`/`setCache` từ `redis-cache.ts`, cache key bao gồm tenantId+date+time+duration+excludeId |
| B1c | Cache invalidation sau booking UPDATE commit | B | ✅ | `invalidateAvailabilityCache()` được gọi trong `update-booking-action.ts` (fire-and-forget) |
| B1d | K6-3v4 validation (xác nhận hypothesis) | B→C | ⬜ | P95 cải thiện + cache hit rate > 70% + RPS scaling |
| B2 | DB Pooler (nếu A5/A6 confirm) | B | ⬜ | Connection exhaustion không còn; connection wait không tăng bất thường; reset = 0; P95 không degradation; DB utilization trong safe range |
| B3 | Index tạo mục tiêu (sau EXPLAIN confirm) | B | ⬜ | EXPLAIN sau index cho thấy Index Scan; P95 giảm trong k6 |
| B4 | maxDuration config (diagnostic only) | B | ⬜ | EOF errors không còn xuất hiện |
| C1 | K6-3v4: 50→100→150→200 VUs | C | ⬜ | booking P95 < 500ms ở tất cả levels **AND** RPS tăng monotonically **AND** reset+EOF = 0 |
| C2 | K6-soak 2h @ 70 VUs | C | ⬜ | Memory trend flat; heap/RSS không tăng dần; P95 ổn định |

---

## 7. References

| Tài liệu | Đường dẫn |
| :--- | :--- |
| Baseline Report | [k6-3v2-baseline-report.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/results/k6-3v2-baseline-report.md) |
| Capacity Report | [k6-3v3-capacity-report.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/results/k6-3v3-capacity-report.md) |
| v1.0 (archived) | [k6-performance-benchmark-v1.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/results/k6-performance-benchmark-v1.md) |
| v2.0 (archived) | [k6-performance-benchmark-v2.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/results/k6-performance-benchmark-v2.md) |
| Baseline Script | [21-k6-3v2-authenticated-business.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/21-k6-3v2-authenticated-business.js) |
| Capacity Script | [23-k6-3v3-100-200vus.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/23-k6-3v3-100-200vus.js) |
| Progressive Scale Script | [22-capacity-progression.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/22-capacity-progression.js) |
| Soak Test Script | [16-soak-runner.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/16-soak-runner.js) |
