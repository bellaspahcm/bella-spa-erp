# P1 Scope Boundary Verification

**Date:** 2026-09-16  
**Checkpoint:** f0af4dea  
**Purpose:** Verify original P1 scope definition to determine if Logistics (282+) and Legacy Services (342) are P1 or P2 debt

---

## P1 Original Scope Definition

**Source:** `docs/platform/BELLA_PLATFORM_HARDENING.md` + `docs/platform/P1_T1_TYPESCRIPT_CENSUS_COMPLETE.md`

### P1 Workstream Objective

```text
P1: TypeScript Debt Governance

Approach: Census by scope, fix selectively, lock with no-new-debt.

Phase T1: TypeScript Census
- Scoped diagnostic census
- Map diagnostics by ownership scope
- Classification: CLEAN / DIRTY / LEGACY
```

### Scopes Explicitly Listed in P1-T1 Census

**Platform Scopes (6):**
1. Platform Core ✅
2. Healthcare Platform ✅
3. Education Platform ✅
4. **Logistics Platform** ✅ (INCLUDED - measurement attempted)
5. Real Estate Platform ✅
6. Beauty OS ✅

**Product Scopes (1):**
7. English Center ✅

**Explicitly Excluded (Legacy):**
- Decision Engine (Legacy) ❌ "Unverified legacy area"
- Services (Legacy) ❌ "Unverified legacy area"

**Evidence:** P1_T1 document section "Unverified Scopes (Legacy Areas)"

---

## Scope Classification Verdict

### ✅ **Logistics Platform: IN P1 SCOPE**

**Evidence:**
1. Listed in P1-T1 census table as "Blocked Scopes"
2. Scoped tsconfig created: `tsconfig.logistics.json`
3. Measurement was attempted (compilation timeout noted)
4. Classified alongside other Platform scopes (Healthcare, Education, Real Estate)
5. NOT listed in "Unverified Scopes (Legacy Areas)"

**Status:** Compilation timeout prevented measurement, but scope inclusion was explicit

**Current findings:**
- Domain module: 282 diagnostics ✅ MEASURED
- Full scope: TIMEOUT (error cascade hypothesis)
- Minimum: ≥282 diagnostics

**P1 Decision:** Logistics 282+ diagnostics **MUST be addressed in P1**

---

### ❌ **Legacy Services: OUT OF P1 SCOPE**

**Evidence:**
1. P1_T1 explicitly lists "Services (Legacy)" in "Unverified Scopes (Legacy Areas)"
2. Paired with "Decision Engine (Legacy)" as legacy exclusion
3. NOT included in P1 Platform or Product scope lists
4. Census strategy: "Legacy areas" measured separately from P1 scopes

**Current findings:**
- Legacy Services: 342 diagnostics ✅ MEASURED
- Files: `src/services/**/*.ts`, `src/lib/decision-engine/**/*.ts`
- Classification: Pre-platform booking/order services

**P1 Decision:** Legacy Services 342 diagnostics **NOT in P1 scope**

**Reasoning:**
- Original P1 scope definition excluded "Services (Legacy)"
- 342 count discovered during UNKNOWN resolution, not scope redefinition
- Exclusion was intentional, not based on diagnostic count

---

## P1 Completion Criteria (Updated)

### Original Criteria (from BELLA_PLATFORM_HARDENING.md)

```text
Phase T3: Scoped Cleanup + Lock

Success Criteria:
✅ Census complete with scope breakdown
✅ Priority 1 (new code) at 0 errors
✅ Priority 2 (Platform APIs) at 0 errors
✅ Priority 3 (Active Products) <50 errors per product
✅ Priority 4 documented as accepted debt
✅ no-new-debt enforced via CI for clean scopes
```

### Current P1 Status Against Criteria

| Scope | Category | Baseline | Current | Target | Status |
|-------|----------|----------|---------|--------|--------|
| Platform Core | P2 (Platform API) | ? | 0 | 0 | ✅ CLEAN |
| Healthcare | P2 (Platform API) | 132 | 0 | 0 | ✅ CLEAN |
| Education | P2 (Platform API) | 127 | 0 | 0 | ✅ CLEAN |
| **Logistics** | **P2 (Platform API)** | **?** | **≥282** | **0** | **🔴 BLOCKED** |
| Real Estate | P2 (Platform API) | 12 | 0 | 0 | ✅ CLEAN |
| Beauty OS | P2 (Platform API) | 49 | 0 | 0 | ✅ CLEAN |
| Platform Host | P2 (Platform API) | ? | 0 | 0 | ✅ CLEAN |
| Payroll | P2 (Platform API) | ? | 0 | 0 | ✅ CLEAN |
| English Center | P3 (Active Product) | 4 | 0 | <50 | ✅ CLEAN |
| **Legacy Services** | **OUT OF SCOPE** | **—** | **342** | **—** | **⏸️ P2/LEGACY** |

**Total Platform scopes in P1:** 8  
**Clean:** 7/8 ✅  
**Dirty:** 1/8 (Logistics ≥282) 🔴

---

## Logistics P1 Work Estimate

### Error Pattern Analysis (from 282 domain errors)

**Pattern 1: snake_case/camelCase Mismatch (Majority ~70%)**
- Example: `inventory.tenantId` → should be `inventory.tenant_id`
- Affected: All domain entities, repositories, operations
- Fix approach: Align domain types with database schema naming
- Estimate: Systematic but tedious (2-3 hours per pattern cluster)

**Pattern 2: Missing Type Exports (~10%)**
- Example: `Inventory` exported from wrong file
- Fix approach: Reorganize exports, update import paths
- Estimate: 30 minutes

