---
remediation: E0.1D-R
phase: R0
status: COMPLETE
created: 2026-09-12
verdict: BASELINE_FROZEN
scope: Platform Org Unit Contract
---

# E0.1D-R R0 — BASELINE CENSUS

> **Mission:** Freeze exact state of `org_units` capability — what exists vs what's missing.

---

## 🎯 R0 EXIT CRITERIA

✅ org_units schema documented (exact state)
✅ Gap inventory locked (what exists vs what missing)
✅ Contract surface area frozen (method signatures)
✅ Test denominator frozen (unit + integration + negative)
✅ Implementation path clear (R1→R7)
✅ Timeline estimated with evidence

---

## 📊 SCHEMA BASELINE (EXISTING)

### Table 1: org_units ✅ EXISTS

**Source:** `supabase/migrations/20260801030000_foundation_org_people_schema.sql`

**Created:** 2026-08-01 (BEFORE English Center E0 phase)

```sql
CREATE TABLE IF NOT EXISTS public.org_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  unit_type   TEXT NOT NULL CHECK (unit_type IN (
    'company', 'region', 'branch', 'department', 'team', 'project', 'task_force', 'committee'
  )),
  
  name        TEXT NOT NULL,
  code        TEXT,                  -- Short identifier: "HCM-Q1", "TEAM-LUX"
  parent_id   UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
  
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB   NOT NULL DEFAULT '{}'::jsonb,
  
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_org_unit_code UNIQUE (tenant_id, code)
);
```

**Indexes:**
- ✅ `idx_org_units_tenant` (tenant_id, is_active)
- ✅ `idx_org_units_parent` (parent_id) WHERE is_active = TRUE
- ✅ `idx_org_units_type_tenant` (tenant_id, unit_type, is_active)

**Constraints:**
- ✅ PK: `id`
- ✅ FK: `tenant_id` → tenants(id) ON DELETE CASCADE
- ✅ FK: `parent_id` → org_units(id) ON DELETE SET NULL (self-referential)
- ✅ UNIQUE: (tenant_id, code)
- ✅ CHECK: unit_type IN (8 types)
- ✅ NOT NULL: tenant_id, unit_type, name, is_active, metadata

**Triggers:**
- ✅ `trg_org_units_updated_at` (auto-update updated_at)

---

### Table 2: org_relationships ✅ EXISTS

**Purpose:** Graph edges for org hierarchy + person membership

```sql
CREATE TABLE IF NOT EXISTS public.org_relationships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  from_id     UUID NOT NULL,
  from_type   TEXT NOT NULL CHECK (from_type IN ('unit', 'person')),
  
  to_id       UUID NOT NULL,
  to_type     TEXT NOT NULL CHECK (to_type IN ('unit', 'person')),
  
  rel_type    TEXT NOT NULL CHECK (rel_type IN (
    'belongs_to', 'manages', 'participates_in', 'reports_to', 'collaborates_with'
  )),
  
  role        TEXT,
  since       DATE,
  until       DATE,
  
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_org_relationship UNIQUE (tenant_id, from_id, to_id, rel_type)
);
```

**Indexes:**
- ✅ `idx_org_rel_person_unit` (tenant_id, to_id, rel_type, from_type) WHERE from_type='person' AND rel_type='belongs_to'
- ✅ `idx_org_rel_reports_to` (tenant_id, from_id, rel_type) WHERE rel_type='reports_to' AND from_type='person'
- ✅ `idx_org_rel_from` (tenant_id, from_id, from_type)
- ✅ `idx_org_rel_to` (tenant_id, to_id, to_type)

**Usage:** Membership tracking (person → unit), manager relationships, matrix org support

---

### RLS Policies ✅ ENABLED

**org_units:**
```sql
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_units_tenant_read ON public.org_units
  FOR SELECT TO authenticated
  USING (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY org_units_admin_write ON public.org_units
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'super_admin'))
    )
  );
```

