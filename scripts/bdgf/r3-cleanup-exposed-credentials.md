# R3 Exposed Credentials Cleanup

**Date:** 2026-08-20  
**Purpose:** Document locations of exposed credentials and cleanup actions

---

## üîç EXPOSURE ANALYSIS

### Exposed Credentials
- `bella_developer`: `[REDACTED ó ROTATED 2026-08-20]`
- `bella_migration_executor`: `[REDACTED ó ROTATED 2026-08-20]`

### Found In Locations

**Evidence files (20 occurrences):**
- `evidence/g3a-architecture/R3_*.md` files
- Purpose: Test documentation and audit trail

**Script files (5 occurrences):**
- `scripts/bdgf/r3-setup-roles.sql`
- `scripts/bdgf/R3_CREDENTIAL_ROTATION_INSTRUCTIONS.md`
- Purpose: Setup and rotation documentation

---

## üîê CLEANUP STRATEGY

### Option A: REDACT (Recommended)
Replace all password occurrences with `[REDACTED_OLD_PASSWORD]`

**Pros:**
- Maintains audit trail structure
- Shows that credentials existed but are now invalid
- Preserves evidence flow

**Cons:**
- Still shows credential format/context

---

### Option B: DELETE FILES
Remove all files containing exposed credentials

**Pros:**
- Complete removal from filesystem

**Cons:**
- Loses audit trail
- May break documentation references

---

### Option C: GIT HISTORY CLEANUP
Use `git-filter-repo` to remove from git history

**Pros:**
- Removes from all commits

**Cons:**
- Complex operation
- Requires force push
- May break team member clones

---

## ‚úÖ RECOMMENDED APPROACH

**Chosen:** Option A (REDACT) + Git amend

### Reason:
- Credentials will be rotated (old passwords invalid)
- Audit trail remains intact  
- No need for complex git rewrite
- New passwords never enter evidence/git

### Actions Required:

1. **Rotate credentials first** (via Supabase Dashboard)
2. **Redact in evidence files** after rotation complete
3. **Git amend** last commit if credentials in HEAD
4. **Document** in this file that rotation occurred

---

## üìã MANUAL CLEANUP STEPS

### After Credential Rotation Complete

```bash
# Find all occurrences (verification)
grep -r "[REDACTED ó ROTATED 2026-08-20]" evidence/ scripts/

# Automated redaction (PowerShell)
$files = Get-ChildItem -Path evidence/,scripts/ -Recurse -File
$files | ForEach-Object {
  (Get-Content $_.FullName) `
    -replace '[REDACTED ó ROTATED 2026-08-20]', '[REDACTED_OLD_PASSWORD_DEV]' `
    -replace '[REDACTED ó ROTATED 2026-08-20]', '[REDACTED_OLD_PASSWORD_EXEC]' |
  Set-Content $_.FullName
}

# Verify redaction
grep -r "[REDACTED ó ROTATED 2026-08-20]" evidence/ scripts/
# Should return no results
```

---

## üî¥ GIT SAFETY

### Check if credentials are in git

```bash
# Check staged/committed
git log --all -p | grep "[REDACTED ó ROTATED 2026-08-20]"

# If found in last commit only
git commit --amend --no-edit

# If found in multiple commits
# Consider: git-filter-repo or accept as historical (now rotated)
```

---

## ‚úÖ COMPLETION CHECKLIST

After rotation complete, verify:

- [ ] New passwords set in Supabase (via SQL Editor)
- [ ] `.env` updated with new passwords
- [ ] Old passwords redacted in evidence files
- [ ] Old passwords redacted in script files
- [ ] Git history checked (and amended if needed)
- [ ] Verification test passed: `node scripts/bdgf/r3-simple-test.mjs`

---

## üìù ROTATION RECORD

**Status:** üî¥ PENDING

After completing rotation, update:

```markdown
**Status:** ‚úÖ COMPLETE
**Date:** YYYY-MM-DD HH:MM
**Method:** Supabase Dashboard SQL Editor
**Verification:** r3-simple-test.mjs (8/8 PASS)
**Cleanup:** Redacted from evidence/scripts
**Git:** Checked / Amended (if applicable)
```

---

**Next:** Only after this checklist complete ‚Üí Create `R3_BASELINE_LOCKED.md`
