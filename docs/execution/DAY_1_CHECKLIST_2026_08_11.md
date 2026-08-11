# Day 1 Execution Checklist - August 11, 2026

**Goal:** Architecture Gate + Capability Validation + Baseline Freeze (NOT migration)

**Duration:** 1 working day (8 hours)  
**Owner:** Platform Architecture Team + Engineering Lead  
**Status:** 🔴 NOT STARTED

**Principle:** Simple Process, Strong Architecture, Measured Outcomes

---

## Day 1 = 5 Architecture Gates (NOT migration day)

**Day 1 is validation, NOT execution:**
- ✅ **G1:** Architecture enforcement (CI/PR gate)
- ✅ **G2:** Capability validation (Person Center ready?)
- ✅ **G3:** Dependency discovery (100% consumers identified)
- ✅ **G4:** Baseline freeze (18%, 22%, 67%, 520h locked)
- ✅ **G5:** Migration design (schema + rollback + test strategy)

**Day 2+ = Migration execution** (only after all 5 gates passed)

---

## Critical Principles (Read First)

### **1. Không làm phức tạp hóa quy trình**
- ❌ NO excessive ceremony, long meetings, heavy documentation
- ✅ YES simple loop: Task → Code → Test → Measure → Review

### **2. Không refactor để đạt % đẹp**
- ❌ NO "Structural reuse MUST increase from 18% to 25%"
- ✅ YES "Use Person Center because it's the right architecture"
- % is outcome, NOT target

### **3. Không production migration theo lịch cố định**
- ❌ NO "Day 5 production migration"
- ✅ YES "Production ONLY when gates passed: integration tests + backup + rollback + reconciliation"

### **4. Architecture enforcement qua CI/PR, NOT just local hook**
- ❌ NO rely on `.git/hooks/pre-commit` (can be bypassed with --no-verify)
- ✅ YES CI/PR gate blocks merge if violates Zero New Legacy Debt

### **5. Không optimize timeline, optimize outcome**
- ❌ NO "MUST finish 12-16 weeks"
- ✅ YES "Measured >2× economic leverage"
- If 6 weeks achieves >2× → Success
- If 16 weeks still 1.7× → NOT success, pivot

---

## Gate 1: Architecture Enforcement (2 hours)

### Goal: Zero New Legacy Debt enforced via CI/PR

### Task 1.1: Stakeholder Alignment (1h)

**Attendees:**
- Platform Architect, Engineering Lead, Product Manager, Tech Lead (Real Estate)

**Agenda:**
1. Executive Summary review (15 min)
2. Approve Zero New Legacy Debt policy (15 min)
3. Phase 1 scope confirmation (20 min)
4. Success criteria: Measured >2×, NOT timeline-driven (10 min)

**Deliverable:**
- [ ] Zero New Legacy Debt policy approved
- [ ] Team understands: Day 1 = Validation, NOT migration
- [ ] Phase 1 scope signed off

### Task 1.2: CI/PR Architecture Gate (1h)

**Create:** `.github/workflows/architecture-gate.yml`

**Purpose:** Block PR merge if violates Zero New Legacy Debt

**Rules:**
1. Block new service files in Real Estate (`src/services/.*real.*estate`)
2. Require manual review for new migrations (table architecture check)
3. Warn about direct DB queries in Real Estate files (document justification)

**Action Items:**
- [ ] Create CI workflow file
- [ ] Test with dummy PR
- [ ] Add required reviewers for `real-estate-refactor` label
- [ ] Update PR template with architecture checklist

**Deliverable:**
- [ ] CI gate active and tested
- [ ] PR template updated
- [ ] Team notified of new enforcement

---

## Gate 2: Capability Validation (1.5 hours)

### Goal: Verify Person Center has sufficient capabilities to replace re_customers

### Task 2.1: Person Center Capability Check (1h)

**Must verify these capabilities exist:**

