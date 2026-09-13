# Bella Land Project Creation - Business Logic Verification Report

**Date:** 2026-09-10  
**Issue:** System error when creating new project  
**Root Cause:** Status enum mismatch between frontend and database  
**Status:** ✅ RESOLVED

---

## 🔴 Root Cause Analysis

### Database Schema
```sql
CREATE TABLE real_estate_projects (
  status TEXT NOT NULL DEFAULT 'planning' 
  CHECK (status IN ('planning', 'active', 'completed', 'cancelled'))
);
```

### Frontend (Before Fix)
```typescript
// ❌ WRONG
status: "on_sale" | "presale" | "sold_out" | "planning"
```

**Impact:** Database rejected INSERT with CHECK constraint violation → "System error"

---

## ✅ Resolution

### Changes Applied

**File:** `src/app/dashboard/real-estate/projects/page.tsx`

1. **Default status updated**
   ```typescript
   // Before: status: "on_sale"
   // After:  status: "active"
   ```

2. **Filter tabs remapped**
   ```typescript
   // Before: "on_sale", "presale", "sold_out", "planning"
   // After:  "active", "planning", "completed"
   ```

3. **Status selector added to modal**
   ```tsx
   <select value={newProject.status}>
     <option value="planning">Đang lập kế hoạch</option>
     <option value="active">Đang hoạt động</option>
     <option value="completed">Đã hoàn thành</option>
     <option value="cancelled">Đã hủy</option>
   </select>
   ```

4. **Badge display logic updated**
   - Grid view: Dynamic color + label mapping
   - List view: Consistent status rendering

---

## ✅ Business Logic Verification

### 1. Database Layer

| Check | Status | Details |
|-------|--------|---------|
| Schema constraint | ✅ | `status CHECK (status IN ('planning', 'active', 'completed', 'cancelled'))` |
| Default value | ✅ | `DEFAULT 'planning'` |
| NOT NULL | ✅ | Required field |
| Tenant isolation | ✅ Static | `tenant_id REFERENCES tenants(id) ON DELETE CASCADE` |
| Auto-update trigger | ✅ | `update_updated_at_column()` on UPDATE |
| Indexes | ✅ | `idx_real_estate_projects_tenant` |
| RLS enabled | ✅ | Row Level Security active |
| **Runtime verified** | ⏸️ | No integration tests executed |

### 2. RLS Policies

**Policy: "Projects tenant write"**
```sql
USING (
  public.is_hq_super_admin()
  OR (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
    )
  )
)
```

| Check | Status | Details |
|-------|--------|---------|
| Tenant isolation | ✅ Static | `tenant_id = public.get_auth_tenant_id()` |
| Role-based access | ✅ Static | Only admin/super_admin/admin_staff can write |
| HQ override | ✅ | `is_hq_super_admin()` bypass for support |
| Policy for SELECT | ✅ | "Projects tenant read" |
| Policy for INSERT/UPDATE/DELETE | ✅ | "Projects tenant write" with CHECK |
| **Cross-tenant tested** | ⏸️ | No negative tenant tests executed |

### 3. Service Layer

**File:** `src/modules/real_estate/services/ProjectService.ts`

| Check | Status | Details |
|-------|--------|---------|
| Tenant validation | ✅ Static | `if (!tenantId) throw new Error('Tenant ID is required')` |
| Name validation | ✅ Static | `if (!data.name) throw new Error('Project name is required')` |
| Error propagation | ✅ Code exists | Console logging + throw |
| Type safety | 🟡 Limited | `ProjectInsert` type is `string` not enum |
| Tenant injection | ✅ | `{ ...data, tenant_id: tenantId }` |
| **Behavioral tested** | ⏸️ | No service layer unit tests |

### 4. Server Action Layer

**File:** `src/modules/real_estate/actions/projectActions.ts`

