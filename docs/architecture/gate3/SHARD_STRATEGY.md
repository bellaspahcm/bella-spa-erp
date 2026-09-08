# TypeScript Hardening — Scope Sharding Strategy

**Date:** 2026-09-08  
**Problem:** 6 mega-scopes timeout (>60s) due to transitive dependency resolution  
**Solution:** Shard into bounded compilation units

## Root Cause Analysis

**Transitive dependency explosion:**
```
AutoMove scope (14 explicit files)
    ↓ 
via `paths: {"@/*": ["./src/*"]}`
    ↓
TypeScript resolves ALL imports
    ↓
1,176 files compiled (14 → 1,176 = 84x multiplier)
    ↓
Timeout at 60s
```

**Every scope with `paths` resolution pulls massive transitive deps.**

## Revised Topology

### Layer 2A: Product-Isolated (KEEP AS-IS)

**Already proven clean + fast:**

| Scope | Files | Status | Evidence |
|-------|-------|--------|----------|
| automove (isolated) | 14 | ✅ CLEAN | 6C pilot |
| preschool (isolated) | ~20 | ✅ CLEAN | 6C pilot |
| dental | 15 | ⚠️ 83 diag | TBD |
| education | 7 | ⚠️ 4 diag | TBD |
| fresh-food | 3 | ⚠️ 3 diag | TBD |
| hospital | 30 | ⏱️ TIMEOUT (when deps included) | TBD |
| kids-clothing | 3 | ⚠️ 4 diag | TBD |
| land | 8 | ✅ CLEAN | Proven |
| medical | 30 | ⚠️ 155 diag | TBD |
| retail-store | 7 | ✅ CLEAN | Proven |

**Action:** Keep Product-Isolated pattern, fix diagnostics in 5 scopes with issues.

### Layer 2B: Shared Infrastructure (SHARD)

#### 2B.1 — Platform Core Shards

**Current:** `platform-core` = 732 files → TIMEOUT

**Shard by platform module:**

```
src/platform/
├─ core/          → tsconfig.compile-platform-core-base.json
├─ healthcare/    → tsconfig.compile-platform-healthcare.json (EXISTS in Gate B)
├─ finance/       → tsconfig.compile-platform-finance.json (EXISTS in Gate B)
├─ logistics/     → tsconfig.compile-platform-logistics.json (EXISTS in Gate B)
├─ education/     → tsconfig.compile-platform-education.json (EXISTS in Gate B)
├─ real-estate/   → tsconfig.compile-platform-real-estate.json (EXISTS in Gate B)
├─ retail/        → tsconfig.compile-platform-retail.json (EXISTS in Gate B)
└─ ...other modules
```

**Reuse Gate B platform scopes where they exist.**

**For `src/lib/` + `src/types/` + `packages/shared/`:**
- Create `tsconfig.compile-infrastructure.json` (lib + types + shared only, NO platform)

#### 2B.2 — Services Shards

**Current:** `services` = 158 files → TIMEOUT

**Shard by service domain:**

```
src/services/
├─ healthcare/    → tsconfig.compile-services-healthcare.json
├─ accounting/    → tsconfig.compile-services-accounting.json
├─ intelligence/  → tsconfig.compile-services-intelligence.json
├─ platform/      → tsconfig.compile-services-platform.json
└─ *.ts (root)    → tsconfig.compile-services-root.json
```

#### 2B.3 — App Routes

**Current:** `app-routes` = 649 files → TIMEOUT

**Already have Layer 1 ownership scopes (29 scopes).** These are Product-Isolated by design.

**Decision:** Do NOT create separate compilation scope. App routes covered by:
1. **Product scopes** (for Product-owned routes)
2. **Layer 1 ownership scopes** (for governance, not compilation)

App routes WITHOUT dedicated Product → Create minimal scopes for platform-owned routes (Admin, Intelligence, etc.)

#### 2B.4 — Remaining

**Current:** `remaining` = 584 files → TIMEOUT

**Files in `remaining`:**
```
src/
├─ adapters/
├─ capabilities/
├─ components/
├─ config/
├─ constants/
├─ core/
├─ cron/
├─ factory/
├─ foundation/
├─ hooks/
├─ middleware/
├─ modules/
├─ plugins/
├─ policies/
├─ shared/
├─ store/
├─ utils/
└─ ...
```

**Shard by architectural layer:**

- `tsconfig.compile-foundation.json` — core, foundation, capabilities
- `tsconfig.compile-ui-components.json` — components, hooks, store
- `tsconfig.compile-adapters.json` — adapters, middleware, plugins
- `tsconfig.compile-utilities.json` — config, constants, utils, shared

## Execution Plan

### Step 1: Fix Product Diagnostics (5 scopes)

**Scopes with diagnostics:**
1. dental (83 diag)
2. education (4 diag)
3. fresh-food (3 diag)
4. kids-clothing (4 diag)
5. medical (155 diag)
6. preschool (34 diag)

**Total:** 283 diagnostics

**Action:** Read sample diagnostics, classify, fix root causes.

### Step 2: Shard Platform Core

**Delete:** `tsconfig.compile-platform-core.json` (mega-scope)

**Create:**
- Reuse existing Gate B scopes (healthcare, finance, logistics, education, real-estate, retail)
- Create `tsconfig.compile-infrastructure.json` (lib + types + shared)

**Run census on platform shards.**

### Step 3: Shard Services

**Delete:** `tsconfig.compile-services.json` (mega-scope)

**Create:** 4-5 service domain scopes

**Run census on service shards.**

### Step 4: Shard Remaining

**Delete:** `tsconfig.compile-remaining.json` (mega-scope)

**Create:** 4 architectural layer scopes

**Run census on remaining shards.**

### Step 5: Final Census

**Run census on ALL scopes (Product + Platform + Services + Remaining).**

**Target:**
- 100% coverage (all 2,178 files)
- 0 diagnostics
- 0 timeout
- All scopes <30s compilation

### Step 6: Closure

**IF Step 5 achieves target:**
- Document full repository TypeScript GREEN
- Close Gate 3 TypeScript Hardening
- Resume product work

## Success Criteria

```
✅ 100% file coverage (2,178 files in at least one scope)
✅ 0 diagnostics (all scopes CLEAN)
✅ 0 timeout (all scopes <60s, ideally <30s)
✅ 0 infrastructure errors
✅ Deterministic (rerun produces same result)
```

## Next Action

**Immediate:** Fix Product diagnostics (Step 1) — 283 diagnostics in 6 scopes.

Start with smallest: education (4 diag) → verify fix pattern → scale to medical (155 diag).

---

**Status:** Sharding strategy documented, ready for execution
