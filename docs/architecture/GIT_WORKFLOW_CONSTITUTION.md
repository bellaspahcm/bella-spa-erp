---
date: 2026-09-13
status: ACTIVE
scope: Git Workflow & Branch Management
enforcement: MANDATORY
---

# GIT WORKFLOW CONSTITUTION

**Purpose:** Prevent branch contamination, ensure clean merge paths, enforce repository-level completion discipline.

**Enforcement:** CI gates + AI agent constraints + human review

---

## 🔴 6 CORE PRINCIPLES (NON-NEGOTIABLE)

### Principle 1: One Branch = One Scope

**Rule:**
```
Branch name MUST reflect ownership and scope.
NO multi-track branches.
```

**Correct:**
```
platform/identity-party-cutover
platform/finance-f3-ar
platform/org-unit-contract
product/english-center-e1
product/bella-land-p5
```

**FORBIDDEN:**
```
bella-land (contains English Center + Finance + Identity)
feature/multi-phase (contains R3 + E1 + F3)
dev (contains everything)
```

**Enforcement:**
- Branch name pattern validation (CI)
- Scope declaration required in PR template
- Multi-scope detection → PR blocked

---

### Principle 2: Short-Lived Branches

**Rule:**
```
Branch lifetime: hours to days, NOT weeks.
One scope done + tests pass → open PR immediately.
```

**Target Timelines:**
```
Bug fix:           < 2 hours
Small feature:     < 1 day
Medium feature:    < 3 days
Large feature:     < 1 week (via incremental PRs)
```

**FORBIDDEN:**
```
Branch alive > 7 days without PR
Branch alive > 14 days total
Accumulating multiple phases on same branch
```

**Enforcement:**
- Automated stale branch detection (daily)
- Alert if branch > 7 days, no PR
- Force cleanup if branch > 14 days

---

### Principle 3: Merge Path Required at Start

**Rule:**
```
Every work item MUST declare merge path before first commit.
```

**Required Declaration:**
```yaml
source_branch: platform/org-unit-contract
target: main
dependencies:
  - platform/identity-party-cutover (merged)
required_ci_gates:
  - Healthcare Constitution
  - Architecture Guard
  - Migration Gates
  - Gitleaks
expected_pr: #XX or "will create"
merge_strategy: squash | merge-commit | rebase
```

**FORBIDDEN:**
```
"Commit first, figure out merge later"
"Let's see if it works before planning PR"
"We'll organize branches at the end"
```

**Enforcement:**
- AI agent MUST output merge plan before implementation
- PR template requires merge path declaration
- CI validates dependency state

---

### Principle 4: No Multi-Track Commits Without Coupling

**Rule:**
```
IF work items are NOT dependency-coupled:
  → separate branches
  → separate PRs
  → independent merge paths

IF dependency-coupled:
  → use temporary integration branch for validation
  → merge dependencies to main FIRST
  → then merge dependent work
  → NEVER merge integration branch as-is
```

**Correct (Independent):**
```
platform/org-unit → PR #1 → main
product/e1        → PR #2 → main (after #1)
```

**Correct (Coupled):**
```
platform/org-unit                    → PR #1 → main
product/e1                           → PR #2 → main
integration/e1-validation (temporary) → verify only, then delete
```

**FORBIDDEN:**
```
bella-land branch containing:
  - English Center E1
  - Finance F3
  - Identity R3
  - Bella Land P5
→ all merged together as 300-file PR
```

**Enforcement:**
- PR size limit: 50 files (warning), 100 files (block)
- Multi-scope detection via file path analysis
- Integration branches tagged `integration/*` auto-delete after 7 days

---

### Principle 5: PR = Unit of Completion

**Rule:**
```
"DONE" at repository level ONLY when:

✅ Code done
✅ Build PASS
✅ Tests PASS
✅ Architecture guard PASS
✅ CI PASS
✅ PR opened
✅ PR merged to main
✅ Main smoke PASS
```

**Status Discipline:**
```
Code done, tests pass, NOT merged → "IMPLEMENTED, NOT IN MAIN"
PR opened, CI pending             → "PR OPEN, PENDING MERGE"
PR merged, smoke pass             → "COMPLETE"
```

**FORBIDDEN Status:**
```
❌ "E1 COMPLETE" when only in feature branch
❌ "DONE" when PR open but not merged
❌ "FINISHED" when code passes local tests only
```

**Enforcement:**
- AI agent MUST distinguish "SEALED" vs "COMPLETE"
- Status markers in commit messages
- Post-merge hook runs smoke tests

---

### Principle 6: Automated Branch Reconciliation