**org_relationships:**
```sql
ALTER TABLE public.org_relationships ENABLE ROW LEVEL SECURITY;

-- Similar policies: tenant-scoped read, admin-only write
```

**Verdict:** ✅ **Tenant isolation enforced at DB layer**

---

### Grants ✅ CONFIGURED

```sql
REVOKE ALL ON TABLE public.org_units FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_units TO authenticated, service_role;
```

**Verdict:** ✅ **Privileges correctly scoped**

---

## 🔍 CODE BASELINE (EXISTING)

### Platform Context BranchInfo ✅ EXISTS

**Source:** `src/platform/context/index.ts`

```typescript
export interface BranchInfo {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly locale: string;
  readonly address?: string;
}

export interface PlatformContext {
  readonly tenant: TenantInfo;
  readonly branch?: BranchInfo;  // ← Optional branch context
  readonly userId: string;
  readonly roles: ReadonlyArray<UserRole>;
  ...
}

export class ContextBuilder {
  withBranch(branch: BranchInfo): this {
    this.data.branch = branch;
    return this;
  }
}
```

**Usage:** 0 callsites found (context builder method unused)

**Verdict:** ✅ **Type exists but NOT populated in practice**

---

### Platform IAM Matrix branchOnly ✅ EXISTS

**Source:** `src/platform/iam-matrix/index.ts`

```typescript
export interface PermissionConditions {
  ownerOnly?: boolean;
  branchOnly?: boolean;  // ← Branch scope condition
  maxAmount?: number;
  allowedStatuses?: string[];
}

export interface PermissionRequest {
  resource?: {
    id?: string;
    ownerId?: string;
    branchId?: string;  // ← Resource's branch
    ...
  };
  userBranchId?: string;  // ← User's assigned branch
}

// Condition check implementation
if (conditions.branchOnly && request.resource?.branchId !== request.userBranchId) {
  return { passed: false, reason: 'branchOnly: resource belongs to different branch' };
}
```

**Usage:** 2 references (implementation + type definition)

**Verdict:** ✅ **Primitive exists but NO callsites use it**

---

### Platform Registry OrganizationTreeProvider ✅ EXISTS

**Source:** `src/platform/registry/vertical-registry.ts`

```typescript
export type OrganizationNodeKind = 'company' | 'branch' | 'team' | 'member' | string;

export interface OrganizationUnit {
  readonly id: string;
  readonly name: string;
  readonly kind: OrganizationNodeKind;
  readonly managerName?: string;
  readonly metricValues: MetricValue[];
  readonly hasChildren?: boolean;
}

export interface OrganizationTreeProvider {
  readonly metadata: ProviderMetadata;
  getTerminology(): { readonly root: string; readonly level1: string; readonly level2: string; readonly member: string; };
  getRoot(): Promise<OrganizationUnit>;
  getChildren(nodeId: string): Promise<OrganizationUnit[]>;
  getNode(nodeId: string): Promise<OrganizationUnit | null>;
  getSummary(nodeId: string): Promise<MetricValue[]>;
}
```

**Usage:** 0 vertical implementations found

**Verdict:** ✅ **Interface exists but NO implementations**

---

### Type Definitions ✅ GENERATED

**Source:** `src/types/supabase-generated.ts`

```typescript
org_units: {
  Row: {
    code: string | null
    created_at: string
    id: string
    is_active: boolean
    metadata: Json
    name: string
    parent_id: string | null
    tenant_id: string
    unit_type: string
    updated_at: string
  }
  Insert: { ... }
  Update: { ... }
  Relationships: [
    { foreignKeyName: "org_units_parent_id_fkey", columns: ["parent_id"], referencedRelation: "org_units" },
    { foreignKeyName: "org_units_tenant_id_fkey", columns: ["tenant_id"], referencedRelation: "tenants" }
  ]
}
```

