---
product: Bella English Center
phase: E1 Chain Management
milestone: Runtime Verification
priority: P0 (blocks E2-E10)
date: 2026-09-12
---

# E1 RUNTIME VERIFICATION PLAN

> **PRIORITY:** P0 — Must complete before E2-E10 development
> 
> **RATIONALE:** E1 = first product consuming Platform Org Unit contract. Runtime verification proves pattern works. E2-E10 depend on E1 branch scope.

---

## 📊 CURRENT STATUS

```text
Implementation              ✅ COMPLETE (6/6 deliverables)
Build                       ✅ PASS (52s compile)
Tests                       ✅ 36/36 PASS (unit tests)

Runtime verification        ⏸️ PENDING (staging/CI needed)
Deployment                  ❌ NOT STARTED
E1 Seal                     ❌ BLOCKED
```

**Blocker:** No staging/CI environment available for runtime verification

**Next:** Deploy to staging → verify 8 runtime criteria → seal E1

---

## 🚀 DEPLOYMENT PLAN

### Phase 1: Environment Setup

**Prerequisites:**
- [ ] Staging Supabase instance (or local with full stack)
- [ ] Database accessible for migrations
- [ ] Auth configured (test users + roles)
- [ ] RLS policies enabled
- [ ] CI/CD pipeline (or manual deploy capability)

**Setup Commands:**
```bash
# Option A: Supabase local
supabase start
supabase db reset

# Option B: Staging
export SUPABASE_URL="https://[project].supabase.co"
export SUPABASE_ANON_KEY="[key]"
export SUPABASE_SERVICE_ROLE_KEY="[key]"
```

---

### Phase 2: Migration Deployment

**File:** `supabase/migrations/20260912120000_add_branch_id_to_education_tables.sql`

**Deploy:**
```bash
# Local
supabase migration up --file 20260912120000_add_branch_id_to_education_tables.sql

# Staging
supabase db push
```

**Verify Schema:**
```sql
-- 1. Check columns exist
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE column_name = 'branch_id'
  AND table_name IN ('enrollments', 'courses', 'classes', 'teachers');

-- Expected: 4 rows (or 2-4 depending on table existence)

-- 2. Check FK constraints
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'branch_id';

-- Expected: 4 FK constraints to org_units(id)

-- 3. Check view exists
SELECT * FROM v_branch_academic_summary LIMIT 1;

-- Expected: view exists (may return 0 rows if no data)

-- 4. Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname LIKE '%branch_id%';

-- Expected: 4 indexes
```

**Rollback (if needed):**
```sql
-- Rollback script
DROP VIEW IF EXISTS v_branch_academic_summary;

ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_branch_fk;
ALTER TABLE enrollments DROP COLUMN IF EXISTS branch_id;

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_branch_fk;
ALTER TABLE courses DROP COLUMN IF EXISTS branch_id;

ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_branch_fk;
ALTER TABLE classes DROP COLUMN IF EXISTS branch_id;

ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_branch_fk;
ALTER TABLE teachers DROP COLUMN IF EXISTS branch_id;
```

---

### Phase 3: Test Data Setup

