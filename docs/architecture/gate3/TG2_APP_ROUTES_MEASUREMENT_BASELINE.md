# TG-2 App Routes Coverage Measurement — Baseline

**Date:** 2026-09-08  
**Measurement Command:** `npm run governance:tg2`

---

## Status

✅ **29 App Routes Scopes Successfully Registered and Measured**

All 29 owner-based app routes scopes are now part of TG-2 gate enforcement.

---

## Coverage Impact

### Before App Routes Registration
```text
Total production files:    2200
Covered (platform only):    371 (17%)
Uncovered:                 1829
```

### After App Routes Registration
```text
Total production files:    2200
Covered (platform + apps):  973 (44%)
Uncovered:                 1227
```

### Delta
```text
Additional coverage:       +602 files
Coverage improvement:      +27 percentage points
Uncovered reduction:       -602 files
```

---

## Scope Registration Evidence

**29 tsconfig files created:**
- `tsconfig.app-routes-*.json` (one per owner/component)

**29 scopes in TG-2 GOVERNED_TSCONFIGS:**
- Lines 109-137 in `scripts/governance/tg2-production-coverage.ts`

**973 files now governed:**
- 371 platform files (existing scopes)
- 602 app routes files (new scopes)

---

## Configuration Fix Applied

**Issue:** Initial tsconfigs extended from non-existent `tsconfig.base.json`

**Fix:** Updated 29 app routes tsconfigs to extend from `./tsconfig.json`

**Result:** All 29 scopes now parse successfully

---

## Remaining Uncovered Files

**1227 uncovered files remain** — these are NOT app routes scope failures.

Uncovered categories:
- `packages/shared/*` — Shared utilities not yet scoped
- `src/__tests__/**` — Test fixtures (intentionally excluded from production scopes)
- Other product/service files outside current scope definitions

**These uncovered files are outside the App Routes Ownership Mapping scope.**

---

## Next Steps

### NOT Done in This Measurement
- ❌ Diagnostic remediation
- ❌ Force green coverage
- ❌ Expand scopes to capture all uncovered files

### Next Phase
1. **Per-Scope Diagnostic Measurement** — Identify which of 29 scopes have TypeScript diagnostics
2. **Owner Assignment** — Map diagnostic counts to owners
3. **Baseline Documentation** — Record diagnostic state before remediation
4. **Prioritization** — Determine which scopes require immediate attention

---

## Evidence Boundary

> **29 scopes registered + measured ≠ TG-2 COMPLETE**

TG-2 gate closes only when:
1. Coverage requirement met across entire repository
2. All governed scopes pass TypeScript checks
3. Diagnostic remediation complete where required

**Current achievement:**
- ✅ App routes ownership mapped (409 routes)
- ✅ 29 owner-based scopes registered
- ✅ Scopes successfully integrated into TG-2 gate
- ✅ Coverage measurement baseline established

**Remaining work:**
- Diagnostic measurement per scope
- Diagnostic remediation by owner
- Extended scope coverage for remaining uncovered files

---

## Canonical Artifacts

1. **Frozen Ownership Map:** `TG2_APP_ROUTES_OWNERSHIP_MAP_FROZEN.csv` (445 routes)
2. **Scope Architecture:** `TG2_APP_ROUTES_SCOPE_ARCHITECTURE.md` (29 scopes)
3. **29 Tsconfig Files:** `tsconfig.app-routes-*.json`
4. **TG-2 Registration:** Updated `scripts/governance/tg2-production-coverage.ts`
5. **Measurement Baseline:** This document

---

## Success Criteria Met

```text
✅ 409/409 KNOWN routes governed
✅ 29 scopes designed and registered
✅ 0 UNKNOWN/AMBIGUOUS forced into scopes
✅ No mega src/app/** scope
✅ TG-2 gate successfully resolves all 29 scopes
✅ Coverage measurement baseline established
✅ +602 files brought under governance
```

---

## Status

🎉 **APP ROUTES OWNERSHIP MAPPING COMPLETE**

📊 **TG-2 COVERAGE BASELINE ESTABLISHED**

📋 **Next: Per-scope diagnostic measurement + owner-driven remediation**

