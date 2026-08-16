# F5.6 Cash + Prepayment — Pre-Implementation Checklist

> **Status:** 🔴 BLOCKED — Semantic specification incomplete
> **Phase:** F5.6 Cash + Prepayment GL Balance control domains
> **Dependency:** F5.5 AR_GL_BALANCE must be FROZEN (✅ complete)
> **Constitution:** F5.0 Constitution v1.2-Final (FROZEN)

---

## Purpose

This checklist ensures F5.6 implementation does NOT begin until all semantic boundaries
and contract dependencies are explicitly specified. No AI coding until all items are GREEN.

---

## CASH_GL_BALANCE Semantic Specification

### ❌ F2 Public Temporal Contract

- [ ] **Contract Name:** `finance_cash_facts_as_of(p_tenant_id, p_as_of, p_version)` exists?
- [ ] **Contract Owner:** F2 Treasury module or F1 Cash module?
- [ ] **Return Schema:** Documented with columns (cash_account_id, balance_minor, currency, as_of)?
- [ ] **Temporal Boundary:** Uses `created_at` or `transaction_date` or `posted_at`?
- [ ] **Version Tag:** Stable version (e.g., `F2_CASH:v1`) published?

**Status:** ❌ PENDING — No F2 public contract identified  
**Blocker:** Cannot implement CASH_GL_BALANCE without approved read contract

### ❌ Cash Account Identity

- [ ] **Table Name:** `finance_cash_accounts` or `finance_bank_accounts` or other?
- [ ] **Primary Key:** UUID or composite?
- [ ] **GL Mapping:** How is cash account mapped to GL account code?
  - Direct column `gl_account_id` on cash account table?
  - Indirect via `finance_account_mappings` table?
  - Hardcoded mapping (e.g., all cash accounts → GL 111)?

**Status:** ❌ PENDING — Cash account schema not confirmed  
**Blocker:** Cannot write reconciliation loop without knowing source entity

### ❌ Inflow/Outflow Semantics

- [ ] **Cash Movement Table:** `finance_cash_movements` or `finance_treasury_ledger` or other?
- [ ] **Entry Types:** What are valid entry_type values?
  - DEPOSIT / WITHDRAWAL?
  - INFLOW / OUTFLOW?
  - DEBIT / CREDIT?
  - Other?
- [ ] **Amount Sign Convention:** Is `amount_minor` always positive (like AR/AP ledgers)?
- [ ] **Direction Field:** Separate `direction` column or embedded in `entry_type`?

**Status:** ❌ PENDING — Cash movement semantics undefined  
**Blocker:** Cannot compute cash balance without knowing ledger structure

### ❌ GL Account Normalization

- [ ] **Account Type:** Cash account is ASSET, DEBIT-normal (like AR account 131)?
- [ ] **GL Balance Formula:** GL = SUM(debit) - SUM(credit)? (same as AR)
- [ ] **Account Code:** Hardcoded `111` or configurable per cash account?
- [ ] **Multi-Currency:** Does each currency have separate GL account or single account?

**Status:** ❌ PENDING — GL normalization not specified  
**Blocker:** Cannot compute variance without knowing expected GL sign

### ❌ Historical as_of Support

- [ ] **Temporal Column:** Cash movements use `created_at` or `transaction_date` or `posted_at`?
- [ ] **F2 Contract Compliance:** F2 temporal contract filters by this column?
- [ ] **GL Journal Compliance:** GL entries for cash have `posted_at` aligned with cash movement timestamp?

**Status:** ❌ PENDING — Temporal semantics not verified  
**Blocker:** Cannot satisfy G8 temporal determinism without confirmed column

---

## PREPAYMENT_GL_BALANCE Semantic Specification

### ❌ F2 Public Temporal Contract

- [ ] **Contract Name:** `finance_prepayment_facts_as_of(p_tenant_id, p_as_of, p_version)` exists?
- [ ] **Contract Owner:** F2 Prepayment module or F3 AR module extension?
- [ ] **Return Schema:** Documented with columns (prepayment_id, gross, applied, refunded, net_unapplied)?
- [ ] **Temporal Boundary:** Uses `created_at` or `prepayment_date` or other?
- [ ] **Version Tag:** Stable version (e.g., `F2_PREPAYMENT:v1`) published?