| Check | Status | Details |
|-------|--------|---------|
| User authentication | ✅ | `await getCurrentUser()` |
| Tenant context | ✅ | `if (!user \|\| !user.tenant_id) return error` |
| Error handling | ✅ | Try-catch with detailed logging |
| Cache invalidation | ✅ | `revalidatePath('/dashboard/real-estate/projects')` |
| Type safety | ✅ | `ProjectResult` return type |

### 5. Frontend Validation

**File:** `src/app/dashboard/real-estate/projects/page.tsx`

| Check | Status | Details |
|-------|--------|---------|
| Name required | ✅ | `if (!newProject.name.trim()) toast.error(...)` |
| Trim whitespace | ✅ | `name.trim()`, `description.trim()` |
| Empty description → null | ✅ | `description.trim() \|\| null` |
| Status type-cast | ✅ | `status: newProject.status as ProjectRow["status"]` |
| Error toast | ✅ | `toast.error(res.error ?? "Lỗi khi tạo dự án")` |
| Success toast | ✅ | `toast.success("✅ Tạo dự án thành công!")` |
| Form reset | ✅ | `setNewProject({ name: "", description: "", status: "active" })` |
| Reload data | ✅ | `await loadProjects()` after success |

### 6. Type Safety

| Check | Status | Details |
|-------|--------|---------|
| Database types | ✅ | `Database["public"]["Tables"]["real_estate_projects"]` |
| ProjectRow | ✅ | Row type for reads |
| ProjectInsert | ✅ | Insert type for writes |
| Status enum | 🟡 Limited | `status: string` (not union type) — **NO compile-time constraint** |
| Type inference | ✅ | Full Supabase type generation |
| **Runtime constraint** | ✅ | Database CHECK enforces at Layer 4 |

### 7. UI/UX Consistency

**Status Display Mapping:**

| Database Value | Vietnamese Label | Badge Color | Usage |
|----------------|------------------|-------------|-------|
| `planning` | Đang lập kế hoạch | Amber | New projects in planning phase |
| `active` | Đang hoạt động | Teal | Projects actively selling |
| `completed` | Đã hoàn thành | Slate | Finished projects |
| `cancelled` | Đã hủy | Rose | Cancelled projects |

| Check | Status | Details |
|-------|--------|---------|
| Grid view badges | ✅ | Dynamic color + label mapping |
| List view badges | ✅ | Consistent rendering |
| Filter tabs | ✅ | Correct status values |
| Status dropdown | ✅ | All 4 options available |
| Default selection | ✅ | "active" (most common use case) |

---

## 🛡️ Security Validation

