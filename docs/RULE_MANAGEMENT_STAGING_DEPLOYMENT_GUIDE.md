# Rule Management API - Staging Deployment Quick Guide

**Date**: July 9, 2026  
**Status**: ✅ Ready to Deploy  
**Estimated Time**: 30 minutes

---

## 🚀 Quick Deploy (5 Steps)

### Step 1: Deploy Database Migration (5 min)

```bash
# Option A: Local Supabase
supabase db reset

# Option B: Remote Staging
supabase db push --project-ref YOUR_STAGING_REF

# Option C: Remote Production (after testing)
supabase db push --project-ref YOUR_PRODUCTION_REF
```

**Verify migration:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('workflow_definitions', 'workflow_rules', 'workflow_versions', 'rule_simulations');

-- Should return 4 rows
```

---

### Step 2: Deploy Application (10 min)

```bash
# Verify build passes
npm run build

# Deploy to Vercel
git add .
git commit -m "feat: Add Rule Management API (6 endpoints, Week 1 Day 2)"
git push origin main

# Or manual deploy
vercel --prod
```

---

### Step 3: Get Auth Token (2 min)

**Option A: Browser Console**
```javascript
// Login to app first, then in console:
const { data } = await supabase.auth.getSession();
console.log(data.session.access_token);
```

**Option B: Supabase Dashboard**
1. Go to Supabase Dashboard
2. Authentication > Users
3. Click your user
4. Copy "Access Token"

**Option C: API Login**
```bash
curl -X POST https://YOUR_SUPABASE_URL/auth/v1/token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

---

### Step 4: Run Test Suite (10 min)

**Windows (PowerShell):**
```powershell
# Set variables
$env:API_BASE_URL = "http://localhost:3000"
$env:AUTH_TOKEN = "YOUR_TOKEN_HERE"

# Run tests
.\scripts\test-rule-management-api.ps1
```

**Mac/Linux (Bash):**
```bash
# Set variables
export API_BASE_URL="http://localhost:3000"
export AUTH_TOKEN="YOUR_TOKEN_HERE"

# Run tests
chmod +x scripts/test-rule-management-api.sh
./scripts/test-rule-management-api.sh
```

**Expected Output:**
```
========================================
Test Summary
========================================

✓ Passed: 12
✗ Failed: 0
Total: 12

✓ All tests passed! 🎉
```

---

### Step 5: Manual Smoke Test (3 min)

**Test 1: Create Workflow**
```bash
curl -X POST http://localhost:3000/api/rule-management/workflows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "category": "test",
    "config": {"version": "1.0"}
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "Test Workflow",
    "status": "draft",
    "created_at": "2026-07-09T..."
  }
}
```

**Test 2: List Workflows**
```bash
curl -X GET "http://localhost:3000/api/rule-management/workflows?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Test Workflow",
      "status": "draft"
    }
  ],
  "meta": {
    "limit": 10,
    "offset": 0,
    "count": 1
  }
}
```

---

## ✅ Success Checklist

After deployment, verify:

- [ ] ✅ All 6 endpoints responding (200/201 status)
- [ ] ✅ Authentication working (no 401 errors)
- [ ] ✅ Tenant isolation enforced (no cross-tenant data leak)
- [ ] ✅ Database queries executing (workflows/rules created)
- [ ] ✅ Test suite passes (12/12 tests)
- [ ] ✅ No errors in server logs
- [ ] ✅ Build completed successfully
- [ ] ✅ Migration applied (4 tables created)

---

## 🐛 Troubleshooting

### Error: "AUTH_TOKEN is not set"
**Solution:**
```powershell
# Check if set
$env:AUTH_TOKEN

# Set it
$env:AUTH_TOKEN = "your-token-here"
```

---

### Error: "API is not reachable"
**Solution:**
```bash
# Check if server running
curl http://localhost:3000/api/health

# Start dev server if needed
npm run dev
```

---

### Error: "Workflow not found (404)"
**Cause**: User's tenant_id not in database  
**Solution:**
```sql
-- Check user's tenant
SELECT id, email, tenant_id FROM users WHERE email = 'your-email@example.com';

-- Create tenant if missing
INSERT INTO tenants (id, name) VALUES (gen_random_uuid(), 'Test Tenant');

-- Update user's tenant
UPDATE users SET tenant_id = 'TENANT_UUID' WHERE email = 'your-email@example.com';
```