**Create Test Hierarchy:**
```sql
-- Tenant
INSERT INTO tenants (id, name, slug)
VALUES ('test-tenant-1', 'Test English Center', 'test-center')
ON CONFLICT (id) DO NOTHING;

-- Company (root)
INSERT INTO org_units (id, tenant_id, unit_type, name, code, is_active)
VALUES 
  ('company-1', 'test-tenant-1', 'company', 'Bella English Center', 'BEC', true)
ON CONFLICT (id) DO NOTHING;

-- Region
INSERT INTO org_units (id, tenant_id, unit_type, name, code, parent_id, is_active)
VALUES 
  ('region-hcm', 'test-tenant-1', 'region', 'Khu Vực Hồ Chí Minh', 'HCM', 'company-1', true)
ON CONFLICT (id) DO NOTHING;

-- Branches
INSERT INTO org_units (id, tenant_id, unit_type, name, code, parent_id, is_active, metadata)
VALUES 
  ('branch-q1', 'test-tenant-1', 'branch', 'Chi Nhánh Quận 1', 'HCM-Q1', 'region-hcm', true, 
   '{"type":"english_center","address":"123 Main St","capacity":100}'::jsonb),
  ('branch-q3', 'test-tenant-1', 'branch', 'Chi Nhánh Quận 3', 'HCM-Q3', 'region-hcm', true,
   '{"type":"english_center","address":"456 Second St","capacity":80}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Test student
INSERT INTO students (student_id, tenant_id, student_name, email)
VALUES ('student-1', 'test-tenant-1', 'Nguyen Van A', 'student1@test.com')
ON CONFLICT (student_id) DO NOTHING;

-- Test course
INSERT INTO courses (course_id, tenant_id, course_code, course_name, credits, status, branch_id)
VALUES ('course-1', 'test-tenant-1', 'ENG-101', 'English 101', 3, 'active', 'branch-q1')
ON CONFLICT (course_id) DO NOTHING;

-- Test enrollment
INSERT INTO enrollments (enrollment_id, tenant_id, student_id, course_id, enrollment_date, status, branch_id)
VALUES ('enroll-1', 'test-tenant-1', 'student-1', 'course-1', CURRENT_DATE, 'active', 'branch-q1')
ON CONFLICT (enrollment_id) DO NOTHING;
```

---

## ✅ RUNTIME VERIFICATION (8 CRITERIA)

### V1: API Route Smoke Tests

**Endpoint Tests:**
```bash
# Setup
export BASE_URL="http://localhost:3000"  # or staging URL
export TENANT_ID="test-tenant-1"

# 1. GET branches
curl -X GET "${BASE_URL}/api/english-center/branches?tenantId=${TENANT_ID}"
# Expected: 200, array with 2 branches

# 2. GET hierarchy
curl -X GET "${BASE_URL}/api/english-center/branches/hierarchy?tenantId=${TENANT_ID}"
# Expected: 200, tree structure (company → region → branches)

# 3. GET single branch
curl -X GET "${BASE_URL}/api/english-center/branches/branch-q1?tenantId=${TENANT_ID}"
# Expected: 200, branch details + summary

# 4. POST create branch
curl -X POST "${BASE_URL}/api/english-center/branches" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "'${TENANT_ID}'",
    "name": "Chi Nhánh Quận 5",
    "code": "HCM-Q5",
    "regionId": "region-hcm",
    "address": "789 Third St",
    "capacity": 60
  }'
# Expected: 200, new branch object

# 5. PATCH update branch
curl -X PATCH "${BASE_URL}/api/english-center/branches/branch-q1?tenantId=${TENANT_ID}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Chi Nhánh Quận 1 (Updated)", "capacity": 120}'
# Expected: 200, updated branch

# 6. DELETE archive branch
curl -X DELETE "${BASE_URL}/api/english-center/branches/branch-q5?tenantId=${TENANT_ID}"
# Expected: 200, success message
```

**Verification:**
- [ ] All endpoints return 2xx status
- [ ] Response data structure matches types
- [ ] Hierarchy shows correct parent-child relationships
- [ ] Summary shows enrollment counts
- [ ] Create/update/archive operations persist

**Evidence:** API response logs + screenshots

---

### V2: Tenant Isolation

**Test Scenarios:**
```sql
-- Setup: Create second tenant
INSERT INTO tenants (id, name, slug)
VALUES ('test-tenant-2', 'Test Center 2', 'test-center-2');

INSERT INTO org_units (id, tenant_id, unit_type, name, code, is_active)
VALUES ('branch-tenant2', 'test-tenant-2', 'branch', 'Branch T2', 'T2-BR1', true);

-- Test 1: Cross-tenant read blocked
SET request.jwt.claims.tenant_id = 'test-tenant-2';
SELECT * FROM org_units WHERE id = 'branch-q1';
-- Expected: 0 rows (RLS blocks)

-- Test 2: API cross-tenant blocked
curl "${BASE_URL}/api/english-center/branches/branch-q1?tenantId=test-tenant-2"
-- Expected: 404 or empty (tenant boundary enforced)

-- Test 3: Hierarchy scoped
curl "${BASE_URL}/api/english-center/branches?tenantId=test-tenant-2"
-- Expected: Only branch-tenant2, NOT branch-q1/q3
```

