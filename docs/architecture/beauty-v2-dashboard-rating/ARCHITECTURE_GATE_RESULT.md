# ARCHITECTURE GATE RESULT - BEAUTY V2 DASHBOARD KTV RATING REAL DATA FIX

> **Status:** PASS - dashboard UI consumer correction authorized
> **Date:** 2026-10-10
> **Scope:** Fix Beauty V2 dashboard rating widgets so KTV leaderboard null ratings render as no-data and customer star distribution comes from approved `session_reviews` instead of hardcoded placeholder percentages.

## Bella OS/Product Development Process Gate

- Truth: KTV leaderboard rating is the `get_ktv_leaderboard.average_rating` composite. SQL contract returns `NULL` when a KTV has no sessions and no attendance records, so UI must not coerce it to `0`.
- Source of Truth: `supabase/migrations/20260527000000_ktv_leaderboard_blended_rating.sql`, generated `get_ktv_leaderboard` function type, and read-only Supabase evidence for tenant `Beauty Spa Franchise Demo - TEST` / branch `Bella Spa HCM`.
- Canonical Contract: Dashboard product UI consumes tenant-scoped analytics actions; customer rating distribution is derived from approved `session_reviews` in the selected month.
- Gate result: `PASS` for Product UI/read-model consumer correction only.

## Product Manifest

- Product: Bella Beauty Spa V2 (`bella_spa`) dashboard.
- Capability in scope: Dashboard KTV rating KPI, Top KTV table rating display, and customer star distribution card.
- Existing capabilities reused: `get_ktv_leaderboard`, `session_reviews`, `getDashboardPrimaryData`, and existing dashboard realtime refresh on `session_reviews`.
- Non-goals: no schema change, no RPC/function change, no ProductRegistry change, no Healthcare/Education/Logistics kernel work, no production data mutation.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| `get_ktv_leaderboard` composite rating | Beauty/Payroll analytics DB contract | consume only |
| Approved customer review rows | Product review persistence (`session_reviews`) | read only |
| Dashboard data bundling | Analytics service action | may extend view model |
| Beauty dashboard rendering | Product UI | may correct rendering |
| Frozen Healthcare/Education/Logistics kernels | OS kernels | not modified |

## Contract Dependency Map

```text
/dashboard Beauty V2 UI
  -> getDashboardPrimaryData(selected month)
  -> getDashboardStats / getCustomerRatingDistribution / getUpcomingSessions / inventory
  -> session_reviews(status='approved', rating 1..5, tenant_id, created_at month)
  -> BeautySpaV2DashboardView renders actual percentages or 0%

/dashboard Top KTV
  -> getTopTechnicians()
  -> get_ktv_leaderboard(p_tenant_id, current month)
  -> average_rating NULL means no rating data
  -> UI renders "-" instead of 0
```

## Change Authority

Authorized:
- Modify `src/core/services/analytics/dashboard-actions.ts`.
- Modify dashboard containers that coerce KTV ratings.
- Modify `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`.
- Add focused tests for no-data rating and customer distribution behavior.

Not authorized:
- Modify SQL functions, migrations, generated types, RLS, ProductRegistry, auth, frozen kernels, or production data.
- Invent review rows or placeholder percentages.

## UI -> Contract Reconciliation

| UI element | Current state | Correct contract |
|---|---|---|
| Top KTV `0` rating for inactive KTV | Consumer coerces `NULL` to `0` | Render no-data when `average_rating` is `NULL` |
| Top KTV status for inactive KTV | `0` becomes `Tốt` | Render no-data status |
| Customer rating bars | Hardcoded `82/12/4/1/1` | Compute percentages from approved `session_reviews` |
| Customer headline rating | Already uses dashboard `avgRating` | Keep existing value and no-data semantics |

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: confirm only dashboard UI/service/test/gate files changed.
2. Contract Boundary: consume existing RPC and `session_reviews`; no contract invention.
3. Tenant Isolation: every query keeps `tenant_id = currentUser.tenant_id`.
4. RLS & Authorization: server action continues to use current user tenant; no service-role bypass in runtime.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, or kernel route touched.
8. Type Safety: no `any`, generated type edit, or suppression added.
9. UI Evidence Integrity: no hardcoded customer-rating percentages.
10. Regression: focused rating/dashboard tests.
11. Runtime Evidence: read-only DB evidence remains separate from code tests; no production mutation.
