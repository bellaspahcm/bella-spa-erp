# P1-T2 COURSE REPOSITORY INVESTIGATION — 7 DIAGNOSTICS

**Checkpoint:** `57bbbcf0`  
**Date:** 2026-09-16  
**File:** `src/platform/education/course/course.repository.ts`  
**Status:** ✅ **ROOT CAUSE IDENTIFIED**

---

## **Diagnostics Summary**

```
7 diagnostics — ALL involve '{}' (empty object type)

Line 231: TS2322 — Type '{}' not assignable to 'number'
Line 232: TS2322 — Type '{} | undefined' not assignable to 'number | undefined'
Line 233: TS2322 — Type '{} | undefined' not assignable to 'number | undefined'
Line 234: TS2740 — Type '{}' missing properties from 'string[]'
Line 235: TS2322 — Type '{} | undefined' not assignable to 'string | undefined'
Line 236: TS2322 — Type '{} | undefined' not assignable to 'string | undefined'
Line 237: TS2322 — Type '{} | undefined' not assignable to 'CourseLevel | undefined'
```

**Pattern:** ALL errors are `{}` type propagation, NOT the patterns from supabase-education.repository.ts.

---

## **Code Analysis**

### **Affected Code (Lines 220-240)**

```typescript
private static mapRowToDomain(row: CoursesTableRow): Course {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  return {
    courseId: row.course_id,
    tenantId: row.tenant_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    description: row.description ?? undefined,
    credits: row.credits,
    durationWeeks: row.duration_weeks ?? undefined,
    status: row.status as Course['status'],
    currentEnrollment: meta.current_enrollment ?? 0,          // Line 231 ❌
    maxStudents: meta.max_students ?? undefined,              // Line 232 ❌
    minStudents: meta.min_students ?? undefined,              // Line 233 ❌
    prerequisiteCourseIds: meta.prerequisite_course_ids ?? [], // Line 234 ❌
    startDate: meta.start_date ?? undefined,                  // Line 235 ❌
    endDate: meta.end_date ?? undefined,                      // Line 236 ❌
    level: meta.level ?? undefined,                           // Line 237 ❌
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? '',
    updatedBy: row.updated_by ?? undefined,
  };
}
```

---

## **Root Cause Analysis**

### **The `{}` Type Problem**

**Line 220:** `const meta = (row.metadata || {}) as Record<string, unknown>;`

**TypeScript inference:**
1. `row.metadata` is `Json | null` (from database types)
2. `row.metadata || {}` is `Json | {}` 
3. Cast to `Record<string, unknown>`
4. `meta.property` is typed as `unknown`
5. `unknown ?? fallback` is evaluated by TypeScript
6. TypeScript cannot determine the type of `unknown ?? T`
7. Falls back to `{}` (empty object type)

**This is a TypeScript type narrowing issue, NOT a database schema issue.**

---

## **Database Schema Investigation**

### **Tables in System**

**1. `public.courses` (migration: 20260810231500)**
```sql
CREATE TABLE IF NOT EXISTS public.courses (
  course_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL,
  duration_weeks INTEGER,
  status TEXT NOT NULL,
  metadata JSONB,  -- ← Generic JSONB field
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by UUID,
  updated_by UUID
);
```

**2. `public.edu_courses` (migration: 20260812060000 + 20260813000040)**
```sql
CREATE TABLE IF NOT EXISTS public.edu_courses (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  -- Added by 20260813000040:
  max_students INTEGER,
  current_enrollment INTEGER DEFAULT 0,
  prerequisite_course_codes TEXT[]
);
```

---

### **Repository Uses: `courses` table**

**Evidence:**
- Line 19: `type CoursesTableRow = Database['public']['Tables']['courses']['Row'];`
- Line 55: `.from('courses')`
- Line 77: `.from('courses')`

**Database types confirm:**
```typescript
courses: {
  Row: {
    course_code: string
    course_id: string
    course_name: string
    credits: number
    metadata: Json | null  // ← Generic, no structure
    // ... other fields
  }
}
```

---

## **Schema Drift Analysis**

### **What Repository Expects**

Repository code (lines 34-41) writes to `metadata`:

```typescript
const metadata = {
  current_enrollment: course.currentEnrollment ?? 0,
  max_students: course.maxStudents ?? null,
  min_students: course.minStudents ?? null,
  prerequisite_course_ids: course.prerequisiteCourseIds ?? [],
  start_date: course.startDate ?? null,
  end_date: course.endDate ?? null,
  level: course.level ?? null,
};
```

Then reads from `metadata` (lines 231-237).

---

### **What Database Has**

**`courses` table:** Generic `metadata JSONB` field (no structure defined)

**`edu_courses` table:** Actual columns for these fields

---

### **The Mismatch**

Repository stores structured data in `metadata` JSONB, then tries to read it back. But TypeScript sees `Json | null` (generic), so property access returns `unknown`, leading to `{}` type.

---

## **Domain Type Requirements**

From `course-types.ts`:

