# Bella Platform — Performance Benchmark Report v2.0

**Date:** August 14, 2026  
**Audience:** Technical Leadership / Engineering Team  
**Test Environment:** Vercel Staging (Singapore Region, `bella-spa-erp.vercel.app`)  
**Database:** Supabase (Singapore, `lvnvkpyxtuilhrabtlwv.supabase.co`)  
**Overall Status:** 🟡 **SATURATION IDENTIFIED — OPTIMIZATION REQUIRED BEFORE HIGHER-SCALE VALIDATION**

> [!NOTE]
> **v2.0 Change Summary:** Report có sự thay đổi từ v1.0.
> - Root causes được phân loại lại thành **Suspected** (chưa được xác minh bằng monitoring data thực tế).
> - "Saturation Knee = 100 VUs" được làm rõ thành "saturation begins around 100 VUs *under this tested workload*".
> - Redis architecture được thiết kế lại với invalidation pattern và transactional revalidation.
> - Sprint order được tái cơ cấu: **Diagnose → Fix → Validate**.
> - Cooldown recovery được diễn đạt lại chính xác hơn.
> - `maxDuration` được phân loại đúng là diagnostic config, không phải performance optimization.

---

## 1. Executive Summary

This document consolidates all load testing results from two test runs conducted on **August 14, 2026**:

- **Test K6-3v2c** (Baseline): 30 min / 50 VUs / 4 tenants → **PASS** (all 7 thresholds)
- **Test K6-3v3** (Capacity): 30 min / 100→200 VUs / 4 tenants → **FAIL** (SLA violated)

**Key findings:**

| Metric | K6-3v2c (50 VUs) | K6-3v3 @100 VUs | K6-3v3 @200 VUs |
| :--- | :---: | :---: | :---: |
| Total Requests | 110,740 | ~32,000 | ~38,000 |
| Peak RPS | 121.08 req/s | ~210 req/s | ~215 req/s |
| HTTP Errors | 0 (0.00%) | 0 (0.00%) | ⚠️ Connection resets |
| `biz_customer_read` P95 | 282 ms ✅ | < 500 ms ✅ | **> 800 ms** ❌ |
| `biz_booking_check` P95 | 230 ms ✅ | **593.93 ms** ❌ | **5,785.45 ms** ❌ |
| `infra_health` P95 | 48 ms ✅ | ✅ | ❌ |
| Auth Rejections (401/403) | 0 ✅ | 0 ✅ | 0 ✅ |
| Thresholds | 7/7 PASS | FAIL | FAIL |

**Kết luận kỹ thuật:** Kết quả K6-3v3 không phải thất bại — đây là một kết quả có giá trị của performance engineering. Test đã trả lời được câu hỏi quan trọng: *Bella scale tốt đến đâu trước khi workload bắt đầu tạo queueing và degradation?*

Câu trả lời dựa trên workload và environment đã kiểm thử:
- **~50 VUs**: Stable, sub-300ms
- **~100 VUs**: Saturation bắt đầu, `booking_check` vượt SLA 500ms
- **~200 VUs**: Overload rõ rệt, latency collapse, connection reset xuất hiện

> [!IMPORTANT]
> **Chú ý về phạm vi kết luận:** "Saturation begins around 100 VUs" là nhận định dựa trên **workload cụ thể này** (3 API, 4 tenants, 1s sleep, staging environment). Đây không phải giới hạn tuyệt đối của toàn bộ Bella Platform. Workload khác, infrastructure khác, hoặc sau optimization có thể cho kết quả rất khác nhau.

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

Kết hợp dữ liệu từ cả hai test run, saturation curve của `biz_booking_check` (route nặng nhất) và `biz_customer_read`:

| VU Level | Est. RPS | `biz_booking_check` P95 | Δ từ mức trước | `biz_customer_read` P95 | HTTP Errors | Zone |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 20 VUs | ~47 | **65 ms** | — | **92 ms** | 0 | 🟢 Comfort |
| 50 VUs | ~121 | **230 ms** | +3.5× | **282 ms** | 0 | 🟢 Stable |
| 100 VUs | ~210 | **593.93 ms** | +2.6× | < 500 ms | 0 | 🟡 Saturation begins |
| 200 VUs | ~215 | **5,785.45 ms** | +9.7× | > 800 ms | ⚠️ Resets | 🔴 Overload |

**Quan sát quan trọng về đường cong:**

Từ 50→100 VUs, tải tăng **2×** nhưng `booking_check` P95 tăng **2.6×** — bắt đầu phi tuyến tính nhẹ.

Từ 100→200 VUs, tải tăng **2×** nhưng `booking_check` P95 tăng **9.7×** — đây là dấu hiệu điển hình của **queueing collapse**: hàng đợi tích lũy vượt khả năng xử lý, mỗi request mới phải chờ request trước dài hơn trong vòng lặp tăng dần.

**Cooldown recovery:** Sau khi hạ tải về 50 VUs, latency của cả hai metric hồi phục về dưới 300 ms trong window 5 phút quan sát. Điều này cho thấy **không có suy giảm hiệu năng dai dẳng trong cửa sổ quan sát cooldown**. Tuy nhiên, đây chưa đủ để tuyên bố "không có memory leak" — cần thêm soak test 2–4 giờ để theo dõi heap growth, RSS, và GC pattern theo thời gian.

---

## 4. Suspected Bottlenecks (Chưa Confirmed — Cần Evidence)

> [!WARNING]
> Các phân tích dưới đây là **suspected root causes** dựa trên k6 warning logs và behavior patterns. Chúng chưa được xác minh bằng Supabase monitoring data, Vercel function logs, hoặc database query traces. Không nên triển khai fix cho đến khi có evidence xác minh từ Phase A.

### 4.1. Suspected #1 — Database / PostgREST Connection Saturation

**k6 warning evidence:**
```
WARN[1251] Request Failed
error="read tcp 192.168.1.216:56980->172.64.149.246:443: wsarecv:
An existing connection was forcibly closed by the remote host."
```

**Phân tích:** `An existing connection was forcibly closed by the remote host` xuất hiện tại phase 200 VUs, cho thấy **khả năng** Supabase PostgREST hoặc Postgres backend đang reset TCP connections do overload hoặc pool exhaustion. Tuy nhiên, số lượng VUs không trực tiếp bằng số lượng DB connections — PostgREST có connection pooling riêng, và một VU thực hiện request tuần tự nên một connection có thể được tái sử dụng.

**Evidence cần thu thập để confirm:**
- Supabase Dashboard → Database → **Active connections** tại đúng timestamp test
- Supabase Dashboard → Database → **Connection pool utilization**
- Supabase Dashboard → Database → **Waiting connections** (queue buildup)
- PostgREST logs: timeout pattern, pool wait time
- Database CPU / Transaction latency metrics
- Xác nhận: project đang dùng **Direct connection** (port 5432) hay **Supavisor/Pooler** (port 6543)?
- Vercel → Functions → **Concurrent invocations** tại cùng timestamp

**Chỉ sau khi các metric trên đồng thời đạt saturation tại phase 200 VUs mới có thể nâng lên Confirmed Root Cause.**

---

### 4.2. Suspected #2 — Serverless / Upstream Connection Failure

**k6 warning evidence:**
```
WARN[1071] Request Failed
error="Get \"https://bella-spa-erp.vercel.app/api/health\": unexpected EOF"
```

**Phân tích:** `unexpected EOF` là **symptom**, không phải root cause. Nó có thể xuất phát từ nhiều nguyên nhân khác nhau:
- Serverless function bị kill khi đạt `maxDuration`
- Upstream DB latency cao → handler block → Vercel gateway timeout
- Infrastructure-level connection closure (load balancer, CDN edge)
- Cold start cascade tạo spike ngắn
- Network-level interruption