**Verification:**
- [ ] RLS blocks cross-tenant SELECT
- [ ] API returns 404/empty for cross-tenant branch access
- [ ] Hierarchy query scoped to tenant only
- [ ] No data leakage between tenants

**Evidence:** SQL query results + API response logs

---

### V3: Branch Authorization

**Test Scenarios:**
```typescript
// Setup: User with branch-q1 access only
const userQ1 = { id: 'user-q1', branchIds: ['branch-q1'] };

// Test 1: Access assigned branch
const branch = await englishBranchService.getBranch('branch-q1', TENANT_ID);
expect(branch).not.toBeNull();

// Test 2: getUserAccessibleUnits returns only assigned
const accessible = await orgUnitEngine.getUserAccessibleUnits(
  'user-q1',
  TENANT_ID,
  'branch'
);
expect(accessible.map(b => b.id)).toEqual(['branch-q1']);

// Test 3: Branch selector shows only accessible
render(<BranchSelector tenantId={TENANT_ID} userId="user-q1" />);
const options = screen.getAllByRole('option');
expect(options).toHaveLength(2); // empty + branch-q1 only
```

**Verification:**
- [ ] User sees only assigned branches
- [ ] getUserAccessibleUnits filters correctly
- [ ] UI components respect branch scope
- [ ] Cross-branch operations blocked

**Evidence:** Test output + UI screenshots

---

### V4: Cross-Branch Access Tests

**Test Scenarios:**
```sql
-- Setup: Enrollment at branch-q1
INSERT INTO enrollments (enrollment_id, tenant_id, student_id, course_id, branch_id, enrollment_date, status)
VALUES ('enroll-cross', 'test-tenant-1', 'student-1', 'course-1', 'branch-q1', CURRENT_DATE, 'active');

-- Test 1: User scoped to branch-q3 queries enrollments
SET request.jwt.claims.user_branch_id = 'branch-q3';
SELECT * FROM enrollments WHERE branch_id = 'branch-q1';

-- Expected behavior (depends on RLS design):
-- Option A: 0 rows (branch-scope RLS enforced)
-- Option B: All rows (branch filtering done in app layer)

-- Test 2: Repository respects branch scope
const enrollments = await branchRepository.getBranchEnrollments('branch-q1', TENANT_ID);
// If user scoped to Q3, should return empty or throw authorization error
```

**Verification:**
- [ ] Cross-branch data access policy defined
- [ ] RLS or app-layer authorization enforced
- [ ] Negative tests document expected behavior
- [ ] Authorization clear for multi-branch users

**Evidence:** SQL results + authorization policy doc

---

### V5: Migration Reversibility

**Test Rollback:**
```bash
# 1. Verify data before rollback
SELECT COUNT(*) FROM enrollments WHERE branch_id IS NOT NULL;

# 2. Execute rollback script
psql -f scripts/rollback-E1-migration.sql

# 3. Verify columns removed
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'enrollments' AND column_name = 'branch_id';
-- Expected: 0 rows

# 4. Verify FK constraints removed
SELECT constraint_name FROM information_schema.table_constraints
WHERE constraint_name LIKE '%branch_fk%';
-- Expected: 0 rows

# 5. Re-deploy migration
supabase migration up --file 20260912120000_add_branch_id_to_education_tables.sql

# 6. Verify restored
SELECT COUNT(*) FROM enrollments WHERE branch_id IS NULL;
-- Expected: All rows (branch_id nullable)
```

**Verification:**
- [ ] Rollback script executes without errors
- [ ] Columns/constraints removed cleanly
- [ ] Re-deployment restores schema
- [ ] No data loss during rollback/redeploy

**Evidence:** Rollback execution logs

