# 🚀 DEPLOY RULE MANAGEMENT API - START HERE

**Status**: ✅ Ready to Deploy  
**Time Required**: 30 minutes  
**Complexity**: Easy (5 steps)

---

## 📦 What You're Deploying

| Component | Files | Size | Lines |
|-----------|-------|------|-------|
| **API Endpoints** | 6 | 38 KB | 1,327 |
| **Documentation** | 5 | 69 KB | 2,211 |
| **Test Scripts** | 2 | 29 KB | 965 |
| **Database Migration** | 1 | 13 KB | 359 |
| **Total** | **14** | **149 KB** | **4,862** |

**Features:**
- ✅ Complete CRUD for workflows and rules
- ✅ Rule simulation engine (10 operators)
- ✅ Simulation history tracking
- ✅ Multi-tenant isolation
- ✅ Version control for workflows
- ✅ Comprehensive test suite (12 tests)

---

## 🎯 Quick Start (Choose Your Path)

### Path A: Local Testing (Recommended First)
**Time**: 10 minutes

```powershell
# 1. Apply database migration
supabase db reset

# 2. Start dev server
npm run dev

# 3. Get auth token (login first, then browser console):
# const { data } = await supabase.auth.getSession();
# console.log(data.session.access_token);

# 4. Run test suite
$env:API_BASE_URL = "http://localhost:3000"
$env:AUTH_TOKEN = "YOUR_TOKEN_HERE"
.\scripts\test-rule-management-api.ps1

# Expected: ✓ Passed: 12, ✗ Failed: 0
```

---

### Path B: Staging Deployment
**Time**: 15 minutes

```bash
# 1. Deploy database to staging
supabase db push --project-ref YOUR_STAGING_REF

# 2. Deploy application
git add .
git commit -m "feat: Add Rule Management API (6 endpoints)"
git push origin staging

# 3. Run tests against staging
$env:API_BASE_URL = "https://your-staging-url.vercel.app"
$env:AUTH_TOKEN = "YOUR_TOKEN"
.\scripts\test-rule-management-api.ps1
```

---

### Path C: Production Deployment (After Staging Tests Pass)
**Time**: 20 minutes

```bash
# 1. Deploy database to production
supabase db push --project-ref YOUR_PRODUCTION_REF

# 2. Deploy application
git push origin main

# 3. Verify deployment
$env:API_BASE_URL = "https://your-production-url.vercel.app"
$env:AUTH_TOKEN = "YOUR_TOKEN"
.\scripts\test-rule-management-api.ps1

# 4. Monitor for 24 hours
# - Check error logs
# - Monitor response times
# - Verify no data corruption
```

---

## 📖 Documentation Quick Links

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[Quick Guide](docs/RULE_MANAGEMENT_STAGING_DEPLOYMENT_GUIDE.md)** | 5-step deploy | 🔥 **READ THIS FIRST** |
| **[Deployment Checklist](docs/RULE_MANAGEMENT_DEPLOYMENT_CHECKLIST.md)** | Full checklist | Before production |
| **[API Reference](docs/RULE_MANAGEMENT_API_REFERENCE.md)** | All endpoints | When integrating UI |
| **[Week 1 Day 2 Report](docs/RULE_MANAGEMENT_WEEK_1_DAY_2_COMPLETION.md)** | What was built | For context |
| **[Architecture](docs/RULE_MANAGEMENT_UI_ARCHITECTURE.md)** | Design decisions | For understanding |

---

## ⚡ Quick Commands

### Get Auth Token
```javascript
// In browser console (after login)
const { data } = await supabase.auth.getSession();
console.log("TOKEN:", data.session.access_token);
```

### Test One Endpoint
```powershell
# Create workflow
curl -X POST http://localhost:3000/api/rule-management/workflows `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{
    "name": "Test Workflow",
    "category": "test",
    "config": {"version": "1.0"}
  }'
```

### Check Database
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('workflow_definitions', 'workflow_rules', 'workflow_versions', 'rule_simulations');
```

---

## ✅ Pre-Deployment Checklist

Before deploying, verify:

- [ ] ✅ Build passes: `npm run build` (exit code 0)
- [ ] ✅ Migration file exists: `supabase/migrations/20260709130000_*.sql`
- [ ] ✅ Test scripts exist: `scripts/test-rule-management-api.*`
- [ ] ✅ Docs created: 5 files in `docs/RULE_MANAGEMENT_*.md`
- [ ] ✅ No TypeScript errors
- [ ] ✅ Auth token obtained
- [ ] ✅ Supabase project accessible

**Verify Now:**
```powershell
# Check build
npm run build 2>&1 | Select-String "Compiled successfully"

# Check files
Test-Path "supabase/migrations/20260709130000_rule_management_ui_foundation.sql"
Test-Path "scripts/test-rule-management-api.ps1"
```

---

## 🎯 Success Criteria

After deployment, you should see:

**1. Test Suite Results:**
```
========================================
Test Summary
========================================

✓ Passed: 12
✗ Failed: 0
Total: 12

✓ All tests passed! 🎉
```