**Evidence cần thu thập từ Vercel:**
- Vercel Dashboard → Functions → Function duration (tại timestamp WARN)
- Vercel Dashboard → Functions → **Terminated invocations** (timeout kill)
- Vercel Dashboard → Functions → Memory usage, cold start count
- Vercel Dashboard → Functions → 5xx error breakdown
- Nếu log cho thấy function chạy đến `maxDuration` rồi bị kill → xác nhận timeout root cause
- Nếu function duration thấp nhưng EOF vẫn xuất hiện → suspect infrastructure/proxy layer

---

### 4.3. Suspected #3 — `biz_booking_check` Heavy Execution Path

**Evidence:** `booking_check` P95 tăng 25× (230ms→5,785ms) trong khi `customer_read` chỉ tăng ~3× (282ms→~900ms) dưới cùng VU load tăng. Độ chênh lệch cực lớn này cho thấy `/api/bookings/check-ktv-availability` có execution path nặng hơn rất nhiều so với direct PostgREST query.

**Các nguyên nhân có thể (chưa confirm):**
- N+1 queries (query therapist list → loop query session log cho từng therapist)
- Thiếu index trên columns được dùng trong availability filter
- Lock contention tại Postgres khi nhiều concurrent reads
- Query planner chọn sai plan khi statistics outdated
- RLS policy overhead với complex policies
- Multiple DB round-trips thay vì single query
- Serialization/deserialization overhead ở tầng application
- External dependencies trong handler

**Evidence cần thu thập:**
```sql
-- Bật slow query log tạm thời trên Supabase
-- hoặc dùng pg_stat_statements để lấy SQL thực tế được gọi
SELECT query, calls, mean_exec_time, max_exec_time, total_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%ktv%' OR query ILIKE '%booking%' OR query ILIKE '%session%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Sau khi có SQL thực tế, chạy `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` dưới đúng user context (với JWT để RLS được kích hoạt) để xem execution plan thực sự.

> [!CAUTION]
> **Không tạo index trước khi có EXPLAIN ANALYZE.** Index không đúng column hoặc không phù hợp query pattern có thể không giúp ích, thậm chí làm chậm write operations. Quy trình đúng: identify slow SQL → EXPLAIN ANALYZE → check Sequential Scan vs Index Scan → tạo index có mục tiêu → EXPLAIN lại → k6 re-test.

---

## 5. Optimization Roadmap

### Phase A — Diagnose (Ưu tiên #1, trước khi làm bất cứ điều gì khác)

Thu thập evidence để confirm/refute các suspected bottlenecks:

```
A1. Supabase Dashboard
    → Database tab: active connections, pool utilization, waiting connections
    → Query Performance tab: slowest queries trong timeframe test

A2. Vercel Function Logs
    → Functions tab: filter theo timestamp của WARN[1071] và WARN[1251]
    → Xem: function duration, terminated invocations, cold start, 5xx breakdown

A3. Application-level tracing
    → Thêm Server-Timing headers vào /api/bookings/check-ktv-availability
    → Đo từng sub-step: DB query time, processing time, response time

A4. Database query identification
    → pg_stat_statements để lấy SQL thực tế
    → EXPLAIN (ANALYZE, BUFFERS) với đúng user context

A5. Connection string audit
    → Xác nhận Vercel env var SUPABASE_URL đang trỏ direct (5432) hay pooler (6543)
```

---

### Phase B — Fix Bottlenecks (Dựa trên evidence từ Phase A)

#### B1. Redis Availability Read Cache (Triển khai ngay song song với Phase A)

`biz_booking_check` là read-heavy, potentially repeated với cùng `tenant+date+time+duration` parameters. Redis phù hợp để giảm DB pressure ở route này. Tuy nhiên, kiến trúc phải đảm bảo Redis là **acceleration layer**, không phải **source of truth**.

**Kiến trúc Redis Availability Cache:**

```
User Request (check-ktv-availability)
          │
          ▼
    Redis Lookup
    (cache key: ktv:avail:{tenantId}:{date}:{time}:{duration})
          │
    ┌─────┴─────┐
    │           │
  HIT          MISS
    │           │
    │        Supabase DB
    │        (calculate availability)
    │           │
    │        Redis SET (TTL: 15s)
    │           │
    └─────┬─────┘
          │
    Response to Client
          │
          ▼
    [Khi user thực sự CREATE booking]
          │
    Supabase Transaction
    (revalidate availability inside transaction)
          │
    COMMIT → invalidate cache key
