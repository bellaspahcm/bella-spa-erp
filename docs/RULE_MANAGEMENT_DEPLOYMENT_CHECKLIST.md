# Rule Management API - Staging Deployment Checklist

**Date**: July 9, 2026  
**Version**: 1.0.0  
**Environment**: Staging → Production  
**Status**: Ready for Deployment

---

## Pre-Deployment Checklist

### 1. Database Migration ✅
- [ ] **Migration file created**: `supabase/migrations/20260709130000_rule_management_ui_foundation.sql`
- [ ] **Tables verified**:
  - [ ] `workflow_definitions` (10 columns, 3 indexes, RLS enabled)
  - [ ] `workflow_rules` (12 columns, 3 indexes, RLS enabled)
  - [ ] `workflow_versions` (8 columns, 1 index, RLS enabled)
  - [ ] `rule_simulations` (7 columns, 2 indexes, RLS enabled)
- [ ] **RPC functions created**:
  - [ ] `get_workflow_definitions()`
  - [ ] `get_workflow_rules()`
  - [ ] `get_rule_simulation_results()`
- [ ] **Indexes created**: 8 total indexes for performance
- [ ] **RLS policies**: All 4 tables have tenant isolation

**Verify Command:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workflow_definitions', 'workflow_rules', 'workflow_versions', 'rule_simulations');

-- Check RPC functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_workflow_definitions', 'get_workflow_rules', 'get_rule_simulation_results');
```

---

### 2. Code Build ✅
- [ ] **Build successful**: `npm run build` passes
- [ ] **No TypeScript errors**: All type checks pass
- [ ] **All 6 endpoints compiled**:
  - [ ] `/api/rule-management/workflows` (GET, POST)
  - [ ] `/api/rule-management/workflows/[workflowId]` (GET, PATCH, DELETE)
  - [ ] `/api/rule-management/rules` (GET, POST)
  - [ ] `/api/rule-management/rules/[ruleId]` (GET, PATCH, DELETE)
  - [ ] `/api/rule-management/simulate` (POST)
  - [ ] `/api/rule-management/simulations` (GET)

**Verify Command:**
```bash
npm run build 2>&1 | grep "rule-management"
```

---

### 3. Environment Variables ✅
- [ ] **Supabase credentials**:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (for server-side operations)
- [ ] **Feature flags** (optional):
  - [ ] `FEATURE_RULE_MANAGEMENT` (default: true)

**Verify Command:**
```bash
# Check .env.local or .env.production
grep -E "(SUPABASE|FEATURE_RULE_MANAGEMENT)" .env.local
```

---

### 4. Authentication Setup ✅
- [ ] **Auth token obtained**: Supabase auth token for testing
- [ ] **User created**: Test user with valid tenant_id
- [ ] **Tenant exists**: Test tenant record in `tenants` table
- [ ] **RLS verified**: User can only access their tenant's data

**Get Auth Token:**
```javascript
// In browser console after login
const { data } = await supabase.auth.getSession();
console.log(data.session.access_token);
```

---

## Deployment Steps

### Step 1: Deploy Database Migration

**Local Development:**
```bash
# Apply migration locally
supabase db reset

# Or apply specific migration
supabase migration up 20260709130000_rule_management_ui_foundation
```

**Staging:**
```bash
# Push migration to staging
supabase db push --project-ref YOUR_STAGING_PROJECT_REF

# Verify migration applied
supabase db remote --project-ref YOUR_STAGING_PROJECT_REF \
  -c "SELECT * FROM workflow_definitions LIMIT 1;"
```

**Production:**
```bash
# Push migration to production (after staging verification)
supabase db push --project-ref YOUR_PRODUCTION_PROJECT_REF

# Verify migration applied
supabase db remote --project-ref YOUR_PRODUCTION_PROJECT_REF \
  -c "SELECT * FROM workflow_definitions LIMIT 1;"
```

---

### Step 2: Deploy Application Code

**Build Application:**
```bash
# Clean build
rm -rf .next
npm run build

# Verify build output
ls .next/standalone/server/app/api/rule-management
```

**Deploy to Vercel/Staging:**
```bash
# Deploy to staging
git add .
git commit -m "feat: Add Rule Management API endpoints (6 endpoints, 1,327 lines)"
git push origin staging

# Or deploy manually
vercel --prod --scope YOUR_TEAM
```

---

### Step 3: Run API Tests

**Get Auth Token:**
```bash
# Login and get token (browser console)
const { data } = await supabase.auth.getSession();
const token = data.session.access_token;
console.log(token);
```

**Run Test Suite (Bash):**
```bash
# Set environment variables
export API_BASE_URL="https://your-staging-domain.vercel.app"
export AUTH_TOKEN="your-auth-token-here"

