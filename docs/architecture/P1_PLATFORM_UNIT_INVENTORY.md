# Platform Unit Type-Check Inventory

**Date:** 2026-09-02  
**Objective:** Identify actionable type errors in Platform units before Bella Auto remediation  
**Method:** Unit-scoped TypeScript checks with 10s timeout threshold

## Summary

| Status | Count | Units |
|--------|-------|-------|
| ✅ PASS | 34 | See below |
| ❌ FAIL | 6 | Real-Estate, Integration-Hub, Education, Deployment, Integration-Runtime |
| 🟠 HOTSPOT | 3 | Host, Healthcare, Logistics |
| **Total** | **43** | All Platform units tested |

## ✅ PASS Units (34)

Fast, actionable diagnostics, zero errors:

| Unit | Duration | Notes |
|------|----------|-------|
| Core | 4.1s | |
| Registry | 3.5s | |
| Security | 3.2s | 7 errors FIXED |
| Accounting | 3.3s | |
| Finance | 4.9s | 1 error FIXED (null → undefined) |
| Messaging | 2.1s | |
| Notification-Hub | 2.0s | |
| Document-Engine | 2.4s | |
| AI-Orchestrator | 2.0s | |
| Asset | 1.9s | |
| Capability-Platform | 2.6s | |
| Activity-Stream | 2.0s | |
| Composition | 1.9s | |
| Config-Center | 2.1s | |
| Context | 2.0s | |
| Events | 1.9s | |
| Extensions | 2.0s | |
| IAM-Matrix | 1.9s | |
| Journey | 1.9s | |
| Knowledge | 1.9s | |
| KPI-Engine | 2.0s | |
| Lead-Engine | 1.9s | |
| Metadata-Engine | 2.6s | |
| Migration-Governance | 2.5s | |
| Party | 1.9s | |
| Policy-Engine | 1.9s | |
| Projection-Engine | 2.0s | |
| Resource-Engine | 2.0s | |
| Runtime | 2.0s | |
| Scheduler-Registry | 2.0s | |
| SDK | 2.0s | |
| Search-Engine | 1.9s | |
| Specification | 1.9s | |
| State-Machine | 2.0s | |
| Template-Engine | 1.9s | |
| Timeline | 1.9s | |

## ❌ FAIL Units (6)

Units with actionable diagnostics:

### 1. Real-Estate (9 errors, 3.3s)

**Pattern:** Schema drift - code using property names that don't exist in database types

**Errors:**
- Missing `unit_code` property (should be `product_code`)
- Missing `real_estate_contracts` table reference
- Wrong property name: `contract_no` → `contract_number`
- Invalid enum value `"completed"` for `re_product_status`
- Invalid enum values `"pending_deposit"`, `"cancelled"` for `re_reservation_status`

**Remediation:** Align code with database schema (property renames, enum fixes)

### 2. Integration-Hub (3 errors, 2.8s)

**Pattern:** Missing export + implicit any

**Errors:**
- `FinanceOutboxWorker` not exported from module
- Parameter `error` implicitly has `any` type

**Remediation:** Add export, add type annotation

### 3. Education (100 errors, 4.5s)

**Pattern:** Systematic schema drift + Json type mismatches

**Errors:**
- `Record<string, unknown>` not assignable to `Json` (multiple instances)
- Missing required properties in DTOs
- Enum value mismatches
- `never` type issues in repositories
- Supabase client version mismatch (14.5 vs 12)
- Null handling issues

**Note:** Also triggers errors in Platform/Host (person.repository, rule-engine) - cross-unit contamination

**Remediation:** Large-scale schema alignment required

### 4. Deployment (2 errors, 2.2s)

**Pattern:** Implicit any

**Errors:**
- Variable `preflight` implicitly has `any[]` type at line 316, 318

**Remediation:** Add explicit type annotation

### 5. Integration-Runtime (36 errors, 2.6s)

**Pattern:** ErrorContext type mismatch + null checks

**Errors:**
- `ErrorContext` not assignable to `Record<string, unknown>` (26 instances)
- `null` not assignable to `Date | undefined` or `Error | undefined`
- Missing properties: ZodError `.errors`, duplicate export `ValidationError`
- Implicit any parameter

**Remediation:** Fix ErrorContext interface, add null checks, deduplicate exports

## 🟠 HOTSPOT Units (3)

Units that timeout without actionable diagnostics (>15s):

| Unit | Reason |
|------|--------|
| Host | Type-check timeout |
| Healthcare | Type-check timeout |
| Logistics | Type-check timeout (syntax error fixed, still times out) |

**Implication:** These units have cross-dependencies that trigger deep type instantiation. Cannot get scoped diagnostics with current tooling.

## Fixes Applied

### Security (7 errors → PASS)
- Extension handlers: changed `input` parameter from specific types to `unknown` with type assertions
- Added `as Record<string, string>` index signature cast

**Files:**
- `src/platform/extensions/engines/test-extensions.ts`
- `src/platform/security/__tests__/8a-exploit-extensions/leak-detector-ext.ts`
- `src/platform/security/__tests__/8a-exploit-extensions/privilege-escalation-ext.ts`
- `src/platform/security/__tests__/platform-resilience.integration.test.ts`

### Finance (1 error → PASS)
- Changed `|| null` to `|| undefined` for optional parameter

**Files:**
- `src/platform/finance/engines/ledger-engine/ledger.service.ts` line 220

## Next Steps

1. ✅ Platform inventory complete (43/43 units tested)
2. ⏭️ Fix remaining 6 FAIL units:
   - Deployment (2 errors) - trivial
   - Integration-Hub (3 errors) - trivial  
   - Real-Estate (9 errors) - schema alignment
   - Integration-Runtime (36 errors) - ErrorContext pattern
   - Education (100 errors) - large schema drift (defer or assess scope)
3. ⏭️ Test Modules (bella-healthcare if not HOTSPOT, bella-auto separately)
4. ⏭️ Bella Auto: 7 FAIL + 5 HOTSPOT from previous checkpoint
5. ⏭️ Retry full `npx tsc --noEmit` when graph cleaner

## Decision Log

**Chosen:** Platform unit inventory before Bella Auto  
**Why:** nền → module → product order, avoid mixed provenance errors

**Pattern:** PASS → note, FAIL + diagnostics → fix immediately (Security, Finance), FAIL without time → mark and continue inventory

**Not chosen:** Investigate HOTSPOT compiler behavior (user directive: no deeper compiler investigation)

## Artifacts

- Config files: `tsconfig.platform-{unit}.json` (temporary, for diagnostics)
- Diagnostic logs: `diagnostics-{unit}.txt`
- Test script: `test-platform-units.ps1`