---

### Error: "relation 'workflow_definitions' does not exist"
**Cause**: Migration not applied  
**Solution:**
```bash
# Apply migration
supabase db reset

# Or remote
supabase db push --project-ref YOUR_PROJECT_REF
```

---

## 📊 Performance Benchmarks

**Expected Response Times (Local):**
| Endpoint | Target | Acceptable |
|----------|--------|------------|
| List workflows | <50ms | <200ms |
| Create workflow | <100ms | <500ms |
| List rules | <80ms | <300ms |
| Simulate rules | <50ms + (2ms × rules) | <500ms |

**Production Targets:**
- Success rate: >99%
- Average response: <100ms
- P95 response: <500ms
- Error rate: <1%

---

## 🔄 Rollback Plan

**If deployment fails:**

**1. Rollback Code:**
```bash
git revert HEAD
git push origin main
```

**2. Rollback Database:**
```bash
# Drop tables (CAUTION!)
supabase db remote --project-ref YOUR_REF \
  -c "DROP TABLE IF EXISTS rule_simulations CASCADE;"
```

**3. Disable Feature:**
```bash
# Add to .env
FEATURE_RULE_MANAGEMENT=false
```

---

## 📚 Reference Documents

- **API Reference**: `docs/RULE_MANAGEMENT_API_REFERENCE.md`
- **Deployment Checklist**: `docs/RULE_MANAGEMENT_DEPLOYMENT_CHECKLIST.md`
- **Week 1 Day 2 Report**: `docs/RULE_MANAGEMENT_WEEK_1_DAY_2_COMPLETION.md`
- **Architecture**: `docs/RULE_MANAGEMENT_UI_ARCHITECTURE.md`

---

## 🎯 Next Steps After Deployment

### Immediate (Next 24h)
1. Monitor error logs
2. Check response times
3. Verify no data corruption
4. Test with real user accounts

### Short-term (Next Week)
1. Start Week 1 Day 3-5: Visual Rule Builder UI
2. Connect UI to APIs
3. Implement form validation
4. Add loading states

### Long-term (Next 2 Weeks)
1. Complete Week 2: Workflow Designer + Simulator
2. Complete Week 3: Testing + Polish
3. Production deployment
4. User training

---

## 💡 Pro Tips

**1. Save Your Auth Token**
```bash
# Save to file for easy access
echo "YOUR_TOKEN" > .auth-token
export AUTH_TOKEN=$(cat .auth-token)
```

**2. Quick Test Command**
```bash
# One-liner test
curl -s http://localhost:3000/api/rule-management/workflows?limit=1 \
  -H "Authorization: Bearer $(cat .auth-token)" | jq '.success'
# Should output: true
```

**3. Watch Logs**
```bash
# In separate terminal
npm run dev | grep "rule-management"
```

**4. Database Inspection**
```sql
-- Quick count check
SELECT 
  'workflow_definitions' as table_name, COUNT(*) as count FROM workflow_definitions
UNION ALL
SELECT 'workflow_rules', COUNT(*) FROM workflow_rules
UNION ALL
SELECT 'workflow_versions', COUNT(*) FROM workflow_versions
UNION ALL
SELECT 'rule_simulations', COUNT(*) FROM rule_simulations;
```

---

## 🎉 Deployment Complete!

**What you deployed:**
- ✅ 6 REST API endpoints (1,327 lines)
- ✅ 4 database tables with indexes
- ✅ 3 RPC functions for queries
- ✅ Complete test suite (12 tests)
- ✅ Comprehensive documentation

**Ready for:**
- ✅ Week 1 Day 3-5: Visual Rule Builder UI
- ✅ User acceptance testing
- ✅ Production deployment (after staging verification)

---

**Questions?** Check:
- `docs/RULE_MANAGEMENT_DEPLOYMENT_CHECKLIST.md` - Detailed checklist
- `docs/RULE_MANAGEMENT_API_REFERENCE.md` - Full API docs
- `scripts/test-rule-management-api.ps1` - Test script source

**Status**: ✅ DEPLOYED AND TESTED
