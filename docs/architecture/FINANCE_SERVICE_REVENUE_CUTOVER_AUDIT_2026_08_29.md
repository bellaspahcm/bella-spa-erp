# Finance SERVICE_REVENUE Cutover Audit — 2026-08-29

> Scope: Accounting Configuration Foundation Phase 1 pilot.
>
> Status: `SERVICE_REVENUE` mapping architecture is proven, but production cutover is not complete.

## Decision

Do not remove the legacy `RECOGNIZE_REVENUE -> 4111` fallback yet.

The fallback remains a compatibility path for the pilot window only. It is not an accounting policy authority and must not be used to claim tenant-configured revenue mapping is fully cut over.

## Evidence

Remote official test/pre-production DB check:

| Mapping | Count |
|---|---:|
| `SERVICE_REVENUE` | 0 |
| `AR_CONTROL` | 29 |
| `PREPAYMENT_CONTROL` | 18 |

There are 1242 active tenants in the official test/pre-production DB. Since no tenant currently has `SERVICE_REVENUE` mapping, switching unconfigured tenants to `CONFIGURATION_REQUIRED` would be a breaking cutover.

Runtime dependency audit:

- `RECOGNIZE_REVENUE` is generated from `PATIENT_SERVICE_REVENUE` and `INSURANCE_SERVICE_REVENUE`.
- The active runtime path is `POST /api/finance/v1/events -> FinanceEventHandler -> DefaultCOAResolver`.
- `DefaultCOAResolver` is currently the only runtime resolver for `RECOGNIZE_REVENUE`.
- Test fixtures contain hardcoded revenue accounts, but they are not production cutover blockers unless they mirror runtime behavior.

E2E pilot evidence:

- Tenant A configured `SERVICE_REVENUE -> 5113`.
- Tenant B configured `SERVICE_REVENUE -> 5111`.
- The same `PATIENT_SERVICE_COMPLETED` runtime path posted revenue to each tenant-selected GL account.
- Verification: `finance-service-revenue-accounting-configuration-e2e.test.ts`.

## Current Behavior

```text
Configured tenant
        ↓
SERVICE_REVENUE contract mapping
        ↓
configured GL account

Unconfigured tenant
        ↓
legacy fallback
        ↓
4111
```

## Cutover Requirement

Before removing fallback, seed or configure `SERVICE_REVENUE` for all production-target tenants:

```text
SERVICE_REVENUE -> tenant-selected finance_accounts.code
```

Then update runtime behavior:

```text
Unconfigured SERVICE_REVENUE
        ↓
CONFIGURATION_REQUIRED
```

Required tests after cutover:

1. Tenant A maps `SERVICE_REVENUE` to `5113`.
2. Tenant B maps `SERVICE_REVENUE` to `5111`.
3. Historical effective date resolves deterministically.
4. Unconfigured tenant returns `CONFIGURATION_REQUIRED`.
5. No fallback to `4111`, `5111`, or `5113`.

## Boundary

Do not open additional semantics until this pilot cutover decision is made.

Do not migrate `GOODS_REVENUE`, `REVENUE_DEDUCTION`, `SALARY_EXPENSE`, `COGS`, `AR_CONTROL`, or `AP_CONTROL` in this checkpoint.