---

### V6: UI Component Rendering

**Test Components:**
```typescript
// 1. BranchSelector renders
test('BranchSelector loads and displays branches', async () => {
  render(<BranchSelector tenantId="test-tenant-1" onChange={jest.fn()} />);
  
  // Wait for API call
  await waitFor(() => {
    expect(screen.getByText('Chi Nhánh Quận 1 (HCM-Q1)')).toBeInTheDocument();
    expect(screen.getByText('Chi Nhánh Quận 3 (HCM-Q3)')).toBeInTheDocument();
  });
});

// 2. BranchHierarchyTree renders
test('BranchHierarchyTree displays hierarchy', async () => {
  render(<BranchHierarchyTree tenantId="test-tenant-1" />);
  
  await waitFor(() => {
    expect(screen.getByText('🏢 Bella English Center')).toBeInTheDocument();
    expect(screen.getByText('📍 Khu Vực Hồ Chí Minh')).toBeInTheDocument();
    expect(screen.getByText('🏫 Chi Nhánh Quận 1')).toBeInTheDocument();
  });
});

// 3. Branch selection triggers callback
test('BranchSelector onChange triggered', async () => {
  const handleChange = jest.fn();
  render(<BranchSelector tenantId="test-tenant-1" onChange={handleChange} />);
  
  await waitFor(() => screen.getByRole('combobox'));
  
  fireEvent.change(screen.getByRole('combobox'), { 
    target: { value: 'branch-q1' } 
  });
  
  expect(handleChange).toHaveBeenCalledWith('branch-q1');
});
```

**Verification:**
- [ ] Components render without errors
- [ ] API data loads and displays
- [ ] User interactions trigger callbacks
- [ ] Hierarchy tree expands/collapses
- [ ] Branch icons display correctly

**Evidence:** Test output + UI screenshots

---

### V7: E2E Branch Creation Flow

**Test Scenario:**
```typescript
test('E2E: Create region → branch → assign enrollment → query summary', async () => {
  // 1. Create region
  const regionResponse = await fetch('/api/english-center/branches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'test-tenant-1',
      name: 'Khu Vực Hà Nội',
      code: 'HN',
    }),
  });
  const region = await regionResponse.json();
  expect(region.branch.unitType).toBe('branch'); // Actually creates branch, not region
  
  // 2. Create branch under region
  const branchResponse = await fetch('/api/english-center/branches', {
    method: 'POST',
    body: JSON.stringify({
      tenantId: 'test-tenant-1',
      name: 'Chi Nhánh Cầu Giấy',
      code: 'HN-CG',
      regionId: region.branch.id,
      address: '100 Nguyen Trai',
      capacity: 150,
    }),
  });
  const branch = await branchResponse.json();
  
  // 3. Create student enrollment at branch
  await supabase.from('enrollments').insert({
    student_id: 'student-1',
    course_id: 'course-1',
    branch_id: branch.branch.id,
    tenant_id: 'test-tenant-1',
    enrollment_date: new Date().toISOString(),
    status: 'active',
  });
  
  // 4. Query branch summary
  const summaryResponse = await fetch(
    `/api/english-center/branches/${branch.branch.id}?tenantId=test-tenant-1`
  );
  const { summary } = await summaryResponse.json();
  
  expect(summary.totalEnrollments).toBeGreaterThanOrEqual(1);
  expect(summary.branchName).toBe('Chi Nhánh Cầu Giấy');
  
  // 5. Query hierarchy (should include new branch)
  const hierarchyResponse = await fetch(
    `/api/english-center/branches/hierarchy?tenantId=test-tenant-1`
  );
  const { hierarchy } = await hierarchyResponse.json();
  
  const hasNewBranch = JSON.stringify(hierarchy).includes('HN-CG');
  expect(hasNewBranch).toBe(true);
});
```

**Verification:**
- [ ] Create region API works
- [ ] Create branch under region works
- [ ] Enrollment assignment persists
- [ ] Summary reflects enrollment
- [ ] Hierarchy includes new branch
- [ ] Full workflow end-to-end functional

