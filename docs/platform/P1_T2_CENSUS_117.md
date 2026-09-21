# P1-T2 Education Census at 117 Diagnostics

**Checkpoint:** `24f1e3ea`  
**Date:** 2026-09-16  
**Baseline:** 117 diagnostics

## Ownership Classification

```text
Total                          117

Foreign/Legacy:
└─ Payroll-provider             49 🔒 DEFER

Shared Platform:
└─ Platform Host                12 🔒 DEFER
                               ───
Subtotal (Not Education)        61

Education-owned                 56 ✅ ACTION
```

## Education-owned Breakdown (56 diagnostics)

### By Cluster

```text
Contract implementations        15
Service null safety             ~13
Education-engine.service        ~11
App/API layer                   ~10
Other                           ~7
```

## Contract Implementations Detail (15 diagnostics)

### assessment.contract.impl.ts (3)
- Line 26: AssessmentType string literal → enum
- Line 37: CreateAssessmentResultDTO missing properties
- Line 47: GradeAssessmentResultDTO missing properties

### course.contract.impl.ts (3)
- Line 23, 39, 55: CourseStatus vs "inactive" comparison (3x)

### enrollment.contract.impl.ts (3)
- Line 12: EventBusService → EventBusPort type mismatch
- Line 28: unknown → OverrideRequest
- Line 40: string → EnrollmentStatus literal

### teacher-assignment.contract.impl.ts (6)
- Line 47: SupabaseClient missing Promise properties
- Line 49: undefined in SupabaseClient union
- Line 78: Property 'teacher_party_id' on never
- Line 100: Property 'course_id' on never
- Line 155: Insert object → never[]
- Line 206: Update object → never

## Root Cause Patterns

### Pattern A: Type Literals vs Enums (4)
- assessment: "quiz"|"midterm" → AssessmentType
- course: CourseStatus vs "inactive" (3x)

### Pattern B: DTO Contract Mismatch (2)
- assessment: CreateAssessmentResultDTO, GradeAssessmentResultDTO

### Pattern C: Port Interface Mismatch (1)
- enrollment: EventBusService vs EventBusPort

### Pattern D: Status Type Narrowing (1)
- enrollment: string → EnrollmentStatus literal

### Pattern E: SupabaseClient Type Issue (1)
- teacher-assignment: Promise wrapper missing

### Pattern F: Type Narrowing Failure → never (4)
- teacher-assignment: Row properties on never (4x)

## Next Actions

1. **Pattern A (Type literals):** Verify domain type imports, add missing imports or fix literal values
2. **Pattern B (DTO mismatch):** Check DTO definitions, add missing properties or fix mapping
3. **Pattern C (Port mismatch):** EventBusService should implement EventBusPort or fix signature
4. **Pattern D (Status narrowing):** Similar to repository status fixes - type assertion with evidence
5. **Pattern E (SupabaseClient):** Fix createClient() await or type annotation
6. **Pattern F (never type):** Investigate query type narrowing failure in teacher-assignment

## Verification Commands

```bash
# Count by file
npx tsc --project tsconfig.education.json --noEmit 2>&1 | \
  Select-String "contracts/.*\.contract\.impl\.ts" | \
  Group-Object { ($_ -split '\(')[0] }

# Verify ownership unchanged
npx tsc --project tsconfig.education.json --noEmit 2>&1 | \
  Select-String "payroll-provider.ts" | Measure-Object  # Must be 49

npx tsc --project tsconfig.education.json --noEmit 2>&1 | \
  Select-String "platform/host/" | Measure-Object       # Must be 12
```

## Status

- Repository DB mapping: 14 → 0 ✅ CLOSED
- Contract implementations: 15 (current focus)
- Remaining Education-owned: 41

**Next:** Fix Contract implementations by pattern with streamlined approach.