```typescript
export interface Course {
  currentEnrollment?: number;
  maxStudents?: number;
  minStudents?: number;
  prerequisiteCourseIds?: string[];
  startDate?: string;
  endDate?: string;
  level?: CourseLevel;
  // ...
}
```

All optional fields, but with specific types.

---

## **Root Cause Classification**

```
course.repository.ts — 7 diagnostics
        ↓
Root Cause: JSONB metadata type narrowing
        ↓
Type: Record<string, unknown>
  → Property access returns: unknown
  → unknown ?? T inferred as: {}
        ↓
Solution category: Type assertion with structure interface
```

**NOT the same as:**
- ✗ Database type parameter (Cluster from supabase-education)
- ✗ null/undefined boundary (Cluster A)
- ✗ Status enum with CHECK (Cluster B)
- ✗ RPC Json contract (Cluster C)

**This is:** JSONB property access type narrowing issue

---

## **Fix Approaches**

### **Option 1: Type Assertion with Interface (Minimal Change)**

**Define metadata structure:**
```typescript
interface CourseMetadata {
  current_enrollment?: number;
  max_students?: number;
  min_students?: number;
  prerequisite_course_ids?: string[];
  start_date?: string;
  end_date?: string;
  level?: string;
}

private static mapRowToDomain(row: CoursesTableRow): Course {
  const meta = (row.metadata || {}) as CourseMetadata;
  // Now meta.property is typed correctly
  return {
    // ...
    currentEnrollment: meta.current_enrollment ?? 0,
    maxStudents: meta.max_students,
    // ...
  };
}
```

**Pros:**
- Minimal code change
- Documents metadata structure
- Type-safe property access

**Cons:**
- Still uses generic JSONB (runtime structure not enforced)
- Type assertion relies on code consistency

---

### **Option 2: Switch to `edu_courses` Table (Structural Fix)**

**Rationale:**
- `edu_courses` has actual columns for this data
- Migration 20260813000040 already added these columns
- Better type safety (database-enforced structure)

**Changes required:**
1. Update repository to use `edu_courses` table
2. Update type references
3. Map field names (e.g., `title` vs `course_name`)
4. Update all queries

**Pros:**
- ✅ Proper database schema (columns not JSONB)
- ✅ Database enforces structure
- ✅ Better type generation

**Cons:**
- ❌ Larger refactor (multiple files affected)
- ❌ Need to verify no other code uses `courses` table
- ❌ Field name differences need mapping

---

### **Option 3: Hybrid (Query Actual Columns, Keep Table)**

**If migrations exist that added columns to `courses`:**

Check if `courses` table was updated with actual columns (not found in migrations searched).

**Current evidence:** `courses` table only has `metadata JSONB`.

---

## **Ownership & Confidence**

**Owner:** Education Platform ✅  
**Confidence:** HIGH

**Rationale:**
- File in `src/platform/education/course/`
- Education domain responsibility
- Not shared platform or foreign dependency

---

## **Recommended Fix**

### **Approach: Option 1 (Type Assertion with Interface)**

**Priority:** HIGH  
**Complexity:** LOW  
**Safety:** MEDIUM (relies on code consistency)

**Justification:**
1. Minimal code change (single file)
2. Clear fix for immediate type errors
3. Documents metadata contract
4. Does not require schema changes
5. Does not affect other files

**Implementation:**
1. Define `CourseMetadata` interface
2. Cast `row.metadata` to interface
3. Property access now properly typed
4. Verify with compiler

**Expected impact:**
- course.repository.ts: 7 → 0
- Education: 127 → 120 (-7)

---

### **Future Consideration: Option 2 (Table Migration)**

**After immediate fix:**
- Investigate if other code uses `courses` table
- Assess migration path to `edu_courses` (proper schema)
- Create ADR for table consolidation
- Plan phased migration

**Reason to defer:**
- Table choice may affect other features
- Requires broader investigation
- Immediate TypeScript hardening can proceed with Option 1

---

## **Comparison to Previous Repository Patterns**

| Pattern | supabase-education.repository | course.repository |
|---------|------------------------------|-------------------|
| **Root cause** | Database type parameter | JSONB type narrowing |
| **Error type** | TS2339, TS18047 | TS2322, TS2740 (all `{}`) |
| **Fix approach** | Add `Database` type param | Type assertion with interface |
| **Evidence needed** | Database schema | Metadata structure contract |
| **Complexity** | LOW (1 line change) | LOW (interface + cast) |

**Key difference:** Different root causes require different fixes. Pattern similarity does NOT mean cause similarity.

---

## **Investigation Summary**

```
course.repository.ts
7 diagnostics
      ↓
Root Cause: JSONB metadata type narrowing
  Record<string, unknown> → property access → unknown → {}
      ↓
Fix: Type assertion with CourseMetadata interface
      ↓
Expected: 7 → 0

Ownership: Education Platform
Confidence: HIGH
Ready to fix: YES (Option 1)
```

---

**Checkpoint:** `57bbbcf0`  
**Investigation:** ✅ **COMPLETE**  
**Root cause:** Type narrowing (NOT same as previous repository patterns)  
**Recommendation:** Define metadata interface + type assertion  
**Next:** Apply fix or get user direction
