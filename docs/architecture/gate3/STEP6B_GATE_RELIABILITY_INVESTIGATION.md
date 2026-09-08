# STEP 6B — Gate Reliability Investigation

**Priority:** 🔴 CRITICAL  
**Status:** 🟡 OPEN  
**Date:** 2026-09-08

---

## Problem Statement

TG-2 gate exhibited **non-deterministic behavior** during STEP 6A diagnostic baseline:

**Run 1 (timeout 600s):** 18/18 scopes tested = **ALL PASS** (0 diagnostics)  
**Run 2 (timeout 180s):** Same scopes rerun = **ALL HAS_DIAGNOSTICS** (1020+ diagnostics)

After cache clear: Consistent TS6307 pattern across all scopes.

**Critical question:** Why did Run 1 report false PASS?

---

## Evidence

### Run 1 Output (Partial)
```text
Checking tsconfig.app-routes-workforce-management (18 routes)...
   ✅ PASS (16256ms)

Checking tsconfig.app-routes-workflows (5 routes)...
   ✅ PASS (9420ms)

[...18 scopes total...]
```

### Run 2 Output (Same Scopes)
```text
Checking tsconfig.app-routes-workforce-management (18 routes)...
   ⚠️  114 diagnostics (22316ms)

Checking tsconfig.app-routes-workflows (5 routes)...
   ⚠️  24 diagnostics (10511ms)
```

### After Cache Clear
```text
Checking tsconfig.app-routes-workforce-management...
   ⚠️  114 diagnostics (consistent)
```

---

## Hypothesis Space

### H1: TypeScript Compiler Cache (Initial Hypothesis)

**Theory:** Cached compilation skips dependency resolution → false PASS

**Evidence FOR:**
- Cache clear → consistent TS6307
- `.tsbuildinfo` files existed

**Evidence AGAINST:**
- Compiler invoked with `--noEmit` (should bypass incremental cache)
- No `.tsbuildinfo` path specified in app routes tsconfigs

**Status:** ⚠️ PLAUSIBLE but UNPROVEN

### H2: Timeout Kills Process Before Error Capture

**Theory:** Long-running scopes killed by timeout, script misinterprets as PASS

**Evidence FOR:**
- Run 1: 600s timeout (longer → more likely to complete)
- Run 2: 180s timeout (shorter → more likely to timeout)
- Platform Core scope took 120s (near timeout)

**Evidence AGAINST:**
- Execution times logged (16s, 9s, 13s) — well under 600s timeout
- No timeout messages in Run 1 output

**Status:** 🟡 POSSIBLE for slow scopes only

### H3: Exit Code Handling Bug

**Theory:** Script catches compiler error but misinterprets exit code

**Evidence FOR:**
- `execSync` with `stdio: 'pipe'` — errors may not propagate correctly
- Catch block may have logic error

**Evidence AGAINST:**
- Same script code for both runs
- Run 2 correctly captured diagnostics

**Status:** 🟡 INVESTIGATE CODE

### H4: Stdout/Stderr Capture Race

**Theory:** Compiler writes errors to stderr; script only reads stdout

**Evidence FOR:**
- TypeScript writes diagnostics to stdout by default, but behavior may vary

**Evidence AGAINST:**
- Run 2 captured diagnostics from same mechanism

**Status:** 🟢 UNLIKELY (same code path)

### H5: Incremental Compilation State

**Theory:** First run used incremental state from previous `tsc` execution

**Evidence FOR:**
- Tsconfigs have `"composite": true`
- `.tsbuildinfo` may exist from prior builds

**Evidence AGAINST:**
- `--noEmit` flag should bypass incremental
- Cache clear test supports this

**Status:** ⚠️ RELATED TO H1

### H6: Concurrent Process State

**Theory:** Multiple `tsc` processes running concurrently interfere

**Evidence FOR:**
- Script runs scopes sequentially (should avoid this)

**Evidence AGAINST:**
- Sequential execution in logs

**Status:** 🟢 UNLIKELY

---