**Verdict:** ✅ **Type definitions auto-generated by Supabase CLI**

---

## ❌ MISSING CAPABILITIES (GAP INVENTORY)

### Gap 1: NO Public Contract ❌

**Expected:** `src/platform/org-unit/index.ts`

**Status:** File does NOT exist

**Impact:** Products cannot import org unit capability

---

### Gap 2: NO Engine/Service Implementation ❌

**Expected:** `src/platform/org-unit/org-unit.engine.ts`

**Status:** File does NOT exist

**Impact:** No business logic for org unit lifecycle

---

### Gap 3: NO Repository Pattern ❌

**Expected:** `src/platform/org-unit/org-unit.repository.ts`

**Status:** File does NOT exist

**Impact:** No encapsulation of DB access

---

### Gap 4: NO Platform Exports ❌

**Expected:** Export from `src/platform/index.ts`

**Current state:**
```typescript
// ❌ NOT FOUND:
export { orgUnitEngine } from './org-unit';
export type { OrgUnit, OrgUnitType, IOrgUnitContract } from './org-unit';
```

**Impact:** Cannot import via `@/platform`

---

### Gap 5: NO Hierarchy Validation Logic ❌

**Expected:** Circular reference prevention

**Current state:**
- Logistics has `LocationDomain.validateHierarchy()` pattern
- org_units has NO validation logic

**Impact:** Can create circular parent-child references

---

### Gap 6: NO Branch Switching Implementation ❌

**Search:** `switchBranch|setBranch|changeBranch`

**Result:** 0 matches found

**Impact:** User cannot switch active branch in PlatformContext

---

### Gap 7: NO Cross-Branch Query API ❌

**Search:** `getAllBranches|getBranchesByRegion|queryAcrossBranches`

**Result:** 0 matches found

**Impact:** HQ Admin cannot query all branches

---

### Gap 8: NO Membership API ❌

**Expected:** Add/remove person from org unit

**Current state:**
- `org_relationships` table exists
- NO API to manipulate relationships

**Impact:** Cannot assign staff to branches

---

### Gap 9: NO Architecture Guard ❌

**Expected:** Block Product code from accessing `org_units` directly

**Current state:** NO guard exists

**Impact:** Product can bypass contract (violates G5)

---

### Gap 10: NO Tests ❌

**Expected:** Unit + integration + negative tests

**Current state:** 0 tests exist for org_units

**Impact:** No verification of contract behavior

---

## 📋 CONTRACT SURFACE AREA (FROZEN)

### Required Methods (Baseline from G5)

```typescript
export interface IOrgUnitContract {
  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════
  
  createOrgUnit(input: CreateOrgUnitInput): Promise<OrgUnit>;
  updateOrgUnit(id: string, updates: Partial<UpdateOrgUnitInput>): Promise<OrgUnit>;
  archiveOrgUnit(id: string): Promise<void>;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY
  // ═══════════════════════════════════════════════════════════════════════════
  
  getOrgUnit(id: string, tenantId: string): Promise<OrgUnit | null>;
  getOrgUnitsByType(type: OrgUnitType, tenantId: string): Promise<OrgUnit[]>;
  getOrgUnitsByParent(parentId: string, tenantId: string): Promise<OrgUnit[]>;
  getOrgUnitHierarchy(rootId: string, tenantId: string): Promise<OrgUnit[]>;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MEMBERSHIP
  // ═══════════════════════════════════════════════════════════════════════════
  
  addMember(unitId: string, personId: string, role?: string): Promise<void>;
  removeMember(unitId: string, personId: string): Promise<void>;
  getUnitMembers(unitId: string, tenantId: string): Promise<OrgUnitMember[]>;
  getUserUnits(personId: string, tenantId: string): Promise<OrgUnit[]>;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  validateHierarchy(childId: string, parentId: string, tenantId: string): Promise<boolean>;
  validateCircularReference(unitId: string, parentId: string, tenantId: string): Promise<boolean>;
}
```