**Rule:**
```
Daily automated check:
  git branch -r --no-merged origin/main

Classify branches:
  ACTIVE:      work in progress, < 7 days
  PR_OPEN:     has open PR
  SUPERSEDED:  work merged via different path
  MERGED:      --merged main
  STALE:       > 7 days, no PR, no recent commits
```

**Automated Actions:**
```
STALE      → alert owner, request cleanup plan
SUPERSEDED → auto-close, comment with merged commit
MERGED     → auto-delete branch
PR_OPEN    → track CI status
```

**Enforcement:**
- Daily cron job (GitHub Actions)
- Report sent to team
- Auto-cleanup for MERGED/SUPERSEDED

---

## 🎯 CANONICAL WORKFLOW

### Standard Path (90% of Work)

```
1. Intent declared
   ↓
2. Create clean branch (scoped name)
   ↓
3. Declare merge path
   ↓
4. Implement
   ↓
5. Test (local)
   ↓
6. Open PR immediately
   ↓
7. CI checks
   ↓
8. Review (if required)
   ↓
9. Merge to main
   ↓
10. Smoke test main
    ↓
11. Delete branch (auto)
    ↓
12. Status: COMPLETE
```

**Timeline:** hours to days, not weeks

---

### Anti-Pattern (FORBIDDEN)

```
❌ Intent 1 → commit to branch
❌ Intent 2 → same branch
❌ Intent 3 → same branch
❌ ...
❌ 300 commits accumulated
❌ Try to merge everything at once
❌ CI fails due to mixed content
❌ Branch contamination
❌ Manual cleanup nightmare
```

---

## 🤖 AI AGENT CONSTRAINTS

### Mandatory Behavior

When AI agent receives task:

**Step 1: Merge Path Declaration**
```
BEFORE first commit, output:
  - Branch name (scoped)
  - Target (main)
  - Dependencies (list)
  - Expected PR number
  - Merge strategy
```

**Step 2: Single-Scope Enforcement**
```
IF task involves multiple unrelated areas:
  → create separate branches
  → create separate PRs
  → merge sequentially

NEVER mix unrelated work on same branch
```

**Step 3: Status Discipline**
```
ONLY declare "COMPLETE" when:
  ✅ PR merged to main
  ✅ Smoke test pass

Otherwise use:
  "IMPLEMENTED, NOT IN MAIN"
  "PR OPEN, PENDING MERGE"
  "SEALED (awaiting merge)"
```

**Step 4: Immediate PR**
```
When implementation + tests pass:
  → open PR immediately
  → do NOT continue with unrelated work
  → do NOT wait for manual instruction
```

---

### Agent Prompt Template

```
You are implementing [SCOPE].

Required before coding:
1. Branch name: [prefix]/[scope]
2. Target: main
3. Dependencies: [list or "none"]
4. Expected PR: [number or "will create"]
5. Merge strategy: squash

Constraints:
- This branch is for [SCOPE] ONLY
- No unrelated commits allowed
- Open PR when tests pass
- Status "COMPLETE" only after merge to main

Completion criteria:
✅ Code done
✅ Tests pass
✅ PR opened
✅ CI pass
✅ PR merged
✅ Main smoke pass
→ THEN declare "COMPLETE"
```

---

## 🛡️ 3 CRITICAL AUTOMATIONS

### A. Branch Protection (GitHub Settings)

**Required Rules:**
```yaml
branches:
  main:
    protection:
      required_pull_request_reviews: 0  # or 1 if team review
      required_status_checks:
        strict: true
        contexts:
          - Healthcare Constitution
          - Architecture Guard
          - Migration Gates
          - Gitleaks
          - Build
          - Tests
      enforce_admins: false  # allow override for emergencies
      require_linear_history: false
      allow_force_pushes: false
      allow_deletions: false
      required_conversation_resolution: true
```

**Effect:** No direct push to main, CI must pass

---

### B. Auto-Cleanup After Merge

**GitHub Actions Workflow:**
```yaml
name: Auto-Cleanup Merged Branches
on:
  pull_request:
    types: [closed]
jobs:
  cleanup:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - name: Delete merged branch
        run: |
          gh api \
            --method DELETE \
            /repos/${{ github.repository }}/git/refs/heads/${{ github.event.pull_request.head.ref }}
```

**Effect:** Branch auto-deleted after merge

---

### C. Canonical Work Detector