```

**Nguyên tắc bắt buộc:**
1. **Redis là read cache chỉ cho availability check** — không quyết định booking có hợp lệ hay không.
2. **Transactional revalidation bắt buộc** — khi user thực sự tạo booking, transaction phải revalidate availability trong Postgres trước khi COMMIT.
3. **Cache invalidation bắt buộc** — sau khi booking được commit thành công, invalidate cache key liên quan:

```typescript
// src/app/api/bookings/check-ktv-availability/route.ts
import { redis } from '@/lib/redis';

const CACHE_TTL_SECONDS = 15; // Ngắn hơn 30s để phù hợp real-time booking

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = /* từ authenticated session */;
  const date = searchParams.get('date');
  const time = searchParams.get('time');
  const duration = searchParams.get('duration');

  const cacheKey = `ktv:avail:${tenantId}:${date}:${time}:${duration}`;

  // 1. Try Redis first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return Response.json(JSON.parse(cached as string), {
      headers: { 'X-Cache': 'HIT', 'X-Cache-Key': cacheKey }
    });
  }

  // 2. Cache miss → query DB
  const availableKtvs = await findAvailableKtvs(tenantId, date, time, duration);

  // 3. Cache result
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(availableKtvs));

  return Response.json(availableKtvs, {
    headers: { 'X-Cache': 'MISS' }
  });
}

// src/app/api/bookings/route.ts (CREATE booking)
export async function POST(request: Request) {
  // ... booking logic ...

  // Transactional revalidation INSIDE Postgres transaction
  const booking = await db.transaction(async (trx) => {
    // Re-check availability inside transaction (locks rows)
    const stillAvailable = await checkKtvAvailabilityInTransaction(trx, params);
    if (!stillAvailable) {
      throw new Error('KTV no longer available');
    }
    return await createBooking(trx, bookingData);
  });

  // Invalidate cache after successful commit
  const cacheKey = `ktv:avail:${tenantId}:${date}:${time}:${duration}`;
  await redis.del(cacheKey);

  return Response.json(booking);
}
```

> [!IMPORTANT]
> **Sau khi triển khai Redis:** Không được giả định bottleneck đã biến mất. Phải chạy **K6-3v4** để đo lại P95 tại 100/150/200 VUs và xác nhận cache hit rate, connection reset count, và EOF errors đều giảm.

#### B2. DB Connection / Pooler (Nếu Phase A confirm connection exhaustion)

Nếu Supabase metrics xác nhận connection exhaustion:

```
# Đổi DATABASE_URL trong Vercel env sang Supabase Pooler (Transaction Mode)
# Từ Direct (port 5432):
postgresql://postgres:pass@db.xxxx.supabase.co:5432/postgres

# Sang Pooler (port 6543, transaction mode):
postgresql://postgres.xxxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

> [!CAUTION]
> PgBouncer Transaction Mode không hỗ trợ `SET LOCAL`, `LISTEN/NOTIFY`, và Named Prepared Statements. Kiểm tra codebase trước khi đổi.

#### B3. Query Optimization (Nếu Phase A confirm heavy query / N+1)

Sau khi có SQL thực tế và EXPLAIN ANALYZE:

```sql
-- Chỉ tạo index sau khi EXPLAIN ANALYZE xác nhận Sequential Scan
-- Ví dụ có mục tiêu (không tạo hàng loạt):

-- Nếu EXPLAIN cho thấy seq scan trên session_logs theo KTV + date:
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_logs_ktv_date
  ON public.session_logs (assigned_ktv_id, booking_date)
  WHERE assigned_ktv_id IS NOT NULL;

-- Nếu EXPLAIN cho thấy RLS scan trên customers:
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_status
  ON public.customers (tenant_id, status);
```

