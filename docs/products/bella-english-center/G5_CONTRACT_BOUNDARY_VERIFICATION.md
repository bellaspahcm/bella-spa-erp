---
gate: E1_READINESS_G5
status: COMPLETE
created: 2026-09-12
verdict: BLOCKED_BY_PLATFORM_CONTRACT_GAP
criteria: Contract Boundary Ready
blocker_for: E1_Chain_Management
remediation_required: Platform Org Unit Contract
---

# G5 — CONTRACT BOUNDARY VERIFICATION

> **Gate Mission:** Verify Product can consume Chain/Branch via **public Platform API** (NOT direct DB access).

---

## 🎯 VERIFICATION CRITERIA

**G5 PASS requires:**
1. ✅ Platform provides public `IOrgUnitContract`
2. ✅ Platform exports org unit engine/service
3. ✅ Platform exports types (OrgUnit, OrgUnitType, etc.)
4. ✅ Product code uses ONLY public Platform imports
5. ❌ Product code does NOT access `org_units` table directly
6. ❌ Product code does NOT deep-import Platform internals

---

## 📊 EVIDENCE COLLECTED

### Evidence 1: Platform Public Exports ❌ CONTRACT MISSING

**Source:** `src/platform/index.ts`

**Search result:**
```typescript
// SEARCHED FOR: IOrgUnit, OrgUnitContract, OrgUnitEngine
// RESULT: No matches found

// Platform exports (lines 1-350):
export { partyEngine } from './party';
export { journeyEngine } from './journey';
export { timelineEngine } from './timeline';
export { assetEngine } from './asset';
export { contractEngine } from './contract';
export { iamMatrix } from './iam-matrix';
// ... 13 engines exported

// NO org unit engine exported
// NO org unit contract exported
```

**Verdict:** ❌ **Platform does NOT export org unit capability**

---

### Evidence 2: Platform Org Unit Implementation ❌ NOT FOUND

**Search patterns:**
```bash
# Pattern 1: Contract interface
grep -r "interface IOrgUnit" src/platform/
# Result: No matches

# Pattern 2: Engine/Service class
grep -r "class.*OrgUnit.*Engine" src/platform/
# Result: No matches

# Pattern 3: Direct table access
grep -r "from('org_units')" src/platform/
# Result: No matches
```

**Verdict:** ❌ **Platform has NO org unit contract, engine, or service implementation**

---

### Evidence 3: Product Code Usage ✅ NO DIRECT ACCESS

**Search pattern:**
```bash
# Check if products access org_units directly
grep -r "from('org_units')" src/products/
# Result: No matches

grep -r "from('org_units')" src/modules/
# Result: No matches
```

