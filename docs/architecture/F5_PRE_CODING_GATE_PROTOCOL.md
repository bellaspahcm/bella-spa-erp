# F5 Pre-Coding Gate Protocol

> **Purpose:** Prevent AI-invented financial semantics. Code can be generated; business rules must be specified.
> **Authority:** Architecture Gate — blocks implementation until semantic boundaries are documented
> **Applies To:** All F5 phases involving new control domains (F5.6+)

---

## Core Principle

```
┌─────────────────────────────────────────────────────────────┐
│  Financial semantics CANNOT be inferred by AI coding        │
│  Every reconciliation domain MUST have explicit contract    │
│  specification BEFORE any SQL function is written           │
└─────────────────────────────────────────────────────────────┘
```

**Why This Gate Exists:**

A reconciliation function that compiles, passes tests, and runs without error can still be **semantically wrong** if:
- It reconciles against the wrong GL account
- It uses the wrong sign convention (DEBIT vs CREDIT normal)
- It reads from the wrong source ledger
- It applies the wrong reconstruction formula
- It uses the wrong temporal boundary column

These errors are **not caught by TypeScript, not caught by SQL syntax checks, and not caught by integration tests** that seed synthetic data matching the AI's invented semantics.

---

## Gate Enforcement Rules

### 🔴 BLOCKED State

A phase enters BLOCKED state when ANY of these conditions are unmet:

1. **Source Contract Undefined**
   - No published F2/F3/F4 public temporal contract for the domain
   - Contract schema not documented
   - Contract version not tagged (e.g., `F2_CASH:v1`)

2. **GL Account Mapping Undefined**
   - Target GL account code not confirmed (cannot guess "111" or "331PP")
   - Account normal balance type not confirmed (DEBIT vs CREDIT)
   - GL balance formula not specified (debit-credit vs credit-debit)

3. **Reconstruction Formula Undefined**
   - Ledger entry types not enumerated
   - Balance calculation not specified (e.g., gross - applied - refunded)
   - Sign conventions not documented

4. **Temporal Semantics Undefined**
   - Temporal boundary column not confirmed (created_at? posted_at? transaction_date?)
   - Source contract temporal filter not verified
   - Historical as_of behavior not specified

### ✅ APPROVED State

A phase exits BLOCKED state when ALL checklist items are GREEN:

- ✅ Source contract published and version-tagged
- ✅ GL account code confirmed by Human Architect
- ✅ Account normal balance type documented
- ✅ Reconstruction formula specified with examples
- ✅ Temporal boundary column verified
- ✅ Checklist reviewed and approved by Human Architect

**Only then may AI coding begin.**

---

## Pre-Coding Gate Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  Phase N Implementation Request                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Create Checklist Doc  │
         │  (F5_N_CHECKLIST.md)   │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Review Existing       │
         │  Contracts + Schema    │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
    ┌───│  All Items GREEN?      │───┐
    │   └────────────────────────┘   │
    NO                               YES
    │                                 │
    ▼                                 ▼
┌────────────────┐          ┌────────────────┐
│  STATUS:       │          │  STATUS:       │
│  🔴 BLOCKED    │          │  ✅ APPROVED   │
│                │          │                │
│  Wait for      │          │  AI coding     │
│  Human         │          │  may begin     │
│  Architect     │          │                │
│  specification │          │                │
└────────────────┘          └────────────────┘
```

---

## Checklist Document Template

Each phase requiring new domain semantics MUST have a checklist document before coding begins.

**File naming:** `docs/architecture/F5_N_[DOMAIN]_CHECKLIST.md`

**Template structure:**

```markdown
# F5.N [DOMAIN] — Pre-Implementation Checklist

> **Status:** 🔴 BLOCKED / ✅ APPROVED
> **Phase:** F5.N [Domain Name]
> **Dependency:** [Previous phase] must be FROZEN

## [CONTROL_TYPE] Semantic Specification

### ❌/✅ Source Contract

- [ ] Contract name documented
- [ ] Contract owner identified (F2/F3/F4 module)
- [ ] Return schema documented
- [ ] Temporal boundary column confirmed
- [ ] Version tag published

### ❌/✅ GL Account Mapping

- [ ] GL account code confirmed
- [ ] Account normal balance type documented (DEBIT/CREDIT)
- [ ] GL balance formula specified
- [ ] Multi-account scenarios addressed

### ❌/✅ Reconstruction Formula

- [ ] Ledger entry types enumerated
- [ ] Balance calculation formula specified
- [ ] Sign conventions documented
- [ ] Edge cases addressed (NULL handling, etc.)

### ❌/✅ Temporal Semantics