## Investigation Protocol

### Test 1: Reproduce False PASS

**Objective:** Confirm false PASS is reproducible

**Method:**
```bash
# Clear all state
rm -rf .next/
rm -rf **/.tsbuildinfo

# Run measurement harness with 600s timeout
npx tsx scripts/governance/step6-diagnostic-baseline.ts

# Check: Does it report PASS for workforce-management scope?
```

**Success criteria:** False PASS reproduced

**Status:** ⏸️ PENDING

### Test 2: Verify Exit Code Handling

**Objective:** Prove script correctly interprets tsc exit codes

**Method:**
```typescript
// Add explicit logging in step6-diagnostic-baseline.ts
try {
  const output = execSync('npx tsc --project X --noEmit', {...});
  console.log('Exit code: 0 (success)');
} catch (error) {
  console.log('Exit code:', error.status);
  console.log('Signal:', error.signal);
  console.log('Killed:', error.killed);
}
```

**Success criteria:** Exit codes logged correctly for PASS vs HAS_DIAGNOSTICS

**Status:** ⏸️ PENDING

### Test 3: Force Clean Compilation

**Objective:** Eliminate incremental/cache variables

**Method:**
```bash
npx tsc --project tsconfig.app-routes-workforce-management.json \
  --noEmit \
  --incremental false \
  --tsBuildInfoFile null
```

**Success criteria:** Consistent result across 3 runs

**Status:** ⏸️ PENDING

### Test 4: Isolated Single Scope

**Objective:** Rule out cross-scope interference

**Method:**
```bash
# Run ONLY workforce scope 3 times
for i in 1 2 3; do
  echo "Run $i"
  npx tsc --project tsconfig.app-routes-workforce-management.json --noEmit
  echo "---"
done
```

**Success criteria:** Same result 3/3 times

**Status:** ✅ COMPLETE — Consistent TS6307 after cache clear

### Test 5: Measure Compiler Stderr

**Objective:** Verify diagnostics written to correct stream

**Method:**
```bash
npx tsc --project tsconfig.app-routes-workforce-management.json --noEmit \
  1>stdout.log 2>stderr.log
  
cat stdout.log  # Check where diagnostics appear
cat stderr.log
```

**Success criteria:** Know which stream contains diagnostics

**Status:** ⏸️ PENDING

---

## Required Invariant

**TG-2 gate MUST enforce:**

```text
PASS reported ONLY IF:
├─ Compiler process completed (not killed)
├─ Exit code = 0
├─ Stdout/stderr captured
├─ No timeout occurred
└─ Output parseable

IF timeout / killed / error:
└─ Report: INDETERMINATE (never false PASS)
```

**Current code MAY violate this** — investigation required.

---

## Remediation Options

### If H1 (Cache) Proven

**Fix:** Force clean compilation
```typescript
execSync('npx tsc --project X --noEmit --incremental false');
```

### If H2 (Timeout) Proven

**Fix:** Increase timeout + detect kills
```typescript
try {
  execSync(..., { timeout: 300000 });
} catch (error) {
  if (error.killed) {
    return { status: 'TIMEOUT', diagnostic_count: -1 };
  }
}
```

### If H3 (Exit Code) Proven

**Fix:** Explicit exit code check
```typescript
const result = spawnSync('npx', ['tsc', '--project', X, '--noEmit']);
if (result.status !== 0) {
  // Has diagnostics
}
```

---

## Definition of Done

```text
✅ False-PASS root cause identified with evidence
✅ Reproduction test case created
✅ Gate reliability invariant enforced in code
✅ 3+ consecutive runs produce same result
✅ Documentation updated with proven mechanism
```

---

## Status

🔴 **CRITICAL OPEN**

**Blocker for:**
- STEP 6C (Compilation topology)
- STEP 6D (Clean diagnostic census)
- Any TypeScript remediation

**Reason:** Cannot trust diagnostic counts from unreliable measurement harness.

---

## Next Action

Execute Tests 1-5 in order to prove false-PASS mechanism.