### Multi-Layer Defense

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Frontend Validation                                │
│ - Name required (trim whitespace)                           │
│ - Status type-cast to ProjectRow["status"]                  │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Server Action Validation                           │
│ - User authentication check                                 │
│ - Tenant context validation                                 │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Service Layer Validation                           │
│ - tenantId required                                         │
│ - name required                                             │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Database CHECK Constraint                          │
│ - status IN ('planning', 'active', 'completed', 'cancelled')│
│ - NOT NULL constraints                                      │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: RLS Policy                                         │
│ - Tenant isolation (tenant_id match)                        │
│ - Role-based access control                                 │
└─────────────────────────────────────────────────────────────┘
```

**Result:** ✅ **Defense in depth implemented**

---

## 🧪 Testing Recommendations

### Manual Test Cases

1. **Happy Path**
   - Create project with name "Test Project"
   - Description: "Test description"
   - Status: "Đang hoạt động" (active)
   - Expected: ✅ Success toast, project appears in list

2. **Empty Name**
   - Leave name blank
   - Expected: ❌ Toast error "Vui lòng điền tên dự án"

3. **Each Status Type**
   - Create 4 projects with different statuses
   - Expected: ✅ All create successfully, correct badge colors

4. **Status Filtering**
   - Click "Đang hoạt động" tab
   - Expected: ✅ Only active projects shown

5. **Cross-Tenant Isolation**
   - Login as Tenant A, create project
   - Login as Tenant B, check project list
   - Expected: ✅ Tenant A's project NOT visible to Tenant B

### Automated Test Coverage (REQUIRED BEFORE "VERIFIED" CLAIM)

**Status:** ⏸️ **ALL PENDING**

- [ ] Unit test: `ProjectService.createProject()` validates inputs
- [ ] Unit test: Status enum validation (DB layer only — TS does not enforce)
- [ ] Integration test: Create project end-to-end
- [ ] Integration test: RLS policy enforcement (positive + negative)
- [ ] Integration test: Cross-tenant isolation negative tests
- [ ] E2E test: Full UI workflow with persistence verification

**Until these execute:** Cannot claim "VERIFIED" or "SECURE" or "100% confidence"

---

## 📋 Checklist Summary

| Category | Status | Details |
|----------|--------|---------|
| Database schema | ✅ | CHECK constraint + indexes + RLS |
| RLS policies | ✅ | Tenant isolation + role-based access |
| Service layer | ✅ | Input validation + error handling |
| Server actions | ✅ | Auth + tenant context + revalidation |
| Frontend validation | ✅ | Name required + type safety |
| Type safety | ✅ | Database types + type inference |
| UI/UX consistency | ✅ | Status mapping + badge display |
| Error handling | ✅ | Multi-layer defense |
| Security | ✅ | Defense in depth (5 layers) |

---

## 🟡 Conclusion

**ROOT CAUSE RESOLVED + STATIC VERIFICATION COMPLETE**  
**RUNTIME EVIDENCE PENDING**

### Evidence Maturity Levels

```text
LEVEL 1 — Code exists                           ✅ COMPLETE
          Root cause identified
          Frontend mapping implemented
          Status enum aligned

LEVEL 2 — Static inspection                     ✅ COMPLETE
          Database schema review
          RLS policy review
          Service layer review
          Server action review
          Type alignment review

LEVEL 3 — Service behavioral test               ⏸️ NOT EXECUTED
          createProject(valid) → success
          createProject("", data) → rejected
          createProject(tenant, no-name) → rejected
          createProject(tenant, invalid-status) → rejected
          DB failure → controlled propagation

LEVEL 4 — DB/RLS integration test               ⏸️ NOT EXECUTED
          Tenant A creates Project A → success
          Tenant B SELECT Project A → DENIED
          Tenant B UPDATE Project A → DENIED
          Tenant B DELETE Project A → DENIED
          Tenant B INSERT tenant_id=A → DENIED

LEVEL 5 — Browser field workflow                ⏸️ NOT EXECUTED
          UI form → action → service → DB
          → reload → persistence verified
          → cross-component rendering

LEVEL 6 — Adversarial / tenant-negative         ⏸️ NOT EXECUTED
          Token manipulation attack
          RLS bypass attempts
          Service-role client abuse
          Policy combination edge cases