# Make script executable
chmod +x scripts/test-rule-management-api.sh

# Run tests
./scripts/test-rule-management-api.sh
```

**Run Test Suite (PowerShell):**
```powershell
# Set environment variables
$env:API_BASE_URL = "https://your-staging-domain.vercel.app"
$env:AUTH_TOKEN = "your-auth-token-here"

# Run tests
.\scripts\test-rule-management-api.ps1
```

**Or pass parameters directly:**
```powershell
.\scripts\test-rule-management-api.ps1 `
  -ApiBaseUrl "https://your-staging-domain.vercel.app" `
  -AuthToken "your-auth-token-here"
```

---

### Step 4: Verify Deployment

**Manual Verification:**

1. **Create Workflow**
```bash
curl -X POST https://your-domain/api/rule-management/workflows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "category": "test",
    "config": {"version": "1.0"}
  }'
```

2. **List Workflows**
```bash
curl -X GET "https://your-domain/api/rule-management/workflows?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Simulate Rule**
```bash
curl -X POST https://your-domain/api/rule-management/simulate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "WORKFLOW_UUID",
    "testData": {"amount": 1000},
    "saveResult": false
  }'
```

**Expected Responses:**
- ✅ `200 OK` for GET requests
- ✅ `201 Created` for POST requests
- ✅ All responses have `{ "success": true, "data": {...} }` structure
- ✅ No authentication errors (401)
- ✅ No server errors (500)

---

### Step 5: Performance Testing

**Load Test (Optional):**
```bash
# Install artillery (if not installed)
npm install -g artillery

# Create test config
cat > artillery-rule-management.yml <<EOF
config:
  target: "https://your-domain"
  phases:
    - duration: 60
      arrivalRate: 10
  processor: "./artillery-auth.js"
scenarios:
  - name: "List Workflows"
    flow:
      - get:
          url: "/api/rule-management/workflows?limit=50"
          headers:
            Authorization: "Bearer {{token}}"
EOF

# Run load test
artillery run artillery-rule-management.yml
```

**Performance Targets:**
| Endpoint | Target Response Time | Max Response Time |
|----------|---------------------|-------------------|
| List workflows | <50ms | <200ms |
| Create workflow | <100ms | <500ms |
| List rules | <80ms | <300ms |
| Simulate rules | <50ms + (rules * 2ms) | <500ms |

---

## Post-Deployment Verification

### 1. Smoke Tests ✅
- [ ] **All 6 endpoints responding**
- [ ] **Authentication working**
- [ ] **Tenant isolation enforced**
- [ ] **Database queries executing**
- [ ] **No server errors in logs**

### 2. Data Integrity ✅
- [ ] **Workflows created successfully**
- [ ] **Rules linked to workflows**
- [ ] **Versions created on config change**
- [ ] **Simulations saved to history**
- [ ] **Soft delete (archive) working**

