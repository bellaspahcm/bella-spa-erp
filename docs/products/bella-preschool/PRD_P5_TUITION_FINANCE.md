# P5 — Tuition & Finance

**Phase:** Commercial Viability  
**Priority:** HIGH — Schools need to collect money  
**Depends on:** P3 (Student, Enrollment)  
**Purpose:** Enable schools to manage tuition, fees, payments, receivables

---

## Overview

Schools must collect tuition to operate. This is not optional.

**Market standard capabilities:**
- Tuition plans (monthly/term/annual)
- Fee configuration
- Student billing
- Payment recording
- Outstanding balance tracking
- Basic financial reports

**Critical decision:** Reuse existing Bella Finance capabilities where compatible, do NOT build parallel accounting.

---

## Platform Reuse Check

**BEFORE implementing P5, inspect:**
1. Does Platform Core have Finance module?
2. Does it support:
   - Pricing/plans
   - Receivables
   - Payment recording
   - Balance tracking
3. Can Preschool extend it?

**If YES:** Extend Platform Finance  
**If NO:** Build minimal Preschool finance (with future extraction potential)

**Assumption for this PRD:** Platform may have some finance capability. Will reconcile during implementation.

---

## Capabilities

### P5.1 — Tuition Plans

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P5-001 | Tuition plan schema | System | Store plans | ❓ Check Platform | ✅ If not in Platform | ❌ | P0 | Schema exists |
| PRE-P5-002 | Create tuition plan | Admin | Define plan + price | ❓ | ✅ `createTuitionPlanAction` | ✅ Plan form | P0 | Can create monthly/term plans |
| PRE-P5-003 | Plan by age group | Admin | Link plan to age group | ❓ | ✅ Association logic | ✅ UI | P1 | Can set different rates by age |
| PRE-P5-004 | Plan by classroom | Admin | Link plan to classroom | ❓ | ✅ Association logic | ✅ UI | P1 | Can set rates by classroom |
| PRE-P5-005 | List plans | Admin | View all plans | ❓ | ✅ Query action | ✅ List page | P0 | Can see all tuition plans |
| PRE-P5-006 | Edit plan | Admin | Update plan details | ❓ | ✅ Update action | ✅ Edit form | P0 | Can modify plans |

**Schema needed (if not in Platform):**

```sql
preschool_tuition_plans (
  id, tenant_id,
  plan_name, plan_code,
  billing_cycle, -- 'monthly', 'term', 'annual'
  amount, currency,
  description,
  is_active,
  created_at, updated_at
)
```

---

### P5.2 — Student Billing

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P5-007 | Assign tuition to student | Admin | Link student to plan | ❓ | ✅ Assignment logic | ✅ Assignment UI | P0 | Can assign plan to student |
| PRE-P5-008 | Recurring charges | System | Auto-generate charges | ❓ | ✅ Recurring logic | ❌ | P0 | Charges generated per cycle |
| PRE-P5-009 | Additional fees | Admin | Add one-time fees | ❓ | ✅ `addFeeAction` | ✅ Fee form | P0 | Can add registration/activity fees |
| PRE-P5-010 | Meal charges | Admin | Charge for meals | ❓ | ✅ Meal pricing + charge logic | ✅ UI | P1 | Can charge for meal services |
| PRE-P5-011 | Service charges | Admin | Charge for services | ❓ | ✅ Generic charge action | ✅ UI | P1 | Can add custom charges |
| PRE-P5-012 | Discounts | Admin | Apply discount to student | ❓ | ✅ Discount logic | ✅ Discount UI | P1 | Can apply sibling/scholarship discounts |
| PRE-P5-013 | Waivers | Admin | Waive fees | ❓ | ✅ Waiver logic | ✅ Waiver UI | P2 | Can waive fees with reason |

**Schema needed:**

```sql
preschool_student_tuition (
  id, tenant_id, student_id, tuition_plan_id,
  start_date, end_date,
  discount_percent, discount_reason,
  is_active,
  created_at, updated_at
)

preschool_charges (
  id, tenant_id, student_id,
  charge_type, -- 'tuition', 'fee', 'meal', 'service'
  charge_date, due_date,
  amount, currency,
  description,
  status, -- 'pending', 'paid', 'overdue', 'waived'
  created_at, updated_at
)
```

---

### P5.3 — Payment & Receivables

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P5-014 | Record payment | Admin | Log payment received | ❓ Check Platform | ✅ `recordPaymentAction` | ✅ Payment form | P0 | Can record payments |
| PRE-P5-015 | Payment methods | Admin | Cash/bank transfer/card | ❓ | ✅ Payment method enum | ✅ Method select | P0 | Can specify payment method |
| PRE-P5-016 | View receivables | Admin | See unpaid charges | ❓ | ✅ Receivables query | ✅ Receivables page | P0 | Can see outstanding balances |
| PRE-P5-017 | Student balance | Admin, Parent | See student's balance | ❓ | ✅ Balance calculation | ✅ Balance display | P0 | Can see balance per student |
| PRE-P5-018 | Payment history | Admin, Parent | View past payments | ❓ | ✅ Payment query | ✅ History view | P0 | Can see payment records |
| PRE-P5-019 | Overdue tracking | System | Mark overdue charges | ❓ | ✅ Overdue logic | ✅ Overdue indicator | P1 | Overdue charges highlighted |
| PRE-P5-020 | Receipt generation | System | Generate receipt | ❓ Check Platform | ✅ Receipt template | ✅ Print/PDF | P1 | Can generate receipts |
| PRE-P5-021 | Invoice (if needed) | System | Generate invoice | ❓ | ✅ Invoice template | ✅ Print/PDF | P2 | Can generate invoices |

