# Phase 2: Apartments Evidence Closure — Kickoff

**Product:** Bella Land v2  
**Phase:** P2 — Apartments  
**Started:** 2026-09-11  
**Status:** 🟡 **IN PROGRESS**

---

## 🎯 Phase Objective

Verify Apartments capability for RC readiness using the same evidence standard applied to Projects (Phase 1).

**Success Criteria:** All evidence gates passed → Phase sealed → Move to Phase 3 (Customers)

---

## 📋 Evidence Standard (Replicate P1 Pattern)

```text
P2.0  Discovery
      ├── Schema analysis
      ├── Relationship to Projects (parent)
      ├── Tenant isolation requirements
      └── RLS policy review

P2.1  Production Write Flow
      ├── Test script (minimum 5 tests)
      ├── Field semantics verification
      ├── Parent-child relationship validation
      └── Tenant context injection

P2.2  Authenticated Tenant Isolation
      ├── A1: Own-tenant create
      ├── A2: Own-tenant read
      ├── A3: Cross-tenant read blocked
      ├── A4: Cross-tenant update blocked
      ├── A5: Cross-tenant delete blocked
      ├── A6: Tenant forgery blocked (WITH CHECK)
      ├── A7: Tenant escape blocked (WITH CHECK)
      └── A8: No query leakage

P2.3  Browser Runtime Verification
      ├── Manual UI test
      ├── Full production path trace
      └── Evidence capture (screenshot + script)

P2.4  Regression Testing
      ├── Re-run P2.1 after any fixes
      └── Verify parent relationship integrity

P2.5  Evidence & Seal
      ├── Documentation complete
      ├── Cleanup debug code
      └── Phase seal document
```

---

## 🏗️ Known Architecture

### Schema

**Table:** `real_estate_apartments`

**Key fields (from prior work):**
- `id` (uuid, PK)
- `project_id` (uuid, FK → real_estate_projects)
- `tenant_id` (uuid, FK → tenants)
- `apartment_number` (text)
- `floor` (integer)
- `block` (text, nullable)
- `status` (text)
- `area` (numeric, nullable)
- `bedrooms` (integer, nullable)
- `bathrooms` (integer, nullable)
- `price` (numeric, nullable)
- `created_at`, `updated_at` (timestamps)

### Relationships

```text
real_estate_projects (1)
         ↓
real_estate_apartments (N)
         ↓
real_estate_products (N)
```

### RLS Policy

**Expected:** Similar to Projects
- USING clause: filters to authenticated tenant
- WITH CHECK clause: validates tenant_id on INSERT/UPDATE
- Role-based: admin/manager access

**To verify:** P2.0 Discovery will confirm actual policy configuration

---

## 🔍 P2.0 Discovery Checklist

### Schema Verification

- [ ] Confirm `real_estate_apartments` table exists
- [ ] Verify `tenant_id` column present and NOT NULL
- [ ] Verify `project_id` FK relationship
- [ ] Review all columns and constraints
- [ ] Document field semantics

### RLS Policy Analysis

- [ ] List all policies on `real_estate_apartments`
- [ ] Verify USING clause syntax
- [ ] Verify WITH CHECK clause present
- [ ] Compare to Projects RLS model
- [ ] Document any differences

### Code Layer Discovery

- [ ] Locate ApartmentService (if exists)
- [ ] Locate apartmentActions server actions
- [ ] Locate UI components (apartments page)
- [ ] Trace production write flow (static)
- [ ] Document tenant injection points

### Relationship Testing Plan

