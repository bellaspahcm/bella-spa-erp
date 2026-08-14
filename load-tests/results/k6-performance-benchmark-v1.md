# Bella Platform — Performance Benchmark Report v1.0

**Date:** August 14, 2026  
**Audience:** Technical Leadership / Engineering Team  
**Test Environment:** Vercel Staging (Singapore Region, `bella-spa-erp.vercel.app`)  
**Database:** Supabase (Singapore, `lvnvkpyxtuilhrabtlwv.supabase.co`)  
**Overall Status:** 🟡 **SATURATION POINT IDENTIFIED** — Optimizations Required Before Scale

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
| Auth Rejections | 0 ✅ | 0 ✅ | 0 ✅ |
| Thresholds | 7/7 PASS | FAIL | FAIL |

**Kết luận:** Hệ thống Bella Platform hoạt động **tốt và ổn định ở mức 50–70 VUs**. Bắt đầu xuất hiện hiện tượng **saturation knee tại ~100 VUs** (booking check vượt SLA 500 ms). Đến **200 VUs** hệ thống rơi vào trạng thái sụp đổ với `biz_booking_check` P95 = **5.78 giây** và TCP connection reset từ Supabase.

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
- **A.** `biz.customer_read` → `GET {SUPABASE_URL}/rest/v1/customers` (JWT + RLS)
- **B.** `biz.booking_check` → `GET /api/bookings/check-ktv-availability` (Next.js route)
- **C.** `infra.health` → `GET /api/health` (unauthenticated anchor)

---

## 3. Performance Saturation Curve

Kết hợp dữ liệu từ cả hai test run, chúng ta có thể vẽ đường cong suy hao hiệu năng của `biz_booking_check` (route nặng nhất):

| VU Level | Est. RPS | `biz_booking_check` P95 | `biz_customer_read` P95 | HTTP Errors | Zone |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 20 VUs (SLA check) | ~47 | **65 ms** | **92 ms** | 0 | 🟢 Comfort |
| 50 VUs (capacity_50) | ~121 | **230 ms** | **282 ms** | 0 | 🟢 Stable |
| 100 VUs | ~210 | **593.93 ms** | < 500 ms | 0 | 🟡 Saturation Knee |
| 200 VUs | ~215 | **5,785.45 ms** | > 800 ms | ⚠️ Resets | 🔴 Collapse |

> [!IMPORTANT]
> **Saturation Knee** xuất hiện rõ ràng tại **~100 VUs**:
> - `biz_booking_check` nhảy từ **230 ms → 593 ms** (tăng 2.6×) khi tải tăng 2× (50→100 VUs).
> - `biz_booking_check` tiếp tục nhảy từ **593 ms → 5,785 ms** (tăng 9.7×) khi tải tăng 2× (100→200 VUs).
> - Đây là dấu hiệu điển hình của **queueing collapse** — hàng đợi tích lũy vượt khả năng xử lý.

**Cooldown recovery:** Sau khi hạ tải về 50 VUs, P95 của cả hai metric đều hồi phục về dưới 300 ms. Xác nhận: hệ thống **không bị rò rỉ bộ nhớ (memory leak)** và **kết nối DB được release** đúng cách.

---

## 4. Root Cause Analysis

### 4.1. Bottleneck #1 — Supabase Connection Pool Exhaustion (Severity: 🔴 Critical)

**Evidence từ k6 warning log:**
```
WARN[1251] Request Failed
error="read tcp 192.168.1.216:56980->172.64.149.246:443: wsarecv:
An existing connection was forcibly closed by the remote host."
```

**Root Cause:**

Supabase Postgres theo mặc định cung cấp tối đa **60 connections** (gói Pro). Khi 200 VUs cùng lúc thực hiện `biz.customer_read` qua PostgREST:

```
200 VUs × 1 request/s × avg latency 1-2s = 200-400 concurrent connections
```

Connection pool đã bị **exhausted** (hết slot kết nối). Kong API Gateway của Supabase bắt đầu **forcibly closing** các TCP connection mới, khiến k6 nhận được lỗi `wsarecv`.