**Method count:** 14 methods

**Complexity:** Medium (hierarchy validation requires recursive CTE queries)

---

## 📊 TEST DENOMINATOR (FROZEN)

### Unit Tests (Engine logic)

| Test Category | Test Count | Description |
|--------------|-----------|-------------|
| **Lifecycle** | 6 | create (valid/invalid), update, archive, reactivate, duplicate code |
| **Query** | 5 | getById, getByType, getByParent, getHierarchy (single-level/multi-level) |
| **Membership** | 4 | add member, remove member, get members, get user units |
| **Validation** | 6 | circular reference, self-parent, cross-tenant parent, orphan parent, hierarchy depth, invalid type transition |
| **Tenant Isolation** | 3 | cross-tenant create, cross-tenant query, cross-tenant membership |
| **Subtotal** | **24** | **Engine unit tests** |

### Integration Tests (DB + RLS)

| Test Category | Test Count | Description |
|--------------|-----------|-------------|
| **CRUD** | 4 | create → read → update → archive flow |
| **Hierarchy** | 3 | company → region → branch, parent validation, hierarchy query |
| **Membership** | 3 | person → unit assignment, unit members query, user units query |
| **RLS Policies** | 3 | tenant read isolation, admin write, non-admin write blocked |
| **Constraints** | 2 | unique code per tenant, FK violations |
| **Subtotal** | **15** | **Integration tests** |

### Negative Tests (Guard + violations)

| Test Category | Test Count | Description |
|--------------|-----------|-------------|
| **Architecture Guard** | 5 | Product direct org_units SELECT, Product INSERT, Product UPDATE, Product deep import, Product duplicate branch table |
| **Contract Violations** | 3 | Missing tenantId, invalid unit_type, NULL name |
| **Business Rule Violations** | 3 | Circular reference, cross-tenant hierarchy, inactive parent |
| **Subtotal** | **11** | **Negative tests** |

### TOTAL TEST DENOMINATOR: **50 tests**

---

## 🔧 IMPLEMENTATION PATH (R1→R7)

### R1: Contract Definition (1 day)

**Deliverables:**
- `src/platform/org-unit/index.ts` — Contract interface
- `src/platform/org-unit/types.ts` — Type exports (OrgUnit, OrgUnitType, CreateOrgUnitInput, etc.)
- Contract semantics frozen (method signatures, input/output DTOs)

**Exit criteria:**
- ✅ 14 contract methods defined
- ✅ All input/output types defined
- ✅ Contract semantics documented
- ✅ NO implementation yet (interface only)

---

### R2: Engine Implementation (2 days)

**Deliverables:**
- `src/platform/org-unit/org-unit.engine.ts` — Engine class implementing IOrgUnitContract
- `src/platform/org-unit/org-unit.repository.ts` — Repository pattern for DB access
- Business logic:
  - Hierarchy validation (circular reference prevention)
  - Tenant boundary enforcement
  - Parent validation
  - Type transition rules
- Event emission:
  - `OrgUnitCreated`
  - `OrgUnitUpdated`
  - `OrgUnitArchived`
  - `MemberAdded`
  - `MemberRemoved`

**Exit criteria:**
- ✅ 14 methods implemented
- ✅ Hierarchy validation logic (recursive CTE)
- ✅ Tenant isolation enforced
- ✅ Repository pattern encapsulates DB access
- ✅ Events emitted

---

### R3: Runtime Integration (0.5 day)

**Deliverables:**
- Integration tests against real `org_units` table
- RLS policy verification
- Tenant isolation verification

**Exit criteria:**
- ✅ 15 integration tests PASS
- ✅ RLS policies verified (tenant read, admin write)
- ✅ Cross-tenant access blocked

---

### R4: Platform Exports (0.5 day)