- [ ] Temporal boundary column confirmed
- [ ] Source contract temporal filter verified
- [ ] Historical as_of behavior specified

## Pre-Implementation Gate

**Implementation MUST NOT begin until:**

1. ✅ All checklist items GREEN
2. ✅ Human Architect approval documented
3. ✅ Previous phase FROZEN

**Current Status:** 🔴/✅
```

---

## Why AI Cannot Fill Gaps

| Gap Type | Why AI Cannot Infer | Consequence If Wrong |
|----------|---------------------|----------------------|
| GL Account Code | Business chart of accounts is arbitrary (111 vs 1111 vs 1110) | Reconciles against wrong account → false MATCHED |
| Normal Balance Type | Cannot infer from data alone (both DEBIT/CREDIT use positive numbers) | Inverted variance sign → VARIANCE reported as MATCHED |
| Reconstruction Formula | Multiple valid formulas exist (gross-net vs inflow-outflow) | Wrong outstanding balance → systematic misclassification |
| Temporal Column | Multiple timestamp columns exist (created_at, posted_at, effective_date) | Wrong as_of boundary → time leakage (G8 violation) |
| Entry Type Semantics | Entry type names are domain-specific conventions | Wrong classification → incorrect position |

**Example of AI-Invented Semantic Failure:**

```sql
-- AI might infer:
SELECT SUM(amount) FROM finance_cash_movements WHERE type = 'DEPOSIT';

-- But business reality might be:
SELECT SUM(amount) FROM finance_treasury_ledger 
WHERE entry_type = 'BANK_INFLOW' AND cleared = true;

-- Both compile. Both pass synthetic tests. Only one is correct.
```

---

## Historical Example: F5.5 AR Success

F5.5 succeeded because:

1. ✅ **Source Contract Pre-Existed:** `finance_ar_facts_as_of()` already deployed (F3_AR:v1)
2. ✅ **Reconstruction Pre-Existed:** `f5_reconstruct_ar_position()` already deployed
3. ✅ **GL Account Known:** AR = account 131 (documented in F1)
4. ✅ **Sign Convention Known:** DEBIT-normal = debit - credit (opposite of AP)
5. ✅ **Temporal Column Known:** AR ledger uses `created_at`

**No semantic gaps → implementation proceeded → 8/8 gates PASS**

---

## Current Example: F5.6 Blocked

F5.6 correctly BLOCKED because:

1. ❌ **Cash Contract Unknown:** No `finance_cash_facts_as_of()` identified
2. ❌ **Prepayment Contract Unknown:** No `finance_prepayment_facts_as_of()` identified
3. ❌ **GL Accounts Unknown:** Cash = 111? Prepayment = 331PP? 234? 132?
4. ❌ **Reconstruction Formulas Unknown:** Cash = inflow - outflow? Prepayment = gross - applied - refunded?
5. ❌ **Temporal Columns Unknown:** created_at? transaction_date? posted_at?

**Semantic gaps present → implementation BLOCKED → correct architecture discipline**

---

## Gate Approval Process

1. **AI Agent:** Creates checklist document with all items marked ❌ PENDING
2. **AI Agent:** Reviews existing codebase for contracts, schema, mappings
3. **AI Agent:** Marks items GREEN only if explicit evidence found in code
4. **AI Agent:** Reports BLOCKED status if any items remain RED
5. **Human Architect:** Reviews checklist, provides missing specifications
6. **Human Architect:** Updates checklist items to GREEN with documented decisions
7. **Human Architect:** Changes status to ✅ APPROVED
8. **AI Agent:** Resumes implementation with explicit semantic boundaries

---

## Consequences of Bypassing Gate

If AI coding proceeds without semantic specification:

- ✅ Code compiles
- ✅ Tests pass (against synthetic data matching AI assumptions)
- ✅ Function runs without error
- ❌ Reconciliation silently wrong
- ❌ VARIANCE/MATCHED classifications unreliable
- ❌ G1–G8 gates pass but semantically meaningless
- ❌ Production deployment breaks real financial control

**This gate exists to prevent silent semantic failure.**

---

## Verdict

```
┌─────────────────────────────────────────────────────────────┐
│  F5 Pre-Coding Gate: ACTIVE                                 │
│                                                              │
│  F5.6 Status: 🔴 BLOCKED (correct)                          │
│  Reason: Semantic specification incomplete                  │
│  Action: Wait for Human Architect contract specification   │
│                                                              │
│  NO AI CODING UNTIL CHECKLIST GREEN                         │
└─────────────────────────────────────────────────────────────┘
```

**This is not a delay. This is architecture discipline working correctly.**

