# R3 Authority #2 Credential Source Analysis

**Date:** 2026-08-20 18:29  
**Status:** 🔴 CREDENTIAL SOURCE IDENTIFIED

---

## 🎯 ROOT CAUSE FOUND

### CLI Authentication Source

```bash
npx supabase projects list --debug
```

**Output:**
```
Using access token for profile: supabase
Using profile: supabase (supabase.co)
```

### Key Finding

**CLI is NOT using `$env:SUPABASE_ACCESS_TOKEN`**

CLI is using **stored profile authentication** at the system level.

---

## 🔍 CREDENTIAL PATH DISCOVERED

```
Supabase CLI
    ↓
Profile: "supabase"
    ↓
Stored Access Token (NOT environment variable)
    ↓
Production Access: GRANTED
```

### Evidence Trail

1. **Test 1:** Removed `$env:SUPABASE_ACCESS_TOKEN`
   - Result: CLI still authenticated ✅

2. **Test 2:** `npx supabase link --project-ref lvnvkpyxtuilhrabtlwv`
   - Result: "Finished supabase link." ✅ (SHOULD HAVE FAILED)

3. **Test 3:** `npx supabase projects list --debug`
   - Result: "Using access token for profile: supabase" ✅

4. **Profile file check:** `~/.supabase/profile`
   - Result: File not found (but CLI still has profile "supabase")

---

## 📊 AUTHORITY #2 STATUS

### Before Remediation
- Developer team member: YES
- CLI authenticated: YES
- Production access: YES

### After Environment Token Removal
- `$env:SUPABASE_ACCESS_TOKEN`: REMOVED
- CLI authenticated: **STILL YES** (using profile)
- Production access: **STILL YES**

### Current State
- Credential Source: **Stored profile "supabase"**
- Token Storage: System-level (not in `~/.supabase/profile`)
- Production Access: **🔴 OPEN**

---

## ✅ REQUIRED REMEDIATION

### Step 1: Logout from CLI profile
```bash
npx supabase logout
# Interactive prompt: Select "Yes"
```

### Step 2: Verify logout
```bash
npx supabase projects list
# Expected: Authentication error
```

### Step 3: Re-authenticate to Dev only
```bash
# DO NOT re-authenticate if dev work doesn't require CLI
# If needed, authenticate with dev-only credentials
```

### Step 4: Negative Test
```bash
npx supabase link --project-ref lvnvkpyxtuilhrabtlwv
# Expected: "Not a member" or authentication error
```

---

## 🔐 SECURITY IMPLICATIONS

### Discovered Bypass Pattern

**Pattern:** Environment variable removal insufficient when CLI uses profile-based authentication

**Impact:** 
- Removing `SUPABASE_ACCESS_TOKEN` did NOT revoke production access
- CLI maintains separate credential store
- Developer team membership removal also insufficient

### Required Controls

1. **Profile-level logout** (not just env variable removal)
2. **Team membership revocation** (already attempted)
3. **Token revocation in Supabase Dashboard** (if logout insufficient)

---

## 📝 NEXT SESSION ACTIONS

**Manual Action Required:**
```bash
npx supabase logout
# Select: Yes
```

**Then verify:**
```bash
npx supabase projects list
# Should fail with auth error
```

**Then negative test:**
```bash
npx supabase link --project-ref lvnvkpyxtuilhrabtlwv
# Should fail with "Not a member" or auth error
```

**Only after PASS:**
- Document evidence
- Mark Authority #2 as CLOSED
- Proceed to rotate exposed credentials
- Lock R3 baseline
- Open R4

---

## 🔴 CURRENT R3 STATUS

**Authority Matrix:**
- Authority #1 (DATABASE_URL): ✅ CLOSED
- Authority #2 (Supabase CLI): 🔴 OPEN (profile authentication active)
- Authority #3 (SERVICE_ROLE_KEY): ✅ CLOSED

**R3 Overall: 🔴 BLOCKED (2/3)**

**R4: ⏸️ BLOCKED**

---

**Principle Validated:** "Evidence > Assumption"

Removing environment variable was NOT sufficient. Required profile-level logout.
