# Autonomous Phase Execution Protocol

**Product:** Bella English Center  
**Mode:** Autonomous Phase Development  
**Effective:** After E2 sealed

---

## Execution Model

```text
PHASE SEALED
    ↓
AI reads roadmap + registry + contracts
    ↓
AI selects next valid phase
    ↓
PLAN (capability analysis, reuse detection)
    ↓
IMPLEMENT (service, API, UI, migration, tests)
    ↓
TEST (unit, integration, architecture)
    ↓
SELF-CORRECT (fix failures without asking)
    ↓
COMMIT + PR (single phase scope)
    ↓
CI (monitor, wait for green)
    ↓
MERGE (when policy allows)
    ↓
SMOKE (validate canonical main)
    ↓
SEAL (evidence complete)
    ↓
REPORT (concise status)
    ↓
NEXT PHASE (repeat)
```

---

## Phase Sequence

### English Center Roadmap

```text
✅ E2 — Enrollment Module
   (Học viên ghi danh)

⏳ E3 — Program / Course / Class Management
   (Quản lý chương trình / khóa học / lớp học)

⏳ E4 — Teacher & Academic Workforce
   (Giáo viên và nhân sự học thuật)

⏳ E5 — Timetable & Room Scheduling
   (Thời khóa biểu / phòng học / xếp lịch)

⏳ E6 — Attendance & Learning Operations
   (Điểm danh / vận hành buổi học / tiến độ)

⏳ E7 — Tuition & Billing
   (Học phí / công nợ, tích hợp Finance OS)

⏳ E8 — Parent / Student Engagement
   (Tương tác phụ huynh / học viên / feedback)

⏳ E9 — Chain Command Center
   (Trung tâm điều hành toàn chuỗi chi nhánh)

⏳ E10 — Full Product Reconciliation + RC
    (Đối soát toàn sản phẩm + Release Candidate)
```

---

## Autonomous Authority

### ✅ AI Can Autonomously:

1. **Analyze capability requirements**
   - Read Platform capabilities
   - Identify reusable Kernel services
   - Design product extension

2. **Implement phase**
   - Create service layer
   - Write repository
   - Build API routes
   - Develop UI pages
   - Write migrations
   - Create tests

3. **Self-correct errors**
   - Fix TypeScript errors
   - Fix failing tests
   - Resolve architecture violations
   - Fix Constitution compliance issues

4. **Manage git workflow**
   - Create phase branch
   - Commit changes
   - Create PR
   - Monitor CI
   - Merge when green
   - Run smoke tests
   - Seal phase

5. **Proceed to next phase**
   - Without asking permission
   - Based on roadmap sequence
   - One phase at a time

### ❌ AI Must Stop When:

1. **Business decision required**
   - Unclear product requirements
   - Multiple valid design choices
   - Feature scope ambiguity

2. **Architecture conflict**
   - Platform Kernel modification needed (requires ACR)
   - Cross-product dependency detected
   - Constitution violation cannot resolve

3. **High-risk operations**
   - Data migration with existing records
   - Breaking API changes
   - Production deployment

4. **External blockers**
   - Missing credentials
   - Environment unavailable
   - Third-party service down
   - Permission denied

5. **Evidence gap**
   - Cannot verify runtime behavior
   - CI perpetually failing
   - Smoke test cannot execute

---

## Branch Management Rules

### One Phase = One Branch

```text
E3 Phase:
    product/english-center/program-course-class-e3
    ↓
    PR #N
    ↓
    Merge + Auto-delete branch
    ↓
    E3 sealed

E4 Phase:
    product/english-center/teacher-workforce-e4
    ↓
    PR #N+1
    ↓
    Merge + Auto-delete branch
    ↓
    E4 sealed
```

### Never:

- ❌ Multiple phases in one branch
- ❌ Multiple open phase PRs
- ❌ Merge phase N+1 before phase N sealed
- ❌ Reuse old branches

---

## Report Format

### Concise Status (Default)

```text
E3 — Program / Course / Class Management
Implementation    ✅ DONE
Tests            42/42 ✅ PASS
CI               ✅ GREEN
Merged           ✅ DONE
Sealed           ✅ COMPLETE

Next: E4 — Teacher & Academic Workforce
```