| Capability | Required | Status | Notes |
|-----------|----------|--------|-------|
| Person identity (name, contact) | ✅ | [ ] |  |
| Party roles (customer, agent, investor) | ✅ | [ ] |  |
| Tenant isolation | ✅ | [ ] |  |
| Deduplication/search | ✅ | [ ] |  |
| Person relationships (family, business) | ⚠️  | [ ] | Nice-to-have |
| Audit trail (created_at, updated_at, updated_by) | ✅ | [ ] |  |
| Data migration support | ✅ | [ ] |  |
| Rollback strategy | ✅ | [ ] |  |

**Check method:**
1. Query `persons` table schema
2. Query `party_roles` table schema
3. Test creating person with role
4. Test querying persons by role
5. Verify RLS policies for tenant isolation

**Action Items:**
- [ ] Document Person Center schema
- [ ] Create test SQL queries
- [ ] Identify any missing capabilities
- [ ] If critical capabilities missing → STOP migration, extend Person Center first

**Deliverable:**
- [ ] Person Center capability matrix (all ✅ required items checked)
- [ ] Go/No-Go decision: Person Center ready for migration?

### Task 2.2: Gap Analysis (30 min)

**If gaps found:**
- [ ] Document missing capabilities
- [ ] Estimate effort to extend Person Center
- [ ] Decision: Extend Person Center OR keep re_customers temporarily?

**Deliverable:**
- [ ] Gap analysis report (if applicable)
- [ ] Extension plan (if needed)

---

## Gate 3: Dependency Discovery (1.5 hours)

### Goal: Identify 100% of code/queries using re_customers

### Task 3.1: Comprehensive Dependency Search (1h)

**Search commands:**
```bash
# Find all references to re_customers table
grep -r "re_customers" src/ --include="*.ts" --include="*.tsx" > re_customers_refs.txt

# Find all service files querying it
grep -r "\.from('re_customers')" src/ --include="*.ts"

# Find all direct SQL references
grep -r "FROM re_customers" src/ supabase/

# Find type definitions
grep -r "re_customers" src/ --include="*.d.ts"
```

**Expected consumers:**
- Product Service (product assignments)
- Lead Service (lead-to-customer conversion)
- Dashboard queries (customer lists)
- Reports (customer analytics)

**Action Items:**
- [ ] Run all grep commands
- [ ] Document ALL files using re_customers
- [ ] Categorize: Services | Components | Types | Migrations | Tests
- [ ] Estimate refactor effort per file

**Deliverable:**
- [ ] Dependency map: `docs/execution/RE_CUSTOMERS_DEPENDENCY_MAP.md`
- [ ] Complete list of files to refactor (no missing references)

### Task 3.2: Schema Mapping (30 min)

**Create:** `docs/execution/CUSTOMER_TO_PERSON_SCHEMA_MAP.md`

**Document:**
```sql
-- BEFORE (re_customers)
id, tenant_id, customer_name, phone, email, address, notes

-- AFTER (persons + party_roles)
persons: id, tenant_id, full_name, phone, email, address, notes
party_roles: person_id, role_type='real_estate_investor', role_metadata={}
```

**Action Items:**
- [ ] Document field-to-field mapping
- [ ] Identify data transformations needed
- [ ] Plan for NULL values / missing data

**Deliverable:**
- [ ] Schema mapping document
- [ ] Data transformation rules

---

## Gate 4: Baseline Freeze (30 min)

### Goal: Lock current metrics as baseline for comparison

### Task 4.1: Baseline Snapshot (30 min)

**Create:** `docs/execution/BASELINE_2026_08_11.md`

