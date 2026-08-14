# Bella SPA ERP — Performance Gate & SLA Specifications

> **Scope:** Automated verification rules for release candidates and Pull Requests.

---

## 1. SLA Classification Matrix

Every endpoint in the system falls into one of three SLA Tiers based on user impact and resource intensity:

| Tier | Description | Target P95 | Target P99 | Example Endpoints |
|------|-------------|------------|------------|-------------------|
| **Tier 1 (Critical)** | Core transactional & auth paths. User-facing latency critical. | **≤ 300 ms** | **≤ 500 ms** | `/api/health`, `/api/auth/session`, `/api/bookings/check-ktv-availability` |
| **Tier 2 (Standard)** | Business queries, list reads, and typical CRUD mutations. | **≤ 600 ms** | **≤ 1000 ms** | `/api/customers`, `/api/bookings`, Direct REST queries to DB tables |
| **Tier 3 (Heavy)** | Financial recalculations, batch payroll, export jobs. | **≤ 3000 ms**| **≤ 5000 ms**| `/api/payroll/calculate`, `/api/finance/reconciliation/snapshot` |

---

## 2. Automated K6 Thresholds

To pass the **Performance Gate**, release builds must meet these thresholds under standard load conditions (50 VUs sustained for 10 minutes):

```javascript
export const options = {
  thresholds: {
    // 1. Transactional check latency
    "biz_booking_check": ["p(95)<=500", "p(99)<=800"],
    
    // 2. Direct database query / PostgREST latency
    "biz_customer_read": ["p(95)<=400", "p(99)<=700"],
    
    // 3. Infrastructure anchor
    "infra_health":      ["p(95)<=250", "p(99)<=400"],
    
    // 4. Maximum server error rate
    "business_server_errors": ["rate<0.01"],
    
    // 5. Zero authentication failures
    "business_auth_rejections": ["count==0"],
  }
};
```

---

## 3. CI/CD Performance Gate Integration

The Performance Gate is executed automatically on merge requests targeting `main`.

### Validation command

```bash
# 1. Run local mock environment
npm run dev &

# 2. Execute local smoke performance run
k6 run --vus 10 --duration 1m load-tests/scripts/22-capacity-progression.js
```

### Pull Request Blocking Policy

A PR will be blocked from merging if any of the following conditions are met:
1. **Error Rate Leak:** `business_server_errors` > 1% under baseline load.
2. **Auth Regressions:** `business_auth_rejections` > 0 (indicating broken token flow or RLS bypass).
3. **P95 Regression:** P95 latency of Tier 1 endpoints exceeds 500ms.
4. **Tenant Contention:** Variance of P95 response times between tenants exceeds 100ms (potential resource starvation or RLS lockups).
