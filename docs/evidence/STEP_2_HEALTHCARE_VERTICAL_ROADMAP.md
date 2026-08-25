# Step ② Healthcare Product Vertical Implementation Roadmap

**Status:** 📋 PLANNING  
**Effective Date:** 2026-08-23  
**Prerequisite:** ✅ Step ① Architecture Guard Complete (Logistics Kernel E7.1/E7.2/E7.3 FROZEN)  
**Goal:** Implement first Healthcare Product Vertical on top of frozen Healthcare Kernel H1-H12

---

## Context

### ✅ What We Have (Step ① Complete)

**Logistics OS Kernel:**
- ✅ E7.1 Domain Kernel (12 artifacts, 366 tests) — FROZEN
- ✅ E7.2 Operational Kernel (4 artifacts, 73 tests) — FROZEN  
- ✅ E7.3 Rules & Traceability (9 artifacts, 108 tests) — FROZEN
- ✅ 5-Layer Architecture Guard enforcement
- ✅ 547/547 regression tests PASSING

**Healthcare OS Kernel Status:**
- 🔒 H1-H12 Kernel — FROZEN (Kernel Candidate Freeze)
- ✅ 52/52 Suites, 504/504 Tests PASSING
- ✅ Healthcare Constitution ACTIVE
- ✅ 11 Automated Verification Gates defined
- ✅ 20 Non-Negotiable Laws documented

---

## Step ② Mission

**Build the FIRST Healthcare Product Vertical** on top of frozen Healthcare Kernel H1-H12 to prove:

1. ✅ **Kernel Freeze works** - Can build products WITHOUT modifying H1-H12
2. ✅ **Architecture Guard works** - 5-layer enforcement prevents Kernel violations
3. ✅ **Contract-Only Access** - Product → Contract → Kernel pattern enforced
4. ✅ **11 Gates Pass** - Full verification suite GREEN
5. ✅ **Zero Regression** - 52/52 Suites remain PASSING

---

## Product Vertical Options

### Option A: Bella Dental (RECOMMENDED)

**Rationale:**
- ✅ Clear bounded context (dental procedures, tooth charting)
- ✅ Moderate complexity (good first vertical)
- ✅ Well-defined Kernel dependencies (Patient, Encounter, Clinical Order)
- ✅ Market demand (Vietnam dental market growing)

**Scope:**
- Dental Assessment
- Dental Treatment Plan
- Dental Procedure Tracking
- Dental Tooth Chart (Product Extension)
- Dental Billing Projection

**Estimated Effort:** 2-3 weeks

---

### Option B: Bella Medical Clinic

**Rationale:**
- ✅ Simpler than Hospital
- ✅ Reuses most H1-H12 capabilities directly
- ✅ Good for proving "thin vertical" pattern

**Scope:**
- Outpatient Consultation
- Prescription Management
- Lab Order Management
- Simple Billing

**Estimated Effort:** 1-2 weeks

---

### Option C: Bella Pharmacy

**Rationale:**
- ✅ Focused scope (medication dispensing)
- ✅ Strong Kernel dependency on Clinical/Pharmacy Engine
- ✅ High business value

**Scope:**
- Prescription Reception
- Medication Dispensing
- Inventory Integration
- Drug Interaction Check (via H8 CDS)

**Estimated Effort:** 1-2 weeks

---

## Recommended Path: **Option A — Bella Dental**

### Why Dental First?

1. **Goldilocks Complexity:** Not too simple (proves Contract pattern), not too complex (finishes in reasonable time)
2. **Clear Product Extension:** Tooth charting is OBVIOUSLY product-specific, won't tempt Kernel modification
3. **Market Validation:** Dental clinics in Vietnam actively looking for software
4. **Architecture Proof:** Best demonstrates Product → Contract → Kernel boundary

---

## Step ② Execution Plan

### Phase 1: Architecture Analysis (2-3 days)

**Deliverables:**

1. **Product Manifest** (`docs/products/dental/PRODUCT_MANIFEST.md`)
   - Capabilities & Scope
   - Business Requirements
   - User Stories

2. **Ownership Map** (`docs/products/dental/OWNERSHIP_MAP.md`)
   - WHO OWNS THIS DATA?
   - Patient → Kernel (Person Engine)
   - Encounter → Kernel (Encounter Engine)
   - Tooth Chart → Product (Dental Vertical)
   - Procedure → Product (Dental Vertical)

