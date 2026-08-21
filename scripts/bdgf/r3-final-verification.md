# R3 Final Verification Checklist

**Purpose:** Complete verification of all 3 authorities AFTER credential rotation

**Status:** 🔴 PENDING ROTATION

---

## ⚠️ PRE-REQUISITES

Before running this verification:

- [ ] Credentials rotated via Supabase Dashboard
- [ ] `.env` updated with new passwords
- [ ] Old passwords redacted from evidence/scripts

---

## 🧪 VERIFICATION SEQUENCE

### Test 1: Authority #1 — DATABASE_URL (Direct PostgreSQL)

```bash
node scripts/bdgf/r3-simple-test.mjs
```

**Expected Results:**
```
✅ Test 1: SELECT on hc_patients (allowed)
✅ Test 2: INSERT on hc_patients (denied) — permission denied
✅ Test 3: UPDATE on hc_patients (denied) — permission denied
✅ Test 4: DELETE on hc_patients (denied) — permission denied
✅ Test 5: SELECT on hc_appointments (allowed)
✅ Test 6: INSERT on bella_migration_approval (denied) — permission denied
✅ Test 7: Executor can INSERT approval (allowed)
✅ Test 8: Executor has BYPASSRLS (true)

Final Result: 8/8 tests PASSED
```

**Status after Test 1:**
- [ ] 8/8 tests PASSED with NEW credentials
- [ ] bella_developer READ-ONLY verified
- [ ] bella_migration_executor MUTATION verified

---

### Test 2: Authority #2 — Supabase CLI (Profile Authentication)

**Test 2a: CLI Authentication Status**
```bash
npx supabase projects list
```

**Expected:**
```
Access token not provided. Supply an access token by running
`supabase login` or setting the SUPABASE_ACCESS_TOKEN environment variable.
```

**Status:**
- [ ] CLI not authenticated
- [ ] No production projects listed

---

**Test 2b: Production Link Attempt**
```bash
npx supabase link --project-ref lvnvkpyxtuilhrabtlwv
```

**Expected:**
```
Access token not provided. Supply an access token by running
`supabase login` or setting the SUPABASE_ACCESS_TOKEN environment variable.
```

**Status:**
- [ ] Link DENIED (no authentication)
- [ ] No [Y/n] prompt appeared

---

**Test 2c: Production Push Attempt** (CRITICAL)
```bash
npx supabase db push --linked --project-ref lvnvkpyxtuilhrabtlwv
```

**Expected:**
```
Access token not provided OR
Error: Not linked to project
```

**Status:**
- [ ] Push DENIED
- [ ] NO mutation path available
- [ ] NO [Y/n] prompt for destructive operations

---

### Test 3: Authority #3 — SERVICE_ROLE_KEY

**Test 3a: Key Absence Verification**
```bash
grep SUPABASE_SERVICE_ROLE_KEY mcp-server/.env
```

**Expected:** (no output)

**Status:**
- [ ] Key not found in active config
- [ ] Backup exists at `mcp-server/.env.backup.r3`

---

**Test 3b: Application Impact Check**
```bash
# Check if application can still function without SERVICE_ROLE_KEY
# This depends on your application architecture
# If MCP server is not used in production, this is N/A
```

**Status:**
- [ ] Application functions without SERVICE_ROLE_KEY OR
- [ ] SERVICE_ROLE_KEY not used in production path (N/A)

---

## ✅ COMPLETE VERIFICATION MATRIX

| Authority | Test | Expected Result | Actual | Status |
|-----------|------|-----------------|--------|--------|
| #1 DATABASE_URL | SELECT allowed | ✅ PASS | | ⬜ |
| #1 DATABASE_URL | INSERT denied | ✅ PASS | | ⬜ |
| #1 DATABASE_URL | UPDATE denied | ✅ PASS | | ⬜ |
| #1 DATABASE_URL | DELETE denied | ✅ PASS | | ⬜ |
| #2 CLI | projects list | ❌ Auth error | | ⬜ |
| #2 CLI | link production | ❌ Auth error | | ⬜ |
| #2 CLI | push production | ❌ Auth error | | ⬜ |
| #3 SERVICE_ROLE_KEY | Key absence | ✅ Not found | | ⬜ |

---

## 🎯 SUCCESS CRITERIA

All of the following MUST be TRUE:

### Authority #1 Success Criteria
✅ bella_developer can SELECT from Kernel tables  
✅ bella_developer CANNOT INSERT/UPDATE/DELETE Kernel tables  
✅ bella_developer CANNOT INSERT into bella_migration_approval  
✅ bella_migration_executor CAN INSERT into bella_migration_approval  
✅ bella_migration_executor HAS BYPASSRLS  

### Authority #2 Success Criteria
✅ CLI reports "Access token not provided"  
✅ CLI cannot link to production  
✅ CLI cannot push to production  
✅ NO [Y/n] prompt for production operations  
✅ NO credential path allows production mutation via CLI  

### Authority #3 Success Criteria
✅ SERVICE_ROLE_KEY not found in mcp-server/.env  
✅ Backup exists at mcp-server/.env.backup.r3  
✅ Application functions without SERVICE_ROLE_KEY (or not used)  

---

## 🔒 BASELINE LOCK CRITERIA

**ONLY proceed to baseline lock if:**

1. All 8 tests in r3-simple-test.mjs PASS with NEW credentials
2. All 3 CLI tests (list/link/push) show auth denial
3. SERVICE_ROLE_KEY confirmed absent
4. Old credentials redacted from evidence/scripts
5. Git history checked (and cleaned if necessary)

---

## 📝 AFTER VERIFICATION COMPLETE

Create `evidence/g3a-architecture/R3_BASELINE_LOCKED.md`:

```markdown
# R3 BASELINE LOCKED

**Date:** YYYY-MM-DD HH:MM  
**Status:** 🟢 PRODUCTION VERIFICATION COMPLETE

## Authority Closure Summary

Authority #1 — DATABASE_URL        ✅ CLOSED (rotated + verified)
Authority #2 — Supabase CLI        ✅ CLOSED (logout + mutation path verified)
Authority #3 — SERVICE_ROLE_KEY    ✅ CLOSED (removed + backed up)

**R3 = 🟢 3/3 AUTHORITIES CLOSED**

## What R3 Achieved

R3 closes **WHO** can mutate Production outside BDGF:

- Database credentials: READ-ONLY for developers
- CLI credentials: No authentication path
- Service keys: Removed from codebase

## What R3 Does NOT Cover

R4 will govern:
- **WHEN** a migration may execute
- **UNDER WHAT CONDITIONS** execution is allowed
- Approval gate automation
- Execution logging and audit trail

## Next Step

Open R4: Migration Execution Gate Framework
```

---

**Principle:** "Evidence > Assumption"

Every authority must be verified through executable tests, not just configuration review.
