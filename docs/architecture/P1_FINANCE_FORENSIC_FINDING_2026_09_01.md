# P1 Finance Schema Drift — Forensic Finding

**Date:** 2026-09-01
**Status:** ⚠️ P1 REPORT DISCREPANCY DETECTED

---

## P1 Report Claim

> `src/platform/accounting/engines/accounting.service.ts`: code assumes legacy column names:
> - `code`
> - `debit`  
> - `credit`
>
> Current generated Supabase types expose:
> - `account_code`
> - `debit_amount`
> - `credit_amount`

**Source:** `SYSTEM_VERIFICATION_P1_2026_09_01.md` lines 51-58

---

## Forensic Evidence

### 1. Canonical Database Schema

**Source:** `supabase/migrations/20260524000000_accounting_core.sql`

```sql
CREATE TABLE public.accounting_accounts (
    account_code TEXT NOT NULL,
    ...
);

CREATE TABLE public.journal_lines (
    debit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    credit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    ...
);
```

**Verdict:** Schema uses `account_code`, `debit_amount`, `credit_amount`

---

### 2. Finance Kernel Contract

**Source:** `src/platform/accounting/contracts/accounting.contract.ts`

```typescript
export interface JournalLineInput {
  accountCode: string;      // ✅ Canonical camelCase
  debitAmount: number;      // ✅ Canonical camelCase
  creditAmount: number;     // ✅ Canonical camelCase
}
```

**Verdict:** Contract uses canonical naming

---

### 3. Accounting Service Implementation

**Source:** `src/platform/accounting/engines/accounting.service.ts`

```typescript
// Line 47: Querying accounts
.select('id, account_code')          // ✅ Uses account_code

// Line 51: Map creation
accountMap.set(acc.account_code, acc.id);  // ✅ Uses account_code

// Line 104-105: Journal lines insert
debit_amount: line.debitAmount,      // ✅ Maps debitAmount → debit_amount
credit_amount: line.creditAmount     // ✅ Maps creditAmount → credit_amount
```

**Verdict:** Service correctly uses canonical naming

---

## Finding: NO SCHEMA DRIFT IN ACCOUNTING.SERVICE.TS

**Evidence shows:**
- ✅ Database schema: `account_code`, `debit_amount`, `credit_amount`
- ✅ Finance contract: `accountCode`, `debitAmount`, `creditAmount` (camelCase)
- ✅ Service implementation: Correctly maps contract → DB schema
- ❌ No usage of legacy `code`, `debit`, `credit` found

**Search Results:**
```bash
grep -r '\bcode:|\bdebit:|\bCredit:' src/platform/accounting/
# No matches found
```

---

## Possible Explanations

### Hypothesis A: P1 Report is Stale

P1 investigation may have been conducted before accounting.service.ts was fixed.
The file currently in working tree is already correct.

### Hypothesis B: Error in Different File

Type error may exist in:
- Consumer code calling accounting service
- Test files
- Different accounting-related file not yet examined
- Product layer using Finance Kernel

### Hypothesis C: Misidentified Error Location

Type-check error may have been attributed to wrong file during P1 investigation.

---

## Recommended Actions

### 1. Verify P1 Report Generation Date

Check if P1 report predates any accounting.service.ts fixes in git history:

```bash
git log --oneline -- src/platform/accounting/engines/accounting.service.ts
git blame src/platform/accounting/engines/accounting.service.ts | grep "debit_amount\|credit_amount\|account_code"
```

### 2. Search for Actual Type Errors

Run scoped type-check on Finance platform:

```bash
npx tsc -p tsconfig.finance.tmp.json --noEmit --pretty false
```

### 3. Search Consumers

Look for Finance Kernel consumers that might use legacy naming:

```bash
grep -r 'IAccountingContract\|postJournalEntry' src/ --include="*.ts" --include="*.tsx"
```

---

## Decision

**DO NOT EDIT accounting.service.ts** — file is already correct

**NEXT STEPS:**
1. Identify actual location of Finance type errors (if any exist)
2. Update P1 report to reflect current state
3. If no errors found, mark Finance cluster as FALSE POSITIVE

**Principle:** Do not fix code that isn't broken based on stale reports

---

## Architectural Safety

✅ **No Kernel violation risk** (no changes proposed)
✅ **Finance semantics preserved** (canonical schema/contract match)
✅ **Evidence-first protocol followed** (read before edit)

**This is why forensic evidence gathering precedes code edits.**
