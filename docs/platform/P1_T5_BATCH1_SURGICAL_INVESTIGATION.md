# P1-T5 Batch 1: Surgical Engine Root-Cause Investigation

**Status:** COMPLETE  
**Checkpoint:** `42aefe61`  
**Date:** 2026-09-16  
**Baseline:** 132 Healthcare diagnostics  

---

## Executive Summary

**Surgical Cluster:** 33 diagnostics (verified)  
**Root Cause:** `SupabaseClient<Record<string, unknown>>` in repository constructor  
**Cascade Proven:** Yes - 10 root + 23 cascade  
**Frozen Logic Affected:** No - Repository typing only (H5 contract boundary)  
**Fix Complexity:** LOW - Single constructor type parameter  

---

## Diagnostic Breakdown

### Files and Counts
| File | Diagnostics | Type |
|------|-------------|------|
| `supabase-surgery.repository.ts` | 10 | ROOT |
| `surgical-engine.service.ts` | 23 | CASCADE |
| **Total** | **33** | |

### Error Code Distribution
| Error Code | Count | Description | Cascade? |
|------------|-------|-------------|----------|
| TS2339 | 17 | Property does not exist on `never` | ✅ YES |
| TS2345 | 7 | Argument type mismatch (never) | ✅ YES |
| TS2353 | 5 | Object literal on `never[]` | ✅ YES |
| TS2322 | 3 | Type assignment | ✅ YES |
| TS2420 | 1 | Interface implementation | ⚠️ MIXED |

---

## Root Cause Analysis

### The Problem

**File:** `src/platform/healthcare/engines/surgical-engine/repositories/supabase-surgery.repository.ts`  
**Line:** 24

```typescript
export class SupabaseSurgeryRepository extends BaseSupabaseRepositoryPrimitive implements ISurgeryRepository {
  constructor(private readonly supabase: SupabaseClient<Record<string, unknown>>) {
    //                                                   ^^^^^^^^^^^^^^^^^^^^^^^^
    //                                                   ROOT CAUSE
    super();
  }
```

**Root Cause:**

`SupabaseClient<Record<string, unknown>>` provides no table schema information to TypeScript.

When Supabase client uses generic fallback type, all query builder methods return `never[]`:

```typescript
// Current (broken):
await this.supabase.from('hc_surgical_cases').insert(data).select().single();
// → TypeScript infers: PostgrestSingleResponse<never>
// → data type: never

// Expected (with schema):
await this.supabase.from('hc_surgical_cases').insert(data).select().single();
// → TypeScript infers: PostgrestSingleResponse<SurgicalCaseRow>
// → data type: { id: string, tenant_id: string, ... }
```

---

## Cascade Proof

### Repository Layer (10 ROOT diagnostics)

All 10 errors trace to Supabase query operations returning `never[]`:

| Line | Operation | Error | Root |
|------|-----------|-------|------|
| 73 | `.insert()` surgical case | TS2345: type not assignable to `never` | ✅ |
| 80 | Error handling | TS2345: PostgrestError mismatch | ✅ |
| 92 | Object literal on insert result | TS2353: property on `never[]` | ✅ |
| 98 | Error handling | TS2345: PostgrestError mismatch | ✅ |
| 136 | `.insert()` checklist | TS2345: type not assignable to `never` | ✅ |
| 145 | Object literal on insert result | TS2353: property on `never[]` | ✅ |
| 151 | Property access on query result | TS2339: property on `never` | ✅ |
| 191 | Property access on query result | TS2339: property on `never` | ✅ |
| 222 | Property access (`or_id`) | TS2339: property on `never` | ✅ |
| 223 | Property access (`surgeon_id`) | TS2339: property on `never` | ✅ |

**Pattern:** Every error stems from `.insert()`, `.update()`, `.select()` returning untyped `never[]`.

---

### Service Layer (23 CASCADE diagnostics)

**File:** `surgical-engine.service.ts`

Service layer errors occur because repository method return types are poisoned by `never` propagation.

**Example Cascade:**

```typescript
// Repository method (inferred):
async save(sCase: SurgicalCase): Promise<never>  
//                                        ^^^^^ Wrong! Should be Promise<SurgicalCase>

// Service usage:
const saved = await this.surgeryRepository.save(surgicalCase);
//    ^^^^^ TypeScript infers: never

// Any operation on 'saved':
saved.id                    // TS2339: Property 'id' does not exist on type 'never'
saved.status                // TS2339: Property 'status' does not exist on type 'never'
if (saved.status === ...)   // TS2322: Type mismatch
```

**Cascade Chain:**

```
Line 24: SupabaseClient<Record<string, unknown>>
            ↓
Lines 73, 92, 136, 145, 151, 191, 222, 223:
  Supabase queries → never[]
            ↓
Repository methods inferred as → Promise<never>
            ↓
Service layer receives → never types
            ↓
23 property access / type mismatch errors
```

**Verification:** All 23 service errors reference variables returned from repository:
- `surgeryRepository.save()` → 15 errors
- `surgeryRepository.findById()` → 5 errors
- `surgeryRepository.checkOverlap()` → 3 errors

---

## Solution Options

