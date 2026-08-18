# Bella Runtime Phase 3C — Gate 0 Workflow

**Date:** 2026-08-18  
**Status:** 🟡 IN PROGRESS  
**Phase:** Gate 0 — Infrastructure Verification & RLS Migration  

---

## Workflow Overview

```
Gate 0 Execution
    │
    ├─ JWT Secret Added           ✅ COMPLETE
    ├─ Infrastructure Test Run    ✅ COMPLETE (4/5 PASS, 1 FAIL)
    ├─ RLS Gap Detected           ✅ COMPLETE
    ├─ RLS Audit                  ✅ COMPLETE
    ├─ Migration Created          ✅ COMPLETE
    ├─ Migration Applied          ⏳ PENDING
    ├─ Phase 3B Regression        ⏳ PENDING
    ├─ Gate 0 Re-test             ⏳ PENDING
    └─ Governance Decision        ⏳ PENDING
```

---

## Execution Timeline

### 2026-08-18 23:56 — Initial Gate 0 Run

**Command:**
```bash
npm run test:runtime:3c:infra
```

**Result:** 4/5 PASS, 1 FAIL

**Tests:**
- ✅ Authenticated clients with JWT: PASS
- ✅ Finance OS mock initialization: PASS
- ✅ Test tenants exist: PASS
- ❌ **RLS enforcement: FAIL** (permission denied)
- ✅ Finance OS mock responses: PASS

**Error:**
```
{
  "code": "42501",
  "message": "permission denied for table runtime_audit_log",
  "hint": "Grant the required privileges to the current role with: 
          GRANT SELECT ON public.runtime_audit_log TO authenticated;"
}
```

**Analysis:** RLS policy uses `current_setting('app.current_tenant_id')` but JWT provides `auth.jwt() ->> 'tenant_id'`.

**Status:** ✅ Gap correctly identified

---

### 2026-08-18 — RLS Audit

**Document:** `BELLA_RUNTIME_RLS_AUDIT_REPORT.md`

**Findings:**
- All 4 Runtime tables use session variable RLS
- JWT authentication incompatible
- No security degradation from migration
- `service_role` unaffected (Phase 3B safe)

**Recommendation:** Proceed with migration

**Status:** ✅ Audit complete

---

### 2026-08-18 — Migration Created

**File:** `supabase/migrations/20260818000002_runtime_rls_jwt.sql`

**Changes:**
- Drop 5 session-variable policies
- Create 6 JWT-claim policies
- Preserve append-only enforcement (audit log)
- Preserve UPDATE/DELETE blocks (audit log)

**Security Impact:** NONE (maintains tenant isolation)

**Status:** ✅ Migration ready

---

### ⏳ NEXT: Migration Application

**Action Required:** Apply migration to Supabase

**Methods:**
1. Supabase Dashboard → SQL Editor → Run migration
2. Supabase CLI: `supabase db push`
3. Direct psql: `psql $DATABASE_URL -f migration.sql`

**Expected Output:**
```
NOTICE: Migration verification: 6 JWT-based RLS policies created
```

**Status:** ⏳ AWAITING USER ACTION

---

### ⏳ NEXT: Phase 3B Regression Test

**CRITICAL:** Must run BEFORE Gate 0 re-test

**Command:**
```bash
npm run test:runtime:3b
```

**Expected:** 97/97 PASS

**Rationale:**
- Proves migration didn't break existing functionality
- `service_role` tests verify RLS changes don't affect bypass
- Evidence of no regression before proceeding

**If FAIL:**
- ❌ STOP immediately
- Diagnose regression
- Rollback migration if needed
- Do NOT proceed to Gate 0 re-test

**Status:** ⏳ BLOCKED (awaiting migration)

---

### ⏳ NEXT: Gate 0 Re-test

**Prerequisite:** Phase 3B regression PASS

**Command:**
```bash
npm run test:runtime:3c:infra
```

**Expected:** 5/5 PASS

**Tests:**
- ✅ Authenticated clients with JWT
- ✅ Finance OS mock initialization
- ✅ Test tenants exist
- ✅ **RLS enforcement** (currently failing)
- ✅ Finance OS mock responses

**If FAIL:**
- Diagnose JWT/RLS issue
- Verify JWT structure
- Verify RLS policies applied
- Check Supabase logs

**Status:** ⏳ BLOCKED (awaiting 3B regression)

---

### ⏳ NEXT: Governance Decision

**Prerequisite:** Both tests PASS

**Decision Matrix:**

