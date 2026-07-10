# 🚀 RUN TESTS NOW - Quick Guide

**Status**: ✅ All systems deployed and ready!  
**Time**: ~5 minutes to complete

---

## STEP 1: Get Auth Token (2 minutes)

### 1. Login to App
- URL: https://bella-spa-erp.vercel.app
- Login with your credentials

### 2. Open Browser Console
- Press **F12** (or right-click → Inspect)
- Go to **Console** tab

### 3. Get Token
Copy and paste this into console:
```javascript
const { data } = await supabase.auth.getSession();
console.log(data.session.access_token);
```

### 4. Copy Token
- You'll see a long string starting with "eyJ..."
- **Right-click → Copy**
- Save it somewhere (you'll need it next)

---

## STEP 2: Run Test Suite (3 minutes)

### Open PowerShell
- Open PowerShell in project directory
- Or use VS Code terminal

### Set Environment Variables
```powershell
$env:API_BASE_URL = "https://bella-spa-erp.vercel.app"
$env:AUTH_TOKEN = "paste-your-token-here"
```

**Replace "paste-your-token-here" with your actual token!**

### Run Tests
```powershell
.\scripts\test-rule-management-api.ps1
```

---

## EXPECTED RESULTS ✅

You should see:
```
========================================
Rule Management API Test Suite
========================================

✓ Prerequisites
✓ Test 1: Create Workflow
✓ Test 2: List Workflows
✓ Test 3: Get Workflow
✓ Test 4: Update Workflow
✓ Test 5: Create Rule
✓ Test 6: List Rules
✓ Test 7: Get Rule
✓ Test 8: Update Rule
✓ Test 9: Simulate Rules
✓ Test 10: List Simulation History
✓ Test 11: Delete Rule
✓ Test 12: Delete Workflow

========================================
Test Summary
========================================

✓ Passed: 12
✗ Failed: 0
Total: 12

✓ All tests passed! 🎉
```

---

## IF TESTS FAIL ❌

### Common Issues:

**1. AUTH_TOKEN not set**
```
Error: AUTH_TOKEN is not set
```
**Fix**: Make sure you ran `$env:AUTH_TOKEN = "..."`

**2. Invalid token**
```
Error: Unauthorized (401)
```
**Fix**: Get a fresh token (tokens expire after 1 hour)

**3. API not found**
```
Error: 404 Not Found
```
**Fix**: Check if Vercel deployment completed successfully

**4. Tenant not found**
```
Error: User tenant not found (404)
```
**Fix**: Make sure your user has a valid tenant_id in database

---

## AFTER TESTS PASS ✅

### 1. Update Deployment Status
- Open `DEPLOYMENT_STATUS.md`
- Mark tests as ✅ Complete

### 2. Monitor for 24 Hours
- Check error logs in Vercel
- Monitor response times
- Verify no crashes

### 3. Start Week 1 Day 3-5
- Begin Visual Rule Builder UI
- ConditionBuilder component
- ActionBuilder component
- RulePreview component

---

## QUICK COMMANDS REFERENCE

### Get New Token
```javascript
const { data } = await supabase.auth.getSession();
console.log(data.session.access_token);
```

### Set Environment
```powershell
$env:API_BASE_URL = "https://bella-spa-erp.vercel.app"
$env:AUTH_TOKEN = "your-token"
```

### Run Tests
```powershell
.\scripts\test-rule-management-api.ps1
```

### Check Deployment
- Vercel: https://vercel.com/bellaspahcm/bella-spa-erp
- GitHub: https://github.com/bellaspahcm/bella-spa-erp
- Supabase: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv

---

## HELP & SUPPORT

**Full Documentation**:
- `DEPLOY_RULE_MANAGEMENT.md` - Main guide
- `DEPLOYMENT_STATUS.md` - Current status
- `docs/RULE_MANAGEMENT_API_REFERENCE.md` - API docs

**Test Scripts**:
- `scripts/test-rule-management-api.ps1` - PowerShell (Windows)
- `scripts/test-rule-management-api.sh` - Bash (Mac/Linux)

---

**Last Updated**: July 9, 2026, 10:30 PM  
**Status**: ✅ READY TO TEST  
**Next**: Get auth token → Run tests → Celebrate! 🎉
