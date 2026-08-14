# Bella Spa ERP - Performance Baseline Report (k6-3v2c)

**Date:** August 14, 2026  
**Test Suite:** Multi-Tenant Authenticated Business Workload (`21-k6-3v2-authenticated-business.js`)  
**Execution Environment:** Staging (Singapore Region)  
**System Status:** **PASSED (Baseline Established - Ready for Progressive Scaling)**

---

## 1. Executive Summary

This report establishes the performance baseline for Bella Spa ERP's core authenticated business APIs. The test ran for **30 minutes** under a peak load of **50 concurrent Virtual Users (VUs)**, distributing transaction threads across four isolated test tenants representing the primary vertical domains (Healthcare OS, Hospital, Education, and Real Estate).

The system achieved a **100% success rate** with **zero HTTP errors** out of **110,740 requests** (peak throughput of **121.08 req/s**). The overall P95 latency was **206 ms**, which is well below the target service level agreement (SLA) of 500 ms. 

---

## 2. Test Scope & Configuration

The script [21-k6-3v2-authenticated-business.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/21-k6-3v2-authenticated-business.js) was configured with the following parameters:

*   **Virtual Users (VUs):** Up to 50 concurrent VUs.
*   **Tenants under Test:**
    1.  Healthcare OS (`loadtest-healthcare@test.local`, ID: `60135a61-...`)
    2.  Hospital (`loadtest-hospital@test.local`, ID: `ef4c035e-...`)
    3.  Education (`loadtest-education@test.local`, ID: `152ff24c-...`)
    4.  Real Estate (`loadtest-realestate@test.local`, ID: `1a6643da-...`)
*   **API Interactions:**
    *   `biz.customer_read`: Direct GET to Supabase PostgREST REST API with authenticated JWT to trigger and test Row-Level Security (RLS) query scanning overhead.
    *   `biz.booking_check`: GET to Next.js handler (`/api/bookings/check-ktv-availability`) simulating therapist and room availability calculations.
    *   `infra.health`: GET to `/api/health` as an unauthenticated system anchor.

### Test Phases (30-Minute Schedule)

| Scenario / Phase | Start Time | Duration | VU Count | Purpose / Workload | Requests Completed |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **warmup** | 0s | 5m | 4 VUs | Baseline connection initialization (1 VU/tenant) | ~2,700 |
| **sla_check** | 5m | 10m | 20 VUs | Standard operations SLA validation (5 VUs/tenant) | ~28,500 |
| **capacity_50** | 15m | 10m | 20 $\rightarrow$ 50 VUs | Multi-tenant concurrency peak (~12 VUs/tenant) | ~65,100 |
| **cooldown** | 25m | 5m | 20 VUs | High-load recovery check (5 VUs/tenant) | ~14,300 |

---

## 3. Performance Metrics Analysis

All 7/7 SLO thresholds passed. Below is the detailed breakdown of latencies observed by scenario and API endpoint:

### 3.1. Threshold Matrix

| Metric Name & Target Gate | Limit | Actual P95 | Status |
| :--- | :---: | :---: | :---: |
| `biz_customer_read` (SLA Check phase) | $\le$ 500 ms | **92 ms** | 🟢 **Pass** |
| `biz_customer_read` (Capacity 50 phase) | $\le$ 700 ms | **282 ms** | 🟢 **Pass** |
| `biz_booking_check` (SLA Check phase) | $\le$ 500 ms | **65 ms** | 🟢 **Pass** |
| `biz_booking_check` (Capacity 50 phase) | $\le$ 700 ms | **230 ms** | 🟢 **Pass** |
| `infra_health` (SLA Check phase) | $\le$ 300 ms | **48 ms** | 🟢 **Pass** |
| `business_server_errors` (5xx rate) | < 1.00% | **0.00%** | 🟢 **Pass** |
| `business_auth_rejections` (401/403) | 0 failures | **0** | 🟢 **Pass** |

> [!NOTE]
> * **SLA Check vs. Capacity Latencies:** The `biz_customer_read` P95 latency increased from **92 ms** to **282 ms** when scaling from 20 VUs to 50 VUs. This indicates that Row-Level Security (RLS) evaluation on Supabase experiences progressive degradation as concurrent DB queries scale.
> * **Path Latency Variations:** `biz_booking_check` at peak was **230 ms** due to the Next.js API routing layer parsing overhead and multi-query validation logic.

---

## 4. Key Engineering Insights

1. **RPS is Not Capacity:** The peak throughput of **121.08 RPS** achieved during the test must not be interpreted as the maximum capacity of Bella Platform. It is simply the throughput produced by 50 VUs executing requests with a 1-second pacing sleep. The true saturation point must be identified using a progressive ramp test.
2. **P95 Metric Segregation:** To prevent misinterpretation, P95 metrics should not be combined into a single general number (e.g., Overall P95 of 206 ms). The report explicitly separates direct database queries via PostgREST (`customer_read` = 282 ms) from application route checks (`booking_check` = 230 ms).
3. **Soak Duration and Memory Leaks:** While 30 minutes is sufficient to verify baseline connection pooling and basic route stability, it is not a true soak test. Identifying deep heap leaks or DB connection exhaustion requires a sustained soak test of 1 to 4 hours.

---

## 5. Next Steps Plan

To validate production readiness, the technical team will execute the following two phases:

### Phase A: Saturation Curve Mapping
Run the [22-capacity-progression.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/22-capacity-progression.js) script to perform a controlled progressive scale:
$$\text{50 VUs (Warmup)} \rightarrow \text{100 VUs} \rightarrow \text{200 VUs} \rightarrow \text{300 VUs} \rightarrow \text{500 VUs (Peak)} \rightarrow \text{50 VUs (Cooldown)}$$
This will measure the saturation knee (where latency rises non-linearly) and locate the breaking limit.

### Phase B: Extended Soak Validation
Run [16-soak-runner.js](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/load-tests/scripts/16-soak-runner.js) with a custom duration:
```powershell
# Execute a 2-hour soak test to audit memory leaks and database connection pool release
k6 run -e SOAK_DURATION=2h load-tests/scripts/16-soak-runner.js
```
During this test, backend telemetry (Vercel memory footprint, Supabase active database connections, CPU profiles) must be actively monitored.
