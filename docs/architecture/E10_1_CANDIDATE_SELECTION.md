# E10.1 Fresh OS Field Test — Candidate Selection

**Date:** 2026-09-05  
**Purpose:** Select strongest Industry OS for independent Factory validation  
**Status:** ✅ AUTOMOTIVE SELECTED

---

## Selection Criteria (5 Required)

| Criterion | Required | Rationale |
|-----------|----------|-----------|
| **Canonical DB/schema exists** | ✅ | Factory requires source truth |
| **RLS + provenance** | ✅ | Security + audit trail |
| **Scope derivable (E9 can classify)** | ✅ | E9 rules must work |
| **NOT used for Factory development** | ✅ | **Independent validation** |
| **E10 pipeline executable** | ✅ | End-to-end test possible |

---

## Repository Survey Results

### Candidate 1: AUTOMOTIVE (auto_*) — ✅ SELECTED

**Database Evidence:**
- **Tables:** 14 (public schema with `auto_` prefix)
- **RLS:** 14/14 tables (100% coverage) ✅
- **Types:** Present in `database.types.ts` ✅
- **Relationships:** Foreign keys to party, accounting ✅

**Tables:**
```
auto_bookings              auto_bookings_history
auto_brands                auto_customer_journeys
auto_customer_profiles     auto_deposits
auto_journey_events        auto_journey_stages
auto_leads                 auto_models
auto_touchpoints           auto_variants
auto_vehicle_owners        auto_vehicle_status_logs
auto_vehicles              auto_vehicles_history
```

**Implementation Status:**
- `src/platform/automotive/`: ❌ **DOES NOT EXIST**
- Domain types: ❌ Not implemented
- Tests: ❌ Not implemented
- Repositories: ❌ Not implemented

**Factory Development Usage:**
- E7 Logistics: NO ✅
- E8 Education: NO ✅
- E10 Orchestrator: NO ✅
- E9 Evidence Collector: NO ✅

**Scope Classification (Predicted):**
- **Brand, Model, Variant:** CONFORM candidate (if types extracted from DB)
- **Vehicle, Booking:** CONFORM candidate (if types extracted from DB)
- **Customer Journey:** CONFORM or RECONSTRUCT (depends on implementation presence)

**E10 Pipeline Executability:**
- Evidence Collection: ✅ (14 tables in DB)
- Scope Derivation: ✅ (E9 can classify from DB + types)
- Build Verification: ✅ (no implementation = RECONSTRUCT or DEFER)
- Tests: ⚠️ (no tests = 0/0 PASS, not a failure)
- Typecheck: ✅ (no code = no errors)
- G0.5: ✅ (no regressions possible)
- Architecture Guard: ✅ (no violations possible)

**Score: 5/5 criteria met** ✅

---

### Candidate 2: REAL ESTATE (re_*) — ❌ REJECTED

**Database Evidence:**
- **Tables:** 13 (public schema with `re_` prefix)
- **RLS:** 11/13 tables (85% coverage) ⚠️
- **Types:** Present in `database.types.ts` ✅

**Implementation Status:**
- `src/platform/real-estate/`: ✅ **EXISTS**
- Domain implementation: ✅ Present
- Tests: ✅ Present

**Rejection Reason:**
- ❌ **FAILS Criterion #4:** Used for Factory development (implementation exists)
- Cannot provide **independent validation** (Real Estate patterns may have influenced Factory)

**Score: 4/5 criteria met** ❌

---

### Candidate 3: EDUCATION (edu_*) — ❌ REJECTED (Reference)

**Database Evidence:**
- **Tables:** 4 (Course, Enrollment, Attendance, Assessment)
- **RLS:** 4/4 tables ✅
- **Types:** Present ✅

**Implementation Status:**
- `src/platform/education/`: ✅ EXISTS
- Used extensively in E8, E10 fixture

**Rejection Reason:**
- ❌ **FAILS Criterion #4:** Core Factory development test case (E8, E10 controlled fixture)

**Score: 4/5 criteria met** ❌

---

### Candidate 4: LOGISTICS (logistics.*) — ❌ REJECTED (Reference)

**Database Evidence:**
- **Tables:** 6 (Item, Location, Inventory, Movement, Traceability, UOM)
- **RLS:** 6/6 tables ✅
- **Types:** Present ✅

**Implementation Status:**
- `src/platform/logistics/`: ✅ EXISTS
- Used extensively in E7, G0.5

**Rejection Reason:**
- ❌ **FAILS Criterion #4:** Core Factory development test case (E7 controlled rebuild)

**Score: 4/5 criteria met** ❌

---

## Selection Decision

**WINNER: AUTOMOTIVE (auto_*)** ✅

**Rationale:**

1. **Strongest independence test:**
   - Zero implementation (no Factory assumptions baked in)
   - Zero test files (no behavioral contracts exist)
   - Not used during E7/E8/E9/E10 development

2. **Complete canonical truth:**
   - 14 tables with 100% RLS coverage
   - Types generated in `database.types.ts`
   - Clear entity relationships (Brand → Model → Variant → Vehicle)

3. **Real domain complexity:**
   - Multi-entity coordination (Vehicle, Booking, Customer Journey)
   - History tracking (bookings_history, vehicles_history)
   - CRM integration (leads, customer profiles, touchpoints)

4. **Clear Factory test:**
   - E9 Evidence Collection: Can extract 14 tables
   - E9 Scope Derivation: Can classify entities (likely DEFER or RECONSTRUCT)
   - E10 Orchestration: Will reveal if Factory can handle **truly fresh** domain

5. **Low-risk failure mode:**
   - No existing code to break
   - No existing tests to maintain
   - Failure = Factory gap (not Automotive regression)

