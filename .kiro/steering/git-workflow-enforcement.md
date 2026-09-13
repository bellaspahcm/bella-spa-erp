---
inclusion: auto
name: Git Workflow Enforcement
description: Enforces Git Workflow Constitution for branch management, PR creation, and merge discipline
tags: [git, workflow, branch-management, pr, merge, constitution]
---

# GIT WORKFLOW ENFORCEMENT (AI AGENT CONSTRAINT)

**Status:** 🔒 **MANDATORY**  
**Reference:** `docs/architecture/GIT_WORKFLOW_CONSTITUTION.md`

This steering file constrains AI agent behavior to enforce the Git Workflow Constitution.

---

## 🔴 MANDATORY BEHAVIOR (ALWAYS ENFORCE)

### Before Starting Any Implementation Task

**STEP 1: Declare Merge Path**

Before writing ANY code, you MUST output:

```yaml
---
MERGE PATH DECLARATION
---

Branch Name: [prefix]/[scope-name]
  Examples:
    - platform/org-unit-hierarchy
    - product/english-center-e2-scheduling
    - fix/rls-policy-student-enrollment
    - docs/architecture-adr-001

Target: main

Dependencies:
  - [ ] None (independent work)
  - [ ] platform/[dep-name] (merged to main: YES/NO)
  - [ ] PR #XX (status: MERGED/OPEN/PENDING)

Scope Boundary:
  CONTAINS:
    - [list what this branch will contain]
  
  DOES NOT CONTAIN:
    - [list what will NOT be in this branch]

Expected File Count: [estimate]
Expected Lifetime: [hours/days]
Expected PR Number: [will create after implementation]

Merge Strategy: squash | merge-commit | rebase
```

**Validation:**
- Branch name MUST match pattern: `(platform|product|fix|docs|chore)/[scope]`
- Scope MUST be singular (ONE platform layer OR ONE product vertical OR ONE fix)
- NO multi-track branches allowed
- Dependencies MUST be explicitly listed

---

### During Implementation

**RULE 1: Single Scope Enforcement**

```
✅ ALLOWED:
  - platform/org-unit-contract
    → changes ONLY in src/platform/org-unit/

  - product/english-center-e2
    → changes ONLY in:
        src/products/bella-english-center/
        supabase/migrations/ (E2-related only)
        docs/products/bella-english-center/

❌ FORBIDDEN:
  - bella-land-mixed
    → changes in:
        src/products/bella-english-center/ ❌
        src/products/bella-land/ ❌
        src/platform/identity/ ❌
        src/platform/finance/ ❌
    
    VIOLATION: Multi-scope, multi-product contamination
```

**If Task Requires Multiple Scopes:**

```
Option 1: Sequential Dependent PRs
  PR #1: platform/dependency → main
  PR #2: product/feature (depends on #1) → main

Option 2: Parallel Independent PRs
  PR #1: product/feature-a → main
  PR #2: product/feature-b → main
  (no dependency between them)

NEVER: Create single branch with mixed scope
```

---

**RULE 2: Immediate PR Creation**

When implementation + tests PASS:

```
✅ DO THIS:
  1. Verify build PASS
  2. Verify tests PASS
  3. Verify architecture guard PASS
  4. Create PR IMMEDIATELY
  5. Push branch
  6. Open PR to main
  7. Link to PR in output
  8. Status: "IMPLEMENTED, PR #XX OPEN"

❌ DO NOT:
  1. Wait for human instruction to create PR
  2. Continue with unrelated work on same branch
  3. Accumulate multiple features
  4. Declare "COMPLETE" before PR is merged
```

---

**RULE 3: No Branch Reuse**

```
✅ CORRECT:
  Task A → branch-a → PR #1 → merge → delete branch-a
  Task B → branch-b → PR #2 → merge → delete branch-b

❌ FORBIDDEN:
  Task A → branch-x → commit
  Task B → branch-x → commit (REUSE)
  Task C → branch-x → commit (REUSE)
  ...
  PR #1 with A+B+C mixed → CONTAMINATION
```

**Exception:**
- Same task, iterative refinement → same branch OK
- Different task → NEW branch REQUIRED

---

### Status Discipline

**Use EXACT terminology:**

```
Status Levels:

1. "IMPLEMENTED, NOT IN MAIN"
   - Code written
   - Tests pass locally
   - Build pass
   - NOT yet in PR OR PR not merged

2. "PR #XX OPEN, PENDING MERGE"
   - PR created
   - CI running or complete
   - Awaiting review/approval
   - NOT yet merged to main

3. "PR #XX MERGED TO MAIN"
   - PR merged
   - Code now in main branch
   - Smoke test pending

4. "COMPLETE"
   - PR merged to main
   - Smoke test on main PASS
   - No issues detected
   - Feature fully integrated
```

**FORBIDDEN Status Claims:**

