# P1.4 — Projects UI → Service → DB Trace

**Date:** 2026-09-11  
**Phase:** Projects Evidence Closure  
**Status:** ✅ COMPLETE

---

## 🎯 Objective

Verify end-to-end production path from browser UI to database, confirming tenant validation at each layer.

---

## 📋 Static Code Trace (Production Path)

### Layer 1: UI Component

**File:** `src/app/dashboard/real-estate/projects/page.tsx`

**Entry Point:**
```typescript
async function handleCreateProject(e: React.FormEvent) {
  e.preventDefault();
  if (!newProject.name.trim()) { 
    toast.error("Vui lòng điền tên dự án"); 
    return; 
  }
  
  setSaving(true);
  const res = await createProjectAction({
    name: newProject.name.trim(),
    description: newProject.description.trim() || null,
    status: newProject.status as ProjectRow["status"],
  });
  
  if (res.success) {
    toast.success("✅ Tạo dự án thành công!");
    setShowAddModal(false);
    setNewProject({ name: "", description: "", status: "active" });
    await loadProjects();
  } else {
    toast.error(res.error ?? "Lỗi khi tạo dự án");
  }
  setSaving(false);
}
```

**Key observations:**
- ✅ Client does NOT send `tenant_id` (security: tenant not client-controlled)
- ✅ Only business data sent: name, description, status
- ✅ Calls server action (server-side execution)

---

### Layer 2: Server Action

**File:** `src/modules/real_estate/actions/projectActions.ts`

**Implementation:**
```typescript
'use server';

export async function createProjectAction(
  data: Omit<ProjectInsert, 'tenant_id'>
): Promise<ProjectResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized: Missing tenant context' };
    }

    const project = await ProjectService.createProject(
      supabase, 
      user.tenant_id,  // ← TENANT INJECTED FROM AUTH
      data
    );
    
    revalidatePath('/dashboard/real-estate/projects');
    return { success: true, data: project };
  } catch (error) {
    console.error('[projectActions] Error in createProjectAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error'
    };
  }
}
```

**Security controls:**
- ✅ `'use server'` directive (server-only execution)
- ✅ `getCurrentUser()` validates authentication
- ✅ `user.tenant_id` extracted from authenticated session (NOT from client input)
- ✅ Type safety: `Omit<ProjectInsert, 'tenant_id'>` prevents client from providing tenant_id
- ✅ Early return if tenant context missing

---

### Layer 3: Service Layer

**File:** `src/modules/real_estate/services/ProjectService.ts`

**Implementation:**
```typescript
export class ProjectService {
  static async createProject(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    data: Omit<ProjectInsert, 'tenant_id'>
  ): Promise<ProjectRow> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!data.name) {
      throw new Error('Project name is required');
    }

    const { data: project, error } = await supabase
      .from('real_estate_projects')
      .insert({
        ...data,
        tenant_id: tenantId,  // ← EXPLICIT TENANT INJECTION
      } as ProjectInsert)
      .select()
      .single();

    if (error) {
      console.error('[ProjectService] Error creating project:', error.message);
      throw error;
    }

    return project;
  }
}
```

**Security controls:**
- ✅ Defensive validation (tenantId required, name required)
- ✅ Explicitly merges `tenant_id` into INSERT payload
- ✅ Type-safe spread prevents accidental tenant override

---

### Layer 4: Database (RLS Enforcement)

**RLS Policy:** `"Projects: Manage for admins"`

**USING Clause (SELECT):**
```sql
tenant_id IN (
  SELECT users.tenant_id FROM users
  WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'manager')
)
```

**WITH CHECK Clause (INSERT/UPDATE):**
```sql
tenant_id IN (
  SELECT users.tenant_id FROM users
  WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'manager')
)
```

**Security controls:**
- ✅ USING clause filters SELECT to own tenant only
- ✅ WITH CHECK validates INSERT/UPDATE tenant_id against authenticated user
- ✅ Role-based access (admin/manager only)
- ✅ Cross-tenant forgery blocked (verified in P1.3 A6/A7)

---

## 🔐 Tenant Security Model