- [ ] Plan FK integrity tests (project_id must exist)
- [ ] Plan parent tenant inheritance (apartment.tenant_id must match project.tenant_id)
- [ ] Plan cross-tenant parent access block (cannot create apartment for other tenant's project)

**CRITICAL INVARIANT — Cross-Entity Tenant Integrity:**

```text
✅ ALLOWED:
Tenant A
  └── Project A
       └── Apartment A

❌ MUST BLOCK:
Tenant A creates Apartment
  ├── apartment.tenant_id = Tenant A  (valid)
  └── apartment.project_id = Project B (Tenant B)  ❌ VIOLATION

Tenant B reads/updates Apartment A  ❌ BLOCKED by RLS

Tenant A moves Apartment A → Project B  ❌ BLOCKED
```

**Why critical:** RLS on `apartments` table alone is NOT sufficient. Must verify:
1. `apartment.tenant_id` = authenticated tenant (standard RLS)
2. `apartment.project_id` points to project WHERE `project.tenant_id` = authenticated tenant
3. Cannot create/update apartment with valid own tenant_id but invalid parent project

**Test coverage required:**
- A9: Cross-entity forgery (create apartment under other tenant's project)
- A10: Cross-entity escape (move apartment to other tenant's project via UPDATE)

---

## 🧪 P2.1 Test Plan

### Production Write Flow Test Script

**Name:** `scripts/bella-land/test-apartment-creation.ts`

**Tests (minimum 5):**

```text
T1  Create apartment via production path
    ├── Authenticate as Tenant A admin
    ├── Get valid project_id from Tenant A
    ├── Call ApartmentService.createApartment
    ├── Verify row created with correct tenant_id
    └── ASSERT: tenant_id = Tenant A

T2  Field semantics verification
    ├── Create apartment with 5 key fields
    ├── apartment_number: "101"
    ├── floor: 1
    ├── status: "available"
    ├── area: 85.5
    ├── price: 2500000000
    └── ASSERT: All fields persisted correctly

T3  Reload/read-back
    ├── Create apartment
    ├── Query by ID
    └── ASSERT: All fields match

T4  Parent relationship enforcement
    ├── Attempt to create apartment with non-existent project_id
    └── ASSERT: FK constraint violation

T5  Parent tenant inheritance
    ├── Create apartment under Tenant A project
    ├── Verify apartment.tenant_id = project.tenant_id
    └── ASSERT: Tenant inheritance correct
```

**Success Criteria:** 5/5 tests PASS

---

## 🔐 P2.2 Tenant Isolation Test Plan

### Test Script

**Name:** `scripts/bella-land/test-apartment-tenant-isolation.ts`

**Tests (10 required — includes cross-entity integrity):**

```text
A1  Own-tenant create
    ├── Tenant A creates apartment under Tenant A project
    └── ASSERT: SUCCESS

A2  Own-tenant read
    ├── Tenant A queries own apartments
    └── ASSERT: All Tenant A apartments visible

A3  Cross-tenant read blocked
    ├── Tenant A queries Tenant B apartment by ID
    └── ASSERT: Row invisible (no error, empty result)

A4  Cross-tenant update blocked
    ├── Tenant A attempts UPDATE on Tenant B apartment
    └── ASSERT: 0 rows affected

A5  Cross-tenant delete blocked
    ├── Tenant A attempts DELETE on Tenant B apartment
    └── ASSERT: 0 rows affected

A6  Tenant forgery blocked (WITH CHECK on INSERT)
    ├── Attempt INSERT with apartment.tenant_id = Tenant B
    ├── But authenticated user = Tenant A
    └── ASSERT: RLS WITH CHECK violation

A7  Tenant escape blocked (WITH CHECK on UPDATE)
    ├── Tenant A updates own apartment
    ├── Attempt to change tenant_id to Tenant B
    └── ASSERT: RLS WITH CHECK violation

A8  No query leakage
    ├── Tenant A queries apartments with invalid filters
    └── ASSERT: No Tenant B data in results

A9  Cross-entity forgery blocked (parent project ownership)
    ├── Tenant A attempts to create apartment
    ├── With apartment.tenant_id = Tenant A (valid)
    ├── But apartment.project_id = Project B (Tenant B)
    └── ASSERT: BLOCKED (FK constraint OR RLS OR service validation)

A10 Cross-entity escape blocked (move to other tenant's project)
    ├── Tenant A owns Apartment A under Project A
    ├── Tenant A attempts UPDATE apartment.project_id = Project B (Tenant B)
    └── ASSERT: BLOCKED (FK constraint OR RLS OR service validation)
```

**Success Criteria:** 10/10 tests PASS

**Note:** A9/A10 test **cross-entity tenant integrity**, which is critical for parent-child relationships. Standard RLS (A1-A8) is necessary but NOT sufficient for hierarchical data.

---

## 🖥️ P2.3 Browser Test Plan

### Manual UI Test

**Flow:**

1. Login as Tenant A admin
2. Navigate to `/dashboard/real-estate/apartments` (or Projects → Apartments)
3. Select Project (Tenant A project)
4. Click "Create Apartment"
5. Fill form:
   - Apartment Number: "P2-Test-[timestamp]"
   - Floor: 5
   - Status: "available"
   - Area: 80
   - Price: 2000000000
6. Submit
7. Verify UI shows success
8. Verify apartment appears in list
9. Reload page
10. Verify persistence

**Evidence:**
- Screenshot showing apartment in UI
- DB query confirming row exists
- tenant_id matches authenticated user

### Script Test

**Name:** `scripts/bella-land/manual-apartment-smoke-test.ts`

**Purpose:** Script-based verification using ApartmentService directly

**Success Criteria:**
- Apartment created
- tenant_id correct
- Parent relationship valid
- No RLS violations

---

## 📊 Evidence Artifacts Plan

### Documentation

1. `P2_APARTMENTS_DISCOVERY.md` — Schema + RLS + code discovery
2. `P2_TEST_RESULTS.md` — All test execution results
3. `P2_BROWSER_EVIDENCE.md` — Browser runtime verification
4. `APARTMENTS_EVIDENCE_COMPLETE.md` — Final evidence report
5. `APARTMENTS_PHASE_SEALED.md` — Phase seal document

### Test Scripts

1. `test-apartment-creation.ts` — P2.1 production write flow
2. `test-apartment-tenant-isolation.ts` — P2.2 security verification
3. `manual-apartment-smoke-test.ts` — P2.3 script verification

### Migrations (if needed)

- Only if RLS gaps discovered (like Projects WITH CHECK fix)

**Total Expected:** 5 docs + 3 scripts + migrations (if any)

---

## 🚧 Potential Blockers

| Blocker | Mitigation |
|---------|------------|
| RLS missing WITH CHECK | Deploy migration (replicate Projects fix) |
| Parent FK not enforced | Investigate + fix schema constraint |
| UI not implemented | Document as gap, adjust RC scope decision |
| Service layer missing | Implement following Projects pattern |
| Test users cannot access parent projects | Create test projects first in setup |

---

## ⏭️ Execution Plan

### Step 1: P2.0 Discovery (Now)

1. Run schema inspection
2. Review RLS policies
3. Locate code layers (service, action, UI)
4. Document findings
5. Identify any gaps vs. Projects pattern

**Deliverable:** `P2_APARTMENTS_DISCOVERY.md`

### Step 2: P2.1 Production Write Flow

1. Create test script
2. Execute 5 tests
3. Document results
4. Fix any issues discovered
5. Re-run until 5/5 PASS

**Deliverable:** `test-apartment-creation.ts` + results

### Step 3: P2.2 Tenant Isolation

1. Create 8-test isolation script
2. Execute authenticated tests (NOT service-role)
3. Document results
4. Deploy WITH CHECK fix if needed
5. Re-run until 8/8 PASS

**Deliverable:** `test-apartment-tenant-isolation.ts` + results

### Step 4: P2.3 Browser Runtime

1. Manual UI test
2. Capture evidence (screenshot)
3. Run script verification
4. Document full production trace

**Deliverable:** `P2_BROWSER_EVIDENCE.md`

### Step 5: P2.4 Regression

1. Re-run P2.1 after any fixes
2. Confirm no breaks
3. Verify parent relationships still valid

**Deliverable:** Regression PASS confirmation

### Step 6: P2.5 Seal

1. Create final evidence report
2. Cleanup debug code
3. Create phase seal document
4. Update Bella Land v2 RC progress

**Deliverable:** `APARTMENTS_PHASE_SEALED.md`

---

## 📈 Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Discovery complete | 100% | 🟡 0% |
| Write flow tests PASS | 5/5 | 🟡 0/5 |
| Isolation tests PASS | 10/10 | 🟡 0/10 |
| Browser runtime PASS | 1/1 | 🟡 0/1 |
| Regression PASS | Yes | 🟡 Pending |
| Documentation complete | 5 docs | 🟡 0/5 |

**Overall Phase Progress:** 🟡 **0%**

---

## 🔗 Dependencies

### Upstream (Complete)

✅ **Phase 1: Projects** — Provides parent entity and pattern to replicate

### Downstream (Blocked on P2)

🟡 **Phase 3: Customers** — Waits for Apartments seal  
🟡 **Bella Land v2 RC** — Requires all phases complete

---

## ▶️ Next Action

**Execute P2.0 Discovery:**

1. Inspect `real_estate_apartments` schema
2. Review RLS policies
3. Locate ApartmentService and apartmentActions
4. Locate UI components
5. Document findings

**Command:**
```bash
npm run db:console
# or direct Supabase query tool
```

**SQL Queries:**
```sql
-- Schema inspection
SELECT * FROM information_schema.columns 
WHERE table_name = 'real_estate_apartments';

-- RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'real_estate_apartments';

-- FK relationships
SELECT * FROM information_schema.table_constraints 
WHERE table_name = 'real_estate_apartments';
```

---

**Phase 2: Apartments** 🟡 **STARTED**  
**Current Step:** → **P2.0 Discovery**  
**Previous Phase:** ✅ **Projects (Sealed)**