**2. All Endpoints Working:**
- ✅ POST /api/rule-management/workflows → 201 Created
- ✅ GET /api/rule-management/workflows → 200 OK
- ✅ PATCH /api/rule-management/workflows/[id] → 200 OK
- ✅ DELETE /api/rule-management/workflows/[id] → 200 OK
- ✅ POST /api/rule-management/rules → 201 Created
- ✅ GET /api/rule-management/rules → 200 OK
- ✅ PATCH /api/rule-management/rules/[id] → 200 OK
- ✅ DELETE /api/rule-management/rules/[id] → 200 OK
- ✅ POST /api/rule-management/simulate → 200 OK
- ✅ GET /api/rule-management/simulations → 200 OK

**3. Database Verification:**
```sql
SELECT 'workflow_definitions' as table_name, COUNT(*) FROM workflow_definitions
UNION ALL
SELECT 'workflow_rules', COUNT(*) FROM workflow_rules
UNION ALL
SELECT 'workflow_versions', COUNT(*) FROM workflow_versions
UNION ALL
SELECT 'rule_simulations', COUNT(*) FROM rule_simulations;
```

---

## 🐛 Common Issues & Fixes

### Issue: "AUTH_TOKEN is not set"
```powershell
# Fix:
$env:AUTH_TOKEN = "your-token-here"
```

### Issue: "API is not reachable"
```bash
# Fix: Start dev server
npm run dev
```

### Issue: "Workflow not found (404)"
```sql
-- Fix: Check user's tenant
SELECT id, email, tenant_id FROM users WHERE email = 'your-email';
-- If tenant_id is NULL, assign one
UPDATE users SET tenant_id = 'TENANT_UUID' WHERE email = 'your-email';
```

### Issue: "relation 'workflow_definitions' does not exist"
```bash
# Fix: Apply migration
supabase db reset
```

---

## 📊 Performance Expectations

| Metric | Target | Acceptable |
|--------|--------|------------|
| List workflows | <50ms | <200ms |
| Create workflow | <100ms | <500ms |
| Simulate rules | <50ms + (2ms × rules) | <500ms |
| Success rate | >99% | >95% |
| Error rate | <1% | <5% |

---

## 🔄 Rollback Plan

If deployment fails:

**1. Rollback Code:**
```bash
git revert HEAD
git push origin main
```

**2. Rollback Database:**
```bash
# Drop tables (CAUTION!)
supabase db remote --project-ref YOUR_REF \
  -c "DROP TABLE IF EXISTS rule_simulations, workflow_versions, workflow_rules, workflow_definitions CASCADE;"
```

**3. Disable Feature:**
```env
# Add to .env
FEATURE_RULE_MANAGEMENT=false
```

---

## 🎉 After Successful Deployment

### Immediate Next Steps (Today)
1. ✅ Monitor error logs for 2 hours
2. ✅ Test with real user account
3. ✅ Share staging URL with team
4. ✅ Document any issues

### Short-term (This Week)
1. Start Week 1 Day 3-5: Visual Rule Builder UI
2. Create ConditionBuilder component
3. Create ActionBuilder component
4. Create RulePreview component

### Long-term (Next 2 Weeks)
1. Complete Week 2: Workflow Designer + Simulator
2. Complete Week 3: Testing + Polish
3. Production deployment
4. User training

---

## 🆘 Need Help?

**Documentation:**
- Quick Guide: `docs/RULE_MANAGEMENT_STAGING_DEPLOYMENT_GUIDE.md`
- Full Checklist: `docs/RULE_MANAGEMENT_DEPLOYMENT_CHECKLIST.md`
- API Docs: `docs/RULE_MANAGEMENT_API_REFERENCE.md`

**Test Scripts:**
- PowerShell: `scripts/test-rule-management-api.ps1`
- Bash: `scripts/test-rule-management-api.sh`

**Code:**
- API Endpoints: `src/app/api/rule-management/`
- TypeScript Types: `src/types/rule-management.types.ts`
- Database Migration: `supabase/migrations/20260709130000_*.sql`

---

## 🚀 Ready to Deploy?

**Step 1**: Read the [Quick Guide](docs/RULE_MANAGEMENT_STAGING_DEPLOYMENT_GUIDE.md)  
**Step 2**: Run the test suite locally  
**Step 3**: Deploy to staging  
**Step 4**: Verify success criteria  
**Step 5**: Monitor for 24 hours  

---

**Last Updated**: July 9, 2026  
**Status**: ✅ READY FOR DEPLOYMENT  
**Next**: Week 1 Day 3-5 - Visual Rule Builder UI

---

**Quick Test Command:**
```powershell
# Test everything in one command
$env:API_BASE_URL = "http://localhost:3000"
$env:AUTH_TOKEN = "YOUR_TOKEN"
.\scripts\test-rule-management-api.ps1
```

**Expected Output:**
```
✓ All tests passed! 🎉
```

🎯 **GO!**