**Lock these metrics:**
```markdown
# Real Estate Platform Baseline - August 11, 2026

## Structural Reuse
- **Current:** 18%
- **Measurement date:** 2026-08-10
- **Audit document:** BELLA_REAL_ESTATE_PLATFORM_REUSE_AUDIT_2026_08_10.md

## Architectural Compliance
- **Current:** 22%
- **Measurement date:** 2026-08-10

## Behavioral Reuse
- **Current:** 67%
- **Measurement date:** 2026-08-10

## Engineering Effort
- **Standalone effort:** 800h (estimated)
- **Actual effort:** 520h (measured)
- **Economic leverage:** 1.54× (800/520)

## Custom Tables Count
- **Real Estate custom tables:** 12
  - re_customers, re_leads, re_products, re_projects, etc.

## Direct DB Query Count
- **Total Real Estate queries:** ~450
- **Platform layer queries:** ~100 (22%)
- **Direct DB queries:** ~350 (78%)

## Refactor Targets
- **Phase 1 target:** Migrate re_customers → Person Center
- **Expected effort:** 60h (estimate - will measure actual)
- **Expected improvement:** Structural reuse 18% → measure after (NOT preset target)

## Re-audit Method
- Use same 4-dimensional audit methodology
- Compare: Before (Aug 2026) vs After (Nov 2026 target)
- Success: >2× economic leverage measured
```

**Action Items:**
- [ ] Create baseline document
- [ ] Lock all current metrics
- [ ] Commit to git (immutable baseline)

**Deliverable:**
- [ ] Baseline snapshot committed and locked

---

## Gate 5: Migration Design (2 hours)

### Goal: Complete migration plan BEFORE writing any code

### Task 5.1: Migration Script Design (1h)

**Create:** `docs/execution/CUSTOMER_MIGRATION_SCRIPT_DESIGN.md`

**Must include:**

**1. Data Migration Steps:**
```sql
-- Step 1: Backup
CREATE TABLE re_customers_backup_20260811 AS SELECT * FROM re_customers;

-- Step 2: Insert into persons
INSERT INTO persons (id, tenant_id, full_name, phone, email, address, notes, created_at, updated_at)
SELECT id, tenant_id, customer_name, phone, email, address, notes, created_at, updated_at
FROM re_customers;

-- Step 3: Insert into party_roles
INSERT INTO party_roles (person_id, role_type, tenant_id, created_at)
SELECT id, 'real_estate_investor', tenant_id, created_at
FROM re_customers;

-- Step 4: Validate row counts
SELECT COUNT(*) FROM re_customers; -- Should match
SELECT COUNT(*) FROM persons WHERE id IN (SELECT id FROM re_customers_backup_20260811);
SELECT COUNT(*) FROM party_roles WHERE role_type = 'real_estate_investor';
```

**2. Rollback Strategy:**
```sql
-- If migration fails, restore from backup
DELETE FROM party_roles WHERE person_id IN (SELECT id FROM re_customers_backup_20260811);
DELETE FROM persons WHERE id IN (SELECT id FROM re_customers_backup_20260811);

-- Verify re_customers still intact (never dropped during migration)
SELECT COUNT(*) FROM re_customers; -- Should be unchanged
```

**3. Dual-Read Period:**
- Week 1-2: Code reads from BOTH re_customers AND persons (validate consistency)
- Week 3: Code reads ONLY from persons (re_customers deprecated)
- Week 4: Drop re_customers table (after validation)

**Action Items:**
- [ ] Write complete migration script
- [ ] Write complete rollback script
- [ ] Document dual-read strategy
- [ ] Plan validation queries

**Deliverable:**
- [ ] Migration script design document
- [ ] Rollback script ready
- [ ] Validation checklist

### Task 5.2: Test Strategy (1h)

**Create:** `docs/execution/CUSTOMER_MIGRATION_TEST_PLAN.md`

**Test levels:**

**1. Unit Tests:**
- [ ] PersonService creates person correctly
- [ ] PartyRoleService creates role correctly
- [ ] Query functions return correct data

**2. Integration Tests:**
- [ ] Migration script executes successfully
- [ ] Row counts match
- [ ] Data integrity preserved (no NULL where required)
- [ ] Foreign keys valid

**3. E2E Tests:**
- [ ] Product assignment flow (uses persons)
- [ ] Lead-to-customer conversion (uses persons)
- [ ] Dashboard displays correctly
- [ ] Search/filter works

**4. Performance Tests:**
- [ ] Query performance acceptable (JOIN overhead?)
- [ ] Index optimization if needed