**Daily Cron Job:**
```yaml
name: Branch Reconciliation
on:
  schedule:
    - cron: '0 0 * * *'  # daily at midnight
jobs:
  reconcile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Detect stale/superseded branches
        run: |
          node scripts/branch-reconciliation.js
          
      - name: Create report
        run: |
          cat BRANCH_RECONCILIATION_REPORT.md
          
      - name: Alert on stale branches
        if: contains(steps.reconcile.outputs.stale, 'STALE')
        run: |
          gh issue create \
            --title "⚠️ Stale branches detected" \
            --body "$(cat BRANCH_RECONCILIATION_REPORT.md)"
```

**Effect:** Daily detection of stale/superseded branches

---

## 📋 PR TEMPLATE (MANDATORY)

```markdown
## Scope Declaration

**Branch:** `[prefix]/[scope-name]`
**Target:** `main`
**Type:** [ ] Platform [ ] Product [ ] Fix [ ] Docs

## Merge Path

**Dependencies:**
- [ ] None
- [ ] PR #XX (merged)
- [ ] Branch YYY (pending)

**Scope Boundary:**
What this PR contains:
- 

What this PR does NOT contain:
- 

**File Count:** XX files
⚠️ If > 50 files, explain why scope is large.

## Verification Checklist

- [ ] Build PASS
- [ ] Tests PASS (unit + integration)
- [ ] Architecture guard PASS
- [ ] Migration reversibility verified (if applicable)
- [ ] No multi-scope contamination
- [ ] Branch lifetime < 7 days

## Post-Merge Plan

- [ ] Smoke test on main
- [ ] Delete branch (auto)
- [ ] Update status → COMPLETE
```

---

## 🚨 VIOLATION HANDLING

### Stale Branch (> 7 days, no PR)

**Automated Alert:**
```
⚠️ STALE BRANCH DETECTED

Branch: feature/xyz
Age: 10 days
Last commit: 2026-09-03
Status: No PR open

Action required:
1. Open PR immediately, OR
2. Provide cleanup plan, OR
3. Branch will be archived in 3 days
```

---

### Multi-Scope PR (> 100 files)

**CI Block:**
```
❌ PR BLOCKED: Multi-scope detected

Files changed: 245
Scopes detected:
  - platform/identity (45 files)
  - product/english-center (67 files)
  - product/bella-land (133 files)

Action required:
1. Split into separate PRs by scope
2. Merge dependencies first
3. Then merge dependent work

Override: requires architect approval
```

---

### Branch Contamination

**Detection:**
```bash
# Check if PR contains unrelated work
scripts/detect-multi-scope.sh PR_NUMBER

# Output:
CONTAMINATED: PR contains multiple unrelated scopes
  - R3 Identity (12 files)
  - E1 Chain Management (8 files)
  - F3 Finance (5 files)
```

**Action:** Require clean PR creation

---

## 📊 METRICS & MONITORING

### Weekly Report

**Branch Health:**
```
Active branches:        12
PRs open:               8
Stale branches:         2  ⚠️
Superseded branches:    1
Avg branch lifetime:    2.3 days  ✅
Avg PR size:            23 files  ✅
Multi-scope PRs:        0         ✅
```

**Compliance:**
```
Clean merges:           95%  ✅
Branch contamination:   5%   ⚠️
PR-without-merge:       0%   ✅
Stale branch cleanup:   100% ✅
```

---

## 🎯 SUCCESS CRITERIA

### Repository Health Indicators

**Healthy:**
```
✅ Avg branch lifetime < 5 days
✅ Stale branches < 5%
✅ Multi-scope PRs < 10%
✅ PR merge rate > 90%
✅ Branch contamination < 5%
```

**Unhealthy:**
```
❌ Avg branch lifetime > 10 days
❌ Stale branches > 20%
❌ Multi-scope PRs > 30%
❌ PR merge rate < 70%
❌ Branch contamination > 20%
```

---

## 🔄 CONTINUOUS IMPROVEMENT

### Monthly Review

1. Analyze branch patterns
2. Identify contamination sources
3. Refine scope naming conventions
4. Update automation thresholds
5. Team retrospective

---

## 📖 RELATED DOCUMENTS

- `ARCHITECTURE_GATE_RESULT.md` - Feature gate verification
- `BRANCH_RECONCILIATION_REPORT.md` - Branch status report
- `E1_MISSION_COMPLETE.md` - Example completion evidence
- `CI_FAILURE_ANALYSIS.md` - Contamination case study

---

## ✅ CONSTITUTION RATIFICATION

**Effective Date:** 2026-09-13  
**Enforcement Level:** MANDATORY  
**Review Cycle:** Monthly  
**Violation Response:** Automated + human escalation

**Signed:**
- Architecture Team
- AI Agent System
- CI/CD Pipeline

---

**Status:** 🔒 **ACTIVE**  
**Next Review:** 2026-10-13