**Schema needed:**

```sql
preschool_payments (
  id, tenant_id, student_id,
  payment_date, amount, currency,
  payment_method, -- 'cash', 'bank_transfer', 'card', 'online'
  reference_number,
  notes,
  recorded_by_user_id,
  created_at, updated_at
)

preschool_payment_allocations (
  id, tenant_id, payment_id, charge_id,
  allocated_amount,
  created_at
)
```

---

### P5.4 — Financial Reports

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P5-022 | Revenue report | Admin | See revenue by period | ❓ | ✅ Revenue query | ✅ Report page | P0 | Can see total revenue |
| PRE-P5-023 | Receivables report | Admin | See outstanding amounts | ❓ | ✅ Receivables summary | ✅ Report widget | P0 | Can see total receivables |
| PRE-P5-024 | Payment collection | Admin | See payments received | ❓ | ✅ Payment summary | ✅ Report widget | P0 | Can see collections |
| PRE-P5-025 | Student financial status | Admin | See each student's status | ❓ | ✅ Student finance query | ✅ Status view | P0 | Can see per-student balances |
| PRE-P5-026 | Financial dashboard | Admin | Overview of finances | ❓ | ✅ Dashboard stats | ✅ Dashboard widget | P1 | Can see financial summary |

---

## Platform Finance Reconciliation

**CRITICAL:** Before implementing, check if Platform has:

### Potential Platform Capabilities

1. **Bella Finance Kernel (if exists):**
   - Ledger system
   - Cash management
   - Receivables tracking
   - Payment recording

2. **Spa Finance (if exists):**
   - Package pricing
   - Service charges
   - Payment collection
   - May be reusable

**Reconciliation steps:**
1. Inspect `src/platform/finance/` or similar
2. Inspect `src/spa-kernel/finance/` or similar
3. Check for existing `payments`, `receivables`, `charges` tables
4. Check for existing pricing/plan infrastructure

**Decision matrix:**

| Platform Capability | Reuse Strategy |
|---------------------|----------------|
| Payment recording exists | ✅ Reuse, extend with preschool context |
| Receivables tracking exists | ✅ Reuse, link to preschool_students |
| Pricing plans exist | ✅ Extend for tuition plans |
| Ledger exists | ✅ Reuse, do NOT duplicate accounting |
| Nothing exists | ❌ Build minimal preschool finance |

**If building new:** Mark as `EXTRACTION_CANDIDATE` for future Finance Kernel.

---

## Parent Visibility

**P5 data visible in P6 Parent Experience:**
- Outstanding balance
- Payment history
- Upcoming charges
- Receipts

**Authorization:** Parents see only their own children's financial data.

---

## Implementation Order

**Priority 0 (Critical):**
1. **Platform reconciliation** — Check what exists
2. Tuition plan CRUD
3. Assign tuition to student
4. Generate charges (manual or recurring)
5. Record payment
6. View receivables
7. Student balance display
8. Payment history

**Priority 1:**
9. Additional fees
10. Discounts
11. Overdue tracking
12. Receipt generation
13. Financial reports
14. Dashboard widget

**Priority 2:**
15. Invoice generation (if needed)
16. Meal charges (if separate from tuition)
17. Waivers

---

## Acceptance Criteria (P5 Complete)

### Functional
- ✅ Can create tuition plans
- ✅ Can assign plans to students
- ✅ Can generate charges
- ✅ Can record payments
- ✅ Can view outstanding balances
- ✅ Can see payment history
- ✅ Basic financial reports work
- ✅ Receipts generated (if P1)

### Non-Functional
- ✅ RLS enforced (tenant + parent isolation)
- ✅ Payment records audit-trailed
- ✅ Balance calculations correct
- ✅ No duplicate accounting if Platform Finance exists

### Demo-Ready
- ✅ Can demonstrate tuition workflow
- ✅ Can show financial dashboard to prospects
- ✅ Looks like a commercial product (not hobby project)

### Evidence
- ✅ Platform reuse documented
- ✅ Financial calculations tested
- ✅ Payment recording tested
- ✅ Balance calculations verified
- ✅ Parent visibility verified (when P6 built)

---

## Risk: Accounting Complexity

**Do NOT build full accounting system.**

Scope limited to:
- Tuition billing
- Payment recording
- Balance tracking
- Basic reports

**Out of scope:**
- Double-entry bookkeeping
- Full GL
- Advanced financial reporting
- Tax management
- Integration with external accounting software (unless simple export)

If customer needs deep accounting, use Platform Finance or integrate with external system.

---

## EXTRACTION_CANDIDATE

If Platform Finance doesn't exist and Preschool builds:
- Payment recording
- Receivables tracking
- Basic billing

Then mark for extraction to **Finance Kernel** after validating with other products.

**NOT NOW.** Build for Preschool, extract later if pattern repeats.

---

## Next Phase

After P5 complete → **P6: Parent Experience**

P6 consumes P3 (Student/Attendance), P4 (Daily Care), P5 (Tuition) data.
