# Cleanup Strategy: Pre-Production Technology Baseline

**Status:** ACTIVE  
**Phase:** Pre-Production Cleanup (before fundraising)  
**Date:** 2026-09-02  

---

## Strategic Context

**Current state:** 100% test/pre-production, no production customers except Babycare

**Window of opportunity:** Can refactor aggressively BEFORE production customers

**Goal:** Establish clean technology baseline before fundraising/production scale

---

## Core Principle

```text
                    BELLA CLEANUP / REFACTOR
                              │
             ┌────────────────┴────────────────┐
             │                                 │
       TEST / PRE-PROD                    PRODUCTION
             │                                 │
   Healthcare / Auto / Support            🔒 Babycare
   Finance / Logistics / Spa                  │
   Platform (no customers)              PRODUCTION-LOCKED
             │                                │
      ✅ Aggressive cleanup             ❌ NO REFACTOR
      ✅ Architecture fix               ❌ NO MASS-FIX
      ✅ Dependency refactor            ❌ NO TYPE CHANGES
      ✅ HOTSPOT resolution             Change control only
```

---

## Decision Framework Change

### Before (Conservative)

```text
HOTSPOT → defer
Technical debt → defer
Type drift → defer
Architecture issue → defer
```

**Rationale:** Production safety

### Now (Aggressive Pre-Production)

```text
HOTSPOT → resolve if cost reasonable
Technical debt → fix if evidence-based
Type drift → align to canonical
Architecture issue → refactor with evidence
```

**Rationale:** 
- No production customers in affected areas
- Better to fix before production than after
- Post-fundraising will have less freedom to refactor

### After Production (Future Conservative)

```text
Customer-facing code → strict change control
Architecture changes → careful migration path
HOTSPOT → defer unless blocking
Technical debt → manage incrementally
```

**Rationale:** Production stability > technical perfection

---

## Technology Clean Baseline Target

**End state required before production scale:**

```text
TypeScript full typecheck
    └── ✅ PASS or VERDICT with evidence

Architecture Guard
    └── ✅ PASS (all critical rules)

Production Build
    └── ✅ PASS

Critical Regression
    └── ✅ PASS

Healthcare
    └── ✅ Verified

Support
    └── ✅ Verified

Bella Auto
    └── ✅ Verified

Migrations
    └── ✅ Canonical (no drift)

Worktree
    └── ✅ Intentional changes only

Source Quality
    └── ✅ No unresolved HOTSPOTs in customer-facing code
```

**NOT required:**
- ❌ Zero modified files (docs/evidence can evolve)
- ❌ Perfect architecture (good enough + no blockers)
- ❌ Zero tech debt (manageable debt OK)

**Required:**
- ✅ Every important source change has owner + scope + evidence
- ✅ No blocking HOTSPOTs preventing production deployment
- ✅ No schema/migration drift
- ✅ No compiler architecture issues

---

## Cleanup Sequence

### Priority Order

1. **`support` module** → verdict (fix or defer with evidence)
2. **`bella-auto` module** → verdict (fix or defer with evidence)
3. **Healthcare 32 files** → review/refactor if needed
4. **Root TypeScript** → verdict; refactor if dependency/compiler architecture issue
5. **Migration reconciliation** → canonical history
6. **Docs/evidence** → sync with actual code
7. **Architecture Guard + build + targeted regression + full typecheck**
8. **Commit/push by clean scope**

### Refactor Decision Protocol

**When HOTSPOT found:**

```text
HOTSPOT / type drift
        ↓
Identify root cause
        ↓
Does it touch Babycare?
        ├─ YES → STOP / production change control
        └─ NO  → Continue
                 ↓
        Refactor solves root cause?
                 ├─ YES → Refactor with evidence
                 └─ NO  → Different approach
                          ↓
                 Verify after change
                          ↓
                 PASS → Commit
                 FAIL → Rollback + different approach
```

**NOT allowed:**

```text
"Code looks ugly"
       ↓
Rewrite entire module
```

**Allowed:**

```text
Evidence shows:
  - Dependency boundary wrong
  - Contract ownership wrong
  - Mapper architecture broken
  - Schema drift
  - Barrel cycle causing compiler hang
  - Module registration inconsistent
       ↓
Fix with evidence
       ↓
Verify
```

---

## Production Protection Boundary

### 🔒 Babycare = PRODUCTION-LOCKED

**Absolute prohibitions:**

❌ Refactor Babycare code  
❌ Fix Babycare types "while we're at it"  
❌ Change Babycare contracts  
❌ Modify Babycare schema/migrations  
❌ Change Babycare dependency architecture  
❌ Run mass-fix into Babycare scope  
❌ Include Babycare in cleanup "because it's in dependency graph"  

**Only allowed:**

✅ Production incident response (separate workstream)  
✅ Customer requirement (with change control)  
✅ Critical security fix (with careful verification)  

**Handling Babycare in HOTSPOT resolution:**

```text
Root compiler HOTSPOT
        ↓
Dependency involves Babycare?
        ├─ YES → 🔒 Babycare LOCKED
        │        ↓
        │   Find boundary/consumer/adapter solution
        │   Do NOT refactor Babycare
        │
        └─ NO  → Continue cleanup normally
```

---

## Scope Classification

### ✅ Aggressive Cleanup Allowed

**Pre-production modules (no customers):**
- Healthcare (test environment only)
- `support` module
- `bella-auto` module
- Logistics
- Spa (test/demo only)
- Finance
- Platform components (no production use)
- Migration/test artifacts for above
- Shared kernel (if no Babycare impact)

### 🔒 Production-Locked

