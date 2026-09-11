# Bella Land - Evidence Closure Plan

**Date:** 2026-09-11  
**Status:** ⏸️  IN PROGRESS  
**Target:** Full Capabilities RC (Option 2)

---

## 🎯 Objective

**Complete evidence closure for Projects, Apartments, Customers before RC seal.**

**Definition of Done:**
```text
For EACH capability (Projects, Apartments, Customers):
✅ At least one write workflow verified (create OR update)
✅ Tenant isolation verified (RLS negative tests)
✅ Field semantics documented (critical fields)

PLUS:
✅ Cross-capability regression (full business flow)
✅ Known debts documented with risk assessment
```

---

## 📋 Evidence Closure Checklist

### Phase 1: Projects

**Target:** Verify write workflow + tenant isolation

**Tasks:**
- [ ] **P1.1** Test project creation workflow
  - Browser OR runtime test
  - Input: name, description, location, price
  - Verify: persisted to `re_projects`
  - Check: `status` enum (on_sale/active mapping)

- [ ] **P1.2** Test project update workflow (optional if create passes)
  - Update existing project
  - Verify: changes persisted

- [ ] **P1.3** Tenant isolation (RLS negative tests)
  - T1: Tenant B READ project of Tenant A → BLOCKED
  - T2: Tenant B CREATE with Tenant A's tenant_id → BLOCKED
  - T3: Tenant B UPDATE project of Tenant A → BLOCKED
  - T4: Tenant B DELETE project of Tenant A → BLOCKED

- [ ] **P1.4** Document critical field semantics
  - status enum (on_sale → active frontend adaptation)
  - name, location, price_range
  - tenant_id, created_at

**Acceptance:**
```text
✅ At least one write test PASS
✅ 4/4 tenant isolation tests PASS
📋 Field semantics documented
```

---

### Phase 2: Apartments

**Target:** Verify write workflow + tenant isolation

**Tasks:**
- [ ] **A2.1** Test apartment creation workflow
  - Browser OR runtime test
  - Input: product_code, project_id, floor, unit_number, area, price
  - Verify: persisted to `real_estate_products`
  - Check: status enum, FK references

- [ ] **A2.2** Test apartment update workflow (optional if create passes)
  - Update existing apartment
  - Verify: changes persisted

- [ ] **A2.3** Tenant isolation (RLS negative tests)
  - T1: Tenant B READ apartment of Tenant A → BLOCKED
  - T2: Tenant B CREATE with Tenant A's tenant_id → BLOCKED
  - T3: Tenant B UPDATE apartment of Tenant A → BLOCKED
  - T4: Tenant B DELETE apartment of Tenant A → BLOCKED

- [ ] **A2.4** Document critical field semantics
  - product_code, project_id (FK), status
  - floor, unit_number, area, price
  - tenant_id

**Acceptance:**
```text
✅ At least one write test PASS
✅ 4/4 tenant isolation tests PASS
📋 Field semantics documented
```

---

### Phase 3: Customers

**Target:** Verify UI integration + write workflow + tenant isolation

**Tasks:**
- [ ] **C3.1** Confirm UI integration status
  - Check: UI uses `customerActions.ts` (real backend)
  - OR: UI still uses mock data
  - Document: current state

- [ ] **C3.2** Test customer creation workflow
  - Browser test (if UI connected)
  - OR runtime test (if UI not ready)
  - Input: name, phone, email
  - Verify: persisted to `re_customers`

- [ ] **C3.3** Test customer update workflow (optional if create passes)
  - Update existing customer
  - Verify: changes persisted

- [ ] **C3.4** Tenant isolation (RLS negative tests)
  - T1: Tenant B READ customer of Tenant A → BLOCKED
  - T2: Tenant B CREATE with Tenant A's tenant_id → BLOCKED
  - T3: Tenant B UPDATE customer of Tenant A → BLOCKED
  - T4: Tenant B DELETE customer of Tenant A → BLOCKED

- [ ] **C3.5** Document critical field semantics
  - name, phone, email (NOT NULL)
  - tenant_id
  - family_members, investment_profile (optional)

**Acceptance:**
```text
✅ UI integration status documented
✅ At least one write test PASS
✅ 4/4 tenant isolation tests PASS
📋 Field semantics documented
```

---

### Phase 4: Cross-Capability Regression

**Target:** Verify full business flow end-to-end

**Tasks:**
- [ ] **R4.1** Full business flow test
  ```text
  Create Project
    → Create Apartment (linked to Project)
      → Create Customer
        → Create Reservation (Customer + Apartment)
  
  Verify:
  - All entities persisted
  - FK references correct
  - Tenant context maintained
  - No data loss
  ```

- [ ] **R4.2** Tenant isolation regression
  ```text
  Verify:
  - Tenant A can access all own entities
  - Tenant B CANNOT access Tenant A's entities
  - Across Projects, Apartments, Customers, Reservations
  ```

- [ ] **R4.3** Business invariants regression
  ```text
  Verify:
  - Concurrency protection (Reservations)
  - Apartment cannot have 2 active reservations
  - Customer references valid
  - Project → Apartment hierarchy correct
  ```

