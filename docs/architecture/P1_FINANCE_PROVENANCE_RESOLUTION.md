# P1 Finance Provenance Investigation — RESOLVED

**Date:** 2026-09-01
**Status:** ✅ MYSTERY SOLVED — FIX EXISTS BUT UNSTAGED

---

## Investigation Summary

P1 report claimed `accounting.service.ts` uses legacy field names.
Initial forensic review found service was already correct.
**Root cause:** Unstaged fix in working copy, but legacy code still in HEAD.

---

## Timeline Reconstruction

### 1. Original State (HEAD / Commit 48e56477)

**File:** `src/platform/accounting/engines/accounting.service.ts`

```typescript
// ❌ LEGACY NAMING (HEAD)
.select('id, code')
.in('code', codes)
accountMap.set(acc.code, acc.id)
code: line.accountCode
debit: line.debitAmount
credit: line.creditAmount
```

**Problem:** Database schema uses `account_code`, `debit_amount`, `credit_amount`

### 2. P1 System Verification Scan

**Command:** `npx tsc -p tsconfig.typecheck.platform-finance.tmp.json --noEmit`

**Result:** FAIL

**Finding:** Schema type mismatch between service code and database types

**P1 Report Accuracy:** ✅ **CORRECT** for HEAD at time of scan

### 3. Subsequent Fix (Unstaged in Working Copy)

**File:** `src/platform/accounting/engines/accounting.service.ts` (MODIFIED, unstaged)

```typescript
// ✅ CANONICAL NAMING (Working Copy)
.select('id, account_code')
.in('account_code', codes)
accountMap.set(acc.account_code, acc.id)
account_code: line.accountCode
debit_amount: line.debitAmount
credit_amount: line.creditAmount
```

**Status:** 
- ✅ Correctly maps domain contract → DB schema
- ❌ **UNSTAGED** (part of 100+ pre-existing modified files)
- ❌ Not committed

### 4. Current Task #1 Core Forensics

**Observation:** Service appeared already correct

**Confusion:** P1 report didn't match working copy

**Resolution:** Discovered diff between HEAD and working copy

---

## Git Evidence

### Diff: HEAD vs Working Copy

```bash
git diff HEAD -- src/platform/accounting/engines/accounting.service.ts
```

**Changes (unstaged):**

| Line | HEAD (Legacy) | Working Copy (Canonical) |
|------|---------------|--------------------------|
| 45 | `.select('id, code')` | `.select('id, account_code')` |
| 47 | `.in('code', codes)` | `.in('account_code', codes)` |
| 55 | `acc.code` | `acc.account_code` |
| 66 | `code: line.accountCode` | `account_code: line.accountCode` |
| 67 | `name: ...` | `account_name: ...` |
| 68 | `type: 'asset'` | `account_type: 'asset'` |
| 104 | `debit: line.debitAmount` | `debit_amount: line.debitAmount` |
| 105 | `credit: line.creditAmount` | `credit_amount: line.creditAmount` |

### Git Status

```
M  src/platform/accounting/engines/accounting.service.ts
```

**Part of 100+ unstaged files from previous sessions**

---

## Canonical Source of Truth

### Database Schema (2026-05-24)

**Source:** `supabase/migrations/20260524000000_accounting_core.sql`

```sql
CREATE TABLE public.accounting_accounts (
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (...),
    ...
);

CREATE TABLE public.journal_lines (
    debit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    credit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    ...
);
```

### Finance Contract (Domain Layer)

**Source:** `src/platform/accounting/contracts/accounting.contract.ts`

```typescript
export interface JournalLineInput {
  accountCode: string;      // Domain camelCase
  debitAmount: number;
  creditAmount: number;
}
```

### Correct Mapping

```
Domain Contract    →    DB Schema
----------------        --------------
accountCode        →    account_code
debitAmount        →    debit_amount
creditAmount       →    credit_amount
```

---

## Decision: Finance Remediation

### Status

**HEAD:** ❌ Contains legacy naming (type errors exist)
**Working Copy:** ✅ Contains canonical naming (correct)
**Unstaged:** ⚠️ Fix exists but not committed

### Options

**Option A: Stage and commit existing fix**
- Pro: Fix already exists and is correct
- Pro: Minimal effort
- Con: Didn't verify fix ourselves
- Con: Part of large unstaged changeset

**Option B: Verify fix, then stage isolated**
- Pro: We verify correctness
- Pro: Isolated commit (Finance only)
- Pro: Clean audit trail
- Con: Requires verification work

**Option C: Reset to HEAD, reapply forensically**
- Pro: Full control and verification
- Pro: Can add tests
- Con: Discards working fix
- Con: Unnecessary rework

### Recommendation: **Option B**

1. Run scoped Finance type-check on working copy
2. Verify fix correctness against canonical schema
3. Stage ONLY accounting.service.ts
4. Review diff one more time
5. Commit isolated Finance fix
6. Document as "complete unstaged remediation from previous session"

---

## Verification Plan

### 1. Scoped Type-check

```bash
# Create minimal tsconfig for Finance verification
npx tsc --noEmit src/platform/accounting/**/*.ts --strict
```

### 2. Verify Correctness

Check that working copy:
- ✅ Uses `account_code` matching DB schema
- ✅ Uses `debit_amount`/`credit_amount` matching DB schema
- ✅ Preserves Finance Kernel semantics
- ✅ Maps domain contract correctly

### 3. Architecture Guard

```bash
npm run arch:guard
```

Must remain PASS (Finance Kernel modifications allowed as baseline evolution)

### 4. Commit

```bash
git add src/platform/accounting/engines/accounting.service.ts
git diff --cached --check
git diff --cached
git commit -m "fix(finance): align service with canonical DB schema

- Use account_code instead of code
- Use debit_amount/credit_amount instead of debit/credit  
- Complete unstaged remediation from previous session

Evidence: DB schema canonical naming from 20260524000000_accounting_core.sql
Ref: P1 Finance provenance investigation"
```

---

## Lessons Learned

### 1. Staged vs Working Copy Matters

**Previous assumption:** Working copy = HEAD
**Reality:** 100+ unstaged files can hide fixes

**New protocol:** Always check `git diff HEAD -- <file>` during forensics

### 2. P1 Report Was Accurate

P1 scan was correct for **committed code (HEAD)**.
Confusion arose from comparing report to **working copy**.

### 3. Forensic Process Worked

Evidence-first protocol prevented:
- ❌ Re-fixing already-fixed code
- ❌ Committing without understanding state
- ❌ Assuming report was wrong

Process correctly identified:
- ✅ Report accurate for HEAD
- ✅ Fix exists but unstaged
- ✅ Need to verify and commit properly

---

## Finance Cluster Status

**Previous:** ⚠️ Report mismatch under investigation
**Current:** ✅ Provenance resolved, fix identified
**Next:** Verify and commit existing unstaged fix

**Principle applied:** Investigate provenance before dismissing reports or editing code.