3. **Contract Dependency Map** (`docs/products/dental/CONTRACT_MAP.md`)
   - Product → Public Contracts → Kernel
   - No direct `hc_*` table access
   - Event subscriptions documented

4. **Database Migration Plan** (`docs/products/dental/DB_MIGRATION_PLAN.md`)
   - `CREATE TABLE dental_tooth_chart` ✅ Additive
   - `CREATE TABLE dental_procedures` ✅ Additive
   - `CREATE TABLE dental_treatment_plans` ✅ Additive
   - `CREATE INDEX` on foreign keys ✅ Additive
   - **Zero ALTER/DROP of Kernel tables** ✅

5. **11 Verification Gates Test Plan** (`docs/products/dental/TEST_PLAN.md`)
   - Gate 1: Architecture Compliance
   - Gate 2: Contract Boundary
   - Gate 3: Tenant Isolation
   - Gate 4: RLS & Authorization
   - Gate 5: DB Migration Safety
   - Gate 6: Event-After-Persistence
   - Gate 7: Clinical Safety Routing
   - Gate 8: Temporal Provenance
   - Gate 9: Rule Governance
   - Gate 10: Audit & Evidence
   - Gate 11: Full Kernel Regression

**Exit Criteria:**
- ✅ All 5 documents reviewed and approved
- ✅ Zero Architectural Gaps identified
- ✅ Architecture Guard pre-approval

---

### Phase 2: Database Foundation (1 day)

**Tasks:**
1. Create additive migration scripts
2. Define Product Vertical tables schema
3. Add RLS policies
4. Create database functions (if needed)
5. Verify migration safety (Gate 5)

**Files:**
- `migrations/dental/001_create_dental_foundation.sql`
- `migrations/dental/002_add_dental_rls_policies.sql`

**Exit Criteria:**
- ✅ Migration runs successfully
- ✅ Zero Kernel table modifications
- ✅ RLS policies active
- ✅ Tenant isolation verified

---

### Phase 3: Domain Layer (3-4 days)

**Tasks:**
1. Define Dental domain entities
2. Implement Product Vertical services
3. Create Public Contracts interfaces
4. Wire up Kernel dependencies (via Contracts)
5. Implement Event subscribers

**Files:**
- `src/products/dental/domain/entities/`
- `src/products/dental/domain/services/`
- `src/products/dental/contracts/`
- `src/products/dental/events/`

**Exit Criteria:**
- ✅ Domain logic complete
- ✅ Contract boundaries verified (Gate 2)
- ✅ Event-After-Persistence enforced (Gate 6)
- ✅ Clinical Safety routing via H8/H10 (Gate 7)

---

### Phase 4: API Layer (2 days)

**Tasks:**
1. Implement REST API endpoints
2. Add authorization checks
3. Validate Tenant Isolation
4. Document API contracts

**Files:**
- `src/app/api/dental/`
- `docs/products/dental/API_SPECIFICATION.md`

**Exit Criteria:**
- ✅ API endpoints functional
- ✅ Authorization working (Gate 4)
- ✅ Tenant isolation verified (Gate 3)

---

### Phase 5: UI Layer (3-4 days)

**Tasks:**
1. Create Dental module UI pages
2. Implement Tooth Chart visualization
3. Add Treatment Plan management
4. Procedure tracking interface

**Files:**
- `src/app/dashboard/dental/`
- `src/components/dental/`

**Exit Criteria:**
- ✅ UI functional
- ✅ User experience validated
- ✅ Integration with API complete

---

### Phase 6: Testing & Verification (3-4 days)

**Tasks:**
1. Write 11 Verification Gate tests
2. Run full Kernel Regression (52/52 Suites)
3. Fix any failures
4. Document test results

**Files:**
- `src/products/dental/__tests__/`
- `docs/products/dental/VERIFICATION_REPORT.md`

**Exit Criteria:**
- ✅ Gate 1-11 ALL PASSING
- ✅ Kernel Regression 52/52 GREEN
- ✅ Architecture Guard approval
- ✅ Zero Kernel modifications

---

### Phase 7: Documentation & Handoff (1-2 days)

**Tasks:**
1. Complete product documentation
2. Create user training materials
3. Document deployment procedures
4. Prepare demo

**Files:**
- `docs/products/dental/USER_GUIDE.md`
- `docs/products/dental/DEPLOYMENT_GUIDE.md`
- `docs/products/dental/COMPLETION_CERTIFICATE.md`

**Exit Criteria:**
- ✅ Documentation complete
- ✅ Demo ready
- ✅ Deployment verified

---

## Total Timeline