#### B4. Serverless Timeout Config (Diagnostic only — không phải performance fix)

Tăng `maxDuration` **không làm route nhanh hơn**. Nó chỉ cho phép function chạy lâu hơn trước khi bị timeout kill. Đây là biện pháp diagnostic để tránh premature kill trong khi đang investigate bottleneck thực sự.

```json
// vercel.json — Chỉ áp dụng sau khi Vercel logs confirm timeout kills
{
  "functions": {
    "src/app/api/bookings/check-ktv-availability/route.ts": {
      "maxDuration": 30
    }
  }
}
```

**Mục tiêu thực sự:** Sau khi Redis cache và query optimization được triển khai, P95 phải về dưới 500ms — lúc đó `maxDuration` default (10s) là dư thừa.

---

### Phase C — K6-3v4 Validation

Sau khi Phase B hoàn thành, chạy lại với **cùng workload** để đo tác động:

```
Mục tiêu K6-3v4:
  50 VU   → biz_booking_check P95 < 300ms
  100 VU  → biz_booking_check P95 < 500ms
  150 VU  → biz_booking_check P95 < 500ms
  200 VU  → biz_booking_check P95 < 500ms
  Error rate = 0.00%
  Connection reset = 0
  unexpected EOF = 0
```

Nếu K6-3v4 đạt mục tiêu trên → mới có ý nghĩa khi mở rộng lên 300→500 VUs.

---

## 6. Progress Tracker

| # | Task | Phase | Status | Điều kiện để mark Done |
| :---: | :--- | :---: | :---: | :--- |
| A1 | Kiểm tra Supabase connection metrics | A | ⬜ | Screenshot dashboard tại timestamp test |
| A2 | Phân tích Vercel function logs | A | ⬜ | Xác định EOF source (timeout vs infra) |
| A3 | Thêm Server-Timing vào booking_check | A | ⬜ | Latency per sub-step được log |
| A4 | Lấy SQL thực tế từ pg_stat_statements | A | ⬜ | SQL của booking_check được xác định |
| A5 | EXPLAIN ANALYZE với đúng user context | A | ⬜ | Execution plan được xem |
| A6 | Xác nhận connection string (direct vs pooler) | A | ⬜ | Pooler URL được confirm/deny |
| B1 | Redis Availability Cache + invalidation | B | ⬜ | Cache hit rate > 70% trong k6 test |
| B2 | DB Pooler (nếu A6 confirm direct connection) | B | ⬜ | Active connections giảm > 50% |
| B3 | Index tạo mục tiêu (sau EXPLAIN xác nhận) | B | ⬜ | EXPLAIN cho thấy Index Scan |
| B4 | maxDuration config (diagnostic only) | B | ⬜ | EOF errors không còn xuất hiện |
| C1 | K6-3v4: 50→100→150→200 VUs | C | ⬜ | booking P95 < 500ms ở tất cả levels |
| C2 | K6-soak 2h @ 70 VUs | C | ⬜ | Memory trend flat, no degradation |

---

## 7. References

| Tài liệu | Đường dẫn |
| :--- | :--- |
| Baseline Report | [k6-3v2-baseline-report.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/results/k6-3v2-baseline-report.md) |
| Capacity Report | [k6-3v3-capacity-report.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/results/k6-3v3-capacity-report.md) |
| Previous Report (v1.0) | [k6-performance-benchmark-v1.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/results/k6-performance-benchmark-v1.md) |
| Baseline Script | [21-k6-3v2-authenticated-business.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/21-k6-3v2-authenticated-business.js) |
| Capacity Script | [23-k6-3v3-100-200vus.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/23-k6-3v3-100-200vus.js) |
| Progressive Scale Script | [22-capacity-progression.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/22-capacity-progression.js) |
| Soak Test Script | [16-soak-runner.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/16-soak-runner.js) |