```text
┌──────────────────────────────────────────────────────────┐
│ BROWSER (Untrusted)                                       │
│                                                           │
│ User submits form: { name, description, status }          │
│ NO tenant_id in payload (security boundary)               │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ↓ Server Action Call
┌──────────────────────────────────────────────────────────┐
│ SERVER ACTION (Trusted Context)                           │
│                                                           │
│ 1. Validate authentication (getCurrentUser)               │
│ 2. Extract tenant_id from session (canonical source)      │
│ 3. Reject if no tenant context                            │
│ 4. Pass tenant_id to Service layer                        │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ↓ Service.createProject(tenant, data)
┌──────────────────────────────────────────────────────────┐
│ SERVICE LAYER (Business Logic)                            │
│                                                           │
│ 1. Validate tenantId required                             │
│ 2. Validate business rules (name required)                │
│ 3. Merge tenant_id into INSERT payload explicitly         │
│ 4. Execute DB query                                       │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ↓ DB INSERT with tenant_id
┌──────────────────────────────────────────────────────────┐
│ DATABASE (RLS Enforcement)                                │
│                                                           │
│ 1. Authenticated Supabase client (not service-role)       │
│ 2. RLS WITH CHECK validates tenant_id against auth.uid()  │
│ 3. Cross-tenant INSERT rejected (policy violation)        │
│ 4. Row written with verified tenant ownership             │
└──────────────────────────────────────────────────────────┘
```

---

## ✅ Security Invariants Verified

| Invariant | Layer | Status |
|-----------|-------|--------|
| Client cannot provide tenant_id | UI → Action | ✅ ENFORCED (type system) |
| Tenant extracted from auth session | Action | ✅ ENFORCED (getCurrentUser) |
| Tenant required before DB operation | Service | ✅ ENFORCED (validation) |
| Tenant injected explicitly into INSERT | Service | ✅ ENFORCED (merge) |
| RLS validates tenant ownership | DB | ✅ ENFORCED (WITH CHECK, verified P1.3) |
| Cross-tenant forgery blocked | DB | ✅ ENFORCED (P1.3 A6/A7 PASS) |

---

## 📊 Production Path Summary

```text
UI Form Submit
     ↓
createProjectAction (server action)
     ↓
getCurrentUser() → user.tenant_id
     ↓
ProjectService.createProject(supabase, tenant_id, data)
     ↓
INSERT { ...data, tenant_id: tenantId }
     ↓
RLS WITH CHECK enforcement
     ↓
Row written with verified tenant ownership
     ↓
Success response to UI
```

**Critical path characteristics:**
- ✅ Tenant never controlled by client
- ✅ Tenant derived from authenticated session
- ✅ Defense in depth (Action + Service + RLS)
- ✅ Type safety prevents accidental bypass
- ✅ Runtime RLS enforcement verified (P1.3)

---

## 🔬 Runtime Verification (P1.3 Reference)

**P1.3 authenticated tests confirmed:**
- A1: Own-tenant create → ✅ PASS
- A6: Tenant forgery (INSERT with wrong tenant_id) → ✅ BLOCKED by WITH CHECK
- A7: Tenant escape (UPDATE tenant_id) → ✅ BLOCKED by WITH CHECK

**Conclusion:** Production path enforces tenant isolation at Application + Database layers.

---

## ✅ P1.4 Verdict

**Status:** ✅ **TRACE COMPLETE**

**Findings:**
- UI → Action → Service → DB chain verified
- Tenant security model correct (defense in depth)
- No client-controlled tenant injection possible
- RLS enforcement active and tested

**Next:** P1.5 Regression testing

---

**Evidence files:**
- P1.0 Discovery: `docs/bella-land/P1_PROJECTS_DISCOVERY.md`
- P1.1 Production Write Flow: `scripts/bella-land/test-project-creation.ts` (5/5 PASS)
- P1.3 Tenant Isolation: `scripts/bella-land/test-project-tenant-isolation.ts` (8/8 PASS)
- P1.4 UI Trace: `docs/bella-land/P1_4_UI_TO_DB_TRACE.md` (this document)