**Deliverables:**
- Export `orgUnitEngine` from `src/platform/index.ts`
- Export types (OrgUnit, OrgUnitType, IOrgUnitContract, etc.)
- Verify NO internal implementation leaked

**Exit criteria:**
- ✅ `orgUnitEngine` exported from `@/platform`
- ✅ Types exported
- ✅ Products can import via `@/platform`

---

### R5: English Center Integration Proof (0.5 day)

**Deliverables:**
- English Center creates branch via contract
- English Center queries branches via contract
- NO direct `org_units` access

**Exit criteria:**
- ✅ English Center can create branch
- ✅ English Center can query branches
- ✅ 0 direct `org_units` table access

---

### R6: Full Verification (1 day)

**Deliverables:**
- 24 unit tests
- 15 integration tests
- 11 negative tests
- Total: 50/50 tests PASS

**Exit criteria:**
- ✅ 50/50 tests PASS
- ✅ Build PASS
- ✅ 0 architecture violations

---

### R7: Enforcement Seal (0.5 day)

**Deliverables:**
- Architecture guard blocks direct `org_units` access
- Guard blocks Product duplicate branch tables
- Evidence sealed

**Exit criteria:**
- ✅ Architecture guard implemented
- ✅ BLOCK tests PASS (5 adversarial tests)
- ✅ ALLOW tests PASS (Product via contract)
- ✅ Evidence document created

---

## 📅 TIMELINE ESTIMATE (EVIDENCE-BASED)

```text
R1 Contract Definition          1 day
R2 Engine Implementation        2 days
R3 Runtime Integration          0.5 day
R4 Platform Exports             0.5 day
R5 English Integration Proof    0.5 day
R6 Full Verification            1 day
R7 Enforcement Seal             0.5 day
──────────────────────────────────────
TOTAL                           6 days
```

**Comparison with F3 AR Finance (E0.1B-R):**
- F3 AR: 7 days (6 tables, invoice lifecycle, F1 posting, 68 tests)
- Org Unit: 6 days (1 table + relationships, hierarchy validation, 50 tests)
- **Simpler than F3 AR** (no GL posting, fewer tables)

**Confidence:** Medium-High
- Schema already exists (low risk)
- Pattern proven (F3 AR remediation succeeded)
- Clear scope (no feature creep)

---

## ✅ R0 VERDICT: **BASELINE FROZEN**

### Summary

**Schema:**
- ✅ org_units table: COMPLETE (created 2026-08-01)
- ✅ org_relationships table: COMPLETE
- ✅ RLS policies: ENABLED
- ✅ Indexes: OPTIMIZED
- ✅ Constraints: ENFORCED

**Code (existing):**
- ✅ BranchInfo type: EXISTS (unused)
- ✅ branchOnly IAM condition: EXISTS (unused)
- ✅ OrganizationTreeProvider interface: EXISTS (no implementations)
- ✅ Type definitions: AUTO-GENERATED

**Gaps (missing):**
- ❌ Public contract: MISSING (14 methods)
- ❌ Engine/service: MISSING
- ❌ Repository: MISSING
- ❌ Platform exports: MISSING
- ❌ Hierarchy validation: MISSING
- ❌ Branch switching: MISSING
- ❌ Cross-branch queries: MISSING
- ❌ Membership API: MISSING
- ❌ Architecture guard: MISSING
- ❌ Tests: MISSING (0/50)

**Test Denominator:** 50 tests (24 unit + 15 integration + 11 negative)

**Timeline:** 6 days (evidence-based estimate)

**Risk:** Low (schema exists, pattern proven)

---

## 📋 R1 AUTHORIZATION

**R0 census COMPLETE.** Authorize R1 Contract Definition.

**Next:** Create `IOrgUnitContract` interface + type exports (14 methods, 1 day).

---

**R0 SEALED:** 2026-09-12

**Evidence:** Schema dormant but complete. Contract gap confirmed. 50-test denominator frozen. 6-day timeline estimated.