---

## Expected E10.1 Execution Flow

### Phase 1: Evidence Collection (E9.1)

```typescript
AutomotiveEvidence {
  tables: [
    { name: 'auto_brands', columns: [...], rls: true },
    { name: 'auto_models', columns: [...], rls: true },
    { name: 'auto_vehicles', columns: [...], rls: true },
    { name: 'auto_bookings', columns: [...], rls: true },
    // ... 10 more
  ],
  types: Database['public']['auto_brands'], // from database.types.ts
  domains: [],  // no implementation
  tests: []     // no tests
}
```

### Phase 2: Scope Derivation (E9)

**Predicted Classifications:**

| Entity | DB Table | Types | Domain | Tests | Decision | Reason |
|--------|----------|-------|--------|-------|----------|--------|
| Brand | ✅ | ✅ | ❌ | ❌ | **DEFER** | No implementation, not required |
| Model | ✅ | ✅ | ❌ | ❌ | **DEFER** | No implementation, not required |
| Vehicle | ✅ | ✅ | ❌ | ❌ | **DEFER** | No implementation, not required |
| Booking | ✅ | ✅ | ❌ | ❌ | **DEFER** | No implementation, not required |

**OR (if E9 rules classify as missing):**

| Entity | Decision | Reason |
|--------|----------|--------|
| All | **RECONSTRUCT** | Canonical persistence exists, implementation missing |

**Expected Outcome:**
- **DEFER decisions:** E10 pipeline completes successfully (no work to do)
- **RECONSTRUCT decisions:** E10 detects need for E10.2 (code generation not implemented)

### Phase 3: E10 Orchestration

**Pipeline Steps:**

1. **Evidence Collection:** ✅ (14 tables discovered)
2. **Scope Derivation:** ✅ (DEFER or RECONSTRUCT decisions)
3. **Build Verification:** ✅ (no build = no errors)
4. **Tests:** ✅ (0/0 tests = PASS by default)
5. **Typecheck:** ✅ (no automotive code = no errors)
6. **G0.5:** ✅ (44/44 platform scopes)
7. **Architecture Guard:** ✅ (no automotive code = no violations)

**Expected Result:**
- **If DEFER:** Pipeline completes, E10.1 PASS ✅
- **If RECONSTRUCT:** Pipeline stops at step 3 (E10.2 not implemented), E10.1 reveals gap ⚠️

---

## Risk Assessment

### Low Risk

- No existing code to break ✅
- No existing tests to maintain ✅
- No production usage to disrupt ✅
- Failure is **Factory learning**, not Automotive regression ✅

### Medium Risk

- RECONSTRUCT decision → E10.2 gap exposed (not blocking, deferred item)
- Complex domain → E9 rules may not classify correctly (reveals E9 gap)

### High Risk

- None identified

---

## Success Criteria

**E10.1 PASS if:**

```
[✅] Evidence Collection discovers 14 auto_* tables
[✅] Scope Derivation classifies all entities (DEFER/RECONSTRUCT/CONFORM)
[✅] E10 pipeline executes without errors
[✅] All gates PASS (tests, typecheck, G0.5, Architecture Guard)
[✅] Decision log captured (0 human decisions or logged exceptions)
[✅] Evidence artifacts saved
```

**E10.1 FAIL if:**

```
[❌] Evidence Collection crashes or misses tables
[❌] Scope Derivation cannot classify entities
[❌] E10 pipeline errors unexpectedly
[❌] Gates fail due to Factory bugs (not Automotive issues)
```

---

## Controlled Experiment Protocol

**RULES:**

1. **NO Factory modifications during test**
   - If E10.1 fails → root cause analysis → minimal fix → retest
   - DO NOT modify Factory to make Automotive pass specifically

2. **Document all failures**
   - Capture exact error
   - Classify as Factory gap or candidate issue
   - Root cause before any remediation

3. **Preserve evidence**
   - Save all E10 metrics JSON
   - Capture decision log
   - Record scope classification results

4. **Retest after fixes**
   - Minimal Factory changes only
   - Verify fix doesn't break E8 Education fixture
   - Re-run E10.1 from clean state

---

## Next Steps

**Immediate:**

1. Execute E10 orchestrator with Automotive configuration:
   ```typescript
   {
     industry: 'automotive',
     mode: 'fresh-os-validation',
     baseline: null // no fixture
   }
   ```

2. Capture all evidence artifacts

3. Document results:
   - E10.1 PASS → Update Factory Qualification Status → VERIFIED
   - E10.1 FAIL → Root cause → Fix → Retest

**After E10.1 PASS:**

- Update `FACTORY_QUALIFICATION_STATUS.md`
- Close E10.1 gate
- Plan production deployment (select 1 OS)

---

## References

**Automotive DB Evidence:**
- Migration files: `supabase/migrations/*.sql`
- Type contracts: `src/types/database.types.ts` (lines 2188-7074)
- RLS policies: 14/14 tables verified

**Factory Components:**
- E9.1 Evidence Collector: `scripts/factory/evidence-collector.ts`
- E9 Scope Engine: `scripts/factory/scope-engine.ts`
- E10 Orchestrator: `scripts/factory/orchestrator.ts`

**Qualification Docs:**
- `docs/architecture/FACTORY_QUALIFICATION_STATUS.md`
- `docs/architecture/E10_FACTORY_ORCHESTRATION.md`

---

**Decision:** AUTOMOTIVE SELECTED for E10.1 Fresh OS Field Test  
**Score:** 5/5 criteria met (strongest candidate)  
**Next:** Execute E10 orchestrator with automotive configuration
