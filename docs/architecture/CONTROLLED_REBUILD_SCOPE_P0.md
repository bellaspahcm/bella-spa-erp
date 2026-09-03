# P0: Controlled Rebuild Scope — Implementation Complete

**Status:** ✅ GREEN  
**Implemented:** 2026-09-03  
**Evidence:** E7 Logistics Domain Controlled Rebuild

---

## Purpose

Extend Architecture Guard to enforce scope boundaries during controlled rebuilds, preventing scope drift and unauthorized modifications to protected files.

## Implementation

**Extended:** `scripts/architecture/architecture-guard.ts`  
**No new systems created** — added mode to existing guard

### Usage

```bash
# Standard mode (default)
npm run arch:guard

# Controlled rebuild mode
npm run arch:guard -- --mode=controlled-rebuild --scope=logistics/domain
```

### Scope Configuration

Currently supported scope: `logistics/domain`

**Allowed paths:**
- `src/platform/logistics/domain/*.ts`
- `src/platform/logistics/domain/**/*.ts`
- `src/platform/logistics/domain/__tests__/**/*.ts`

**Blocked paths:**
- `supabase/migrations/**/*` (DB changes)
- `src/shared/database.types.ts` (generated canonical types)
- `src/platform/logistics/repositories/**/*` (repository layer)
- `src/platform/logistics/services/**/*` (service layer)
- `src/platform/logistics/api/**/*` (API layer)
- All other Platform components (healthcare, real-estate, education, finance, spa, core)

### Exit Codes

- `0` = All checks passed
- `1` = Frozen boundary violation
- `2` = Dependency boundary violation
- `3` = Hash verification failed
- `4` = **Controlled rebuild scope violation** (NEW)

---

## Validation Results

### ✅ Existing Guard Behavior Preserved

```
npm run arch:guard
→ All existing checks still work
→ Frozen layers enforced
→ Dependency boundaries enforced
```

### ✅ Controlled Rebuild Mode Works

```bash
npm run arch:guard -- --mode=controlled-rebuild --scope=logistics/domain
```

**ALLOWED (verified):**
- ✅ `src/platform/logistics/domain/inventory.domain.ts` (within scope)
- ✅ `src/platform/logistics/domain/inventory.types.ts` (within scope)
- ✅ `src/platform/logistics/domain/__tests__/*.test.ts` (within scope)

**BLOCKED (verified):**
- ❌ `supabase/migrations/20260822_logistics_os_domain_kernel.sql` (protected)
- ❌ `src/shared/database.types.ts` (protected)
- ❌ `src/platform/logistics/repositories/**/*` (out of scope)
- ❌ `src/platform/logistics/services/**/*` (out of scope)
- ❌ Other Platform components (out of scope)

### ✅ E7 Evidence Alignment

All 12 E7 domain files created during Controlled Rebuild are correctly ALLOWED:
- 6 domain implementation files (`*.domain.ts`)
- 6 type re-export files (`*.types.ts`)

### ✅ Gates Still GREEN

```
E7 Domain Tests:    366/366 PASS
Scoped Typecheck:   0 errors
G0.5 Gate B:        44/44 PASS
Existing Arch Guard: PASS (with expected missing E7.2/E7.3 files)
```

---

## Key Design Decisions

### 1. No New Framework

P0 extends existing Architecture Guard, not creates new system.

### 2. Compiler-Required Fix ≠ Bypass Scope

"Compiler fix" does NOT allow modifying files outside declared scope. Files must pass BOTH scope rules AND existing frozen/dependency rules.

### 3. Additive Constraints

Controlled rebuild mode ADDS constraints, does not replace existing guard checks. All existing frozen boundary and dependency rules still apply.

### 4. Git-Based Detection

Uses `git status --porcelain` to detect recently modified/created files. Only checks TypeScript and SQL files.

### 5. Pattern Matching

Uses glob-style patterns with `**` for recursive matching:
- `*.ts` — files in directory
- `**/*.ts` — files in subdirectories (requires at least one subdir)
- Both patterns needed to cover direct children AND nested files

---

## Proven Pattern from E7

This implementation codifies the pattern proven during E7 Controlled Rebuild:

```text
Canonical Schema
      ↓
Generated Types (protected)
      ↓
Domain Implementation (scoped)
      ↓
Tests (scoped)
      ↓
Verification (gates)
```

**Scope boundaries prevent:**
- Premature abstraction (repository/service/API without evidence)
- DB/migration drift during domain rebuild
- Manual modification of generated canonical types
- Unrelated refactoring during focused rebuild
- Platform Core modification during Industry OS work

---

## Next Steps

**P0 Complete** — do NOT implement P1/P2/P3 yet.

**P1 (Canonical Guard):** Enforce generated types as only persistence authority  
**P2 (Evidence Guard):** Enforce no GREEN status without evidence  
**P3 (Component Manifest):** Auto-discovery or explicit manifest (if needed)

Each phase must be proven GREEN before moving to next.

---

## References

- E7 Logistics Domain Controlled Rebuild: 366/366 tests PASS
- Architecture Guard baseline: `scripts/architecture/architecture-guard.ts`
- G0.5 Gate B: `scripts/governance/scoped-typecheck.ts`
- AGENTS.md: Bella Development Principles

**Implementation validated:** 2026-09-03  
**Evidence:** E7 field test complete