```
❌ "E1 COMPLETE" when only in feature branch
❌ "DONE" when PR is open but not merged
❌ "FINISHED" when tests pass but no PR exists
❌ "SEALED + COMPLETE" when only sealed but not in main
```

**Distinguish Product-Level vs Repository-Level:**

```
Product Evidence Level: "SEALED"
  - All verification gates pass
  - Evidence documented
  - Canonical implementation verified
  - BUT: may not be in main yet

Repository Integration Level: "COMPLETE"
  - PR merged to main
  - Smoke test pass
  - Code in production branch
  - Available to all developers
```

---

### PR Creation Protocol

When you create a PR, you MUST:

```
1. Verify PR checklist complete:
   ✅ Build PASS
   ✅ Tests PASS
   ✅ Architecture guard PASS
   ✅ Lint PASS
   ✅ Type check PASS

2. Fill PR template completely:
   - Scope declaration
   - Dependencies list
   - Verification checklist
   - Testing evidence

3. Add appropriate labels:
   - platform-layer | product-vertical
   - english-center | bella-land
   - migration-included | no-migration

4. Link related issues/PRs

5. Output in chat:
   ✅ PR #XX created: [title]
   📋 URL: [github-url]
   📊 Status: CI pending
   🎯 Next: Await CI results
```

---

## 🚫 FORBIDDEN PATTERNS

### Pattern 1: Multi-Track Branch

```
❌ NEVER DO THIS:

bella-land branch:
  commit: Add English Center E1
  commit: Add Finance F3
  commit: Add Identity R3
  commit: Add Bella Land P5
  commit: Fix E1 bug
  commit: Update F3 migration
  ...
  → 300 commits, 140 files
  → PR #74 fails CI due to contamination
```

**Why Forbidden:**
- Mixed scope → CI failures from unrelated content
- Merge conflicts exponentially increase
- Impossible to revert one feature without affecting others
- Violates Git Workflow Constitution Principle 1

---

### Pattern 2: Premature "COMPLETE" Declaration

```
❌ NEVER DO THIS:

AI: "E1 Chain Management COMPLETE ✅"
Reality:
  - Code in feature branch only
  - No PR to main
  - Not merged
  - Not in main branch

Status: FALSELY MARKED COMPLETE
```

**Why Forbidden:**
- Misleads about repository state
- Creates tracking gaps
- Work may be lost if branch is deleted
- Violates completion discipline

---

### Pattern 3: Branch Hoarding

```
❌ NEVER DO THIS:

Day 1: Create feature-x branch
Day 2: Implement feature
Day 3: Tests pass
Day 4-7: Continue adding features
Day 8: Realize branch is now 300 commits
Day 9: Try to merge → conflicts everywhere
```

**Why Forbidden:**
- Increases merge conflict risk
- Delays integration
- Hard to review large PRs
- Violates Principle 2 (short-lived branches)

---

## ✅ CORRECT WORKFLOWS

### Workflow A: Independent Feature

```
1. User: "Implement E2 Class Scheduling"

2. AI Output:
   ---
   MERGE PATH DECLARATION
   ---
   Branch: product/english-center-e2-scheduling
   Target: main
   Dependencies: None
   Scope: E2 Class Scheduling ONLY
   Expected: 15 files, 2 days
   ---

3. AI: Create branch
   git checkout -b product/english-center-e2-scheduling

4. AI: Implement feature
   - Write code
   - Write tests
   - Verify build
   - Verify architecture guard

5. AI: Tests pass ✅

6. AI: Create PR IMMEDIATELY
   gh pr create --title "E2: Class Scheduling" --body "[filled template]"

7. AI Output:
   ✅ IMPLEMENTED, PR #75 OPEN
   📋 https://github.com/org/repo/pull/75
   🎯 Awaiting CI results
   
   Status: PENDING MERGE (not COMPLETE)

8. CI passes → Merge

9. AI Output:
   ✅ PR #75 MERGED TO MAIN
   🎯 Running smoke test...

10. Smoke test pass

11. AI Output:
    ✅ E2 Class Scheduling COMPLETE
    📊 Status: REPOSITORY INTEGRATED
```

---

### Workflow B: Dependent Feature Chain

```
1. User: "Implement E2 (depends on org-unit hierarchy)"

2. AI Output:
   ---
   DEPENDENCY DETECTED
   ---
   
   Org-unit hierarchy not in main.
   
   Merge Plan:
     PR #1: platform/org-unit-hierarchy → main
     PR #2: product/english-center-e2 → main (after #1)
   
   Starting with PR #1...

3. AI: Implement org-unit first
   Branch: platform/org-unit-hierarchy
   [implement, test, PR]

4. AI: PR #71 created for org-unit

5. [PR #71 CI → merge]

6. AI: Org-unit merged to main ✅

7. AI: Now implement E2
   Branch: product/english-center-e2
   Dependencies: platform/org-unit-hierarchy (MERGED ✅)
   [implement, test, PR]

8. AI: PR #72 created for E2

9. [PR #72 CI → merge]

10. AI: E2 merged to main ✅
    
    Status:
      Org-Unit: COMPLETE
      E2: COMPLETE
```

