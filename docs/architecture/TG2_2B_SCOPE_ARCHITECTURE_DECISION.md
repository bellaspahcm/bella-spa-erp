# TG-2.2B Governed Scope Architecture Decision

**Date:** September 8, 2026  
**Status:** 🟡 **DECISION IN PROGRESS**

---

## Context

**TG-2.2A outcome:**
- 13 Healthcare capabilities mapped to 4 owners
- All capabilities in `src/services/healthcare/**` (currently 0% covered)
- Existing scope: `tsconfig.platform-healthcare.json` (covers Platform only)

**Ownership distribution:**
```text
Hospital           4 capabilities
Medical Clinic     1 capability
Dental             0 capabilities (in service layer)
Shared Healthcare  8 capabilities
```

---

## Current Inventory

### Existing Scopes
1. **tsconfig.platform-healthcare.json** ✅
   - Covers: `src/platform/healthcare/**`
   - Status: Qualified, executable
   - Gap: Does NOT cover `src/services/healthcare/**`

2. **Products** ✅
   - `src/products/bella-hospital/`
   - `src/products/bella-medical/`
   - `src/products/bella-dental/`
   - Status: No product-level tsconfigs yet

### Uncovered Capabilities (13 files)
```text
src/services/healthcare/
├── emergency-service.ts              → HOSPITAL
├── icu-service.ts                    → HOSPITAL
├── operating-room-service.ts         → HOSPITAL (nursing-related)
├── patient-flow-service.ts           → HOSPITAL (nursing-related)
├── appointments-actions.ts           → MEDICAL CLINIC
├── pharmacy-actions.ts               → SHARED HEALTHCARE
├── laboratory-service.ts             → SHARED HEALTHCARE
├── lis-ris-actions.ts                → SHARED HEALTHCARE
├── billing-actions.ts                → SHARED HEALTHCARE
├── bhyt-actions.ts                   → SHARED HEALTHCARE
├── clinical-alerts-service.ts        → SHARED HEALTHCARE
├── healthcare-service.ts             → SHARED HEALTHCARE
└── healthcare-actions.ts             → SHARED HEALTHCARE
```

---

## Architecture Options

### Option A: Single Healthcare Services Scope ⚠️
**Create:** `tsconfig.healthcare-services.json`
- **Covers:** All `src/services/healthcare/**`
- **Pro:** Simple, one scope
- **Con:** Violates ownership boundaries (mixes Hospital + Medical Clinic + Shared)
- **Verdict:** ❌ **REJECTED** — loses ownership clarity

### Option B: Owner-Based Scopes ✅
**Create 3 scopes matching owners:**
1. `tsconfig.hospital-services.json` → Hospital-owned services (4 files)
2. `tsconfig.medical-services.json` → Medical Clinic-owned services (1 file)
3. `tsconfig.healthcare-shared-services.json` → Shared services (8 files)

- **Pro:** Preserves ownership boundaries, governance aligned with architecture
- **Con:** 3 scopes instead of 1
- **Verdict:** ✅ **RECOMMENDED** — correct architecture

### Option C: Extend Platform Scope ⚠️
**Extend:** `tsconfig.platform-healthcare.json` to include `src/services/healthcare/**`
- **Pro:** Reuses existing scope
- **Con:** Platform scope should NOT cover Product/Service layer services
- **Verdict:** ❌ **REJECTED** — violates layer boundaries

### Option D: Product-Level Scopes Only 🤔
**Create product tsconfigs:**
- `tsconfig.product-hospital.json` → Hospital product + services
- `tsconfig.product-medical.json` → Medical Clinic product + services
- `tsconfig.product-dental.json` → Dental product

- **Pro:** Aligns with product boundaries
- **Con:** Dental has 0 service files (empty scope), cross-product Shared services unclear
- **Verdict:** ⚠️ **PARTIAL** — good for Hospital/Medical, unclear for Shared

---

## Recommended Decision: Hybrid Architecture (Option B + D)

**Create 5 scopes:**

### Service Layer (Owner-Based)
1. **tsconfig.hospital-services.json**
   - Coverage: `src/services/healthcare/{emergency,icu,operating-room,patient-flow}*`
   - Owner: Hospital
   - Files: 4

2. **tsconfig.medical-services.json**
   - Coverage: `src/services/healthcare/appointments-actions.ts`
   - Owner: Medical Clinic
   - Files: 1

3. **tsconfig.healthcare-shared-services.json**
   - Coverage: `src/services/healthcare/{pharmacy,lab*,lis-ris,billing,bhyt,clinical-alerts,healthcare-service,healthcare-actions}*`
   - Owner: Shared Healthcare
   - Files: 8

### Product Layer (Future)
4. **tsconfig.product-hospital.json** (future)
   - Coverage: `src/products/bella-hospital/**`
   - Owner: Hospital Product

5. **tsconfig.product-medical.json** (future)
   - Coverage: `src/products/bella-medical/**`
   - Owner: Medical Clinic Product

**Dental:** No scope created (0 service files; product scope deferred until capability exists)

---

## Scope Qualification Criteria

Each scope MUST pass:
1. ✅ **Executable:** Compilation completes <120s
2. ✅ **Deterministic:** Rerun produces identical results
3. ✅ **Qualified:** Contains production code (not empty/test-only)
4. ✅ **Integrated:** Registered in TG-2 gate + Factory workflow

---

## Implementation Plan

### Phase 1: Service Layer Scopes (TG-2.2B)
```bash
# Create 3 service-layer scopes
1. tsconfig.hospital-services.json
2. tsconfig.medical-services.json
3. tsconfig.healthcare-shared-services.json

# Register in TG-2 gate
4. Update scripts/governance/tg2-production-coverage.ts

# Validate
5. Run each scope (<120s)
6. Rerun TG-2 gate
7. Verify 13 files now covered
```

### Phase 2: Product Layer Scopes (Future)
- Defer until TG-2.2B proven
- Hospital/Medical products when product-layer capabilities mature
- Do NOT create Dental scope until capabilities exist

---

## Exit Criteria

```text
✅ Every canonical owner → has exactly one clear governance scope
✅ Every scope → executable, qualified, deterministic
✅ TG-2 coverage → 13 Healthcare files now covered
✅ No production capability → depends on root tsconfig
✅ Dental → no empty scope (correct, 0 files = no scope)
```

---

## Decision Status

**Recommendation:** Option B (Owner-Based Service Scopes)

**Rationale:**
1. Preserves ownership boundaries from TG-2.2A
2. Aligns governance with architecture
3. Executable and qualified (real files)
4. No artificial scopes (Dental correctly excluded)

**Next:** Human approval → Implementation → Validation

---

**Decision needed from:** Quang  
**Blocked on:** Architecture approval for 3 service scopes

