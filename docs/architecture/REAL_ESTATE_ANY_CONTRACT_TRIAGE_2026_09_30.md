# Real Estate Any Contract Triage

Date: 2026-09-30
Status: INVENTORY COMPLETE - NO PRODUCTION CODE CHANGES

## Summary

After Production Batch P1-D, the production invariant reports 74 remaining violations. Real Estate accounts for 18 of them.

This triage did not modify Real Estate runtime/product code. It only classified each Real Estate violation by contract evidence.

```text
Real Estate total                         18

Can be candidate for small follow-up       9
Requires contract/governance decision      9
```

## Evidence Sources

```text
src/__tests__/invariants/production-runtime-integrity.test.ts
src/types/database.types.ts
supabase/migrations/20260802120000_real_estate_partner_portal.sql
supabase/migrations/20260802150000_real_estate_core_schema.sql
supabase/migrations/20260802151000_real_estate_rpc_functions.sql
src/app/dashboard/real-estate/**
src/platform/real-estate/**
src/modules/real_estate/**
```

Confirmed generated Database contracts exist for:

```text
src/types/database.types.ts:27114  re_contracts
src/types/database.types.ts:27629  re_reservations
src/types/database.types.ts:28039  real_estate_products
src/types/database.types.ts:36139  Real Estate enums
```

But the generated contract and migration history are not perfectly aligned:

- `real_estate_products.unit_code` exists in `supabase/migrations/20260802150000_real_estate_core_schema.sql`, but is absent from `src/types/database.types.ts`.
- `re_reservations.status` in generated types uses `re_reservation_status = active | released | expired | converted`.
- Separate core schema evidence uses `reservation_status = pending_deposit | deposited | converted_to_contract | cancelled`.
- `re_contracts` generated type has `contract_number` and `state`, while `property.service.ts` still writes `contract_no` and `status`.

## Classification Totals

| Classification | Count | Decision |
|---|---:|---|
| UI literal narrowing / type-local | 8 | Candidate for small follow-up batch |
| Generated-aligned local cleanup | 1 | Candidate for small follow-up batch |
| Generated Database drift | 2 | DEFER until generated/schema source of truth is refreshed |
| Product status contract reconciliation | 2 | DEFER pending Real Estate state-contract decision |
| Contract table/field mismatch | 4 | DEFER pending `re_contracts` canonical contract decision |
| Reservation status semantic mismatch | 1 | DEFER pending reservation model decision |

## Detailed Inventory