**5. Rollback Tests:**
- [ ] Rollback script executes successfully
- [ ] System returns to original state
- [ ] No data loss

**Action Items:**
- [ ] Write test cases
- [ ] Setup test environment
- [ ] Define pass criteria

**Deliverable:**
- [ ] Test plan document
- [ ] Test environment ready

---

## End of Day 1 - Gate Completion Checklist

**All 5 gates MUST pass before proceeding to Day 2:**

- [ ] **G1:** Architecture enforcement active (CI gate tested)
- [ ] **G2:** Person Center capabilities verified (all ✅ required items)
- [ ] **G3:** Dependencies discovered (100% consumers identified)
- [ ] **G4:** Baseline frozen (metrics locked in git)
- [ ] **G5:** Migration designed (script + rollback + tests)

**Deliverables created:**
- [ ] `.github/workflows/architecture-gate.yml`
- [ ] Updated PR template
- [ ] `docs/execution/RE_CUSTOMERS_DEPENDENCY_MAP.md`
- [ ] `docs/execution/CUSTOMER_TO_PERSON_SCHEMA_MAP.md`
- [ ] `docs/execution/BASELINE_2026_08_11.md`
- [ ] `docs/execution/CUSTOMER_MIGRATION_SCRIPT_DESIGN.md`
- [ ] `docs/execution/CUSTOMER_MIGRATION_TEST_PLAN.md`

**Team communication:**
- [ ] #platform-refactor channel active
- [ ] Team understands: Day 2+ = Migration execution
- [ ] Daily standup scheduled (15 min, 9:00 AM)

**Go/No-Go Decision:**
- [ ] If ALL gates passed → Proceed to Day 2 (migration execution)
- [ ] If ANY gate failed → Fix gaps before migration

---

## Day 2+ Execution (After All Gates Passed)

**Simple execution loop:**

```
Day 2-3: Code Migration
├── Data migration script
├── Service layer refactor
├── Component updates
└── Type definitions

Day 4: Testing
├── Unit tests
├── Integration tests
├── E2E tests
└── Performance tests

Day 5+: Staging Validation
├── Deploy to staging
├── Validate with real data
├── User acceptance testing
└── Rollback test

Production: ONLY when validated
├── Backup production DB
├── Execute migration
├── Validate row counts
├── Monitor for issues
└── Measure actual effort
```

**Measurement after completion:**
- [ ] Log actual effort vs 60h estimate
- [ ] Measure structural reuse (use same audit methodology)
- [ ] Document lessons learned
- [ ] Update baseline for next migration

---

## Simplified Principles Summary

**What Day 1 IS:**
✅ Architecture gate setup
✅ Capability validation
✅ Dependency discovery
✅ Baseline measurement
✅ Migration design

**What Day 1 is NOT:**
❌ Writing migration code
❌ Executing data migration
❌ Production changes
❌ "Finish in 5 days" timeline
❌ Targeting specific % improvements

**Success Criteria:**
- NOT "Day 1 complete"
- BUT "All 5 gates passed, ready for safe migration"

**Outcome-Driven:**
- NOT "Finish Phase 1-2 in 12-16 weeks"
- BUT "Measured >2× economic leverage"
- Checkpoint after each primitive migration
- Adjust strategy based on measured results

---

**Document Owner:** Platform Architecture Team  
**Last Updated:** 2026-08-10  
**Status:** ✅ READY FOR DAY 1 EXECUTION  
**Next Review:** End of Day 1 (verify all 5 gates passed)

**Key Reference Documents:**
- [Real Estate Audit](../architecture/BELLA_REAL_ESTATE_PLATFORM_REUSE_AUDIT_2026_08_10.md)
- [Executive Summary](../architecture/BELLA_PLATFORM_EXECUTIVE_SUMMARY_2026_08_10.md)
- [Architecture Tree](../architecture/BELLA_PLATFORM_ARCHITECTURE_TREE_2026_08_10.md)
- [Corrections Document](../architecture/BELLA_ASSESSMENT_CORRECTIONS_2026_08_10.md)
