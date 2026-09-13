# CHECKPOINT: R3 SEALED

**Date:** 2026-09-12 10:17 UTC  
**Status:** ✅ COMPLETE  
**Milestone:** 4/8 (Identity Remediation)

---

## 📊 CANONICAL STATE

```text
═══════════════════════════════════════════════════════════════
IDENTITY REMEDIATION — CURRENT CHECKPOINT
═══════════════════════════════════════════════════════════════

R0  Preflight               ✅ COMPLETE
R1  Identity Mapping        🔒 SEALED
R2  Party Backfill          🔒 SEALED
R3  Education Cutover       🔒 SEALED (2026-09-12 10:17 UTC)
R4  Caller Migration        🟢 AUTHORIZED
R5  Legacy Freeze           ⏸️  BLOCKED (wait R4)
R6  E2E Regression          ⏸️  BLOCKED (wait R5)
R7  Evidence Seal           ⏸️  BLOCKED (wait R6)

═══════════════════════════════════════════════════════════════
Progress: 4/8 milestones complete
Next:     R4 Caller Reconciliation & Migration
═══════════════════════════════════════════════════════════════
```

---

## ✅ R3 EVIDENCE SUMMARY

### Database Migration

```text
Students migrated:           631/631 (100%)
Party entities linked:       631/631 (100%)
Orphan students:            0
Invalid FK references:      0
Tenant mismatches:          0
Persons total:              848 (unchanged since R2)
New Person rows:            0
```

### Code Deployment

```text
Modified files:             6
New files:                  1 (PartyRepository)
Build status:               ✅ PASS
TypeScript errors:          0
```

### Runtime Tests

```text
Integration tests:          11/11 PASS
DB verification:            9/9 PASS
Execution time:             ~2.5s
Test coverage:              Party validation, Student creation,
                           FK integrity, contract semantics,
                           tenant isolation, duplicate rules
```

### Migration History

```text
Local migration:            20260912000000_r3_education_student_party_cutover.sql
Remote applied:             ✅ VERIFIED
History status:             RECONCILED
```

---

## 🔒 ARCHITECTURE BOUNDARIES

### Compatibility Bridge (Temporary)

**Location:** `src/platform/education/contracts/student.contract.ts`

```typescript
export interface RegisterStudentInput {
  readonly partyId: string;        // CANONICAL identity
  readonly personId?: string;      // ⚠️ TEMPORARY (until R5)
  readonly studentCode: string;
}
```

**Status:** ⚠️ **COMPATIBILITY BRIDGE ONLY**

**Not Target Architecture:**
- `personId` required because DB FK `students.person_id` still enforced
- Product Verticals MUST NOT create new Person identities
- Callers use existing Person IDs from Party backfill (R2)
- R5 will freeze Person writes and mark `personId` @deprecated

**Target State (R5+):**
```typescript
export interface RegisterStudentInput {
  readonly partyId: string;        // CANONICAL (only identity)
  readonly studentCode: string;
}
```

### R4 Scope (Authorized)

**IN SCOPE:**
- ✅ Census existing callers (exact count, not estimate)
- ✅ Migrate production callers to Party-based APIs
- ✅ Migrate test callers/fixtures to Party-based setup
- ✅ Remove deprecated API usage (`getStudentsByPersonId`)
- ✅ Verify callers do NOT create new Person identities

**OUT OF SCOPE:**
- ❌ Remove `students.person_id` FK (DB migration, R5 task)
- ❌ Freeze Person write methods (R5 task)
- ❌ Deprecate/remove `personId` parameter (R5 task)
- ❌ Migrate 6 remaining FK tables (R5+ analysis)
- ❌ Architecture discovery (E0 locked)

**Discipline:** Census → Migrate → Verify. **No exploration, no expansion.**

---

## 📈 QUANTITATIVE EXIT CRITERIA

### R3 Exit (ACHIEVED)

```text
✅ Database migration:          631/631 students linked
✅ Independent verification:    9/9 checks PASS
✅ Code deployment:             6 files + 1 new repository
✅ Runtime behavioral tests:    11/11 PASS
✅ Migration history:           RECONCILED
✅ Persons unchanged:           848 (baseline maintained)
✅ New Person rows:             0
✅ Build:                       PASS
```

### R4 Exit (Required)

```text
Known production callers     = exact (not "~8")
Known test callers          = exact
Known fixtures/helpers      = exact (not "40+")
Total migration targets     = exact

Migrated to Party APIs      = 100% of targets
Remaining Person API usage  = 0 (in active caller logic)
Unknown callers             = 0
Deprecated API usage        = 0

Build status                = PASS
Targeted tests              = PASS
New Person identities       = 0
```

**Key Difference:** R4 removes **caller ownership of Person identity**, NOT the compatibility bridge.

---

## 🎯 CRITICAL PATH

```text
R4 Caller Reconciliation & Migration
    ↓
R5 Legacy Person Freeze
    ↓
R6 Full E2E Regression
    ↓
R7 Identity Evidence Seal
    ↓
Finance Remediation (if needed)
    ↓
E1 Readiness Gate
    ↓
E1 Feature Development AUTHORIZED
```

**Current Position:** R4 entry point  
**Current Blocker:** None (R3 sealed, R4 authorized)

---

## 📚 CANONICAL DOCUMENTS

```text
Status Tracker:         IDENTITY_REMEDIATION_STATUS.md
R3 Evidence:           R3_COMPLETION_REPORT.md
R4 Plan:               R4_CALLER_MIGRATION_PLAN.md
Business Invariants:   E0_4_BUSINESS_INVARIANTS.md
Cutover Plan:          CUTOVER_PLAN_V1_0.md
```

