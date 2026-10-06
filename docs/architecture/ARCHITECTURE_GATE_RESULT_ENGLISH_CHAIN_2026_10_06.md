# Architecture Gate Result - English Chain Product Identity Integration

> **Status:** PASS - minimal Product Registry integration authorized
> **Date:** 2026-10-06
> **Scope:** Verify and integrate Bella English Center into the canonical Product Identity chain without modifying the frozen Education Kernel, Healthcare Kernel, Logistics Kernel, schema, or product runtime services.

## 1. Bella OS/Product Development Process Gate

Truth: product identity is resolved through `tenants.product_key -> ProductRegistry -> ProductDefinition`. English Center already has product-owned APIs, dashboards, repositories, tables, and bounded evidence records, but the current Product Registry does not register an English Center product key.

Source of Truth:
- `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`
- `docs/governance/OPERATIONAL_READINESS_SOP.md`
- `src/platform/registry/product-registry.ts`
- `src/platform/registry/product-resolver.ts`
- `docs/products/bella-english-center/STATUS.md`
- `docs/products/bella-english-center/E10_PRODUCT_RECONCILIATION_RC.md`

Canonical Contract:

```text
Tenant.product_key
  -> ProductRegistry.get(product_key)
  -> ProductDefinition.defaultRoute / requiredModules / serviceProfile
  -> UserProvider.product / PWA / dashboard consumers
```

Gate result: `PASS` for a product identity registry addition plus focused registry/resolver tests. This gate does not authorize Education Kernel, Healthcare Kernel, Logistics Kernel, database schema, onboarding, Finance, Payroll, or broad UI changes.

## 2. Product Manifest

| Field | Decision |
|---|---|
| Product key | `bella_english_center` |
| Display name | `Bella English Center` |
| Required modules | `bella_education` |
| Service profile | `english_center` |
| Default route | `/dashboard/english-center` |
| Navigation profile | `english-center` |

Capabilities observed in current product surface:
- Enrollment and activation (`/api/english-center/enrollments`, dashboard enrollment pages).
- Program/course/class management.
- Teacher and branch assignment.
- Timetable and rooms.
- Attendance and learning operations.
- Tuition and billing.
- Engagement.
- Chain command center.

Finance/Payroll expansion is not part of this integration. Tuition/billing remains bounded English product evidence unless a separate Finance outbox/fact chain is selected and proven.

## 3. Ownership Map

| Data / Capability | Owner | Decision |
|---|---|---|
| `tenant.product_key` | Platform tenant identity | Consume as canonical product selector |
| Product definition | Product Registry | Add English product identity |
| `bella_education` capability module | Education product/platform module catalog | Reuse as required module |
| Education contracts | Frozen Education Kernel public contracts | Consume only; no source modification |
| English Center product tables | Bella English Center product | Existing product-owned tables remain unchanged |
| `org_units`, `user_org_unit_access` | Platform Org Unit / Authorization | Existing chain/branch dependency, consume only |

## 4. Contract Dependency Map

```text
English tenant row
  -> tenants.product_key = 'bella_english_center'
  -> ProductRegistry.getRequired('bella_english_center')
  -> ProductDefinition(requiredModules=['bella_education'])
  -> defaultRoute '/dashboard/english-center'
  -> existing English Center UI/API/product services
  -> Education public contracts and product-owned persistence
```

## 5. Change Authority

Authorized:
- Add `bella_english_center` Product Registry definition.
- Register it during Product Registry initialization.
- Add focused Product Registry and Product Resolver tests.
- Record this architecture gate.

Not authorized:
- Modifying `src/platform/education/`.
- Modifying Healthcare H1-H12, Logistics E7.1-E7.3, or frozen kernel artifacts.
- Creating schema migrations or editing generated DB types.
- Changing onboarding/HQ registration flow.
- Creating product-local replacements for Education OS contracts.
- Claiming browser, Real DB, production, Finance, or Payroll PASS unless fresh evidence is run.

## 6. UI -> Contract Reconciliation

| UI / consumer | Expectation | Canonical contract | Conclusion |
|---|---|---|---|
| `/dashboard/english-center` | English Center default landing route | `ProductDefinition.defaultRoute` | MATCH after registry addition |
| English API/dashboard pages | Product-specific surface exists | Existing English Center routes/services | MATCH for code presence; runtime evidence must be verified separately |
| UserProvider product display | Resolve tenant product from `product_key` | `ProductResolver.tryResolve()` | STALE CONSUMER before registry addition; MATCH after registry addition |
| Finance/Payroll | Not requested for this chain | No fresh English Finance/Payroll chain evidence in this scope | DEFERRED / NOT_PROVEN |

## 7. Additive Migration Plan

No migration. No schema change. No data mutation. No generated type edit.

## 8. 11 Automated Verification Gates Plan

1. Architecture Compliance: no Education, Healthcare, Logistics, or Core frozen source changes.
2. Contract Boundary: product identity stays `tenant.product_key -> ProductRegistry`, not `enabled_modules`.
3. Tenant Isolation: unchanged; product identity resolution does not query cross-tenant data.
4. RLS & Authorization: unchanged; runtime DB paths still rely on existing English/Platform policies.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no event behavior changed.
7. Academic Safety Routing: unchanged; Education public contracts remain the only allowed kernel path.
8. Temporal Provenance: unchanged.
9. Rule Governance: unchanged.
10. Audit Evidence Integrity: focused unit tests prove identity contract; operational evidence remains separate.
11. Platform Regression: run targeted registry tests, English product regression where feasible, architecture/education gates, and `git diff --check`.

## 9. Current Decision Boundary

```text
ENGLISH_PRODUCT_IDENTITY_CHAIN = PROVEN_BY_FOCUSED_REGISTRY_TESTS after tests pass
ENGLISH_OPERATIONAL_CHAIN      = NOT_PROVEN until fresh Real DB/browser evidence runs
ENGLISH_FINANCE_PAYROLL_CHAIN  = DEFERRED / NOT_PROVEN in this scope
```

Minimal implementation may proceed only for Product Registry integration and focused tests.

## 10. Verification Evidence

```text
npm test -- src/platform/registry/__tests__/product-registry.test.ts src/platform/registry/__tests__/product-resolver.test.ts --runInBand
  PASS: 2 suites, 73 tests

npm run typecheck:changed
  PASS: TypeScript scope "full" passed with zero diagnostics

npm run arch:guard
  PASS: Architecture Guard all checks passed

git diff --check
  PASS

npm test -- src/products/bella-english-center/__tests__ --runInBand
  PARTIAL: 6 suites PASS / 44 tests PASS
  NOT_PROVEN: 3 Real DB suites fail-fast with REAL_DB_ENV_REQUIRED because the current environment is mock Supabase

npm run education:conformance:ci
  ALLOW_WITH_INFRASTRUCTURE_ATTRIBUTION: Supabase URL/service role unavailable

npm run education:architecture
  BASELINE_FAIL_OUT_OF_SCOPE: broad existing Bella Education direct-DB violations under src/products/bella-education; no touched file appears in that failure

npm run check:any-types
  BASELINE_FAIL_OUT_OF_SCOPE: 91 existing any-type violations in 21 files; no touched file appears in that failure
```

Updated decision:

```text
ENGLISH_PRODUCT_IDENTITY_CHAIN = PROVEN_BY_FOCUSED_REGISTRY_TESTS
ENGLISH_OPERATIONAL_CHAIN      = NOT_PROVEN in this worktree without real Supabase/browser evidence
ENGLISH_FINANCE_PAYROLL_CHAIN  = DEFERRED / NOT_PROVEN in this scope
```
