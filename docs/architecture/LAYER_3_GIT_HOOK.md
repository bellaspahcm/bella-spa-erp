# LAYER 3: GIT PRE-COMMIT HOOK

**Component:** Git Pre-Commit Hook  
**Layer:** 3 of 5  
**Status:** ✅ ACTIVE  
**Version:** 1.0.0

---

## Overview

Layer 3 provides **developer-side protection** by blocking commits that modify frozen kernel files at the local git level.

**Protection Flow:**
```
Developer
    ↓
Code Changes
    ↓
git add
    ↓
git commit ← Layer 3 blocks here if frozen files modified
    ↓
Commit Success/Fail
```

---

## Implementation

### Files

| File | Purpose | Lines |
|------|---------|-------|
| `.husky/pre-commit` | Hook entry point | 6 |
| `scripts/architecture/git-pre-commit-guard.js` | Guard logic | 220 |

### Hook Installation

```bash
# Hook is automatically installed via husky
# Runs on every `git commit` command
```

### Protected Files

**22 frozen files across 3 layers:**

**E7.1 Domain Kernel (12 files):**
- `src/platform/logistics/domain/inventory.types.ts`
- `src/platform/logistics/domain/inventory.domain.ts`
- `src/platform/logistics/domain/movement.types.ts`
- `src/platform/logistics/domain/movement.domain.ts`
- `src/platform/logistics/domain/traceability.types.ts`
- `src/platform/logistics/domain/traceability.domain.ts`
- `src/platform/logistics/domain/item.types.ts`
- `src/platform/logistics/domain/item.domain.ts`
- `src/platform/logistics/domain/location.types.ts`
- `src/platform/logistics/domain/location.domain.ts`
- `src/platform/logistics/domain/uom.types.ts`
- `src/platform/logistics/domain/uom.domain.ts`

**E7.2 Operational Kernel (1 file):**
- `src/platform/logistics/domain/inventory-operations.domain.ts`

**E7.3 Rules & Traceability (9 files):**
- `src/platform/logistics/domain/rules/rule.types.ts`
- `src/platform/logistics/domain/rules/rule.helpers.ts`
- `src/platform/logistics/domain/rules/expiry.rule.ts`
- `src/platform/logistics/domain/rules/quantity.rule.ts`
- `src/platform/logistics/domain/rules/traceability.rule.ts`
- `src/platform/logistics/domain/rules/traceability.operations.ts`
- `src/platform/logistics/domain/rules/compliance.evaluation.ts`
- `src/platform/logistics/domain/rules/rule.composition.ts`
- `src/platform/logistics/domain/rules/index.ts`

---

## Behavior

### Scenario 1: Frozen File Modified

```bash
$ vim src/platform/logistics/domain/inventory.types.ts
$ git add .
$ git commit -m "modify frozen file"

╔════════════════════════════════════════════════════════════════╗
║  ❌ FROZEN BOUNDARY VIOLATION — COMMIT BLOCKED                ║
╚════════════════════════════════════════════════════════════════╝

Found 1 frozen file(s) in staged changes:

  ❌ src/platform/logistics/domain/inventory.types.ts
     Layer: E7.1 Domain Kernel
     Status: SEALED

[... additional guidance ...]

╔════════════════════════════════════════════════════════════════╗
║  COMMIT BLOCKED                                                ║
╚════════════════════════════════════════════════════════════════╝
```

**Result:** Commit blocked, exit code 1

### Scenario 2: Non-Frozen File Modified

```bash
$ vim src/products/warehouse/feature.ts
$ git add .
$ git commit -m "add warehouse feature"

🔒 Architecture Guard — Git Pre-Commit Hook
   Checking staged files for frozen kernel modifications...

   ✅ Checked 1 staged file(s)
   ✅ No frozen files modified
   ✅ Commit allowed

[main abc123] add warehouse feature
 1 file changed, 10 insertions(+)
```

**Result:** Commit allowed, exit code 0

### Scenario 3: --no-verify Bypass

```bash
$ vim src/platform/logistics/domain/inventory.types.ts
$ git add .
$ git commit --no-verify -m "bypass hook"

[main def456] bypass hook
 1 file changed, 1 insertion(+)
```

**Result:** Local hook bypassed, commit succeeds

**Protection:** Layer 4 (CI Architecture Gate) will catch this violation and block PR merge.

---

## Bypass Behavior

### Can Be Bypassed Locally

```bash
git commit --no-verify
```

This is **intentional Git behavior** and cannot be prevented at the local level.

