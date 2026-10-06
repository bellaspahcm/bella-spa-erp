# Architecture Gate Result - PR 235 Fixes - 2026-10-06

## Result

PASS

## Problem / Non-goals

Problem: PR #235 is blocked by one failed real database E2E suite and review findings in HQ UI/Core tenant context behavior.

Non-goals:
- No schema, migration, RPC, API, or public contract change.
- No Healthcare, Education, Logistics, Finance, or Kernel capability change.
- No new product vertical or cross-scope refactor.

## Truth and Source of Truth

| Topic | Truth | Source of Truth |
| --- | --- | --- |
| HQ tenant context fallback | Production must not receive dev fallback context on auth/error/timeout. | `docs/architecture/acr/ACR-2026-017-hq-tenant-context-abort-fallback.md` and `src/core/providers/TenantContextProvider.tsx` |
| HQ branch UI data | Branch UI must not display fabricated phone, address, staff, customer, revenue, status, module, tier, or count data. | `src/types/domain.ts`, `src/services/hq-actions.ts`, and `src/app/hq/components/HqBranchTable.tsx` |
| Financial overview source | Consolidated P&L rows provide tenant id/name/revenue/bookings/sessions/profit fields only. They do not prove tenant phone/address/status/module/tier/staff. | `ConsolidatedPnLRow` in `src/services/hq-actions.ts` |
| Bella Auto E2E template lookup | NPS/CSI services query active `auto_survey_templates` by tenant, type, and trigger using the primary client. The real-DB fixture must provide an isolated tenant/template set. | `src/modules/bella-auto/services/NPSSurveyService.ts`, `src/modules/bella-auto/services/CSISurveyService.ts`, and `src/__tests__/bella-auto-phase5-experience.test.ts` |

## Ownership Map

| Capability / Data | Owner | This change |
| --- | --- | --- |
| Tenant context bootstrap | Platform Core | Guard fallback to non-production only and keep production auth/error behavior strict. |
| HQ branch list presentation | HQ Product UI | Render only proven values; show unknown/empty states when a field is not present. |
| Consolidated P&L mapping | HQ Product UI consumer | Map only P&L-proven values into presentation records. |
| Bella Auto survey fixture | Bella Auto test fixture | Use an isolated tenant per run to avoid real DB fixture drift. |

## Contract Dependency Map

```text
HQ UI -> HqTenantRecord / ConsolidatedPnLRow -> hq-actions -> Supabase RPC/table contracts
TenantContextProvider -> /api/tenant/context -> TenantContext
Bella Auto test -> NPSSurveyService / CSISurveyService -> auto_survey_templates
```

## Change Authority

User request: fix PR #235 blockers.

Authorized layers:
- Product UI consumer mapping for HQ PR-introduced false data.
- Core provider fallback guard already covered by ACR-2026-017 approved file scope.
- Test fixture isolation for the failing Bella Auto real DB E2E suite.

Not authorized:
- New database contract.
- New API/RPC.
- Kernel or vertical domain behavior change.

## UI to Contract Reconciliation

| UI element | UI expectation | Canonical contract | Backend reality | Conclusion |
| --- | --- | --- | --- | --- |
| Branch phone/address | Display branch contact/location. | `HqTenantRecord.contact_phone/address`. | P&L rows do not provide these fields. | STALE UI - render unknown instead of fake values. |
| Staff count | Display staff count. | `HqTenantRecord.staffCount`. | P&L rows do not provide staff count. | STALE UI - render 0/unknown from record only. |
| Customer/bookings count | Display count. | `HqTenantRecord.customerCount` or P&L `total_bookings_count`. | P&L proves bookings count, not synthetic customer total. | MAPPING BUG - map P&L count explicitly as performance count only. |
| Revenue | Display revenue. | `HqTenantRecord.revenueSum` or P&L `net_revenue`. | P&L proves net revenue. | MATCH. |
| Status/module/tier filters | Filter by real tenant metadata. | Tenant metadata fields. | P&L rows do not prove metadata. | STALE UI - unknown metadata must not match specific filters. |
| Zero-result filters | Show no rows. | Filtered collection. | PR fallback showed all rows when filtered length was zero. | MAPPING BUG. |

## Additive Migration Plan

None. No database migration is required.

## Verification Plan

1. `npm run test:real-db-e2e -- --runTestsByPath src/__tests__/bella-auto-phase5-experience.test.ts --runInBand`
2. Targeted Jest/unit checks for HQ provider/actions if available.
3. `npm run type-check` or PR CI Type Check.
4. Relevant architecture guards from CI after push.

