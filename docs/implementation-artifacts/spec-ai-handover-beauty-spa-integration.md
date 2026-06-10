# AI Agent Handover: Bella ERP – Beauty Spa Integration
> **Last Updated:** 2026-06-09  
> **Test Status:** ✅ 122 suites / 1194 tests — 100% GREEN  
> **System Score:** 91/100 (from `bella_erp_audit_update.md`)

---

## 1. Purpose of This Document

This file preserves full working context for any AI Agent (or human developer) resuming work on the **Bella ERP** codebase. Read this before touching any module file.

**Cross-reference documents:**
- `docs/index.md` — master documentation index
- `docs/AI_AGENT_ONBOARDING.md` — agent-specific onboarding rules
- `docs/KNOWLEDGE_STORAGE_PROCESS.md` — how to store new discoveries
- `C:\Users\DELL\.gemini\antigravity-ide\brain\a8d89a78-6de3-448d-a0c1-af660df5b236\bella_erp_audit_update.md` — last full system audit

---

## 2. Current Architecture Overview

### 2.1 Multi-Tenant Module System

Bella ERP is a **multi-module SaaS ERP** serving two distinct business verticals:

| Module Key | Business | Default |
|---|---|---|
| `babycare` | Chăm sóc Mẹ & Bé (the original product) | `true` |
| `beauty_spa` | Beauty Spa / Thẩm mỹ viện | `false` — must be enabled by HQ Admin |

**Source of truth:** `src/lib/business-rules/tenant-modules.ts`

```typescript
// Core type definitions
export const TENANT_MODULE_KEYS = ['babycare', 'beauty_spa'] as const;
export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];
export type TenantEnabledModules = Record<TenantModuleKey, boolean>;

// Default: babycare ON, beauty_spa OFF
export const DEFAULT_ENABLED_MODULES: TenantEnabledModules = {
  babycare: true,
  beauty_spa: false,
};
```

**Key invariants:**
- `normalizeEnabledModules(null)` returns `DEFAULT_ENABLED_MODULES` (babycare: true)  
- If a tenant JSON has no explicit module keys, it defaults to babycare
- `normalizeEnabledModulesForSave()` ensures at least one module is always enabled

### 2.2 Tenant Module Isolation Guard

**All Beauty Spa tenant setups require HQ Admin authorization.** The guard is in `src/services/onboarding-actions.ts`:

```typescript
// Line 69 — Only runs when moduleKey !== 'babycare'
async function assertBusinessModuleSetupAllowed(moduleKey: RegisterTenantBusinessModule) {
  if (moduleKey === 'babycare') return null;
  const hqAuth = await checkHqAuth();
  return hqAuth.authorized ? null : BEAUTY_SPA_HQ_ONLY_ERROR;
}
```

**Enabled modules are set POST-onboarding** (after the base RPC `onboard_tenant` completes):
```typescript
// Lines 208-212 in onboarding-actions.ts
if (businessModule === 'beauty_spa') {
  postOnboardingUpdate.enabled_modules = toTenantModuleJson(
    getEnabledModulesForBusinessModule(businessModule),  // { babycare: false, beauty_spa: true }
  );
}
```

---

## 3. Beauty Spa – Database Schema (Phase 2 Foundation)

**Migration file:** `supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql`

### Key Design Decisions (do NOT reverse these)

1. **No separate `beauty_services` table** — Beauty Spa services are stored in the **shared `packages` table** with a `module_key` column:
   ```sql
   ALTER TABLE public.packages
   ADD COLUMN IF NOT EXISTS module_key TEXT DEFAULT 'babycare'
   CHECK (module_key IN ('babycare', 'beauty_spa'));
   ```

2. **`service_kind` column** added to `packages`:
   ```sql
   CHECK (service_kind IN ('single_service', 'treatment_package', 'retail_product', 'consultation'))
   ```

3. **`booking_resources` table** — new, tenant-scoped schedulable resources (beds, rooms, machines):
   ```sql
   CREATE TABLE IF NOT EXISTS public.booking_resources (
     -- resource_type: 'bed' | 'room' | 'machine' | 'chair' | 'other'
     -- status: 'available' | 'in_use' | 'maintenance' | 'inactive'
   );
   ```
   - Has RLS enabled with `public.get_auth_tenant_id()` policy
   - `REVOKE ALL FROM anon` — no anonymous access
   - Tested in `src/__tests__/beauty-spa-phase2-schema.test.ts`

### Package Module Scope Guard

**Every booking** that involves a package must pass `validateBookingPackageScope()` in `src/modules/booking/actions/create-booking-helpers.ts`:

```typescript
// Guard rules (tested in booking-package-module-scope.test.ts):
// ✅ No package_id → allowed immediately (no DB query)
// ✅ Same tenant + matching module_key → allowed
// ❌ Cross-module package (e.g., babycare pkg on beauty_spa tenant) → blocked
// ❌ Cross-tenant package → blocked
```

---

## 4. Session Completion Engine (Critical Path)

**All KTV checkout / session completion MUST route through the centralized engine.**

```
completeSession() [session-actions.ts]
  └─> completeSession() [complete-session-action.ts]
        └─> processSessionCompletion() [session-completion-engine.ts]
              ├─> autoConsumeForSession()       → inventory deduction
              ├─> recalculateAndSaveSalaryRecord()  → salary update (uses session_multiplier)
              ├─> enqueueWithAutoClient()        → accounting outbox (SESSION_DONE)
              └─> recordAuditLog()              → audit trail
```

**Never add a separate checkout path.** The commit `aa0811d3` ("Route KTV checkout through completion engine") fixed a bug where checkout was bypassing this engine. Do not revert that pattern.

**Error handling contract:**
```typescript
// On engine failure, completeSession rolls back status and logs:
console.error('[completeSession] Failed to process session completion, rolling back status:', result.error);
// This console.error is intentional — it is NOT a silent failure.
// The function returns { error: result.error } to the caller.
```

---

## 5. Test Suite Architecture

### 5.1 Status
- **122 test suites, 1194 tests — ALL PASSING**
- Run with: `npx jest --passWithNoTests`

### 5.2 MockQueryBuilder Pattern

Most tests use custom mock Supabase clients. The `MockQueryBuilder` must support these methods to avoid failures in health monitoring and preflight checks:

```typescript
// Required methods on MockQueryBuilder (from finance.lockMonth.test.ts, business-health.test.ts):
select()   // returns this
eq()       // returns this  
neq()      // returns this
in()       // returns this
order()    // ← REQUIRED for accounting preflight checks (added in this session)
limit()    // ← REQUIRED for franchise-royalty and inter-branch-clearing checks
single()   // returns Promise<{ data, error }>
```

**Pattern for creating a mock:**
```typescript
class MockQueryBuilder {
  private filters: Record<string, unknown> = {};
  select(cols?: string) { return this; }
  eq(col: string, val: unknown) { this.filters[col] = val; return this; }
  order(col: string, opts?: unknown) { return this; }  // ← must be a no-op
  limit(n: number) { return this; }                    // ← must be a no-op
  async single() { /* return mock data */ }
}
```

### 5.3 Key Mock: getCurrentUser

Several test files broke when `getCurrentUser` was not mocked. Always mock it at the top of test files that test server actions:

```typescript
const mockGetCurrentUser = jest.fn();
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// In beforeEach:
mockGetCurrentUser.mockResolvedValue({ id: 'user-1', role: 'admin', tenant_id: 'tenant-1' });
```

**Files that were fixed in this session:**
- `src/__tests__/chat-actions.test.ts`
- `src/__tests__/finance.lockMonth.test.ts`
- `src/__tests__/franchise-royalty.test.ts`
- `src/__tests__/inter-branch-clearing.test.ts`
- `src/__tests__/business-health.test.ts`

---

## 6. Module Isolation Tests (do NOT break)

### `beauty-spa-module-isolation.test.ts`
Tests that the **services page hook** does NOT default to babycare before tenant modules load:

```typescript
// src/app/dashboard/services/hooks/useServicesPageState.ts MUST have:
const EMPTY_ENABLED_MODULES: TenantEnabledModules  // not: normalizeEnabledModules(null)
useState<TenantEnabledModules>(EMPTY_ENABLED_MODULES)
setEnabledModules(EMPTY_ENABLED_MODULES)  // ← on logout/reset
hasLoadedTenantModules  // ← boolean gate

// src/app/dashboard/services/page.tsx MUST have:
const canManageServices = hasLoadedTenantModules && enabledModuleOptions.length > 0
const showModuleFilter = hasLoadedTenantModules && enabledModuleOptions.length > 1
{hasLoadedTenantModules && enabledModules.babycare && (  // ← babycare-specific UI
disabled={!canManageServices}  // ← UI disabled until modules load
```

### `booking-package-module-scope.test.ts`
Tests 4 scenarios for `validateBookingPackageScope()`. All must pass.

### `cross-module-integrity.test.ts`
End-to-end pipeline: booking creation → payment → session completion → month locking.
All 4 phases must trigger correct side effects and be verifiable in mock DB state.

---

## 7. AGENTS.md Rules — Critical Summary

These rules are non-negotiable and enforced via tests:

| Rule | Requirement |
|---|---|
| **Zero Silent DB Failures** | Never catch errors with only `console.error`. Always re-throw or return `{ success: false, error }` |
| **Side-Effect Assertions** | Tests for actions (approve leave, complete session) MUST query side-effect tables |
| **Strict DB Typing** | Use `Database['public']['Tables']['X']['Insert']` types, never cast to `any` |
| **Atomic Salary Recalculation** | Always use `recalculateAndSaveSalaryRecord()` — never patch individual salary fields |
| **KPI Sync** | KPI amount must be sourced from `kpi_records` table, not cached values |
| **Pro-Rata for Drafts** | Draft salary = `(base_salary / 26) * actualDays` — never full monthly amount |
| **Status Filters in P&L** | Only `status === 'approved' || 'paid'` expenses count in P&L |
| **Package Session Multiplier** | `total_sessions` is `NUMERIC(5,2)` — use `session_multiplier` from `packages` table |

---

## 8. Recent Git History (as of 2026-06-09)

```
f9f88b14  Improve export error handling
e743a6be  Fix HQ filter overflow and transfer grants
acb10a8f  Fix HQ controls and salary Excel export
f71821fe  Wait for visual smoke page rendering
cc06c148  Use webpack dev server for visual smoke
e54f344b  Stabilize responsive visual smoke timeout
547938f5  Polish accounting repair descriptions
aa0811d3  Route KTV checkout through completion engine  ← critical fix
81e13abf  Add booking package invariant guard
f7418187  Guard booking package module scope
6e855369  Scope CI visual smoke to core routes
6ec85d57  Add beauty spa module isolation guard test
4949e2dd  Guard services page by tenant modules
6c3ca1fe  Show tenant business modules in HQ
0c65bab5  Gate beauty spa tenant setup through HQ      ← security gate
3e86d550  Preserve explicit tenant module isolation
```

---

## 9. Next Development Areas (Recommended Priorities)

### 9.1 Beauty Spa Phase 3 — Booking Resources Scheduling
- **Status:** Schema exists (`booking_resources` table), no UI yet
- **Needed:** Calendar/slot management UI for beds/rooms
- **Tests to write:** Resource availability conflict detection, overbooking prevention
- **File to create:** `src/app/dashboard/resources/` page and hooks

### 9.2 CRM Module — Potential Silent Failures
- **Risk:** `src/services/customer-actions.ts` — audit before extending
- **Check:** All DB operations in CRM must return `{ success: false, error }` on failure, not swallow errors

### 9.3 Beauty Spa – Services UI
- **Current state:** `packages` table extended with `module_key` and `service_kind`
- **Needed:** UI filtering by `module_key` when tenant is `beauty_spa`-only
- **Guard:** `canManageServices` already in `services/page.tsx`

### 9.4 White-Label / Brand Theme
- **Migration:** `20260608104000_add_tenant_module_white_label_config.sql`
- **Type:** `TenantBrandTheme` in `src/lib/business-rules/tenant-modules.ts`
- **Status:** Schema + types exist, UI TBD

---

## 10. Commands Cheat Sheet

```powershell
# Run full test suite
npx jest --passWithNoTests

# Run specific test file
npx jest src/__tests__/beauty-spa-module-isolation.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="beauty spa"

# TypeScript compile check
npx tsc --noEmit

# Dev server
npm run dev
```

---

## 11. File Map — Key Files

| Purpose | Path |
|---|---|
| Module types & normalization | `src/lib/business-rules/tenant-modules.ts` |
| Tenant registration + HQ guard | `src/services/onboarding-actions.ts` |
| Session completion (single entry point) | `src/modules/booking/actions/complete-session-action.ts` |
| Session actions (public API façade) | `src/modules/booking/actions/session-actions.ts` |
| Session completion engine | `src/modules/booking/actions/session-completion-engine.ts` |
| Booking package scope guard | `src/modules/booking/actions/create-booking-helpers.ts` |
| Services page hook | `src/app/dashboard/services/hooks/useServicesPageState.ts` |
| Services page (module-aware) | `src/app/dashboard/services/page.tsx` |
| Salary engine | `src/modules/hr-salary/actions/admin-salary-actions.ts` |
| Accounting outbox | `src/lib/accounting-outbox.ts` |
| P&L / Finance reports | `src/services/finance/reports.ts` |
| Beauty spa phase 2 migration | `supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql` |
| Isolation guard test | `src/__tests__/beauty-spa-module-isolation.test.ts` |
| Phase 2 schema test | `src/__tests__/beauty-spa-phase2-schema.test.ts` |
| Cross-module E2E test | `src/__tests__/cross-module-integrity.test.ts` |

---

*Generated by AI Agent — 2026-06-09. Update this file whenever significant architecture or test changes occur.*
