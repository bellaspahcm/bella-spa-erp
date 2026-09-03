# Production Boundary — System Test Cleanup Strategy

**Date:** 2026-09-02  
**Context:** Nearly all products are system-test, aggressive cleanup allowed

---

## Production Boundary

### 🔒 PRODUCTION-LOCKED (No cleanup/refactor)

- **Bella Spa** (production)
- **Bella Babycare** (production customers)
- **Beauty Spa** (production)

**Rule:** Absolute protection. No refactor, no schema changes, no aggressive fixes.

---

### 🟢 SYSTEM-TEST (Aggressive cleanup allowed)

- **Bella Auto** (test/reference product)
- **Hospital** (test environment)
- **Medical** (test environment)
- **Dental** (test environment)
- **Warehouse/Logistics** (test environment)
- **Other test modules/products**

**Rule:** Fix aggressively. Schema reconciliation, dependency refactor, type alignment all allowed.

---

## Cleanup Pipeline

```text
Bella Auto
   ↓ PASS
Hospital
   ↓ PASS
Medical
   ↓ PASS
Dental
   ↓ PASS
Warehouse
   ↓ PASS
────────────
All System-Test Products CLEAN
   ↓
Root Compiler Check
   ↓ PASS or narrow HOTSPOT
Global Cleanup (remaining issues only)
   ↓
PRODUCTION-READY BASELINE
```

**Each product = independent checkpoint.**

---

## Current: Bella Auto Q1 Batch

**Focus:** AutoCustomerProvider + AutoInventoryProvider + AutoSalesProvider

**Approach:**
1. Schema evidence (migration vs. database.types vs. code)
2. Fix root cause (align code to actual schema)
3. Verify Q1 PASS
4. Move to Q2

**NOT:**
- ❌ Systematic `as any` to hide errors
- ❌ Investigation sprawl
- ❌ Root compiler investigation now

**YES:**
- ✅ Fix schema drift properly
- ✅ Align types with actual DB
- ✅ Checkpoint per batch
- ✅ Incremental progress

---

**Goal:** System-test products compiler-clean before production expansion

**Protection:** Bella Spa + Babycare + Beauty Spa untouched