**Status:** ❌ PENDING — No F2 prepayment contract identified  
**Blocker:** Cannot implement PREPAYMENT_GL_BALANCE without approved read contract

### ❌ Prepayment Ledger Structure

- [ ] **Table Name:** `finance_prepayment_ledger` or `finance_customer_deposits` or other?
- [ ] **Entry Types:** What are valid entry_type values?
  - DEPOSIT_RECEIVED / APPLIED_TO_INVOICE / REFUNDED?
  - PREPAYMENT_ACCRUAL / PREPAYMENT_ALLOCATION / PREPAYMENT_REFUND?
  - Other?
- [ ] **Amount Sign Convention:** Is `amount_minor` always positive?
- [ ] **Balance Formula:** Net unapplied = DEPOSIT - APPLIED - REFUNDED?

**Status:** ❌ PENDING — Prepayment ledger semantics undefined  
**Blocker:** Cannot reconstruct prepayment position without knowing ledger structure

### ❌ GL Clearing Account Specification

- [ ] **Account Code:** What is the prepayment clearing account?
  - `331PP` (extended from AP account 331)?
  - `234` (customer deposit liability)?
  - `132` (prepaid receivable asset)?
  - Other?
- [ ] **Account Type:** LIABILITY (CREDIT-normal) or ASSET (DEBIT-normal)?
- [ ] **GL Balance Formula:** If CREDIT-normal → GL = SUM(credit) - SUM(debit) (like AP)?
- [ ] **Configuration:** Hardcoded or configurable per tenant/entity?

**Status:** ❌ PENDING — GL account identity not confirmed  
**Blocker:** Cannot compute variance without knowing GL account and sign convention

### ❌ Applied vs. Unapplied Distinction

- [ ] **Application Tracking:** How is prepayment application to invoice recorded?
  - Separate `finance_prepayment_applications` table?
  - Entry in `finance_prepayment_ledger` with `entry_type = APPLIED`?
  - Link via `finance_receivable_ledger` with special entry type?
- [ ] **Refund Tracking:** How are prepayment refunds recorded?
  - Entry in prepayment ledger with `entry_type = REFUNDED`?
  - Separate refund transaction?
- [ ] **Net Calculation:** Net unapplied = Gross - Applied - Refunded (confirmed formula)?

**Status:** ❌ PENDING — Application semantics not specified  
**Blocker:** Cannot compute expected outstanding without knowing calculation

### ❌ Historical as_of Support

- [ ] **Temporal Column:** Prepayment movements use `created_at` or `prepayment_date` or `posted_at`?
- [ ] **F2 Contract Compliance:** F2 temporal contract filters by this column?
- [ ] **GL Journal Compliance:** GL entries for prepayments have `posted_at` aligned with movement timestamp?

**Status:** ❌ PENDING — Temporal semantics not verified  
**Blocker:** Cannot satisfy G8 temporal determinism without confirmed column

---

## Pre-Implementation Gate

**F5.6 implementation MUST NOT begin until:**

1. ✅ F5.5 AR_GL_BALANCE is FROZEN (COMPLETE)
2. ❌ All CASH_GL_BALANCE checklist items are GREEN
3. ❌ All PREPAYMENT_GL_BALANCE checklist items are GREEN
4. ❌ F2 public contracts are published and version-tagged
5. ❌ Migration plan reviewed by Human Architect

**Current Status:** 🔴 **BLOCKED**

---

## Next Steps

1. **Human Architect Review:** Specify F2 cash and prepayment public contracts
2. **Schema Verification:** Document cash account and prepayment ledger structure
3. **GL Account Mapping:** Confirm GL clearing accounts and sign conventions
4. **Temporal Column Confirmation:** Verify as_of boundary columns for F2 contracts
5. **Gate Approval:** Human Architect approves F5.6 semantic specification
6. **Only Then:** AI coding begins F5.6 implementation

**No AI coding until this checklist is GREEN.**