**Pattern 3: Method Signature Mismatches (~20%)**
- Example: `shipOperation(inventory, { shippedBy, shippedAt })` expects 1 arg
- Fix approach: Update method signatures or call sites
- Estimate: 1-2 hours

### Comparison to Healthcare Hardening

| Metric | Healthcare | Logistics | Comparison |
|--------|------------|-----------|------------|
| Baseline diagnostics | 132 | ≥282 | 2.1× larger |
| Primary issue | Contract/EventBus boundaries | snake_case/camelCase | Different patterns |
| Frozen Kernel | Yes (H1-H12) | Yes (E7.1-E7.3) | Both frozen |
| Regression tests | 52/52 PASS | 547/547 PASS | Both stable |
| Fix complexity | High (architectural) | Medium (naming consistency) | Logistics potentially simpler |
| Estimated duration | 3 days (actual) | **2-3 days** | Similar scope |

**Key difference:** Healthcare had contract redesign complexity. Logistics has volume but more mechanical fixes (rename properties to match schema).

---

## Recommendation

### Option 1: Include Logistics in P1 (ALIGNED WITH ORIGINAL SCOPE)

**Rationale:**
- Logistics was explicitly included in P1 scope definition
- Platform API category requires 0 diagnostics
- Excluding now = changing scope post-measurement (violates evidence-based principle)

**Timeline Impact:**
- P1 closure: +2-3 days
- Total P1 duration: ~7 days (was 4-5 days without Logistics)

**Benefits:**
- All Platform APIs clean and locked
- Consistent with original P1 definition
- Prevents scope creep in future (clear boundary)

**Risks:**
- Delays factory reopening by 2-3 days
- Logistics errors may cascade to repositories/engines (full count unknown)

### Option 2: Defer Logistics to P2 (SCOPE CHANGE)

**Rationale:**
- 282+ diagnostics is substantial
- P1 already achieved significant cleanup (7/8 Platform scopes)
- Logistics not blocking current deployments

**Timeline Impact:**
- P1 closure: immediate
- P2-T1: Logistics Hardening (new workstream)

**Benefits:**
- Faster factory reopening
- Dedicated focus for Logistics cleanup

**Risks:**
- Violates original P1 scope definition
- Creates precedent for excluding "difficult" scopes
- Logistics remains type-unsafe longer

### Option 3: Partial Logistics Fix (COMPROMISE)

**Approach:**
- Fix missing exports only (~20-30 errors)
- Document remaining 250+ as P2 work
- Enable no-new-debt for Logistics contracts

**Timeline Impact:**
- P1 closure: +1 day
- P2-T2: Remaining Logistics cleanup

**Benefits:**
- Maintains scope integrity (Logistics addressed in P1)
- Reduces immediate timeline impact
- Locks Logistics contracts against further degradation

**Risks:**
- Partial fix may not reduce compilation timeout
- Creates "half-clean" state

---

## Decision Framework

### If Prioritizing Speed → Option 2
- Factory reopening is critical
- Logistics can wait for P2
- Document scope change with ADR

### If Prioritizing Scope Integrity → Option 1
- Original P1 definition must be honored
- 2-3 days acceptable for complete Platform cleanup
- All Platform APIs locked together

### If Prioritizing Pragmatism → Option 3
- Acknowledge Logistics scope inclusion
- Fix critical exports, defer naming consistency
- Balanced approach

---

## Recommended Decision: **Option 1 (Include Logistics in P1)**

**Justification:**
1. **Evidence-based principle:** Original P1 scope explicitly included Logistics
2. **Consistency:** All Platform scopes (Healthcare, Education, Logistics, Real Estate) same treatment
3. **Quality bar:** Platform APIs should be type-safe before factory reopening
4. **Precedent:** Excluding difficult scopes undermines hardening initiative credibility
5. **Timeline:** 2-3 days delay acceptable given 7 days total P1 work already invested

**Alternative:** If timeline is critical, choose Option 3 (partial fix) with explicit ADR documenting why full cleanup deferred to P2.

---

## Legacy Services - Confirmed Out of Scope

**342 diagnostics in `src/services/**/*.ts` and `src/lib/decision-engine/**/*.ts`**

**Action:**
1. Document 342 count as Legacy Services baseline
2. Create separate workstream: "P2-Legacy: Services Modernization" or "Legacy Deprecation"
3. Decision: Modernize vs Deprecate vs Document as accepted debt
4. NOT blocking P1 closure

**Evidence:** Original P1-T1 census explicitly excluded "Services (Legacy)" from Platform scopes

---

## Conclusion

**P1 Scope Boundary:**
- ✅ **IN SCOPE:** 8 Platform scopes (Core, Healthcare, Education, **Logistics**, Real Estate, Beauty, Platform Host, Payroll) + English Center product
- ❌ **OUT OF SCOPE:** Legacy Services (Decision Engine, Services)

**Current P1 Status:**
- Clean: 7/8 Platform + 1/1 Product = 8/9 total ✅
- Dirty: 1/8 Platform (Logistics ≥282) 🔴

**P1 Closure Blocker:** Logistics ≥282 diagnostics must be resolved (or explicitly deferred with ADR) before P1 can be declared COMPLETE

**Legacy Services:** 342 diagnostics documented, moved to P2/Legacy track

---

**Verification Date:** 2026-09-16  
**Evidence Sources:** BELLA_PLATFORM_HARDENING.md, P1_T1_TYPESCRIPT_CENSUS_COMPLETE.md  
**Decision:** Awaiting user confirmation of Option 1, 2, or 3 for Logistics