**Điều cần kiểm tra:**
- Supabase project đang dùng connection string nào: **Direct** (`port 5432`) hay **Pooler** (`port 6543`)?
- Vercel serverless functions khi không dùng Pooler sẽ mở connection mới cho mỗi invocation → hoàn toàn có thể exhaust pool.

---

### 4.2. Bottleneck #2 — Vercel Serverless Function Timeout / EOF (Severity: 🔴 Critical)

**Evidence từ k6 warning log:**
```
WARN[1071] Request Failed
error="Get \"https://bella-spa-erp.vercel.app/api/health\": unexpected EOF"
```

**Root Cause:**

`unexpected EOF` trên Vercel endpoint là dấu hiệu của một trong hai nguyên nhân:

1. **Serverless function timeout**: Latency DB leo thang → Next.js handler block lâu hơn **maxDuration** được cấu hình → Vercel force-kill process → client nhận EOF.
2. **Cold start cascade**: Tại 200 VUs, nhiều serverless invocations bị cold start đồng thời. Cold start Next.js thường mất 500-2000 ms, tạo spike lớn tại đầu phase.

---

### 4.3. Bottleneck #3 — `biz_booking_check` N+1 / Heavy Query (Severity: 🟠 High)

**Evidence:** P95 nhảy từ 230 ms → 5,785 ms (tăng 25×) trong khi `biz_customer_read` chỉ nhảy từ 282 ms → ~900 ms (tăng ~3×). Độ chênh lệch cực lớn này cho thấy route `/api/bookings/check-ktv-availability` có query phức tạp hơn rất nhiều, có thể là N+1 queries (query therapist list → query từng session log của từng therapist).

---

## 5. Optimization Roadmap

### Sprint 1 — Database Connection (Priority: P0, Dự kiến: 1 ngày)

Đây là fix quan trọng nhất, không cần thay đổi business logic.

**5.1. Chuyển sang Supabase Connection Pooler (PgBouncer)**

Kiểm tra file `.env.local` / `.env.production`:

```bash
# HIỆN TẠI (Direct connection — mỗi serverless function mở 1 kết nối Postgres)
DATABASE_URL=postgresql://postgres:password@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres

# CẦN ĐỔI sang (PgBouncer Transaction Mode — tái sử dụng connection pool)
DATABASE_URL=postgresql://postgres.lvnvkpyxtuilhrabtlwv:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

> [!CAUTION]
> PgBouncer Transaction Mode **không hỗ trợ** `SET LOCAL`, `LISTEN/NOTIFY`, và Prepared Statements. Kiểm tra code Supabase client của dự án trước khi đổi.

**5.2. Thêm Index cho RLS Policy Scan**

Chạy migration SQL sau trên Supabase:

```sql
-- Index cho biz_customer_read (RLS scan on customers)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_id_status
  ON public.customers (tenant_id, status)
  WHERE status IS NOT NULL;

-- Index cho RLS auth function lookup (nếu dùng get_auth_tenant_id())
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_id_tenant
  ON public.users (id, tenant_id);

-- Index cho booking availability query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_logs_ktv_date
  ON public.session_logs (completed_by_ktv_id, session_date)
  WHERE completed_by_ktv_id IS NOT NULL;
```

---

### Sprint 2 — Booking Availability Cache (Priority: P1, Dự kiến: 2-3 ngày)

**5.3. Cache KTV/Therapist Availability trong Redis (Upstash)**

Route `/api/bookings/check-ktv-availability` query toàn bộ danh sách KTV của tenant rồi filter. Tại 200 VUs đồng thời, đây là 200 query nặng chạy song song.

```typescript
// src/app/api/bookings/check-ktv-availability/route.ts