| 3B Regression | Gate 0 | Decision |
|---------------|--------|----------|
| 97/97 PASS | 5/5 PASS | ✅ Week 2 UNBLOCKED |
| 97/97 PASS | FAIL | 🔴 Diagnose Gate 0 |
| FAIL | N/A | 🔴 Diagnose regression, rollback migration |

**If both PASS:**
```
🔓 Gate 0 COMPLETE
    ↓
🔓 Phase 3C Week 2 UNBLOCKED
    ↓
Runtime API implementation begins
```

**Status:** ⏳ BLOCKED (awaiting tests)

---

## Governance Checkpoints

### Checkpoint 1: RLS Audit ✅

**Question:** Is migration safe?

**Answer:** YES
- No security degradation
- No breaking changes
- Standard Supabase pattern

**Evidence:** `BELLA_RUNTIME_RLS_AUDIT_REPORT.md`

---

### Checkpoint 2: Phase 3B Regression ⏳

**Question:** Did migration break existing functionality?

**Answer:** PENDING

**Test:** `npm run test:runtime:3b`

**Pass Criteria:** 97/97 PASS

---

### Checkpoint 3: Gate 0 Verification ⏳

**Question:** Does JWT authentication work with RLS?

**Answer:** PENDING

**Test:** `npm run test:runtime:3c:infra`

**Pass Criteria:** 5/5 PASS

---

### Checkpoint 4: Week 2 Unblock Decision ⏳

**Question:** Is Phase 3C ready to proceed?

**Answer:** PENDING

**Criteria:**
- ✅ Phase 3B regression: 97/97
- ✅ Gate 0 verification: 5/5
- → Week 2 unblocked

---

## Success Criteria

**Gate 0 COMPLETE when:**
- ✅ JWT secret configured
- ✅ Infrastructure tests created
- ✅ RLS gap identified
- ✅ RLS audit complete
- ✅ Migration created
- ✅ Migration applied
- ✅ Phase 3B regression: 97/97 PASS
- ✅ Gate 0 re-test: 5/5 PASS
- ✅ Governance approval

**Current Progress:** 5/9 steps complete (56%)

---

## Discipline Maintained

### ✅ No Architecture Changes

Migration changes ONLY RLS implementation, not:
- ❌ Table schemas
- ❌ Column definitions
- ❌ Domain logic
- ❌ Business rules
- ❌ Integration contracts

Architecture v1.1 remains FROZEN ✅

---

### ✅ Evidence-Driven Process

Every step documented with evidence:
- JWT secret requirement → Environment config
- RLS gap → Error log + analysis
- Migration safety → RLS audit report
- Regression proof → Phase 3B test results
- Gate 0 success → Phase 3C test results

No assumptions, only evidence ✅

---

### ✅ Regression Prevention

Testing order enforced:
1. Migration applied
2. Phase 3B regression (97/97)
3. Gate 0 verification (5/5)

Cannot skip Step 2 ✅

---

### ✅ Rollback Plan

Migration includes rollback SQL if issues detected

Safety-first approach ✅

---

## Why This Matters

**Gate 0 Value:**
> Found JWT/RLS incompatibility BEFORE implementing Runtime API

**Without Gate 0:**
```
Week 2 begins → Implement Runtime API →
Build submission logic → Build outbox processing →
Test end-to-end → RLS permission denied →
Debug for hours → Discover JWT/RLS mismatch →
Fix infrastructure → Re-test everything
```

**With Gate 0:**
```
Week 1 complete → Gate 0 run →
RLS permission denied → Immediate diagnosis →
RLS audit → Migration → Regression test →
Gate 0 pass → Week 2 begins with confidence
```

**Time Saved:** Potentially days of debugging

**Risk Reduced:** No cascading failures from infrastructure gaps

---

## Related Documents

- [Gate 0 Definition](./BELLA_RUNTIME_PHASE_3C_GATE_0.md)
- [Gate 0 Result](./BELLA_RUNTIME_PHASE_3C_GATE_0_RESULT.md)
- [RLS Audit Report](./BELLA_RUNTIME_RLS_AUDIT_REPORT.md)
- [Migration SQL](../../supabase/migrations/20260818000002_runtime_rls_jwt.sql)
- [Migration Apply Instructions](./BELLA_RUNTIME_MIGRATION_02_APPLY.md)

---

**Current Status:** 🟡 IN PROGRESS (awaiting migration application)

**Next Action:** Apply migration to Supabase → Run 3B regression → Run Gate 0 → Decision

**Architecture:** 🔒 FROZEN (v1.1)