| # | File | Line | Pattern | Existing canonical contract? | Classification | Recommended action |
|---:|---|---:|---|---|---|---|
| 1 | `src/app/dashboard/real-estate/apartments/page.tsx` | 561 | `(u: any)` | Yes: `ProductRow` already inferred from `floorGroups: Record<string, ProductRow[]>` | UI literal/type-local | Candidate. Remove explicit `any`; do not change data flow. |
| 2 | `src/app/dashboard/real-estate/contracts/page.tsx` | 587 | `tab.id as any` | Yes: local `domainTab` union exists in same file | UI literal/type-local | Candidate. Use typed tab array or local type guard. |
| 3 | `src/app/dashboard/real-estate/customers/page.tsx` | 1011 | `tab.id as any` | Yes: local `drawerTab` union exists in same file | UI literal/type-local | Candidate. Use typed tab array or local type guard. |
| 4 | `src/app/dashboard/real-estate/documents/page.tsx` | 1181 | `tab.id as any` | Yes: local `drawerTab` union exists in same file | UI literal/type-local | Candidate. Use typed tab array or local type guard. |
| 5 | `src/app/dashboard/real-estate/reports/page.tsx` | 257 | `tab.id as any` | Yes: `ReportCategoryFilter` exists in same file | UI literal/type-local | Candidate. Use typed tab array or local type guard. |
| 6 | `src/app/dashboard/real-estate/marketing/page.tsx` | 930 | `val as any` for campaign channel | Yes: `CampaignItem['channel']` exists in same file | UI literal/type-local | Candidate. Use typed options or guard before setter. |
| 7 | `src/app/dashboard/real-estate/marketing/page.tsx` | 1020 | `val as any` for agency tier | Yes: `AgencyItem['tier']` exists in same file | UI literal/type-local | Candidate. Use typed options or guard before setter. |
| 8 | `src/app/dashboard/real-estate/leads/page.tsx` | 467 | `newLead.source as any` | Yes: `LeadItem['source']` exists in same file | UI literal/type-local | Candidate. Type `newLead.source` as `LeadItem['source']` or guard on create. |
| 9 | `src/platform/real-estate/engines/reservation.service.ts` | 54 | `'active' as any` | Yes: generated `re_reservation_status` includes `active` | Generated-aligned local cleanup | Candidate. Remove cast or use generated enum alias. |
| 10 | `src/platform/real-estate/repositories/property-unit.repository.ts` | 93 | `(data as any).unit_code` | Partial: migration has `unit_code`, generated `Database` does not | Generated Database drift | DEFER. Refresh/repair generated Database contract from canonical schema before code cleanup. |
| 11 | `src/platform/real-estate/repositories/property-unit.repository.ts` | 144 | `(item as any).unit_code` | Partial: migration has `unit_code`, generated `Database` does not | Generated Database drift | DEFER. Same as row 10. |
| 12 | `src/platform/real-estate/repositories/property-unit.repository.ts` | 96 | `data.status as any` | Yes but mismatched: generated enum includes `held`; mapper does not accept it | Product status contract reconciliation | DEFER. Decide DB enum to domain status mapping before changing. |
| 13 | `src/platform/real-estate/repositories/property-unit.repository.ts` | 147 | `item.status as any` | Yes but mismatched: generated enum includes `held`; mapper does not accept it | Product status contract reconciliation | DEFER. Same as row 12. |
| 14 | `src/platform/real-estate/engines/property.service.ts` | 42 | `(this.supabase as any)` insert to `re_contracts` | Yes but mismatched: generated `re_contracts` lacks `contract_no` and `status` | Contract table/field mismatch | DEFER. Choose canonical `contract_number/state` vs legacy compatibility path. |
| 15 | `src/platform/real-estate/engines/property.service.ts` | 62 | `data as any` | Yes but row normalization depends on non-generated `status/contract_no` compatibility | Contract table/field mismatch | DEFER. Remove only after contract row shape is reconciled. |
| 16 | `src/platform/real-estate/engines/property.service.ts` | 75 | `(this.supabase as any)` select from `re_contracts` | Yes but downstream reads legacy-compatible fields | Contract table/field mismatch | DEFER. Needs same contract decision as row 14. |
| 17 | `src/platform/real-estate/engines/property.service.ts` | 101 | `(this.supabase as any)` update `re_contracts` | Yes but update writes `status` absent from generated type | Contract table/field mismatch | DEFER. Needs same contract decision as row 14. |
| 18 | `src/platform/real-estate/engines/reservation.service.ts` | 91 | `'cancelled' as any` | No single canonical answer: generated `re_reservation_status` excludes `cancelled`; core schema `reservation_status` includes it | Reservation status semantic mismatch | DEFER. Decide whether platform service owns partner-portal `released` semantics or core `cancelled` semantics. |

## Candidate Batch

If implementation is authorized later, the safest next batch is:

```text
REAL_ESTATE_ANY_BATCH_RE1

Scope:
- 8 UI literal narrowing violations
- 1 generated-aligned reservation `active` cast

Expected removal:
9 violations
0 DB schema changes
0 generated type changes
0 runtime behavior change intended
```

Suggested verification for that future batch:

```text
targeted scan for the 9 files/lines
targeted ESLint for touched files
targeted Real Estate tests if present
git diff --check
production-runtime-integrity expected fail with 65 remaining baseline
```

## Deferred Contract Work

Do not fix these by inventing local DTOs or fake generated types:

```text
2  real_estate_products.unit_code generated Database drift
2  re_product_status / PropertyUnitStatus mapper mismatch
4  re_contracts generated-vs-legacy field mismatch
1  re_reservations released-vs-cancelled semantic mismatch
```

These require a Real Estate contract/schema decision first.

## Decision

```text
Real Estate triage = COMPLETE
Production code changes = NONE
Commits = NONE

Next safe implementation candidate = RE1, 9 violations
Contract/governance deferred = 9 violations
```