import { redis } from '@/lib/redis'; // Upstash Redis client

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = /* từ session */;
  const date = searchParams.get('date');
  const time = searchParams.get('time');
  const duration = searchParams.get('duration');

  // Cache key: mỗi tenant + date + time + duration là 1 cache entry
  const cacheKey = `ktv:avail:${tenantId}:${date}:${time}:${duration}`;
  
  // 1. Thử đọc từ cache (TTL 30 giây — phù hợp với booking real-time)
  const cached = await redis.get(cacheKey);
  if (cached) {
    return Response.json(JSON.parse(cached as string), {
      headers: { 'X-Cache': 'HIT' }
    });
  }

  // 2. Cache miss → query DB
  const availableKtvs = await findAvailableKtvs(tenantId, date, time, duration);

  // 3. Lưu vào cache, TTL 30s
  await redis.setex(cacheKey, 30, JSON.stringify(availableKtvs));

  return Response.json(availableKtvs, {
    headers: { 'X-Cache': 'MISS' }
  });
}
```

---

### Sprint 3 — Vercel Serverless Tuning (Priority: P2, Dự kiến: 0.5 ngày)

**5.4. Tăng maxDuration cho API Routes nặng**

Trong `vercel.json`:

```json
{
  "functions": {
    "src/app/api/bookings/check-ktv-availability/route.ts": {
      "maxDuration": 30
    }
  }
}
```

**5.5. Warm-up Cache với `cache:warmup` script**

```bash
npm run cache:warmup
```

Script này đã tồn tại trong `package.json`. Lên lịch chạy cron 5 phút/lần trên Vercel Cron Jobs để tránh cold start spike.

---

## 6. Expected Impact After Optimization

| Optimization | Expected Effect | Metric Improved |
| :--- | :--- | :--- |
| PgBouncer Pooler | Giảm DB connections 10×, ngăn exhaustion | `biz_customer_read` P95 @ 200 VUs |
| RLS Indexes | Giảm RLS scan time ~50-80% | `biz_customer_read` P95 tất cả levels |
| Booking Cache (TTL 30s) | Giảm DB query 90%+ với repeated params | `biz_booking_check` P95 @ 100-200 VUs |
| maxDuration tăng | Ngăn premature EOF | `unexpected EOF` errors |

**Mục tiêu sau Sprint 1+2:**

| Metric | Hiện tại @200 VUs | Dự kiến @200 VUs sau fix |
| :--- | :---: | :---: |
| `biz_booking_check` P95 | 5,785 ms ❌ | **< 500 ms** 🟢 |
| `biz_customer_read` P95 | > 800 ms ❌ | **< 400 ms** 🟢 |
| HTTP Connection Errors | ⚠️ Resets | **0** 🟢 |

---

## 7. Performance Testing Roadmap (Next Steps)

| Bước | Test | Mục tiêu | Khi nào |
| :---: | :--- | :--- | :--- |
| ✅ | K6-3v2c (50 VUs baseline) | Xác lập baseline | Done |
| ✅ | K6-3v3 (100/200 VUs) | Tìm saturation point | Done |
| ⬜ | **Sprint 1+2 fixes** | Implement optimizations | Tuần tới |
| ⬜ | K6-3v4 (200 VUs re-test) | Xác nhận fix hiệu quả | Sau Sprint |
| ⬜ | K6-22 (50→500 VUs progression) | Vẽ full capacity curve | Sau re-test |
| ⬜ | K6-soak (2h @ 70 VUs) | Kiểm tra memory leak | Sau progression |

---

## 8. References

| Tài liệu | Đường dẫn |
| :--- | :--- |
| Baseline Report | [k6-3v2-baseline-report.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/results/k6-3v2-baseline-report.md) |
| Capacity Report | [k6-3v3-capacity-report.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/results/k6-3v3-capacity-report.md) |
| Baseline Script | [21-k6-3v2-authenticated-business.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/21-k6-3v2-authenticated-business.js) |
| Capacity Script | [23-k6-3v3-100-200vus.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/23-k6-3v3-100-200vus.js) |
| Progressive Scale Script | [22-capacity-progression.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/22-capacity-progression.js) |
| Soak Test Script | [16-soak-runner.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/16-soak-runner.js) |
