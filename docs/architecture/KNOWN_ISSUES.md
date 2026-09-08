# Known Platform Issues

**Status as of:** 2026-09-04

---

## Architecture Guard: Logistics Frozen Artifacts Missing

**Status:** ACTIVE BLOCKER (system-wide)

**Scope:** Logistics E7 Kernel frozen boundary enforcement

**Impact:**
- Architecture Guard fails validation
- Frozen boundary protection incomplete
- Does NOT affect M4 Intelligence Pipeline

**Evidence:**
```
npm run arch:guard

FROZEN BOUNDARY VIOLATION
Missing artifacts:
- src/platform/logistics/domain/inventory-operations.domain.ts
- src/platform/logistics/domain/rules/expiry.rule.ts
- src/platform/logistics/domain/rules/quantity.rule.ts
- src/platform/logistics/domain/rules/traceability.rule.ts
- src/platform/logistics/domain/rules/traceability.operations.ts
- src/platform/logistics/domain/rules/compliance.evaluation.ts
- src/platform/logistics/domain/rules/index.ts
```

**Classification:** Infrastructure / Logistics-specific

**Remediation:** Separate investigation required (not M4-related)

**Related:**
- See: AGENTS.md § Logistics HOTSPOT Analysis
- Product Tier: TEST (no real customers)
- Decision: DEFERRED (preserve OS expansion proof)

**Next steps:**
1. Evidence gathering (compiler profiling, code quality)
2. Classify: FIX / REFACTOR / TARGETED RESET / FULL RESET
3. Execute based on evidence

---

## M4 Status

**M4 Intelligence Pipeline:** ✅ CORE GOVERNANCE VERIFIED

See: P1 investigation series (P0 → P1.5)
