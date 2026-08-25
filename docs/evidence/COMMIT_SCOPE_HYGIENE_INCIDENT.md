# Commit Scope Hygiene Incident Report

**Date:** 2026-08-23  
**Commit:** `e67c0fcc`  
**Severity:** 🟡 LOW (no functional impact, governance learning)  
**Status:** DOCUMENTED & MITIGATED

---

## Incident Summary

**What Happened:**
- Commit `e67c0fcc` intended for "Bella Dental Phase 1 (2/5 documents)"
- Used `git add -A` which included 66 files of pre-existing workspace cleanup
- Result: Mixed Dental Phase 1 (3 files) with organizational cleanup (65 files)

**Architecture Guard Status:**
- ✅ **PASSED** - No frozen Kernel files modified
- ✅ E7.1/E7.2/E7.3 remain FROZEN
- ✅ Healthcare Kernel H1-H12 remain FROZEN

**Commit Scope Status:**
- ⚠️ **MIXED SCOPE** - Dental + unrelated cleanup
- 68 files changed, 2791 insertions, 1 deletion

---

## Root Cause Analysis

### Why Did This Happen?

**Command Used:**
```bash
git add -A  # Stages ALL changes in working tree
git commit -m "..."
```

**Pre-existing Changes:**
- 54 operational docs moved to `docs/archive/operational/`
- 3 new system-level docs (`BELLA_SYSTEM_INDEX.md`, etc.)
- 3 line-ending fixes in constitution files
- **All legitimate, but unrelated to Dental Phase 1**

**Why It Passed Architecture Guard:**
- Architecture Guard checks: **"Did you modify frozen Kernel?"**
- Answer: **NO** ✅
- Architecture Guard **does NOT check**: **"Is this commit single-purpose?"**

---

## Impact Assessment

### Technical Impact: ✅ NONE

- ✅ No functional bugs introduced
- ✅ No Kernel violations
- ✅ No breaking changes
- ✅ All tests passing
- ✅ Architecture integrity preserved

### Process Impact: 🟡 LEARNING OPPORTUNITY

**What We Learned:**
1. **Architecture Guard protects architecture, not commit hygiene**
2. **Mixed-scope commits make git history harder to navigate**
3. **Evidence-based development requires evidence-per-commit**

**Bella's Governance Philosophy:**
> "Architecture Guard proves **what you didn't break**.  
> Commit Scope Guard proves **what you intended to change**."

---

## What Should Have Happened

### Ideal Flow:

**Commit 1: Workspace Cleanup** (54 files)
```bash
git add BELLA_SYSTEM_INDEX.md docs/CURRENT_STATE.md docs/DOCUMENT_REGISTRY.md
git add docs/archive/operational/
git commit -m "chore: Organize workspace - move operational docs to archive"
```

**Commit 2: Dental Phase 1** (3 files)
```bash
git add docs/products/dental/PRODUCT_MANIFEST.md
git add docs/products/dental/OWNERSHIP_MAP.md
git add docs/evidence/STEP_2_HEALTHCARE_VERTICAL_ROADMAP.md
git commit -m "docs: Step ② Phase 1 - Bella Dental Product Manifest & Ownership Map"
```

**Result:** Clean git history, clear change attribution

---

## Mitigation Applied

### Immediate Actions Taken:

1. ✅ **Document incident** (this file)
2. ✅ **Accept commit as-is** (no history rewrite on main)
3. ✅ **Update process** for next commits

### Going Forward:

**New Commit Protocol:**
```bash
# ❌ AVOID
git add -A

# ✅ PREFER
git add <specific-file-1>
git add <specific-file-2>
git add <specific-directory>/

# OR use interactive staging
git add -p
```

**Commit Message Template:**
```
<type>: <scope> - <subject>

<body>

Files changed:
- file1.md (purpose)
- file2.md (purpose)

Architecture Guard: PASS
Commit Scope: SINGLE
```

---

## Governance Evolution

### Current State:

| Layer | Protection | Status |
|-------|-----------|--------|
| **Architecture Guard** | Frozen Kernel integrity | ✅ ACTIVE |
| **Git Pre-Commit Hook** | Blocks Kernel modifications | ✅ ACTIVE |
| **CI Architecture Gate** | Validates Kernel regression | ✅ ACTIVE |
| **Commit Scope Guard** | Single-purpose commits | 🟡 MANUAL |

### Future Enhancement:

**Commit Scope Guard (Pre-Commit Hook v2):**

```bash
# Check if commit mixes multiple scopes
if [ $(git diff --cached --name-only | wc -l) -gt 10 ]; then
  echo "⚠️  WARNING: Large changeset (10+ files)"
  echo "Consider splitting into multiple commits"
  echo "Press Y to continue, N to abort"
  read -r response
  if [ "$response" != "Y" ]; then
    exit 1
  fi
fi
```

**Scope Detection Heuristics:**
- ✅ All files in same directory → Single scope
- ⚠️ Files in multiple unrelated directories → Mixed scope
- ⚠️ >10 files → Require confirmation
- ⚠️ Mix of code + docs + migrations → Require explanation

---

## Husky Deprecation Warning

**Warning Observed:**
```
husky - DEPRECATED
Please remove the following two lines from .husky/pre-commit:
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
They WILL FAIL in v10.0.0
```

**Resolution:** Fix husky configuration (see separate task)

---

## Lessons Learned

### For AI Coding Agents:

1. **Architecture Guard ≠ Commit Hygiene Guard**
2. **Always use targeted `git add` for commits**
3. **Separate organizational changes from feature changes**
4. **Document scope in commit message**

### For Bella Architecture:

1. **Evidence-based development requires granular commits**
2. **Governance is multi-layered:**
   - Layer 1: Architecture Guard (what didn't break)
   - Layer 2: Commit Scope Guard (what was intended)
   - Layer 3: PR Review (what makes sense)
   - Layer 4: CI Gate (what still works)

### For Future Phases:

When implementing remaining Phase 1 documents:
```bash
# Contract Dependency Map
git add docs/products/dental/CONTRACT_DEPENDENCY_MAP.md
git commit -m "docs: Dental Phase 1 (3/5) - Contract Dependency Map"

# Database Migration Plan
git add docs/products/dental/DB_MIGRATION_PLAN.md
git commit -m "docs: Dental Phase 1 (4/5) - Database Migration Plan"

# 11 Verification Gates
git add docs/products/dental/VERIFICATION_GATES_TEST_PLAN.md
git commit -m "docs: Dental Phase 1 (5/5) - 11 Verification Gates Test Plan"
```

**Each commit = 1 document = 1 purpose = clear attribution**

---

## Conclusion

**Incident Classification:** 🟡 **Process Improvement, Not Failure**

**What Worked:**
- ✅ Architecture Guard caught zero violations
- ✅ Kernel remains FROZEN
- ✅ Evidence-based development mindset active

**What Improved:**
- ✅ Commit hygiene awareness raised
- ✅ Process documented
- ✅ Future prevention strategy defined

**Status:** ✅ **RESOLVED - No Rollback Required**

**Next Action:** Continue Phase 1 with improved commit discipline

---

**Signed:**  
Kiro AI Development Environment  
Evidence-Based Development — Governance Evolution  
2026-08-23
