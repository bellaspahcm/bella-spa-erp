# R3 AUTHORITY #3 ANALYSIS — SERVICE_ROLE_KEY BYPASS

**Date:** 2026-08-20  
**Status:** 🔴 BYPASS EXISTS (Remediation Required)  
**Authority:** SERVICE_ROLE_KEY / REST API

---

## 🔍 FINDINGS

### Test Results

**Test 1: REST API Mutation**
- ❌ FAIL: SERVICE_ROLE_KEY can INSERT via REST API
- Record created: `authority3-bypass-test`
- Bypass confirmed

**Test 2: exec_sql Function**
- ✅ PASS: exec_sql function not found (404)
- No exec_sql bypass vector

### Root Cause

**SERVICE_ROLE_KEY bypasses Row Level Security (RLS)** by design.

Supabase SERVICE_ROLE_KEY has special privilege:
- Bypasses ALL RLS policies
- Has superuser-like privileges via REST API
- Cannot be restricted by database roles (operates at API layer)

**Current situation:**
1. bella_developer role → READ-ONLY at database level ✅
2. SERVICE_ROLE_KEY → Full mutation via REST API ❌
3. Developer has SERVICE_ROLE_KEY in `mcp-server/.env` ❌

**Conclusion:** R3 role separation is effective at database level but bypassed at API layer.

---

## 🎯 REMEDIATION OPTIONS

### Option A: Remove SERVICE_ROLE_KEY from Developer Environment (RECOMMENDED)

**Action:**
1. Remove `SERVICE_ROLE_KEY` from `mcp-server/.env`
2. Move `SERVICE_ROLE_KEY` to CI/CD secrets only
3. Give developer `ANON_KEY` instead (limited privileges)

**Impact:**
- ✅ Closes Authority #3 immediately
- ✅ No code changes needed
- ⚠️  Developer loses some Supabase Dashboard features
- ⚠️  MCP server functionality may be affected

**Verification:**
```bash
# After removal
grep -r "SERVICE_ROLE_KEY" . --exclude-dir=node_modules
# Should only appear in CI/CD configs, not developer files
```

---

### Option B: Rotate SERVICE_ROLE_KEY

**Action:**
1. Generate new SERVICE_ROLE_KEY in Supabase Dashboard
2. Update CI/CD with new key
3. Do NOT give new key to developer

**Impact:**
- ✅ Closes Authority #3
- ✅ Old key becomes invalid
- ⚠️  Requires CI/CD update
- ⚠️  Brief downtime if used in production

---

### Option C: Use Anon Key for Developer Tools

**Action:**
1. Replace SERVICE_ROLE_KEY with ANON_KEY in `mcp-server/.env`
2. ANON_KEY respects RLS policies
3. Keep SERVICE_ROLE_KEY in CI/CD only

**Impact:**
- ✅ Closes Authority #3
- ✅ Developer tools still work (with RLS restrictions)
- ✅ No rotation needed

---

### Option D: Accept Controlled Exception

**Action:**
1. Document SERVICE_ROLE_KEY as "break-glass" authority
2. Require evidence when SERVICE_ROLE_KEY is used
3. Audit all SERVICE_ROLE_KEY usage

**Impact:**
- ⚠️  Authority #3 remains open (controlled)
- ⚠️  Requires strict operational discipline
- ⚠️  Not machine-enforceable

**NOT RECOMMENDED** - Violates "Evidence > Assumption" principle

---

## 📊 IMPACT ASSESSMENT

### Current Threat Surface

**3 Canonical Authorities (from R1):**
1. ✅ Authority #1 (DATABASE_URL) → CLOSED
2. ✅ Authority #2 (Supabase CLI) → CLOSED
3. ❌ Authority #3 (SERVICE_ROLE_KEY) → **OPEN**

**Closure Status:** 2/3 (67%)

### Why Authority #3 Matters

**Bypass scenario:**
```
Developer → SERVICE_ROLE_KEY → REST API → Database mutation
```

**Bypasses:**
- bella_developer READ-ONLY restriction
- R2 Human GO approval requirement
- BDGF governance path
- Database role separation

**Risk Level:** HIGH (complete governance bypass)

---

## 💡 ARCHITECTURAL INSIGHT

### Why RLS Didn't Work

**Attempted Fix:**
```sql
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY block_rest_api_access ON tenants
  FOR ALL
  USING (false)
  WITH CHECK (false);
```

**Why It Failed:**
- SERVICE_ROLE_KEY has `bypassrls` privilege
- RLS policies don't apply to SERVICE_ROLE_KEY
- This is Supabase's intentional design (for migrations, admin operations)

**Quote from Supabase docs:**
> "The service_role key has the ability to bypass Row Level Security. Never share it publicly."

### Correct Solution

**Cannot solve at database layer** (SERVICE_ROLE_KEY bypasses database policies)  
**Must solve at credential layer** (remove key from developer environment)

This is why R1 correctly identified SERVICE_ROLE_KEY as a **separate canonical authority** (not just another database connection method).

---

## 🎯 RECOMMENDED ACTION

**Immediate (10 minutes):**

1. **Move SERVICE_ROLE_KEY out of developer environment**
   ```bash
   # Remove from mcp-server/.env
   # Add to CI/CD secrets only
   ```

2. **Replace with ANON_KEY for developer tools**
   ```env
   # mcp-server/.env
   SUPABASE_URL=https://lvnvkpyxtuilhrabtlwv.supabase.co
   SUPABASE_ANON_KEY=<anon-key-here>  # Respects RLS
   # Remove: SUPABASE_SERVICE_ROLE_KEY
   ```

3. **Re-run Authority #3 test**
   ```bash
   node scripts/bdgf/r3-test-authority3.mjs
   ```

4. **Expected result:** REST API mutation blocked (no SERVICE_ROLE_KEY available)

**Status After Fix:**
- Authority #1: ✅ CLOSED
- Authority #2: ✅ CLOSED  
- Authority #3: ✅ CLOSED
- R3: 🟢 FULLY COMPLETE (3/3 authorities)

---

## 📝 EVIDENCE

**Test Output:** `evidence/g3a-architecture/R3_AUTHORITY3_RESULTS_FIXED.txt`

**Key Evidence:**
```
❌ FAIL: REST API mutation succeeded
   SERVICE_ROLE_KEY can bypass bella_developer role
   Authority #3 bypass exists
   Inserted record: {"id":"e14dcf2a-71ed-4f2c-a9ee-4624bdbd6899",...}
```

**Test Date:** 2026-08-20  
**Test Script:** `scripts/bdgf/r3-test-authority3.mjs`

---

## 🔄 NEXT STEPS

1. ⏳ Execute Option A or C (remove/replace SERVICE_ROLE_KEY)
2. ⏳ Re-test Authority #3 (should PASS after remediation)
3. ⏳ Update R3_FINAL_STATUS.md → 🟢 FULLY COMPLETE (3/3)
4. ⏳ Lock R3 baseline
5. ⏳ Proceed to R4 design

**Blocker:** Authority #3 must be closed before R3 can be declared complete.

**Principle:** "Evidence > Assumption" - Cannot claim R3 complete with known bypass.

---

**Analysis Date:** 2026-08-20  
**Status:** 🔴 BYPASS DETECTED, REMEDIATION OPTIONS IDENTIFIED  
**Recommended Action:** Option A or C (remove/replace SERVICE_ROLE_KEY)