**Evidence:** E2E test output + data verification

---

### V8: No Direct org_units Bypass

**Test Scenarios:**
```typescript
// Anti-pattern: Direct org_units access
test('Product should NOT import org_units table directly', () => {
  const serviceCode = fs.readFileSync(
    'src/products/bella-english-center/services/branch.service.ts',
    'utf-8'
  );
  
  // Should NOT contain direct table access
  expect(serviceCode).not.toMatch(/from\('org_units'\)/);
  expect(serviceCode).not.toMatch(/supabase.*org_units/);
  
  // Should only use Platform contract
  expect(serviceCode).toMatch(/orgUnitEngine/);
  expect(serviceCode).toMatch(/require\('@\/platform'\)/);
});

// Verify repository uses view, not raw org_units
test('Repository should use v_branch_academic_summary view', () => {
  const repoCode = fs.readFileSync(
    'src/products/bella-english-center/services/branch.repository.ts',
    'utf-8'
  );
  
  expect(repoCode).toMatch(/v_branch_academic_summary/);
  // Direct org_units access in repository is OK for JOINs,
  // but service layer must go through Platform contract
});
```

**Verification:**
- [ ] Service layer only uses orgUnitEngine
- [ ] No direct `supabase.from('org_units')` in product code
- [ ] Repository JOINs use view when possible
- [ ] Platform boundary respected

**Evidence:** Code review checklist

---

## 📊 SEAL CRITERIA RECONCILIATION

```text
After completing V1-V8:

Implementation
✅ Service layer complete
✅ Repository layer complete
✅ Migration ready
✅ API routes compiled
✅ UI components compiled
✅ Tests written

Build & Test
✅ npm run build PASS
✅ Platform tests PASS (29/29)
✅ Product tests PASS (7/7)

Runtime (8 PENDING → COMPLETE)
✅ Migration deployed (V2)
✅ API routes smoke-tested (V1)
✅ Tenant isolation verified (V2)
✅ Branch authorization verified (V3)
✅ Cross-branch access tested (V4)
✅ Migration reversible (V5)
✅ UI components rendered (V6)
✅ E2E flow tested (V7)
✅ No direct org_units bypass (V8)

Architecture
✅ Platform boundary preserved
✅ Contract consumption verified
✅ Reusability confirmed
✅ Table ownership verified

TOTAL: 19/19 ✅ COMPLETE
```

**After 19/19:** E1 🔒 SEALED

---

## 📋 EXECUTION CHECKLIST

- [ ] Phase 1: Environment setup complete
- [ ] Phase 2: Migration deployed + verified
- [ ] Phase 3: Test data created
- [ ] V1: API smoke tests ✅ PASS
- [ ] V2: Tenant isolation ✅ PASS
- [ ] V3: Branch authorization ✅ PASS
- [ ] V4: Cross-branch access ✅ PASS
- [ ] V5: Migration reversibility ✅ PASS
- [ ] V6: UI rendering ✅ PASS
- [ ] V7: E2E flow ✅ PASS
- [ ] V8: No bypass ✅ PASS
- [ ] Evidence collected (logs, screenshots, test output)
- [ ] Seal criteria reconciliation: 19/19 ✅
- [ ] E1 status updated to 🔒 SEALED
- [ ] E2-E10 unblocked

---

## 🎯 PRIORITY

**P0 — MUST COMPLETE BEFORE E2-E10**

**Rationale:**
1. E1 = first Platform Org Unit consumer
2. Runtime verification proves pattern works
3. E2-E10 depend on branch scope functionality
4. Pattern must be stable before replication

**After E1 SEALED:**
- ✅ Pattern validated for other products
- ✅ Platform Org Unit contract proven stable
- ✅ E2-E10 can proceed autonomously
- ✅ Preschool/Spa/Clinic can reuse pattern

---

**Date:** 2026-09-12  
**Status:** READY TO EXECUTE — Awaiting staging/CI environment  
**Blocker:** Environment setup (manual or CI/CD)
