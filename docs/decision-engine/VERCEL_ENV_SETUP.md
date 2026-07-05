# Vercel Environment Variables Setup for Gate 1

**Issue**: Gate 1 test endpoint returns `supabaseKey is required.`

**Root Cause**: `SUPABASE_SERVICE_ROLE_KEY` environment variable not set on Vercel.

---

## ✅ Solution: Add Environment Variable on Vercel

### Step 1: Open Vercel Dashboard

1. Go to https://vercel.com/bella-spa-s-projects/bella-spa-erp
2. Click **Settings** tab
3. Click **Environment Variables** in left sidebar

### Step 2: Add SUPABASE_SERVICE_ROLE_KEY

**Variable Name**:
```
SUPABASE_SERVICE_ROLE_KEY
```

**Value** (copy from `.env.local`):
```
sb_secret_REMOVED_SERVICE_ROLE_KEY
```

**Environments** (select all 3):
- ✅ Production
- ✅ Preview
- ✅ Development

### Step 3: Redeploy

After adding the variable:

1. Go to **Deployments** tab
2. Click **...** menu on latest deployment
3. Click **Redeploy**
4. Wait 2-3 minutes

---

## Alternative: Use Vercel CLI (Faster)

If you have Vercel CLI installed:

```bash
# Set environment variable
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Paste the key when prompted:
# sb_secret_REMOVED_SERVICE_ROLE_KEY

# Select environments: All (Production, Preview, Development)

# Redeploy
vercel --prod
```

---

## Verification

After redeployment, test the endpoint:

```bash
curl -X POST https://bella-spa-erp.vercel.app/api/leave-requests/req-gate1-success/decide-test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sb_secret_REMOVED_SERVICE_ROLE_KEY" \
  -d '{
    "approverId": "23a9da64-a8c6-4250-8268-37c965e70fd7",
    "approverRole": "manager",
    "tenantId": "26c2d467-7c12-4e77-bb67-0e9e43fd7594"
  }'
```

**Expected**: JSON response with `success: true` or decision result (not "supabaseKey is required")

---

## Security Note

✅ **Correct**: Environment variables stored securely on Vercel  
❌ **Never**: Hardcode keys in source code  
❌ **Never**: Commit keys to Git  
✅ **Use**: `.env.local` for local development (gitignored)

---

**Next**: After env var is set and redeployed, run Gate 1 validation script again.