**Acceptance:**
```text
✅ Full business flow PASS
✅ Cross-entity tenant isolation PASS
✅ Business invariants maintained
```

---

## 📊 Progress Tracker

```text
╔═══════════════════════╦═══════════╦═══════════════╦════════════╗
║ Phase                 ║ Write     ║ Tenant        ║ Status     ║
║                       ║ Workflow  ║ Isolation     ║            ║
╠═══════════════════════╬═══════════╬═══════════════╬════════════╣
║ P1. Projects          ║ ⏸️  TODO  ║ ⏸️  TODO      ║ ⏸️  PENDING ║
║ P2. Apartments        ║ ⏸️  TODO  ║ ⏸️  TODO      ║ ⏸️  PENDING ║
║ P3. Customers         ║ ⏸️  TODO  ║ ⏸️  TODO      ║ ⏸️  PENDING ║
║ P4. Cross-Capability  ║ ⏸️  TODO  ║ ⏸️  TODO      ║ ⏸️  PENDING ║
╚═══════════════════════╩═══════════╩═══════════════╩════════════╝

Overall Progress: 0/4 phases complete
Reservations (baseline): ✅ VERIFIED
```

---

## ⏱️  Estimated Effort

**Per capability:**
```text
Write workflow test:       1–2 hours
Tenant isolation tests:    1–2 hours
Documentation:             0.5 hour
Total per capability:      2.5–4.5 hours
```

**Total (3 capabilities):**
```text
Optimistic:  7.5 hours
Realistic:   9–12 hours
Pessimistic: 15 hours (if issues found)
```

**Cross-capability regression:**
```text
Test creation:   1 hour
Execution:       0.5 hour
Total:           1.5 hours
```

**Grand Total:** 10.5–13.5 hours (realistic)

---

## 🚦 Success Criteria

### Minimal (RC Seal Possible)

```text
✅ Projects:     1 write workflow + 4/4 isolation
✅ Apartments:   1 write workflow + 4/4 isolation
✅ Customers:    1 write workflow + 4/4 isolation
✅ Reservations: ✅ ALREADY VERIFIED
✅ Cross-capability: Full flow PASS

Known debts: DOCUMENTED + BOUNDED
```

### Optimal (High Confidence RC)

```text
✅ All minimal criteria
✅ Both create AND update tested per entity
✅ Field semantics fully documented
✅ Concurrency considerations addressed
✅ Migration reproducibility verified (DEBT-MIG-01 closed)
```

---

## 📋 Risk Assessment

### Green Flags ✅

```text
✅ Reservations already fully verified (strong baseline)
✅ Backend CRUD exists for all entities
✅ DB schema verified (integrity checks passed)
✅ Test infrastructure in place (can reuse patterns)
```

### Yellow Flags 🟡

```text
🟡 UI integration status unknown (Customers)
🟡 Write workflows never tested (may find issues)
🟡 RLS policies exist but not verified (Projects/Apartments/Customers)
🟡 Migration reproducibility gap (DEBT-MIG-01)
```

### Red Flags 🔴

```text
None currently identified.

If write tests FAIL:
🔴 Schema mismatch (backend vs DB)
🔴 RLS policies broken (security issue)
🔴 Business logic errors (data loss, corruption)

→ Must fix before RC seal
```

---

## 🎯 After Evidence Closure

### Final RC Evidence Review

**Re-evaluate:**
```text
1. All capabilities have write workflow evidence
2. Tenant isolation verified for all entities
3. Cross-capability flow working
4. Known debts bounded and documented
5. No new critical issues discovered
```

**Decision:**
```text
IF all criteria met:
  → ✅ SEAL RC
  → Document as Bella Land v2 Release Candidate
  → Plan deployment

IF critical issues found:
  → ⏸️  DEFER RC
  → Fix issues
  → Re-run evidence closure
```

### RC Seal Ceremony

**When evidence closure complete:**
```text
1. Update RC Readiness Matrix (all ✅)
2. Final regression run (all tests PASS)
3. Create RC_SEAL.md document
4. Tag RC version in git
5. Announce RC status
```

---

## 📝 Notes

**Important Boundaries:**

```text
Evidence gap ≠ Defect
- Projects/Apartments/Customers NOT broken
- They are UNVERIFIED (need evidence)

Readiness is evidence-based:
- If test finds real bug, fix before RC
- Don't force 98–100% by ignoring issues
- Evidence closure may reveal unknowns

Known debts remain post-closure:
- DEBT-MIG-01: Migration reproducibility
- DEBT-SCHEMA-01: Extra columns
- DEBT-AUTH-01: Actor attribution
- These do NOT block RC if bounded
```

**Pragmatic Testing:**

```text
Prefer:
✅ One strong write workflow test
✅ Tenant isolation negative suite
✅ Critical field verification

Over:
❌ 100% code coverage
❌ Every possible edge case
❌ Exhaustive field testing
```

**Test-Driven Evidence:**

```text
Test → Evidence → Confidence

Not:
Assumption → Hope → RC seal
```

---

**Status:** ⏸️  EVIDENCE CLOSURE IN PROGRESS

**Next:** Start with **Phase 1: Projects** (write workflow + tenant isolation)