**Estimated Duration:** **15-20 days** (3-4 weeks)

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Architecture Analysis | 2-3 days | Day 3 |
| Phase 2: Database Foundation | 1 day | Day 4 |
| Phase 3: Domain Layer | 3-4 days | Day 8 |
| Phase 4: API Layer | 2 days | Day 10 |
| Phase 5: UI Layer | 3-4 days | Day 14 |
| Phase 6: Testing & Verification | 3-4 days | Day 18 |
| Phase 7: Documentation & Handoff | 1-2 days | Day 20 |

---

## Success Criteria

### Must Have (Mandatory)

- ✅ **Gate 1-11 ALL PASSING** - Full verification suite GREEN
- ✅ **Kernel Regression 52/52 PASSING** - Zero regression
- ✅ **Zero Kernel Modifications** - H1-H12 remain FROZEN
- ✅ **Contract-Only Access** - No direct `hc_*` table queries
- ✅ **Tenant Isolation** - RLS working, cross-tenant blocked
- ✅ **Additive Migrations Only** - All CREATE, no ALTER/DROP
- ✅ **Architecture Guard Approval** - 5-layer enforcement passing

### Should Have (Quality)

- ✅ API documentation complete
- ✅ User guide complete
- ✅ Deployment guide complete
- ✅ Test coverage > 80%

### Nice to Have (Business)

- ✅ Demo video recorded
- ✅ User training materials
- ✅ Marketing materials

---

## Risks & Mitigations

### Risk 1: Architectural Gap Discovered

**Scenario:** Product needs capability not exposed by Kernel Contracts

**Mitigation:**
1. **STOP coding immediately**
2. **Document Architectural Gap**
3. **Human Architect Review**
4. **Decide:** Add Contract OR defer feature OR modify Kernel (requires ACR)

**Protocol:** DO NOT bypass — report via `ARCHITECTURAL_GAP_DETECTED.md`

---

### Risk 2: Kernel Regression Failures

**Scenario:** Product changes break Kernel tests

**Mitigation:**
1. **Run regression frequently** (after each phase)
2. **Revert changes immediately** if regression breaks
3. **Root cause analysis** before retry
4. **Never commit broken regression**

---

### Risk 3: Contract Boundary Violations

**Scenario:** Product accidentally queries `hc_*` tables directly

**Mitigation:**
1. **Architecture Guard blocks** (Pre-Tool-Use Hook)
2. **Gate 2 catches** violations in tests
3. **Code review** mandatory
4. **Automated linting** for direct table access

---

### Risk 4: Timeline Overrun

**Scenario:** 3-4 weeks stretches to 6-8 weeks

**Mitigation:**
1. **MVP scope first** (Tooth Chart + Basic Procedures)
2. **Defer advanced features** (3D imaging, AI analysis)
3. **Parallel work** (Domain + API + UI can overlap slightly)
4. **Daily progress checks**

---

## Decision Point

**Ready to start Step ②?**

### Option 2A: Start Bella Dental Now ✅ (RECOMMENDED)

**Action:**
1. Create `docs/products/dental/` directory structure
2. Begin Phase 1: Architecture Analysis
3. Generate Product Manifest
4. Generate Ownership Map
5. Generate Contract Dependency Map

**Timeline:** Start today, complete in 3-4 weeks

---

### Option 2B: Choose Different Vertical

**Alternatives:**
- Bella Medical Clinic (simpler, 1-2 weeks)
- Bella Pharmacy (focused, 1-2 weeks)
- Bella Laboratory (moderate, 2-3 weeks)

**User decides:** Which vertical first?

---

### Option 2C: Defer Step ② (Clean up technical debt first)

**Focus on:**
- Fix Build Integrity (`ignoreBuildErrors: true`)
- Fix Healthcare UI violations (3 components)
- Fix type errors (6 in receipt.service.ts)
- Fix CI infrastructure

**Timeline:** 4-8 hours

---

## Recommendation

**START OPTION 2A — Bella Dental Now**

**Rationale:**
1. ✅ Step ① complete and proven
2. ✅ Red CI documented as pre-existing (not blocking)
3. ✅ Architecture Guard enforcement ready
4. ✅ Healthcare Constitution active
5. ✅ Dental is optimal first vertical (Goldilocks complexity)
6. ✅ Technical debt can be fixed in parallel

**Next Action:** Generate Phase 1 Architecture Analysis documents?

---

**Signed:**  
Kiro AI Development Environment  
Evidence-Based Development — Step ② Planning  
2026-08-23