### 3. Security Checks ✅
- [ ] **Unauthorized access blocked** (401 without token)
- [ ] **Cross-tenant access blocked** (404 for other tenant's data)
- [ ] **Invalid input rejected** (400 for missing fields)
- [ ] **SQL injection protected** (parameterized queries)
- [ ] **RLS policies active** (database-level isolation)

### 4. Monitoring Setup ✅
- [ ] **Error tracking** (Sentry/Bugsnag configured)
- [ ] **Performance monitoring** (response time alerts)
- [ ] **Log aggregation** (console.error captured)
- [ ] **Database metrics** (query performance)

---

## Rollback Plan

### If Deployment Fails

**1. Rollback Database Migration:**
```bash
# Revert migration (if needed)
supabase db reset --remote --project-ref YOUR_PROJECT_REF

# Or run down migration (if created)
supabase migration down 20260709130000_rule_management_ui_foundation
```

**2. Rollback Application Code:**
```bash
# Revert git commit
git revert HEAD

# Redeploy previous version
git push origin main

# Or redeploy via Vercel
vercel rollback
```

**3. Disable Feature Flag:**
```bash
# In .env.production
FEATURE_RULE_MANAGEMENT=false
```

### If Partial Failure

**Disable specific endpoints:**
```typescript
// In route.ts files, add feature flag check
if (process.env.FEATURE_RULE_MANAGEMENT !== 'true') {
  return NextResponse.json(
    { success: false, error: 'Feature disabled' },
    { status: 503 }
  );
}
```

---

## Troubleshooting

### Common Issues

**1. Authentication Errors (401)**
- **Cause**: Invalid or expired auth token
- **Fix**: Get new token from Supabase dashboard or re-login
- **Verify**: `supabase auth getSession()`

**2. Tenant Not Found (404)**
- **Cause**: User's tenant_id not in tenants table
- **Fix**: Create tenant record or assign user to existing tenant
- **Verify**: `SELECT * FROM users WHERE id = 'USER_ID';`

**3. Migration Already Applied**
- **Cause**: Migration file already exists in remote database
- **Fix**: Check `supabase_migrations` table, skip if already applied
- **Verify**: `SELECT * FROM supabase_migrations WHERE version = '20260709130000';`

**4. RPC Function Not Found**
- **Cause**: Migration not fully applied or permissions issue
- **Fix**: Re-run migration, check GRANT EXECUTE statements
- **Verify**: `SELECT * FROM pg_proc WHERE proname = 'get_workflow_definitions';`

**5. CORS Errors**
- **Cause**: Frontend calling from different domain
- **Fix**: Add domain to Supabase Auth allowed domains
- **Verify**: Check browser console for CORS error details

---

## Success Criteria

### All Tests Must Pass ✅
- [ ] **12 automated tests** pass (test suite)
- [ ] **Manual verification** successful
- [ ] **Performance targets** met (<200ms avg)
- [ ] **Security checks** pass (no unauthorized access)
- [ ] **Zero critical errors** in logs

### Metrics to Track
| Metric | Target | Status |
|--------|--------|--------|
| API Success Rate | >99% | ⏳ |
| Average Response Time | <100ms | ⏳ |
| Error Rate | <1% | ⏳ |
| Authentication Success | 100% | ⏳ |
| Tenant Isolation | 100% | ⏳ |

---

## Next Steps After Deployment

### 1. Monitor for 24 Hours
- Check error logs every 2 hours
- Monitor response times
- Verify no data corruption
- Watch for authentication issues

### 2. User Acceptance Testing
- Share staging URL with team
- Test workflow creation flow
- Test rule simulation
- Collect feedback

### 3. Prepare for Week 1 Day 3-5
- Start building Visual Rule Builder UI
- Connect UI components to APIs
- Implement form validation
- Add loading states

---

## Appendix A: Test Script Usage

### Bash Script (Linux/Mac)

**Basic Usage:**
```bash
# Set environment variables
export API_BASE_URL="http://localhost:3000"
export AUTH_TOKEN="your-token-here"

# Run tests
./scripts/test-rule-management-api.sh
```

**With Custom Parameters:**
```bash
API_BASE_URL="https://staging.example.com" \
AUTH_TOKEN="eyJhbGc..." \
./scripts/test-rule-management-api.sh
```

### PowerShell Script (Windows)

**Basic Usage:**
```powershell
# Set environment variables
$env:API_BASE_URL = "http://localhost:3000"
$env:AUTH_TOKEN = "your-token-here"

# Run tests
.\scripts\test-rule-management-api.ps1
```

**With Parameters:**
```powershell
.\scripts\test-rule-management-api.ps1 `
  -ApiBaseUrl "https://staging.example.com" `
  -AuthToken "eyJhbGc..."
```

### Expected Output

**Successful Run:**
```
========================================
Rule Management API Test Suite
========================================

✓ jq is installed
✓ AUTH_TOKEN is set
✓ API is reachable at http://localhost:3000

========================================
Test 1: Create Workflow
========================================

ℹ Creating workflow...
✓ Created workflow with ID: 550e8400-e29b-41d4-a716-446655440000

...

========================================
Test Summary
========================================

✓ Passed: 12
✗ Failed: 0
Total: 12

✓ All tests passed! 🎉
```

---

## Appendix B: Database Schema Reference

### Tables Created

**1. workflow_definitions**
```sql
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

**2. workflow_rules**
```sql
CREATE TABLE workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

**3. workflow_versions**
```sql
CREATE TABLE workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  version INT NOT NULL,
  config JSONB NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

**4. rule_simulations**
```sql
CREATE TABLE rule_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  test_data JSONB NOT NULL,
  results JSONB NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

---

## Appendix C: API Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rule-management/workflows` | List all workflows |
| POST | `/api/rule-management/workflows` | Create workflow |
| GET | `/api/rule-management/workflows/[id]` | Get workflow |
| PATCH | `/api/rule-management/workflows/[id]` | Update workflow |
| DELETE | `/api/rule-management/workflows/[id]` | Archive workflow |
| GET | `/api/rule-management/rules` | List all rules |
| POST | `/api/rule-management/rules` | Create rule |
| GET | `/api/rule-management/rules/[id]` | Get rule |
| PATCH | `/api/rule-management/rules/[id]` | Update rule |
| DELETE | `/api/rule-management/rules/[id]` | Delete rule |
| POST | `/api/rule-management/simulate` | Simulate rules |
| GET | `/api/rule-management/simulations` | List simulation history |

---

**Last Updated**: July 9, 2026  
**Status**: ✅ Ready for Staging Deployment  
**Next**: Run test suite → Monitor 24h → Week 1 Day 3-5 UI