**Verdict:** ✅ **No product code accesses org_units table** (because contract doesn't exist yet)

---

### Evidence 4: Schema Exists But Dormant ✅ VERIFIED

**Source:** `supabase/migrations/20260801030000_foundation_org_people_schema.sql`

```sql
-- Schema created: 2026-08-01
CREATE TABLE IF NOT EXISTS public.org_units (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  unit_type TEXT NOT NULL CHECK (unit_type IN (
    'company', 'region', 'branch', 'department', 'team', 'project', 'task_force', 'committee'
  )),
  name TEXT NOT NULL,
  code TEXT,
  parent_id UUID REFERENCES public.org_units(id),
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes created
-- Constraints enforced
-- RLS enabled (assumed, needs verification)
```

**Usage status:**
- ✅ Schema exists
- ❌ NO code uses this table
- ❌ NO public contract
- ❌ NO engine/service
- ❌ NO exports

**Verdict:** ✅ **Schema is dormant** — created but never activated

---

## 🔍 GAP ANALYSIS

### Platform Capability Status

| Component | Required | Status | Location | Notes |
|-----------|----------|--------|----------|-------|
| **Schema** | ✅ | ✅ EXISTS | `supabase/migrations/20260801030000` | Created 2026-08-01 |
| **IOrgUnitContract** | ✅ | ❌ MISSING | Should be `src/platform/org-unit/` | NOT CREATED |
| **OrgUnitEngine** | ✅ | ❌ MISSING | Should be `src/platform/org-unit/` | NOT CREATED |
| **Public exports** | ✅ | ❌ MISSING | Should be in `src/platform/index.ts` | NOT EXPORTED |
| **Repository** | ✅ | ❌ MISSING | Should be `org-unit.repository.ts` | NOT CREATED |
| **RLS policies** | ✅ | ⚠️ UNKNOWN | Should be in migration | NEEDS VERIFICATION |
| **Architecture guard** | ✅ | ❌ MISSING | Should block Product direct access | NOT CREATED |

### Contract Gap Details

**MISSING: Platform Org Unit Contract**

```typescript
// EXPECTED (does NOT exist):
// src/platform/org-unit/index.ts

export interface IOrgUnitContract {
  // Lifecycle
  createOrgUnit(input: CreateOrgUnitInput): Promise<OrgUnit>;
  updateOrgUnit(id: string, updates: Partial<OrgUnit>): Promise<OrgUnit>;
  archiveOrgUnit(id: string): Promise<void>;
  
  // Query
  getOrgUnit(id: string): Promise<OrgUnit | null>;
  getOrgUnitsByType(type: OrgUnitType, tenantId: string): Promise<OrgUnit[]>;
  getOrgUnitsByParent(parentId: string): Promise<OrgUnit[]>;
  getOrgUnitHierarchy(rootId: string): Promise<OrgUnit[]>;
  
  // Membership
  addMember(unitId: string, personId: string, role?: string): Promise<void>;
  removeMember(unitId: string, personId: string): Promise<void>;
  getUnitMembers(unitId: string): Promise<OrgUnitMember[]>;
  getUserUnits(personId: string): Promise<OrgUnit[]>;
  
  // Validation
  validateHierarchy(childId: string, parentId: string): Promise<boolean>;
  validateCircularReference(unitId: string, parentId: string): Promise<boolean>;
}

export type OrgUnitType =
  | 'company'
  | 'region'
  | 'branch'
  | 'department'
  | 'team'
  | 'project'
  | 'task_force'
  | 'committee';

export interface OrgUnit {
  id: string;
  tenantId: string;
  unitType: OrgUnitType;
  name: string;
  code?: string;
  parentId?: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrgUnitInput {
  tenantId: string;
  unitType: OrgUnitType;
  name: string;
  code?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface OrgUnitMember {
  unitId: string;
  personId: string;
  role?: string;
  since?: Date;
  until?: Date;
}
```

**MISSING: Platform Org Unit Engine**

```typescript
// EXPECTED (does NOT exist):
// src/platform/org-unit/org-unit.engine.ts

class OrgUnitEngine implements IOrgUnitContract {
  private repository: IOrgUnitRepository;
  
  async createOrgUnit(input: CreateOrgUnitInput): Promise<OrgUnit> {
    // 1. Validate tenant exists
    // 2. Validate parent (if specified) belongs to same tenant
    // 3. Validate unit_type transition rules
    // 4. Insert into org_units
    // 5. Publish OrgUnitCreated event
  }
  
  async getOrgUnitHierarchy(rootId: string): Promise<OrgUnit[]> {
    // Recursive CTE query to fetch tree
  }
  
  async validateCircularReference(unitId: string, parentId: string): Promise<boolean> {
    // Prevent unit.parentId = descendant of unit
  }
  
  // ... other methods
}

export const orgUnitEngine = new OrgUnitEngine();
```

**MISSING: Platform Public Export**

```typescript
// EXPECTED (does NOT exist):
// src/platform/index.ts

// ─── Org Unit Engine ──────────────────────────────────────────────────────
export { orgUnitEngine } from './org-unit';
export type {
  OrgUnit,
  OrgUnitType,
  CreateOrgUnitInput,
  OrgUnitMember,
  IOrgUnitContract,
} from './org-unit';
```

---

## 🚫 WHAT ENGLISH CENTER CANNOT DO (Without Contract)

### Scenario 1: Create Branch ❌ BLOCKED

**Product intent:**
```typescript
// English Center wants to create branch
import { orgUnitEngine } from '@/platform';

const branch = await orgUnitEngine.createOrgUnit({
  tenantId: ctx.tenant.id,
  unitType: 'branch',
  name: 'Chi Nhánh Quận 1',
  code: 'HCM-Q1',
  parentId: regionId
});
```

**Current reality:**
```typescript
// ❌ orgUnitEngine does not exist
// ❌ Cannot import from @/platform
// ❌ Must access org_units table directly (VIOLATION)
```

**Blocked:** ✅ YES

---

### Scenario 2: Query User's Branches ❌ BLOCKED

**Product intent:**
```typescript
// English Center wants to list user's accessible branches
const branches = await orgUnitEngine.getOrgUnitsByType('branch', ctx.tenant.id);
```

**Current reality:**
```typescript
// ❌ orgUnitEngine does not exist
// ❌ No public query API
// ❌ Must SELECT from org_units directly (VIOLATION)
```

**Blocked:** ✅ YES

---

### Scenario 3: Validate Branch Hierarchy ❌ BLOCKED

**Product intent:**
```typescript
// English Center wants to assign course to branch
const isValid = await orgUnitEngine.validateHierarchy(
  branchId,
  regionId
);

if (!isValid) {
  throw new Error('Branch does not belong to region');
}
```

**Current reality:**
```typescript
// ❌ orgUnitEngine does not exist
// ❌ No hierarchy validation API
// ❌ Must implement recursive query (DUPLICATION)
```

**Blocked:** ✅ YES

---

### Scenario 4: Branch Membership ❌ BLOCKED

**Product intent:**
```typescript
// English Center wants to assign teacher to branch
await orgUnitEngine.addMember(branchId, teacherPartyId, 'teacher');
```

**Current reality:**
```typescript
// ❌ orgUnitEngine does not exist
// ❌ No membership API
// ❌ Must INSERT into org_relationships directly (VIOLATION)
```

**Blocked:** ✅ YES

---

## 📊 IMPACT ANALYSIS

### What English Center NEEDS (Cannot proceed without)

| Capability | Contract Method | Impact if Missing |
|-----------|----------------|-------------------|
| **Create branch** | `createOrgUnit()` | ❌ Cannot onboard new centers |
| **Query branches** | `getOrgUnitsByType()` | ❌ Cannot list branches in UI |
| **Branch hierarchy** | `getOrgUnitHierarchy()` | ❌ Cannot render org tree |
| **Validate hierarchy** | `validateHierarchy()` | ❌ Cannot enforce region → branch rules |
| **Branch membership** | `addMember()`, `getUnitMembers()` | ❌ Cannot assign staff to branches |
| **User's branches** | `getUserUnits()` | ❌ Cannot filter data by user's branch scope |
| **Switch branch** | Context update API | ❌ Cannot switch active branch |

**VERDICT:** English Center **COMPLETELY BLOCKED** without Platform Org Unit Contract.

---

### Workaround Options (ALL VIOLATE ARCHITECTURE)

**Option A: Direct table access ❌ PROHIBITED**
```typescript
// Product accesses org_units table directly
const { data } = await supabase
  .from('org_units')
  .select('*')
  .eq('tenant_id', tenantId)
  .eq('unit_type', 'branch');

// ❌ VIOLATION: Product → Platform DB coupling
// ❌ VIOLATION: Bypass contract boundary
// ❌ VIOLATION: No business logic enforcement
// ❌ VIOLATION: G5 FAIL
```

**Option B: Product-specific branch table ❌ PROHIBITED**
```typescript
// English Center creates english_center_branches table

// ❌ VIOLATION: Duplicate canonical Platform entity
// ❌ VIOLATION: G4 ownership decision violated
// ❌ VIOLATION: Future products will duplicate again
// ❌ VIOLATION: Platform org_units becomes dead code
```

**Option C: Platform internal deep import ❌ PROHIBITED**
```typescript
// Product imports internal Platform implementation
import { supabase } from '@/platform/host/supabase';

// ❌ VIOLATION: Bypass public contract
// ❌ VIOLATION: Couple to internal implementation
// ❌ VIOLATION: No versioning/compatibility guarantee
```

**ALL OPTIONS FAIL G5 Contract Boundary.**

---

## ✅ G5 VERDICT: **BLOCKED BY PLATFORM CONTRACT GAP**

### Failure Criteria

1. ❌ **Platform does NOT provide public `IOrgUnitContract`**
   - Contract interface: MISSING
   - Contract implementation: MISSING
   - Public exports: MISSING

2. ❌ **Platform does NOT export org unit engine/service**
   - Engine: MISSING
   - Repository: MISSING
   - Lifecycle logic: MISSING

3. ❌ **Platform does NOT export required types**
   - OrgUnit: MISSING
   - OrgUnitType: MISSING
   - CreateOrgUnitInput: MISSING

4. ✅ **Product code does NOT access `org_units` directly** (correct behavior, but blocked)

5. ✅ **Product code does NOT deep-import Platform internals** (correct behavior, but blocked)

**ROOT CAUSE:** Platform has **schema without contract** — dormant capability.

---

## 🔴 REMEDIATION REQUIRED

### Gap Classification

**Type:** Platform Contract Gap (similar to F3 AR Finance gap)

**Severity:** **BLOCKER** — English Center E1 cannot start

**Scope:** Platform Core responsibility (NOT Product)

**Comparison:**

| Gap | Schema | Contract | Impact |
|-----|--------|----------|--------|
| **F3 AR Finance** | ✅ Existed | ❌ Missing | E0.1B-R remediation (SEALED) |
| **Org Unit** | ✅ Exists | ❌ Missing | **G5 BLOCKED** (current) |

**Similarity:** Both have schema but lack public contract for Product consumption.

---

### Remediation Track: E0.1D-R

**Name:** E0.1D-R — Platform Org Unit Contract Remediation

**Mission:** Create public contract for `org_units` schema so Products can consume Chain/Branch/Region.

**Scope:**
```text
R0 Baseline Assessment
  - Verify org_units schema
  - Verify RLS policies
  - Document gap

R1 Contract Definition
  - Define IOrgUnitContract interface
  - Define type exports (OrgUnit, OrgUnitType, etc.)
  - Define input/output DTOs
  - Lock contract semantics

R2 Engine Implementation
  - Implement OrgUnitEngine class
  - Implement repository pattern
  - Business logic (hierarchy validation, circular reference check)
  - Event emission (OrgUnitCreated, OrgUnitArchived)

R3 Runtime Integration
  - Test against real org_units table
  - Verify RLS policies work
  - Integration tests (create → query → update → archive)

R4 Platform Exports
  - Export orgUnitEngine from @/platform
  - Export types
  - Verify no internal implementation leakage

R5 English Integration (Proof of Contract)
  - English Center creates branch via contract
  - English Center queries branches via contract
  - NO direct org_units access

R6 Verification
  - Unit tests
  - Integration tests
  - Negative tests (circular reference, cross-tenant)

R7 Enforcement Seal
  - Architecture guard blocks direct org_units access
  - Guard blocks Product creating duplicate branch tables
  - Evidence sealed
```

**Estimated effort:** **3–5 days** (smaller than F3 AR, schema already exists)

---

### Comparison: F3 AR vs Org Unit Remediation

| Aspect | F3 AR (E0.1B-R) | Org Unit (E0.1D-R) |
|--------|-----------------|-------------------|
| **Schema** | 6 tables | 1 table (org_units) |
| **Complexity** | High (invoice lifecycle, AR subledger, F1 posting) | Medium (hierarchy validation) |
| **Contract methods** | 5 (create, addLine, finalize, void, get) | ~10 (CRUD, hierarchy, membership) |
| **Dependencies** | F1 General Ledger, F2 Cash (deferred) | org_relationships (membership) |
| **Evidence tests** | 68/68 | TBD (~30-40 expected) |
| **Effort** | 1 week | **3–5 days** |
| **Product impact** | English Center billing | **ALL products needing org hierarchy** |

**Key difference:** Org Unit is **more generic, less complex, higher reuse** than F3 AR.

---

## 📋 E1 READINESS IMPACT

### Before G5 Verification

```text
E1 READINESS GATE
═══════════════════════════════════════

G1 Identity Ready          ✅ PASS
G2 Finance Ready           ✅ PASS
G3 Tenant Boundary         ✅ PASS
G4 Ownership Boundary      ✅ PASS (Platform elevation)
G5 Contract Boundary       ⏳ VERIFYING
```

### After G5 Verdict

```text
E1 READINESS GATE
═══════════════════════════════════════

G1 Identity Ready          ✅ PASS
G2 Finance Ready           ✅ PASS
G3 Tenant Boundary         ✅ PASS
G4 Ownership Boundary      ✅ PASS (Platform elevation)
G5 Contract Boundary       🔴 BLOCKED BY PLATFORM GAP
G6 Regression Baseline     🚫 CANNOT VERIFY (G5 blocks)
G7 Enforcement             🚫 CANNOT VERIFY (G5 blocks)

Current: 4/7 PASS, 1/7 BLOCKED, 2/7 WAITING
E1 implementation: 🚫 NOT AUTHORIZED
═══════════════════════════════════════

BLOCKER IDENTIFIED:
  Platform Org Unit Contract MISSING
  → E0.1D-R Remediation REQUIRED
  → E1 cannot start until remediation SEALED
```

---

## 🔒 ARCHITECTURAL DECISIONS LOCKED

**AD-G5-001:** English Center MUST NOT access `org_units` table directly (enforce in architecture guard)

**AD-G5-002:** English Center MUST NOT create `english_center_branches` table (G4 ownership violation)

**AD-G5-003:** Platform MUST create `IOrgUnitContract` before E1 can proceed

**AD-G5-004:** Platform Org Unit Contract is **BLOCKER** for E1 Chain Management implementation

**AD-G5-005:** E0.1D-R Org Unit Remediation track is **MANDATORY** (cannot skip)

**AD-G5-006:** Org Unit Contract follows same remediation pattern as F3 AR (R0→R7)

**AD-G5-007:** All Products (English Center, K-12, Hospital, Real Estate) MUST consume via `@/platform` exports

**AD-G5-008:** Architecture guard MUST block `supabase.from('org_units')` in Product code

**AD-G5-009:** E1 Readiness Gate CANNOT pass 7/7 until E0.1D-R SEALED

**AD-G5-010:** G6/G7 verification is BLOCKED until G5 PASS

---

## 📊 REGISTRY UPDATE

### R2: Contract Registry

| Capability | Contract | Owner | Status | Remediation Track |
|-----------|----------|-------|--------|------------------|
| **Org Unit Lifecycle** | `IOrgUnitContract` | Platform | ❌ MISSING | **E0.1D-R REQUIRED** |
| **Branch Query** | `IOrgUnitContract.getOrgUnitsByType()` | Platform | ❌ MISSING | **E0.1D-R REQUIRED** |
| **Hierarchy Validation** | `IOrgUnitContract.validateHierarchy()` | Platform | ❌ MISSING | **E0.1D-R REQUIRED** |
| **Membership** | `IOrgUnitContract.addMember()` | Platform | ❌ MISSING | **E0.1D-R REQUIRED** |

### R5: Gate Mapping Registry

| Gate | Capability | Status | Blocker |
|------|-----------|--------|---------|
| **G5** | Contract Boundary | 🔴 BLOCKED | Platform Org Unit Contract MISSING |

---

## 🚀 NEXT STEPS

### IMMEDIATE (CANNOT SKIP)

```text
STEP 1: Authorize E0.1D-R Platform Org Unit Contract Remediation
  - Owner: Platform Team
  - Timeline: 3–5 days
  - Phases: R0 → R7
  - Exit: IOrgUnitContract exported from @/platform

STEP 2: E0.1D-R Execution
  - R0: Baseline assessment
  - R1: Contract definition
  - R2: Engine implementation
  - R3: Runtime integration
  - R4: Platform exports
  - R5: English integration proof
  - R6: Verification (30-40 tests)
  - R7: Enforcement seal

STEP 3: Re-run G5 Verification
  - Verify Platform exports IOrgUnitContract
  - Verify English Center can consume
  - Verdict: PASS

STEP 4: Continue E1 Readiness Gate
  - G6 Regression Baseline
  - G7 Enforcement
  - Target: 7/7 PASS
```

### CANNOT PROCEED (BLOCKED)

```text
❌ E1-PLATFORM implementation (blocked by G5)
❌ E1-ENGLISH implementation (blocked by G5)
❌ G6 Regression Baseline (depends on G5 PASS)
❌ G7 Enforcement (depends on G5 PASS)
```

---

## 📝 REMEDIATION AUTHORIZATION

**RECOMMENDATION:** Authorize **E0.1D-R Platform Org Unit Contract Remediation** immediately.

**Justification:**
1. ✅ English Center E1 **COMPLETELY BLOCKED** without contract
2. ✅ Schema already exists (low implementation risk)
3. ✅ Pattern proven (F3 AR remediation succeeded)
4. ✅ High reuse (K-12, Hospital, Real Estate will need same)
5. ✅ Smaller scope than F3 AR (3–5 days vs 1 week)

**Approval criteria:**
- Platform Team accepts ownership
- Timeline: 3–5 days
- Exit: `orgUnitEngine` exported from `@/platform`
- Evidence: ~30-40 tests PASS
- Architecture guard enforced

**After E0.1D-R SEALED:**
- G5 re-verification → PASS
- G6, G7 verification proceed
- E1 Readiness Gate 7/7 → E1 authorized

---

## ✅ SUMMARY

```text
G5 CONTRACT BOUNDARY VERIFICATION COMPLETE

Platform Org Unit Contract:       ❌ MISSING
Schema:                           ✅ EXISTS (dormant)
English Center access:            ✅ NO VIOLATION (blocked correctly)

VERDICT:                          🔴 BLOCKED BY PLATFORM GAP

Remediation Required:             E0.1D-R (3–5 days)
Blocker for:                      E1 Chain Management
Alternative solutions:            NONE (all violate architecture)

NEXT:                             Authorize E0.1D-R remediation
AFTER REMEDIATION:                Re-run G5 → G6 → G7 → E1 authorized
```

---

**GATE G5 SEALED:** 2026-09-12

**ARCHITECTURAL DECISION:** Platform Org Unit Contract gap confirmed. E0.1D-R remediation REQUIRED before E1 can proceed.