---

## 🔐 GOVERNANCE PRINCIPLES

### Zero False-Green Policy

**All milestones require:**
1. ✅ Runtime behavioral tests (not just "build successful")
2. ✅ Independent DB verification (not just code inspection)
3. ✅ Exact counts (not estimates like "~40")
4. ✅ Evidence-based seal (not assumption-based)

**R3 Compliance:**
- Runtime tests: 11/11 PASS ✅
- DB verification: 9/9 PASS ✅
- Persons verified: 848 (exact) ✅
- Migration history: RECONCILED ✅

### Boundary Discipline

**R4 Rules:**
- Census existing code → no architecture discovery
- Exact inventory → no estimates or approximations
- Migrate callers → do NOT expand scope to R5 tasks
- Verify behavior → do NOT assume based on types alone

**Progression Gate:**
```text
R3 SEALED → R4 authorized
R4 COMPLETE → R5 authorized (not before)
```

**No Milestone Skipping.**

---

## 📋 R4 IMMEDIATE ACTIONS

**Step 1: Caller Census (Exact Count)**

```bash
# Production callers
grep -r "StudentService\." src/ --include="*.ts" \
  | grep -v "student.service.ts" \
  | grep -v "\.test\.ts" \
  | cut -d: -f1 | sort -u

# Test callers
grep -r "StudentService\." tests/ --include="*.test.ts" \
  | cut -d: -f1 | sort -u | wc -l

# Deprecated API usage
grep -r "getStudentsByPersonId" src/ tests/ --include="*.ts"

# Test fixtures
grep -r "createStudent\|student.*fixture" tests/ --include="*.ts" | wc -l
```

**Output:** `R4_CALLER_CENSUS.md` with exact numbers (not estimates)

**Step 2: Execute Migration (After Census)**

See: `R4_CALLER_MIGRATION_PLAN.md`

---

**Checkpoint Sealed:** 2026-09-12 10:17 UTC  
**Next Milestone:** R4 Caller Reconciliation & Migration  
**Authorization:** 🟢 AUTHORIZED  
**Document Version:** 1.0 (CANONICAL)


---

## 🏛️ PLATFORM PRINCIPLE: REMEDIATION VS ENFORCEMENT

### Current Activity: Remediation (One-Time)

**R0–R7 Identity Remediation:** Fixing legacy English Center architecture debt

**Cost:** ~13-14 days (DB migrations, code migrations, caller migrations, E2E verification)

**Why expensive:** 631 existing students + legacy Person infrastructure to migrate

### Future: Enforcement (Forever)

**After R7 Seal:** Platform blocks Person-based identity in new Product Verticals

**Cost:** 0 days per new product (Party enforced automatically)

**Mechanism:**
```text
Architecture Guard    → Blocks Person code at build time
Product Registry      → Validates Party contracts
Factory Templates     → Generates Party-based scaffolds by default
CI/CD Gates          → Rejects Person-based deployments
```

### Scalability Model

**Without Enforcement (debt repeats):**
```text
English Center:     13 days
Spa:               13 days
Preschool:         13 days
Product N:         13 days
─────────────────────────────
10 products:       130 days
```

**With Enforcement (debt paid once):**
```text
English Center:     13 days  ← REMEDIATION
+ R7 Platform:      2 days
Spa:               0 days   ← ENFORCEMENT
Preschool:         0 days   ← ENFORCEMENT
Product N:         0 days   ← ENFORCEMENT
─────────────────────────────
10 products:       15 days  (8.7x improvement)
```

### R7 Mandate

**R7 MUST deliver:**

1. **Working Architecture Guard** (not just documentation)
   ```typescript
   // This code must exist and be tested
   if (domain.isNewProduct() && domain.usesPersonIdentity()) {
     throw new ArchitectureViolation('Person prohibited (use Party)');
   }
   ```

2. **Automated tests proving enforcement**
   ```typescript
   test('New product using Person is blocked', () => {
     expect(() => ProductFactory.create('test', { identity: 'Person' }))
       .toThrow(/Person prohibited/);
   });
   
   test('New product uses Party by default', () => {
     const product = ProductFactory.create('test');
     expect(product.identitySource).toBe('Party');
   });
   ```

3. **Verifiable prevention** (not aspirational)
   - ✅ Guard blocks Person code (test proves it)
   - ✅ Factory uses Party default (test proves it)
   - ✅ Enforcement automatic (no human memory)

**R7 Success Metric:**

```text
NEW PRODUCT SCAFFOLD ATTEMPT:

1. Developer: ProductFactory.create('bella-spa')
2. Factory:   Party-based identity (default)
3. Developer: Try Person override
4. Guard:     BLOCKS (clear error message)
5. Tests:     Prove enforcement works
```

**R7 cannot seal with only:**
- ❌ Documentation ("use Party")
- ❌ Guidelines or best practices
- ❌ Aspirational statements

**Principle:** Identity remediation intended as **one-time platform remediation**. New Person-based debt **must be automatically prevented**. Equivalent remediation **should not recur** unless enforcement fails.

**R7 Deliverable:** Working enforcement (code + tests), not just documentation.

**Document:** `docs/architecture/REMEDIATION_VS_ENFORCEMENT.md`

---

**Checkpoint Sealed:** 2026-09-12 10:17 UTC  
**Next Milestone:** R4 Caller Reconciliation & Migration  
**Platform Deliverable:** R7 enforcement rules (after R0–R6 complete)