**Production customer environment:**
- 🔒 **Bella Babycare** (production customers exist)
- Any code directly serving Babycare production
- Babycare migrations (in production DB)
- Babycare-specific contracts/schemas

### ⚠️ Careful (Shared Components)

**Shared between pre-production and production:**
- Core platform (tenant, auth, RLS)
- Database fundamentals
- Runtime/Security
- Contract registry
- Migration governance framework

**Protocol for shared components:**
- Can refactor IF no Babycare behavioral impact
- Must verify Babycare regression before commit
- Document Babycare impact assessment

---

## Commit Gate

**Simple gate before every commit:**

```text
Change ready to commit
        ↓
Does it touch Babycare scope?
        ├─ YES → STOP
        │        ↓
        │   Separate production change control
        │   Evidence of Babycare safety
        │   Regression verification
        │
        └─ NO  → Continue
                 ↓
            Verify
                 ↓
            PASS → Commit
            FAIL → Fix or defer
```

**Implementation:**
- Scope discipline (manual review)
- Architecture Guard (Babycare freeze rule if needed)
- File path inspection before commit

---

## Allowed Refactoring Patterns

### ✅ Dependency Boundary Fix

**Problem:** Module A imports from Module B internals  
**Solution:** Create proper contract, fix import direction  
**Condition:** No Babycare impact

### ✅ Contract Ownership Correction

**Problem:** Contract owned by wrong layer  
**Solution:** Move contract to correct boundary  
**Condition:** Verify all consumers updated

### ✅ Mapper Architecture Alignment

**Problem:** Mapper duplicated, schema drift  
**Solution:** Canonical mapper, single source of truth  
**Condition:** Verify all paths produce same result

### ✅ Barrel Cycle Removal

**Problem:** Barrel re-export creates compiler hang  
**Solution:** Remove problematic re-export  
**Condition:** Update consumers to direct imports

### ✅ Module Registration Consistency

**Problem:** Module registered inconsistently  
**Solution:** Standardize registration pattern  
**Condition:** Verify all modules work

### ❌ Speculative Refactoring

**NOT allowed:**
- Rewrite because "cleaner"
- Change architecture because "better pattern"
- Refactor without evidence of problem

**Required for refactoring:**
- Evidence of actual problem (HOTSPOT, type error, regression)
- Clear root cause identified
- Refactor directly addresses root cause
- Verification proves fix

---

## Risk Management

### High Risk Activities

**Require extra verification:**
- Shared component changes (Core, Runtime, Security)
- Migration schema changes
- Contract breaking changes
- Dependency graph restructuring

**Protocol:**
- Scoped verification before commit
- Targeted regression for affected modules
- Babycare impact assessment
- Rollback plan documented

### Low Risk Activities

**Can proceed with standard verification:**
- Pre-production module internals
- Test fixtures
- Documentation
- Investigation artifacts

---

## Success Criteria

### Before Fundraising / Production Scale

**Must achieve:**

1. ✅ No blocking TypeScript HOTSPOTs
2. ✅ Architecture Guard PASS (critical rules)
3. ✅ Production build PASS
4. ✅ Migrations canonical (no drift)
5. ✅ Healthcare/Support/Auto verified
6. ✅ Babycare protected (no unintended changes)
7. ✅ Critical regression PASS

**Good to have:**

- Full TypeScript typecheck PASS (or understood HOTSPOT with defer decision)
- All Architecture Guard rules PASS
- Zero worktree noise
- Complete documentation sync

---

## Post-Cleanup Strategy

**After achieving clean baseline:**

1. **Lock down architecture**
   - Stricter change control
   - Architecture Guard enforcement
   - Breaking change review

2. **Production readiness**
   - Deployment automation
   - Monitoring/alerting
   - Incident response

3. **Customer onboarding**
   - Healthcare first production customer
   - Careful rollout
   - Close monitoring

4. **Future changes**
   - Conservative approach
   - Change control for customer-facing code
   - Technical debt managed incrementally

---

## Governance Principles

### For This Cleanup Phase

**Aggressive but evidence-based:**

> Fix HOTSPOTs now if cost reasonable.  
> Refactor architecture issues before production.  
> Protect Babycare absolutely.  
> Every change has evidence + verification.

**NOT allowed:**

> Refactor because code looks ugly.  
> Mass-fix without scope discipline.  
> Touch Babycare "while we're at it".  
> Cleanup without clear problem identified.

### After Production Scale

**Conservative with customer protection:**

> Customer stability > technical perfection.  
> Change control for production code.  
> Incremental improvements over big rewrites.  
> HOTSPOTs deferred unless blocking.

---

## Implementation

**Starting point:** Checkpoint `9b0df2e3`  
**Current worktree:** Healthcare 32 files deferred (documented HOTSPOT)

**Next actions:**
1. `support` module investigation → verdict
2. `bella-auto` module investigation → verdict
3. Healthcare 32 files review → commit or defer with evidence
4. Root TypeScript → investigate hang, refactor if architecture issue
5. Migration reconciliation
6. Full verification suite
7. Technology clean baseline achieved

**Timeline:** Complete before fundraising/production customer onboarding

**Owner:** Development team with architecture discipline

---

**Status:** ACTIVE  
**Phase:** Pre-Production Cleanup  
**Protection:** 🔒 Babycare PRODUCTION-LOCKED  
**Strategy:** Aggressive cleanup with evidence, absolute Babycare protection

**Principle:**

> **Pre-production: fix aggressively.**  
> **Production Babycare: protect aggressively.**

This is Bella's best window to establish clean technology baseline.