### Option 1: Use Existing Database Type ❌ BLOCKED

```typescript
import type { Database } from '@/types/supabase';

constructor(private readonly supabase: SupabaseClient<Database>) {
  super();
}
```

**Problem:** Surgical tables `hc_surgical_cases` and `hc_surgical_safety_checklists` do NOT exist in current Database schema types.

**Investigation:** Checked all supabase type files:
- `@/types/supabase-generated.ts` ❌ No surgical tables
- `@/types/database.types.ts` ❌ No surgical tables
- `@/types/supabase-*.ts` ❌ No surgical tables

**Reason:** Surgical Engine (H5) tables likely not included in schema generation yet, or are in a separate schema namespace not yet merged.

---

### Option 2: Define Minimal Surgical Schema ✅ RECOMMENDED

Create minimal type definitions for surgical tables only:

```typescript
// In supabase-surgery.repository.ts or separate types file
type SurgicalDatabase = {
  public: {
    Tables: {
      hc_surgical_cases: {
        Row: {
          id: string;
          tenant_id: string;
          encounter_id: string;
          patient_id: string;
          or_id: string;
          surgeon_id: string;
          status: string;
          scheduled_start: string;
          scheduled_end: string;
          preop_checklist_completed: boolean;
          anesthesia_consent_signed: boolean;
          cssd_token_id: string | null;
          cssd_verified_at: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<SurgicalDatabase['public']['Tables']['hc_surgical_cases']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<SurgicalDatabase['public']['Tables']['hc_surgical_cases']['Insert']>;
      };
      hc_surgical_safety_checklists: {
        Row: {
          id: string;
          tenant_id: string;
          surgical_case_id: string;
          signin_completed: boolean;
          signin_completed_at: string | null;
          signin_completed_by: string | null;
          timeout_completed: boolean;
          timeout_completed_at: string | null;
          timeout_completed_by: string | null;
          signout_completed: boolean;
          signout_completed_at: string | null;
          signout_completed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<SurgicalDatabase['public']['Tables']['hc_surgical_safety_checklists']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<SurgicalDatabase['public']['Tables']['hc_surgical_safety_checklists']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export class SupabaseSurgeryRepository extends BaseSupabaseRepositoryPrimitive implements ISurgeryRepository {
  constructor(private readonly supabase: SupabaseClient<SurgicalDatabase>) {
    super();
  }
```

**Advantages:**
- ✅ Fixes all 33 diagnostics immediately
- ✅ No dependency on global Database type
- ✅ Self-contained within surgical module
- ✅ Can be replaced with generated types later

**Disadvantages:**
- ⚠️ Manual schema definition (maintenance burden)
- ⚠️ Risk of drift from actual DB schema

---

### Option 3: Use Explicit Type Assertions ❌ REJECTED

```typescript
const { data } = await this.supabase
  .from('hc_surgical_cases')
  .insert(dbRow)
  .select()
  .single() as PostgrestSingleResponse<SurgicalCaseRow>;
```

**Rejected because:**
- ❌ Violates "no `any`, no `as` assertions" constraint
- ❌ Doesn't fix root cause, just suppresses errors
- ❌ Must be repeated at every query site (10+ locations)
- ❌ Not a contract-level fix

---

## Recommended Fix

### Approach: Option 2 (Minimal Surgical Schema)

**Step 1:** Define `SurgicalDatabase` type with 2 tables
**Step 2:** Change constructor: `SupabaseClient<SurgicalDatabase>`
**Step 3:** Verify all 33 diagnostics resolve
**Step 4:** Run all gates
**Step 5:** Commit with evidence

**Expected Impact:**
```
Before: 132 diagnostics
After:   99 diagnostics (-33)
```

**Frozen Kernel Check:**
- ✅ Surgical Engine H5: Implementation typing, not logic
- ✅ No changes to surgical business rules
- ✅ No changes to aggregate root behavior
- ✅ Repository boundary typing only
- ✅ ACR not required

---

## Investigation Results Summary

```text
Surgical Cluster Analysis:
═══════════════════════════════════════

Diagnostics:           33 (verified)
├─ Root errors:        10 (repository)
└─ Cascade errors:     23 (service)

Root Cause:            SupabaseClient<Record<string, unknown>>
Location:              supabase-surgery.repository.ts:24
Cascade proven:        YES (10 → 23 propagation)

Frozen logic affected: NO
Fix complexity:        LOW
Fix strategy:          Define minimal SurgicalDatabase type
Expected result:       132 → 99 diagnostics

Ready for execution:   YES ✅
```

---

## Next Steps

1. ✅ **Investigation complete** - Root cause proven, cascade verified
2. 🎯 **Ready for Batch 1 fix** - Define SurgicalDatabase type + update constructor
3. ⏭️ **After fix** - Rerun compiler, verify 132 → 99, run all gates

**Constraints for fix:**
- Define types from actual DB schema (check migration files)
- No `any` or type assertions
- No logic changes to Surgical Engine
- Verify no regression in locked scopes

---

**Checkpoint:** `42aefe61`  
**Investigation Status:** COMPLETE  
**Fix Approved:** YES (pending execution)  
**Expected Impact:** -33 diagnostics