### Why This Is OK

Layer 3 is **developer-side protection**. It:
- Catches violations early
- Provides fast feedback
- Prevents accidental mistakes
- Educates developers

Layer 4 (CI Architecture Gate) is **repository-side enforcement**. It:
- Cannot be bypassed
- Blocks PR merge
- Enforces absolutely
- Protects the repository

**Together:** Layers 3 + 4 ensure frozen files cannot be merged.

---

## Error Messages

### Frozen File Detected

**Message provides:**
- Clear violation notification
- List of frozen files modified
- Layer identification (E7.1, E7.2, E7.3)
- Frozen status (SEALED)
- Required steps to modify frozen files
- Reference to policy documentation

**Design goal:** Developer knows exactly what happened and what to do next.

### Success

**Message provides:**
- Files checked count
- Confirmation no frozen files modified
- Commit allowed

---

## Testing

**Test Evidence:** `docs/evidence/LAYER_3_TEST_EVIDENCE.md`

| Test | Result |
|------|--------|
| Frozen file blocked | ✅ PASS |
| Non-frozen file allowed | ✅ PASS |
| No staged files | ✅ PASS |
| Error messaging | ✅ PASS |
| `--no-verify` documented | ✅ PASS |

**Conclusion:** Layer 3 functions correctly and provides appropriate protection.

---

## Integration

### With Layer 2 (PreToolUse Hook)

Layer 2 blocks AI tools from writing frozen files.  
Layer 3 blocks developers from committing frozen files.

**Combined:** Prevents frozen modifications in development.

### With Layer 4 (CI Architecture Gate)

Layer 3 can be bypassed with `--no-verify`.  
Layer 4 catches bypassed violations at PR level.

**Combined:** Ensures frozen modifications cannot be merged.

---

## Maintenance

### Adding New Frozen Files

**Location:** `scripts/architecture/git-pre-commit-guard.js`

**Update:**
```javascript
const FROZEN_FILES = [
  // ... existing files ...
  'path/to/new/frozen/file.ts',  // Add here
];
```

**Also update:**
- Layer 2: `scripts/architecture/pre-tool-guard.js`
- Layer 4: `scripts/architecture/ci-frozen-check.js`

### Removing Files from Protection

**Process:**
1. Create ACR (Architecture Change Request)
2. Get approval
3. Update all 3 guard scripts
4. Document in ADR

**Do not remove files without formal approval.**

---

## Troubleshooting

### Hook Not Running

**Check:**
```bash
# Verify hook file exists
ls .husky/pre-commit

# Verify hook is executable (Unix/Mac)
chmod +x .husky/pre-commit

# Verify husky is installed
npm list husky
```

### False Positives

If hook blocks a file that should not be frozen:
1. Verify file path in `FROZEN_FILES` list
2. Check for path normalization issues (Windows \ vs /)
3. Create issue with reproduction steps

### False Negatives

If hook allows a file that should be frozen:
1. Verify file is in `FROZEN_FILES` list
2. Check path matches exactly
3. Verify staging with `git diff --cached --name-only`

---

## Performance

**Execution time:** <100ms for typical commits

**Impact:** Negligible on developer workflow

**Scalability:** Can handle 100+ frozen files without performance issues

---

## Security Considerations

### Limitations

- **Can be bypassed** with `--no-verify`
- **Cannot prevent** force push (handled by Layer 4)
- **Cannot prevent** direct file system edits (handled by Layers 2 & 4)

### Threat Model

**Threat:** Developer accidentally modifies frozen file  
**Mitigation:** Layer 3 blocks commit, provides guidance  
**Residual Risk:** LOW (fast feedback prevents accidents)

**Threat:** Developer intentionally bypasses hook  
**Mitigation:** Layer 4 (CI) catches and blocks  
**Residual Risk:** NONE (CI enforcement mandatory)

---

## Related Documentation

- **Layer 2:** `docs/architecture/LAYER_2_PRETOOLUSE_HOOK.md`
- **Layer 4:** `docs/architecture/LAYER_4_CI_GATE.md` (pending)
- **Freeze Policy:** `docs/architecture/FREEZE_POLICY.md`
- **Test Evidence:** `docs/evidence/LAYER_3_TEST_EVIDENCE.md`
- **Guard Implementation:** `docs/implementation/ARCHITECTURE_GUARD_IMPLEMENTATION.md`

---

**Status:** ✅ ACTIVE  
**Last Updated:** 2026-08-22  
**Version:** 1.0.0  
**Maintainer:** Platform Architecture Team
