---
date: 2026-09-13
scope: E1 V1 Semantic Verification Unblock
priority: P0
---

# VERCEL SSO UNBLOCK GUIDE

**Current Status:** API verification BLOCKED by Vercel Deployment Protection  
**Impact:** Cannot complete E1 V1 semantic verification (11.5/19 → 12/19)  
**Resolution Time:** 2 minutes

---

## 🔴 PROBLEM CONFIRMED

```bash
$ curl -i <preview-url>/api/english-center/branches

HTTP/1.1 302 Found
Location: https://vercel.com/sso-api?url=...
Content-Type: text/plain
Body: "Redirecting..."
```

**Root Cause:** Vercel Deployment Protection enabled on preview deployment

**Evidence:**
- All API requests redirect to SSO login
- Cannot verify JSON response format
- Cannot test API semantics
- Blocks E1 runtime verification

---

## ✅ SOLUTION: DISABLE PROTECTION (RECOMMENDED)

### Step-by-Step Instructions

#### 1. Open Vercel Dashboard

**URL:** https://vercel.com/bellaspahcm/bella-spa-erp/settings/deployment-protection

**Or navigate manually:**
1. Go to https://vercel.com
2. Select project: `bella-spa-erp`
3. Click **Settings** tab
4. Scroll to **Deployment Protection**

---

#### 2. Disable Vercel Authentication

**Find section:** "Vercel Authentication"

**Current state:**
```
[x] Vercel Authentication
    Require visitors to log in with Vercel before accessing your Preview Deployments
```

**Action:** Toggle OFF / Uncheck the box

**Expected result:**
```
[ ] Vercel Authentication
    Disabled
```

---

#### 3. Wait for Change to Propagate

**Duration:** 30 seconds

Vercel needs time to update edge configuration.

---

#### 4. Verify Change

Run this command to confirm SSO disabled:

```powershell
curl -i "https://bella-spa-28uiqxh1h-bella-spa-s-projects.vercel.app/api/english-center/branches?tenantId=test-tenant-1"
```

**Expected result:**
```
HTTP/1.1 200 OK
Content-Type: application/json
...

{"data":[...]}
```

**If still getting 302:** Wait another 30 seconds and retry

---

#### 5. Run E1 V1 Semantic Verification

After SSO unblocked:

```powershell
# Full semantic test
.\scripts\e1-smoke-test-semantic.ps1 "https://bella-spa-28uiqxh1h-bella-spa-s-projects.vercel.app"
```

**Success criteria:**
- ✅ Response `Content-Type: application/json`
- ✅ Response body is valid JSON
- ✅ JSON matches expected schema
- ✅ Error cases return proper error JSON

**Result:** V1 complete (12/19) → Proceed to V6 UI test

---

## 🔐 ALTERNATIVE: USE BYPASS TOKEN (IF PROTECTION MUST STAY)

**If you cannot disable protection:**

### Step 1: Generate Bypass Token

1. Go to: https://vercel.com/bellaspahcm/bella-spa-erp/settings/deployment-protection
2. Find section: **Protection Bypass for Automation**
3. Click: **Create Token**
4. Copy token value

### Step 2: Test with Token

```powershell
$token = "<your-bypass-token>"
$url = "https://bella-spa-28uiqxh1h-bella-spa-s-projects.vercel.app/api/english-center/branches"

curl -H "x-vercel-protection-bypass: $token" $url
```

### Step 3: Set Environment Variable

```powershell
# For current session
$env:VERCEL_AUTOMATION_BYPASS_SECRET = "<your-token>"

# For persistent (add to profile)
[System.Environment]::SetEnvironmentVariable(
    "VERCEL_AUTOMATION_BYPASS_SECRET",
    "<your-token>",
    [System.EnvironmentVariableTarget]::User
)
```

### Step 4: Update Test Script

Modify `scripts/e1-smoke-test-semantic.ps1` to use bypass token if available.

---

## ⚠️ SECURITY NOTES

### Disabling Protection is Safe For:

✅ Preview deployments (this case)  
✅ Testing/staging environments  
✅ Short-term verification (re-enable after E1 complete)

### Keep Protection Enabled For:

🔒 Production deployments  
🔒 Public-facing previews  
🔒 Long-term preview branches

### Best Practice:

1. Disable protection for E1 verification (2 hours max)
2. Complete V1-V8 runtime tests
3. Re-enable protection after E1 sealed
4. Use bypass token for automated CI/CD

---

## 📋 QUICK CHECKLIST

- [ ] Open Vercel deployment protection settings
- [ ] Disable "Vercel Authentication"
- [ ] Wait 30 seconds
- [ ] Test: `curl -i <preview-url>/api/english-center/branches`
- [ ] Verify: `Content-Type: application/json`
- [ ] Run: `.\scripts\e1-smoke-test-semantic.ps1`
- [ ] Record results in `E1_V1_SEMANTIC_RESULTS.md`
- [ ] (Optional) Re-enable protection after E1 complete

---

## 🎯 EXPECTED OUTCOME

**After unblock:**

```text
V1 Route Reachability       ✅ PASS (already done)
V1 API Semantic Verification ✅ PASS (after unblock)
V1 Total                    ✅ 2/2 (12/19 overall)

Next: V6 UI Manual Test → V2-V8 Full Suite → 19/19 → E1 SEALED
```

**Timeline:**
- Disable protection: 2 minutes
- Run semantic tests: 3 minutes
- Document results: 2 minutes
- **Total:** 7 minutes to complete V1

---

## ❓ DECISION REQUIRED

**User: Please choose one option:**

**Option A (Recommended):** Disable Vercel Protection temporarily
- Pros: Fast (2 min), simple, no token management
- Cons: Preview unprotected during test (acceptable for private repo)
- Action: Follow "Disable Protection" steps above

**Option B:** Use bypass token
- Pros: Keep protection enabled
- Cons: More steps (5 min), need to manage token
- Action: Follow "Use Bypass Token" steps above

**Option C:** Skip V1 semantic, proceed to V6 UI
- Pros: No Vercel config needed
- Cons: V1 incomplete, E1 not fully verified
- Action: Not recommended (11.5/19 vs 12/19)

---

**Current blocker:** Awaiting user decision on SSO resolution approach

**Recommended action:** Option A (disable protection, test, re-enable after E1)