---

### Workflow C: Bug Fix

```
1. User: "Fix RLS policy for student enrollment"

2. AI Output:
   ---
   MERGE PATH DECLARATION
   ---
   Branch: fix/rls-policy-student-enrollment
   Target: main
   Dependencies: None
   Scope: RLS policy fix ONLY
   Expected: 2 files, 2 hours
   ---

3. AI: Create branch, fix bug, test

4. AI: Tests pass → Create PR immediately
   PR #76: Fix RLS policy for student enrollment

5. [Fast track: CI → merge within hours]

6. AI: Fix merged to main and smoke tested ✅
   Status: COMPLETE
```

---

## 🔍 SELF-CHECK QUESTIONS (BEFORE DECLARING COMPLETE)

Before declaring "COMPLETE", AI agent MUST verify:

```
1. Is code in a feature branch or in main?
   If feature branch only → NOT COMPLETE

2. Is PR created?
   If no PR → NOT COMPLETE

3. Is PR merged to main?
   If PR open but not merged → NOT COMPLETE

4. Is smoke test on main passed?
   If not tested on main → NOT COMPLETE

5. Can other developers access this code?
   If only in feature branch → NOT COMPLETE

All YES → "COMPLETE" ✅
Any NO → Use appropriate status (e.g., "PR #XX PENDING MERGE")
```

---

## 🛠️ COMMANDS TO USE

### Check Branch Status

```bash
# List all branches
git branch -a

# Check if branch merged to main
git branch -r --merged origin/main | grep branch-name

# Check commits not in main
git log origin/branch-name --not origin/main --oneline

# Check file diff
git diff origin/main...origin/branch-name --name-only
```

### Branch Reconciliation

```bash
# Run reconciliation report
npm run branch:reconcile

# Manual branch cleanup
git branch -r --merged origin/main  # find merged branches
gh pr list --head branch-name       # check if PR exists
git push origin --delete branch-name  # delete remote branch
```

### PR Creation

```bash
# Create PR with template
gh pr create \
  --title "E2: Class Scheduling" \
  --body-file .github/PULL_REQUEST_TEMPLATE.md \
  --label "product-vertical,english-center"

# Check PR status
gh pr view 75

# Check CI status
gh pr checks 75
```

---

## 📊 METRICS TO TRACK

After each task completion, output:

```
---
TASK COMPLETION METRICS
---

Branch Name: product/english-center-e2
Branch Lifetime: 1.5 days ✅ (< 7 days)
Files Changed: 18 ✅ (< 50)
Commits: 12
Scope: Single (Product E2) ✅
Dependencies: 1 (org-unit, merged ✅)

PR: #72
PR Status: MERGED ✅
CI Status: PASS ✅
Smoke Test: PASS ✅

Workflow Compliance: 100% ✅
  ✅ Merge path declared before coding
  ✅ Single scope maintained
  ✅ PR created immediately after tests pass
  ✅ Status discipline followed
  ✅ Branch deleted after merge

Final Status: COMPLETE ✅
```

---

## 🚨 VIOLATION DETECTION

If you detect any of these during execution, STOP and ALERT:

```
❌ VIOLATION 1: Multi-scope branch detected
   Branch contains changes in:
     - src/products/english-center/
     - src/products/bella-land/
   
   ACTION: Split into separate branches

❌ VIOLATION 2: Branch alive > 7 days
   Branch: feature-x
   Age: 10 days
   
   ACTION: Create PR immediately or close branch

❌ VIOLATION 3: No PR after implementation
   Code complete: 2 days ago
   Tests passing: YES
   PR created: NO
   
   ACTION: Create PR now

❌ VIOLATION 4: Premature COMPLETE status
   Declared: "E2 COMPLETE"
   PR status: Open, not merged
   
   ACTION: Correct status to "PR #XX PENDING MERGE"
```

---

## 🎯 SUCCESS CRITERIA

AI agent follows Git Workflow Constitution successfully when:

```
✅ Every task starts with merge path declaration
✅ Every branch has single, clear scope
✅ Every implementation → immediate PR
✅ Every status report is accurate
✅ No multi-scope branches created
✅ No branch lives > 7 days without PR
✅ "COMPLETE" only declared after main merge + smoke
✅ Branch reconciliation report shows healthy metrics
```

---

## 📖 REFERENCES

- **Primary:** `docs/architecture/GIT_WORKFLOW_CONSTITUTION.md`
- **Script:** `scripts/branch-reconciliation.js`
- **Template:** `.github/PULL_REQUEST_TEMPLATE.md`
- **Automation:** `.github/workflows/branch-protection.yml`

---

**🔒 ENFORCEMENT LEVEL:** MANDATORY  
**📅 ACTIVE SINCE:** 2026-09-13  
**👤 APPLIES TO:** All AI agents (Kiro, custom agents, sub-agents)