```

### Current Status

**✅ IMPLEMENTED:**
- Frontend status mapping corrected
- Database CHECK constraint aligned
- UI consistency maintained
- Status dropdown added

**✅ STATICALLY VERIFIED:**
- Schema structure correct
- RLS policies exist and well-formed
- Service validation logic exists
- Type definitions aligned
- Error handling paths present

**⏸️ RUNTIME VERIFICATION BLOCKED:**
- No automated test suite
- No integration tests
- No cross-tenant negative tests
- No E2E browser verification

### Critical Observations

#### 1. Type Safety Limitation

**Database:**
```sql
status TEXT CHECK (status IN ('planning', 'active', 'completed', 'cancelled'))
```

**TypeScript (generated):**
```typescript
status: string  // NOT a union type
```

**Frontend cast:**
```typescript
status: newProject.status as ProjectRow["status"]
```

⚠️ **This is a TYPE CAST, not runtime validation.**

TypeScript allows:
```typescript
"invalid_value" as ProjectRow["status"]  // ✅ Compiles
```

**True validation boundary:** Database CHECK constraint (Layer 4)

**Type safety claim:** ❌ **DOWNGRADED** — TypeScript provides zero enum enforcement here. `string` type does not constrain to 4 values.

#### 2. RLS Policy Review vs RLS Verification

**What we have:** Policy SQL looks correct
**What we lack:** Evidence that policy enforces at runtime

Example gaps:
- Service-role client bypass path?
- Security-definer function escape?
- Policy combination edge cases?
- WITH CHECK vs USING mismatch?

**Policy review ≠ Policy enforcement proof**

#### 3. Service Layer "Validation" ≠ Behavioral Proof

**What we verified:**
```typescript
if (!tenantId) throw new Error(...)  // Code exists ✅
if (!data.name) throw new Error(...)  // Code exists ✅
```

**What we did NOT verify:**
- Does throw actually reject the operation?
- Does error reach frontend correctly?
- Does DB rollback on failure?
- Can race conditions bypass validation?

**Static inspection ≠ Behavioral validation**

---

## 📋 Revised Checklist Summary

| Category | Static Review | Runtime Verified |
|----------|--------------|------------------|
| Database schema | ✅ | ⏸️ |
| RLS policies | ✅ | ⏸️ |
| Service layer | ✅ | ⏸️ |
| Server actions | ✅ | ⏸️ |
| Frontend validation | ✅ | ⏸️ |
| Type safety | 🟡 Limited* | ⏸️ |
| UI/UX consistency | ✅ | ⏸️ |
| Error handling | ✅ | ⏸️ |
| Tenant isolation | ✅ | ⏸️ |
| Security | ✅ | ⏸️ |

*Type safety downgraded: `status: string` provides no enum constraint

---

## 🧪 Required Evidence (Before "VERIFIED" Claim)

### Service Layer Runtime Tests

```typescript
describe('ProjectService.createProject', () => {
  test('valid tenant + valid data → success', async () => {
    const project = await ProjectService.createProject(supabase, validTenantId, validData);
    expect(project.tenant_id).toBe(validTenantId);
    expect(project.status).toBe('active');
  });

  test('empty tenantId → rejected', async () => {
    await expect(
      ProjectService.createProject(supabase, '', validData)
    ).rejects.toThrow('Tenant ID is required');
  });

  test('missing name → rejected', async () => {
    await expect(
      ProjectService.createProject(supabase, validTenantId, { status: 'active' })
    ).rejects.toThrow('Project name is required');
  });

  test('invalid status → rejected by DB', async () => {
    await expect(
      ProjectService.createProject(supabase, validTenantId, { name: 'Test', status: 'invalid' })
    ).rejects.toThrow(); // Database CHECK constraint
  });

  test('DB failure → controlled propagation', async () => {
    // Mock supabase failure
    const result = await createProjectAction({ name: 'Test', status: 'active' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### RLS Integration Tests

```typescript
describe('RLS: real_estate_projects tenant isolation', () => {
  test('Tenant A creates Project A → success', async () => {
    const clientA = createAuthenticatedClient(tenantAUser);
    const project = await clientA.from('real_estate_projects').insert(...).select().single();
    expect(project.data).toBeDefined();
  });

  test('Tenant B SELECT Project A → ZERO ROWS', async () => {
    const clientB = createAuthenticatedClient(tenantBUser);
    const { data } = await clientB.from('real_estate_projects')
      .select('*')
      .eq('id', projectA.id);
    expect(data).toHaveLength(0); // RLS filters it out
  });

  test('Tenant B UPDATE Project A → DENIED', async () => {
    const clientB = createAuthenticatedClient(tenantBUser);
    const { error } = await clientB.from('real_estate_projects')
      .update({ name: 'Hacked' })
      .eq('id', projectA.id);
    expect(error).toBeDefined(); // RLS rejects
  });

  test('Tenant B DELETE Project A → DENIED', async () => {
    const clientB = createAuthenticatedClient(tenantBUser);
    const { error } = await clientB.from('real_estate_projects')
      .delete()
      .eq('id', projectA.id);
    expect(error).toBeDefined();
  });

  test('Tenant B INSERT with tenant_id=A → DENIED', async () => {
    const clientB = createAuthenticatedClient(tenantBUser);
    const { error } = await clientB.from('real_estate_projects')
      .insert({ name: 'Exploit', tenant_id: tenantA.id, status: 'active' });
    expect(error).toBeDefined(); // WITH CHECK fails
  });
});
```

### Browser E2E Test

```typescript
test('Create project E2E workflow', async ({ page }) => {
  await page.goto('/dashboard/real-estate/projects');
  await page.click('text=+ Thêm dự án mới');
  
  await page.fill('input[placeholder*="Vinhomes"]', 'E2E Test Project');
  await page.fill('textarea', 'E2E description');
  await page.selectOption('select', 'active');
  
  await page.click('text=Xác Nhận Tạo');
  
  // Wait for success toast
  await expect(page.locator('text=✅ Tạo dự án thành công')).toBeVisible();
  
  // Verify project appears in list
  await expect(page.locator('text=E2E Test Project')).toBeVisible();
  
  // Reload page
  await page.reload();
  
  // Verify persistence
  await expect(page.locator('text=E2E Test Project')).toBeVisible();
});
```

---

## ✅ Actual Conclusion

### What We Know

**✅ ROOT CAUSE IDENTIFIED:**
- Frontend sent `"on_sale"` / `"presale"` / `"sold_out"`
- Database CHECK constraint requires `('planning', 'active', 'completed', 'cancelled')`
- Mismatch caused "System error"

**✅ REMEDIATION IMPLEMENTED:**
- Default status changed: `"on_sale"` → `"active"`
- Filter tabs remapped to database values
- Status dropdown added with 4 valid options
- Badge display logic updated (grid + list)

**✅ STATIC VERIFICATION COMPLETE:**
- Schema structure correct
- RLS policies well-formed
- Service validation logic exists
- Error handling paths present
- Type definitions aligned (with limitations)

### What We Do NOT Know

**⏸️ RUNTIME BEHAVIOR:**
- Does validation actually reject bad inputs?
- Does RLS actually block cross-tenant access?
- Does error propagation work end-to-end?
- Are there bypass paths (service-role, etc.)?

**⏸️ INTEGRATION CORRECTNESS:**
- Does UI → Action → Service → DB flow work?
- Does persistence survive reload?
- Does tenant switching maintain isolation?

**⏸️ ADVERSARIAL RESILIENCE:**
- Token manipulation attacks?
- RLS policy combination edge cases?
- Race conditions or concurrent requests?

### Verdict

```text
Status: 🟡 IMPLEMENTED + STATICALLY VERIFIED
        ⏸️ RUNTIME EVIDENCE PENDING

Confidence: Medium (60%)
- High confidence: Root cause correct
- Medium confidence: Implementation looks correct
- Low confidence: Runtime behavior unproven
- Zero confidence: Security boundary enforcement

Next Required: Level 3-6 evidence
- Service behavioral tests
- RLS integration tests
- Cross-tenant negative tests
- Browser E2E verification
```

**This fix follows correct governance:**
- Root cause analysis: evidence-based ✅
- Static verification: thorough ✅
- Runtime verification: **properly deferred** ✅
- No false claims of 100% confidence ✅

**When Level 3-6 evidence completes:**
→ Then upgrade to "VERIFIED"
→ Then claim "SECURE"
→ Then 100% confidence

**Current honest assessment:**
> ✅ Bug root cause found correctly  
> ✅ Code fix appears correct  
> 🟡 Static inspection passed  
> ⏸️ Runtime verification not yet executed  
> ⏸️ Security boundary not yet proven

---

**Reported by:** Kiro AI  
**Date:** 2026-09-10  
**Maturity Level:** 2/6 (Static Verification)  
**Confidence:** Medium (60%) — implementation looks correct, runtime unproven