### Expanded Report (On Request Only)

User asks: "E3 details?"

Then provide:
- Files changed
- Architecture decisions
- Platform services consumed
- Test coverage
- Evidence points

### Blocker Report (When Stopped)

```text
E5 — Timetable & Room Scheduling
Status:          ⏸️  BLOCKED

Blocker:         Business decision required
Issue:           Multiple scheduling algorithm options
Options:         [A] Time-based priority
                 [B] Teacher preference priority
                 [C] Room capacity optimization

Decision needed from Product Owner.
```

---

## Constitution Compliance (Auto-Enforced)

Every phase must:

✅ **Single Scope**
- English Center only
- No other product touch

✅ **Via Public Contracts**
- Use Platform services
- No Kernel bypass

✅ **No Kernel Modifications**
- Healthcare H1-H12: untouched
- Logistics E7.1-E7.3: untouched
- Education Kernel: consumption only

✅ **Additive Only**
- New product tables
- New product services
- No Platform table modifications

✅ **Code Quality**
- No `any` types
- TypeScript strict
- Tests included

---

## Self-Correction Protocol

### Type Errors

```text
TypeCheck fails
    ↓
AI reads errors
    ↓
AI fixes types
    ↓
AI commits fix
    ↓
AI pushes update
    ↓
CI re-runs
```

No user intervention unless error persists after 3 attempts.

### Test Failures

```text
Tests fail
    ↓
AI reads failure output
    ↓
AI analyzes root cause
    ↓
AI fixes code/test
    ↓
AI commits fix
    ↓
AI verifies tests pass
```

### Architecture Violations

```text
Architecture Guard fails
    ↓
AI reads violation
    ↓
If fixable (e.g., wrong import):
    AI fixes immediately
If not fixable (e.g., Kernel modification):
    AI reports blocker
```

---

## Merge Policy

### Auto-Merge When:

✅ All required CI checks GREEN  
✅ No conflicts  
✅ Constitution compliance verified  
✅ Architecture Guard PASS  
✅ Kernel Regression PASS  

### Wait For Approval When:

⏳ First phase after E2 (E3) - establish pattern  
⏳ Breaking changes detected  
⏳ Migration involves existing data  

### Never Auto-Merge When:

❌ CI red  
❌ Conflicts unresolved  
❌ Constitution violation  
❌ Kernel modified  

---

## Phase Seal Criteria

Phase sealed when:

1. ✅ PR merged to main
2. ✅ Branch auto-deleted
3. ✅ Smoke test PASS on canonical main
4. ✅ Evidence documented
5. ✅ No regressions detected

---

## Next Phase Selection

AI selects next phase by:

1. Read roadmap sequence
2. Verify previous phase sealed
3. Check for dependencies
4. Confirm no blockers
5. Create new branch from main
6. Begin implementation

---

## Example Autonomous Session

```text
[User] E2 sealed

[AI] ✅ E2 sealed verified
     Reading roadmap...
     Next: E3 — Program / Course / Class Management
     
     Creating branch: product/english-center/program-course-class-e3
     Analyzing Platform capabilities...
     
     [5 minutes later]
     
     E3 Implementation ✅
     - Service layer: 4 files
     - API routes: 6 endpoints
     - UI pages: 3 pages
     - Migration: 2 tables
     - Tests: 38/38 ✅
     
     Committing... ✅
     PR created: #86
     CI running...
     
     [10 minutes later]
     
     CI: ✅ ALL GREEN
     Merging...
     Smoke test: ✅ PASS
     
     E3 🔒 SEALED
     
     Next: E4 — Teacher & Academic Workforce
     Proceeding...
```

---

## Override Commands

If user needs to intervene:

- `"pause"` - Stop autonomous execution
- `"resume"` - Continue from current phase
- `"skip E5"` - Skip a phase (requires justification)
- `"details E3"` - Show expanded phase report
- `"rollback E4"` - Revert a phase (destructive)

---

**Status:** ✅ ACTIVE after E2 sealed  
**Mode:** Autonomous phase execution  
**Report:** Concise unless requested  
**Stop Conditions:** Business decision, architecture conflict, high-risk, external blocker
