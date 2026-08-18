# Bella Runtime Phase 3C — Gate 0: Infrastructure Verification

**Date:** 2026-08-18  
**Gate:** Gate 0 (Infrastructure Prerequisite)  
**Status:** 🟡 PENDING (awaiting configuration)  

---

## Gate Purpose

Gate 0 verifies that test infrastructure is functional before Week 2 implementation begins.

**Critical Distinction:**
- Week 1 built infrastructure (code complete ✅)
- Gate 0 verifies infrastructure works (execution verification ⏳)

**Gate 0 MUST PASS before Week 2 begins.**

---

## Gate 0 Acceptance Criteria

### Environment Configuration

```bash
# Required in .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here  # NEW for Phase 3C
```

### Verification Command

```bash
npm run test:runtime:3c:infra
```

### Expected Output

```
✓ 3C-1: Happy Path E2E > Infrastructure Verification
  ✓ should create authenticated clients with tenant JWT
  ✓ should initialize Finance OS mock
  ✓ should verify test tenants exist in registry
  ✓ should enforce RLS on authenticated clients
  ✓ should handle Finance OS mock responses

Test Files  1 passed (1)
     Tests  5 passed (5)
```

### Pass Criteria

| Test | Description | Status |
|------|-------------|--------|
| Authenticated clients | JWT generation + Supabase client creation | ⏳ |
| Finance OS mock | Mock initialization and configuration | ⏳ |
| Test tenants | Tenants exist in `runtime_tenant_registry` | ⏳ |
| RLS enforcement | Cross-tenant queries return empty (not error) | ⏳ |
| Mock responses | Accept/reject/timeout behavior | ⏳ |

**Gate 0 PASS:** All 5 tests PASS

---

## Current Status

### Last Execution

```bash
npm run test:runtime:3c:infra

Error: SUPABASE_JWT_SECRET not found in environment.
Required for Phase 3C RLS testing.
```

**Classification:**
- ❌ NOT a test failure
- ✅ Environment prerequisite not configured
- ⏳ Awaiting user configuration

### What's Missing

**Action Required:**
1. User obtains `SUPABASE_JWT_SECRET` from Supabase Dashboard
2. User adds secret to `.env.local`
3. User runs `npm run test:runtime:3c:infra`
4. Verify all 5 infrastructure tests PASS

**No code changes needed.** Week 1 infrastructure is complete.

---

## How to Get JWT Secret

### Steps

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Project Settings → API**
4. Scroll to **JWT Settings**
5. Find **JWT Secret** field
6. Click **Reveal** (if hidden)
7. Copy the secret
8. Add to `.env.local`:
   ```bash
   SUPABASE_JWT_SECRET=your-actual-secret-here
   ```

### Security Warning

**JWT Secret is highly sensitive.**
- Never commit to git
- Never share publicly
- Never log in application code
- Use only in test environment

---

## Why Gate 0 Matters

### Phase 3C Critical Difference

| Aspect | Phase 3B | Phase 3C |
|--------|----------|----------|
| **Authentication** | `service_role` key | `anon` key + tenant JWT |
| **RLS** | Bypassed | **Enforced** |
| **Tenant Context** | Repository-level | **JWT claim-level** |
| **Security Testing** | NOT tested | **Cross-tenant attacks tested** |

**Phase 3C cannot prove RLS enforcement without JWT.**

### What Gate 0 Proves

1. **JWT generation works:** Test helper can create valid Supabase JWT
2. **Authenticated clients work:** Supabase client accepts JWT and applies RLS
3. **Test tenants exist:** Database has test tenant fixtures
4. **RLS enforced:** Cross-tenant queries return empty (tenant isolation proof)
5. **Finance OS mock works:** Mock can simulate accept/reject/timeout

**Without Gate 0 PASS, Week 2 E2E tests cannot execute.**

---

## Gate 0 → Week 2 Transition

### If Gate 0 PASS

**Proceed to Week 2:**
- Implement Runtime submission API
- Implement outbox processing
- Create 3C-1 (Happy Path) tests
- Create 3C-2 (Idempotency) tests

### If Gate 0 FAIL

**Do NOT proceed to Week 2.**

**Diagnose failure:**
1. JWT secret incorrect or missing
2. RLS policies not enabled in Supabase
3. Test tenants cannot be created
4. Authenticated clients cannot connect
5. Finance OS mock initialization issue

**Fix root cause → Re-run Gate 0 → Verify PASS → Proceed to Week 2**

---

## Governance Checkpoint

### Gate Structure

```
Phase 3C
    │
    ├─ Week 1: Infrastructure      ✅ COMPLETE
    │
    ├─ Gate 0: Verification        🟡 PENDING
    │     │
    │     ├─ PASS → Week 2 begins
    │     └─ FAIL → Diagnose & fix
    │
    └─ Week 2: E2E Implementation  🔒 BLOCKED (Gate 0)
```

### Discipline

**Gate 0 is a hard prerequisite.**

**NOT allowed:**
- ❌ Skip Gate 0 and start Week 2
- ❌ Implement Runtime API without infrastructure verification
- ❌ Write E2E tests that cannot execute

**Reason:**
> Building on unverified foundation creates cascade failures. Gate 0 proves foundation before building.

---

## Related Documents

- [Phase 3C Test Plan](../architecture/BELLA_RUNTIME_PHASE_3C_TEST_PLAN.md)
- [Week 1 Status](./BELLA_RUNTIME_PHASE_3C_WEEK1_STATUS.md)
- [Phase 3B Evidence](./BELLA_RUNTIME_PHASE_3B_EVIDENCE.md)

---

## Summary

**Gate 0 Status:** 🟡 PENDING

**Blocker:** `SUPABASE_JWT_SECRET` not configured

**Action Required:** User configuration (no code changes)

**Next Step:** Configure JWT secret → Run verification → PASS → Week 2

**Week 2 Status:** 🔒 BLOCKED (Gate 0 prerequisite)

---

**Gate 0 is the last checkpoint before E2E Runtime testing begins.**
