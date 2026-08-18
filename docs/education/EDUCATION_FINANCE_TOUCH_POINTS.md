# Education Finance Touch Points
**Phase:** 2 — Education Discovery  
**Date:** 2026-08-18  
**Status:** IN PROGRESS  
**Objective:** Map detailed financial events from Education business processes

---

## Touch Point Analysis Method

**For each Education business event:**
1. What is the Education event?
2. Source entity?
3. Financial consequence (potential)?
4. Financial Intent candidate?
5. Finance subsystem involved?
6. Accounting treatment: Known / Potential / UNKNOWN
7. Idempotency/provenance requirement?
8. Product Definition dependency?

**NOT doing:**
- ❌ Deciding accounting treatment (if UNKNOWN)
- ❌ Designing adapters
- ❌ Creating journal entry logic
- ❌ Assuming policies not documented

---

## Touch Point #1: Student Enrollment

### Education Event

**Business Action:** Student enrolls in a course

**Source Entity:** `students` table
```sql
INSERT INTO students (
  tenant_id, user_id, course_id,
  full_name, phone, email,
  enrollment_status,  -- 'active'
  tuition_total,      -- NUMERIC
  tuition_paid,       -- 0
  enrolled_at         -- DATE
)
```

**Trigger:** User action (admin enrolls student) or self-registration

**Frequency:** Per student per course (one-time per enrollment)

**Cardinality:** Many students → Many courses (many-to-many via students table)

---

### Financial Consequence (Potential)

**Hypothesis #1: Revenue Obligation Created**
- Entity: Accounts Receivable
- Amount: `tuition_total`
- Accounting treatment: DR AR, CR Deferred Revenue

**Hypothesis #2: No Immediate Financial Effect**
- Revenue recognized only on payment (cash basis)
- Enrollment is operational milestone, not financial

**Hypothesis #3: Deferred Revenue Only**
- No AR until invoice issued
- Enrollment creates future revenue obligation

**Status:** 🔴 **UNKNOWN** — Requires Product Definition

**Questions:**
- Does enrollment create AR?
- Or AR created only when invoice issued?
- Is there revenue deferral period?
- Is tuition_total amount fixed at enrollment? Or can change?

---

### Financial Intent Candidate

**IF revenue obligation model:**
```typescript
FinancialIntent: "TUITION_OBLIGATION_CREATED"
{
  eventType: "REVENUE_OBLIGATION",
  industry: "EDUCATION",
  amount: tuition_total,
  currency: "VND", // or tenant default
  recognitionPolicy: UNKNOWN, // immediate | deferred | completion-based
  metadata: {
    studentId: UUID,
    courseId: UUID,
    enrolledAt: DATE,
    expectedCompletionDate: DATE?
  }
}
```

**IF no immediate financial effect:**
- No financial intent published at enrollment
- Financial intent only at payment or completion

---

### Finance Subsystem Involved

**Potential:**
- Accounts Receivable (if AR model)
- Deferred Revenue (if advance payment)
- Revenue Recognition (if recognition rule applies)

**NOT involved:**
- Cash (no cash movement at enrollment)
- AP (no payable created)

---

### Accounting Treatment

**Status:** 🔴 **UNKNOWN / PRODUCT-DEPENDENT**

**Possible treatments:**
1. **Accrual + Deferral:**
   - DR Accounts Receivable (tuition_total)
   - CR Deferred Revenue (tuition_total)

2. **No entry until payment:**
   - Memo only (off-balance-sheet obligation)
   - Entry at payment: DR Cash, CR Revenue

3. **Deferred revenue only (prepaid model):**
   - Entry only if advance payment received
   - DR Cash, CR Deferred Revenue

**Decision required:** Product Owner + Accounting Policy

---

### Idempotency Requirement

**Enrollment idempotency:**
- UNIQUE constraint: `(user_id, course_id)`
- Cannot enroll same student in same course twice
- Re-enrollment after withdrawal: New student record? Or status update?

**Financial implication:**
- If financial intent published: Must be idempotent per enrollment
- Key: `studentId` or `(userId, courseId, enrolledAt)`

**Provenance:**
- Education OS owns enrollment lifecycle
- Finance OS receives financial intent (if applicable)
- Finance must NOT re-create AR if enrollment event re-processed

---

### Product Definition Dependency

**High dependency:**
- Revenue recognition policy: UNKNOWN
- AR creation timing: UNKNOWN
- Tuition amount fixation: UNKNOWN
- Refund policy (affects revenue deferral): UNKNOWN

**Cannot design contract without these decisions.**

---

## Touch Point #2: Tuition Payment

### Education Event

**Business Action:** Student makes tuition payment

**Source Entity:** `student_tuition_payments` table
```sql
INSERT INTO student_tuition_payments (
  tenant_id, student_id,
  amount,           -- NUMERIC (CHECK > 0)
  payment_method,   -- 'cash' | 'bank_transfer' | ...
  payment_status,   -- 'recorded' | 'voided'
  paid_at,          -- TIMESTAMPTZ
  recorded_by,      -- user_id
  receipt_number    -- TEXT (UNIQUE per tenant)
)
```

**Also updates:** `students.tuition_paid` (running total)

**Trigger:** Payment recorded by staff or system (bank integration?)

**Frequency:** Multiple payments per student (installment model likely)

---

### Financial Consequence (Potential)

**Hypothesis #1: Cash Receipt + AR Reduction**
- DR Cash (`amount`)
- CR Accounts Receivable (`amount`)

**Hypothesis #2: Cash Receipt + Revenue Recognition**
- DR Cash (`amount`)
- CR Tuition Revenue (`amount`)
- (No AR model, cash-basis recognition)

**Hypothesis #3: Cash Receipt + Deferred Revenue Reduction**
- DR Cash (`amount`)
- CR Deferred Revenue (`amount`)
- (Advance payment model, revenue recognized separately)

**Status:** 🟡 **PARTIALLY KNOWN**

**Known:**
- Cash receipt occurs (payment_method indicates cash type)
- Amount: `amount` field

**Unknown:**
- Does payment reduce AR? Or recognize revenue? Or reduce deferred revenue?
- Depends on revenue recognition policy (Touch Point #1 dependency)

---

### Financial Intent Candidate

```typescript
FinancialIntent: "TUITION_PAYMENT_RECEIVED"
{
  eventType: "CASH_RECEIPT",
  subType: "TUITION_PAYMENT",
  industry: "EDUCATION",
  amount: amount,
  currency: "VND",
  paymentMethod: payment_method, // 'cash' | 'bank_transfer' | ...
  paidAt: paid_at,
  receiptNumber: receipt_number, // Idempotency key
  metadata: {
    studentId: student_id,
    courseId: ?, // May need JOIN to students table
    recordedBy: recorded_by
  }
}
```

**Idempotency:** `receipt_number` (UNIQUE per tenant)

**Provenance:** Education OS records payment → Finance OS posts to GL

---

### Finance Subsystem Involved

**Definite:**
- Cash (cash receipt)
- Ledger (GL posting)

**Conditional:**
- AR (if payment reduces AR)
- Revenue (if payment triggers recognition)
- Deferred Revenue (if payment reduces liability)

---

### Accounting Treatment

**Status:** 🟡 **DEPENDS ON REVENUE POLICY**

**Scenario A: AR Model**
```
DR Cash (amount)
CR Accounts Receivable (amount)
```
Revenue recognized separately (on completion? pro-rated?)

**Scenario B: Cash-Basis Recognition**
```
DR Cash (amount)
CR Tuition Revenue (amount)
```
No AR, no deferral.

**Scenario C: Deferred Revenue Model**
```
DR Cash (amount)
CR Deferred Revenue (amount)
```
Revenue recognized later (graduation? course completion?)

**Decision required:** Accounting Policy

---

### Idempotency Requirement

**Payment idempotency:**
- `receipt_number` is UNIQUE per tenant
- Finance must NOT post duplicate journal if event re-processed
- Idempotency key: `receipt_number` (or combination with `tenant_id`)

**Provenance:**
- Education OS: Source of truth for payment record
- Finance OS: Source of truth for GL posting
- Contract must specify: "If receipt_number already posted, reject with IDEMPOTENT response"

---

### Product Definition Dependency

**Medium dependency:**
- Revenue recognition policy: Affects CR account (AR? Revenue? Deferred Revenue?)
- Payment allocation rules: If student owes multiple courses, how to allocate?
- Overpayment handling: What if `tuition_paid > tuition_total`?

---

## Touch Point #3: Enrollment Status Change → Graduated

### Education Event

**Business Action:** Student completes course

**Source Entity:** `students` table
```sql
UPDATE students
SET
  enrollment_status = 'graduated',
  graduated_at = CURRENT_DATE
WHERE id = $studentId
```

**Trigger:** Admin marks student as graduated (or automated on completion criteria)

**Frequency:** Once per enrollment

---

### Financial Consequence (Potential)

**Hypothesis #1: Revenue Recognition**
- IF deferred revenue model: DR Deferred Revenue, CR Tuition Revenue
- Amount: `tuition_total` (or pro-rated if partial payment?)

**Hypothesis #2: No Immediate Financial Effect**
- Revenue already recognized at payment (cash-basis)
- Graduation is operational milestone only

**Hypothesis #3: AR Write-Off (if unpaid)**
- IF AR model AND student graduates with unpaid balance
- DR Bad Debt Expense, CR AR
- Or: Leave AR outstanding (collection continues)

**Status:** 🔴 **UNKNOWN / PRODUCT-DEPENDENT**

**Questions:**
- Does graduation trigger revenue recognition?
- What if student graduates with unpaid tuition? (tuition_paid < tuition_total)
- Is unpaid balance forgiven? Collected post-graduation? Written off?

---

### Financial Intent Candidate

**IF graduation triggers revenue recognition:**
```typescript
FinancialIntent: "TUITION_REVENUE_EARNED"
{
  eventType: "REVENUE_RECOGNITION",
  industry: "EDUCATION",
  amount: tuition_total, // or (tuition_total - already_recognized)?
  currency: "VND",
  recognitionDate: graduated_at,
  metadata: {
    studentId: student_id,
    courseId: course_id,
    enrolledAt: enrolled_at,
    graduatedAt: graduated_at,
    tuitionTotal: tuition_total,
    tuitionPaid: tuition_paid,
    unpaidBalance: tuition_total - tuition_paid
  }
}
```

**IF no immediate effect:** No financial intent published.

---

### Finance Subsystem Involved

**Potential:**
- Deferred Revenue (if revenue deferred until graduation)
- Revenue (recognition triggered)
- AR (if unpaid balance handling required)

---

### Accounting Treatment

**Status:** 🔴 **UNKNOWN / PRODUCT-DEPENDENT**

**Scenario A: Deferred Revenue → Revenue**
```
DR Deferred Revenue (tuition_total)
CR Tuition Revenue (tuition_total)
```

**Scenario B: No Entry (Cash-Basis)**
- Revenue already recognized at payment
- Graduation has no GL effect

**Scenario C: AR Write-Off (Unpaid Balance)**
```
DR Bad Debt Expense (tuition_total - tuition_paid)
CR Accounts Receivable (tuition_total - tuition_paid)
```

**Decision required:** Revenue Recognition Policy + Bad Debt Policy

---

### Idempotency Requirement

**Graduation idempotency:**
- Status change is idempotent (`enrollment_status` field update)
- Cannot graduate twice (status already 'graduated')

**Financial implication:**
- If financial intent published: Idempotent per `studentId`
- Finance must NOT recognize revenue twice for same graduation

---

### Product Definition Dependency

**High dependency:**
- Revenue recognition timing: CRITICAL
- Unpaid balance policy: CRITICAL
- Bad debt write-off rules: CRITICAL

**Cannot design contract without these policies.**

---

## Touch Point #4: Enrollment Status Change → Withdrawn

### Education Event

**Business Action:** Student withdraws before course completion

**Source Entity:** `students` table
```sql
UPDATE students
SET enrollment_status = 'withdrawn'
WHERE id = $studentId
```

**Trigger:** Student request or admin action

**Frequency:** Rare (but financially significant)

---

### Financial Consequence (Potential)

**Hypothesis #1: Refund Liability Created**
- IF refund policy allows refund
- DR Tuition Revenue (or Deferred Revenue), CR Refund Liability
- Amount: TBD (full refund? pro-rated? forfeiture?)

**Hypothesis #2: Revenue Forfeiture**
- Tuition retained (no refund policy)
- No financial adjustment
- `tuition_paid` remains as earned revenue

**Hypothesis #3: AR Write-Off (Unpaid Balance)**
- IF AR model AND unpaid balance exists
- DR Bad Debt Expense, CR AR
- Student no longer obligated to pay

**Status:** 🔴 **UNKNOWN / PRODUCT-DEPENDENT**

**Questions:**
- What is refund policy?
- Is refund full, pro-rated, or none?
- Does refund depend on withdrawal timing? (e.g., before week 3 = full refund)
- What happens to unpaid AR balance?

---

### Financial Intent Candidate

**IF refund policy exists:**
```typescript
FinancialIntent: "TUITION_REFUND_DUE"
{
  eventType: "REFUND_LIABILITY",
  industry: "EDUCATION",
  amount: refund_amount, // Calculate based on policy
  currency: "VND",
  refundReason: "STUDENT_WITHDRAWAL",
  metadata: {
    studentId: student_id,
    courseId: course_id,
    enrolledAt: enrolled_at,
    withdrawnAt: CURRENT_DATE,
    tuitionTotal: tuition_total,
    tuitionPaid: tuition_paid,
    refundPolicy: ?, // 'FULL' | 'PRORATED' | 'FORFEITURE'
    daysElapsed: ?
  }
}
```

**IF no refund (forfeiture model):** No financial intent (or intent with `refund_amount = 0`).

---

### Finance Subsystem Involved

**Potential:**
- Refund Liability (if refund due)
- Cash (if refund paid)
- AR (if unpaid balance write-off)
- Revenue (if revenue reversal)

---

### Accounting Treatment

**Status:** 🔴 **UNKNOWN / PRODUCT-DEPENDENT**

**Scenario A: Full Refund**
```
DR Tuition Revenue (tuition_paid)
CR Refund Liability (tuition_paid)

When refund paid:
DR Refund Liability (tuition_paid)
CR Cash (tuition_paid)
```

**Scenario B: Pro-Rated Refund**
```
Earned = (days_completed / total_days) * tuition_total
Refund = tuition_paid - Earned

DR Tuition Revenue (Refund)
CR Refund Liability (Refund)
```

**Scenario C: Forfeiture (No Refund)**
```
No entry (revenue retained)
```

**Decision required:** Refund Policy

---

### Idempotency Requirement

**Withdrawal idempotency:**
- Status change is idempotent
- Cannot withdraw twice

**Financial implication:**
- If refund intent published: Idempotent per `studentId`
- Finance must NOT create duplicate refund liability

---

### Product Definition Dependency

**Critical dependency:**
- Refund policy: CRITICAL (full? pro-rated? forfeiture?)
- Withdrawal timing rules: CRITICAL (affects refund calculation)
- Unpaid balance handling: CRITICAL (write off? collect?)

**Cannot design contract without refund policy.**

---

## Touch Point #5: Payment Voiding

### Education Event

**Business Action:** Payment marked as voided

**Source Entity:** `student_tuition_payments` table
```sql
UPDATE student_tuition_payments
SET payment_status = 'voided'
WHERE id = $paymentId
```

**Also updates:** `students.tuition_paid` (reversed?)

**Trigger:** Error correction, fraud detection, or refund processing

**Frequency:** Rare (exception handling)

---

### Financial Consequence (Potential)

**Hypothesis #1: Cash Receipt Reversal**
- DR AR (or Deferred Revenue), CR Cash
- Restores pre-payment state

**Hypothesis #2: Refund Processing**
- Void represents refund to student
- DR Refund Liability, CR Cash

**Status:** 🟡 **DEPENDS ON VOID REASON**

**Questions:**
- Why is payment voided? (error? refund? fraudulent?)
- Does void trigger cash refund? Or just reverses GL entry?
- Is voiding same as refund? Or different process?

---

### Financial Intent Candidate

```typescript
FinancialIntent: "TUITION_PAYMENT_VOIDED"
{
  eventType: "CASH_RECEIPT_REVERSAL",
  industry: "EDUCATION",
  amount: amount, // Original payment amount
  currency: "VND",
  voidReason: "ERROR" | "REFUND" | "FRAUD",
  originalReceiptNumber: receipt_number,
  voidedAt: CURRENT_TIMESTAMP,
  metadata: {
    studentId: student_id,
    originalPaymentId: id,
    recordedBy: ?
  }
}
```

---

### Finance Subsystem Involved

**Definite:**
- Cash (reversal or refund)
- Ledger (reversing entry)

**Conditional:**
- AR (if AR model)
- Revenue (if revenue reversal)
- Deferred Revenue (if deferred model)

---

### Accounting Treatment

**Status:** 🟡 **DEPENDS ON ORIGINAL TREATMENT + VOID REASON**

**Scenario A: Error Correction (Reverse Entry)**
```
Original entry:
  DR Cash, CR AR

Reversal:
  DR AR, CR Cash
```

**Scenario B: Refund (Liability Model)**
```
DR Refund Liability
CR Cash
(Assumes refund liability already created at withdrawal)
```

**Decision required:** Void reason taxonomy + Refund process

---

### Idempotency Requirement

**Void idempotency:**
- Payment already voided → no-op
- `payment_status = 'voided'` is idempotent

**Financial implication:**
- Reversal entry must be idempotent
- Key: `originalReceiptNumber` or `paymentId`

---

### Product Definition Dependency

**Medium dependency:**
- Void reason classification: Needed for correct accounting treatment
- Refund process: If void = refund, need refund workflow

---

## Touch Point #6: Trainer Compensation (Potential)

### Education Event

**Business Action:** Training class completed

**Source Entity:** `training_classes` table
```sql
UPDATE training_classes
SET status = 'completed'
WHERE id = $classId
```

**Linked entity:** `training_classes.trainer_id` (references `users`)

**Trigger:** Class end time reached or admin marks complete

**Frequency:** Per class session

---

### Financial Consequence (Potential)

**Hypothesis #1: Instructor Cost Accrual**
- DR Instructor Expense
- CR Accrued Instructor Payable
- Amount: Based on compensation rule (per-class? per-hour? salary?)

**Hypothesis #2: No Direct Financial Effect**
- Instructor compensation flows through HR/Payroll module
- Not direct Education → Finance integration
- Education tracks class completion; Payroll calculates compensation

**Status:** 🔴 **UNKNOWN**

**Questions:**
- Are trainers employees (payroll) or contractors (AP)?
- Is compensation calculated per-class? Per-hour? Monthly salary?
- Does Education OS trigger payment? Or separate process?
- Is there compensation tracking in Education OS? (Not visible in schema)

---

### Financial Intent Candidate

**IF Education triggers compensation:**
```typescript
FinancialIntent: "INSTRUCTOR_SERVICE_COMPLETED"
{
  eventType: "EXPENSE_ACCRUAL",
  subType: "INSTRUCTOR_COMPENSATION",
  industry: "EDUCATION",
  amount: ?, // Calculated how?
  currency: "VND",
  metadata: {
    trainerId: trainer_id,
    classId: class_id,
    classType: class_type,
    duration: ends_at - starts_at,
    compensationRule: ?
  }
}
```

**IF separate Payroll process:** No financial intent from Education for trainer cost.

---

### Finance Subsystem Involved

**Potential:**
- Accounts Payable (if contractor model)
- Payroll (if employee model)
- Expense (instructor cost recognition)

**Likely:** Separate from Education-Finance integration (HR/Payroll domain)

---

### Accounting Treatment

**Status:** 🔴 **UNKNOWN / LIKELY OUT OF SCOPE**

**IF in scope:**
```
DR Instructor Expense
CR Accrued Compensation Payable
```

**IF out of scope:**
- Handled by HR/Payroll module
- Not Education-Finance integration concern

**Decision required:** Is trainer compensation part of Education-Finance scope?

---

### Product Definition Dependency

**High dependency (IF in scope):**
- Compensation calculation rules: CRITICAL
- Employee vs. contractor classification: CRITICAL
- Payment timing: CRITICAL

**Likely:** OUT OF SCOPE for Education-Finance Integration v1.1

**Recommendation:** Defer to separate HR/Payroll-Finance integration (if needed)

---

## Summary: Financial Touch Points

| # | Touch Point | Status | Financial Intent | Accounting Treatment | Dependencies |
|---|------------|--------|------------------|---------------------|--------------|
| 1 | Enrollment | 🔴 UNKNOWN | Revenue obligation? | AR + Deferred Revenue? | Revenue policy |
| 2 | Payment | 🟡 PARTIAL | Cash receipt ✅ | AR? Revenue? Deferred? | Revenue policy |
| 3 | Graduated | 🔴 UNKNOWN | Revenue recognition? | Deferred → Revenue? | Revenue policy |
| 4 | Withdrawn | 🔴 UNKNOWN | Refund liability? | Revenue reversal? | Refund policy |
| 5 | Void Payment | 🟡 PARTIAL | Reversal ✅ | Reverse original entry | Void reason |
| 6 | Trainer Cost | 🔴 UNKNOWN | Expense accrual? | AP? Payroll? | Compensation model |

---

## Key Findings

### Definite Financial Events

**Clear:**
1. **Payment received** - Cash receipt (Touch Point #2)
2. **Payment voided** - Cash receipt reversal (Touch Point #5)

**These can proceed to contract design (Phase 3) with HIGH confidence.**

---

### UNKNOWN Financial Events

**Blocked on Product Definition:**
1. **Enrollment** - AR creation? Revenue deferral? (Touch Point #1)
2. **Graduation** - Revenue recognition trigger? (Touch Point #3)
3. **Withdrawal** - Refund policy? (Touch Point #4)

**Cannot design contract until Product Owner provides:**
- Revenue recognition policy
- Accounts Receivable model (or cash-only)
- Refund policy (full / pro-rated / forfeiture)
- Bad debt policy (unpaid balances)

---

### Out of Scope (Likely)

**Trainer compensation** - Likely HR/Payroll domain, not Education-Finance integration v1.1

**Recommendation:** Focus Education-Finance v1.1 on **Tuition Revenue Cycle** only.

---

## Idempotency Strategy

**All financial intents must be idempotent:**

| Touch Point | Idempotency Key | Provenance |
|------------|----------------|-----------|
| Enrollment | `studentId` or `(userId, courseId, enrolledAt)` | Education OS |
| Payment | `receipt_number` (UNIQUE per tenant) | Education OS |
| Graduated | `studentId` (status change) | Education OS |
| Withdrawn | `studentId` (status change) | Education OS |
| Void Payment | `paymentId` or `receipt_number` | Education OS |

**Finance OS responsibility:**
- Check idempotency key before posting
- Reject duplicate with `IDEMPOTENT` response
- Maintain idempotency registry (Finance Outbox pattern from H1.1)

---

## Phase 2 Next Steps

**Completed:**
1. ✅ DOMAIN_DISCOVERY.md
2. ✅ TOUCH_POINTS.md (this document)

**Remaining:**
3. ⏳ RESPONSIBILITY_MATRIX.md (Education vs. Integration vs. Finance boundaries)

**Then:**
→ Phase 2 Evidence Review
→ Phase 2 COMPLETE
→ Stakeholder review of UNKNOWNs
→ Product Definition required
→ Phase 3: Contract Design (only after UNKNOWNs resolved)

---

**Status:** Phase 2 Touch Points Mapping COMPLETE  
**Blockers:** 3 critical UNKNOWNs require Product Definition before Phase 3  
**Next:** Create RESPONSIBILITY_MATRIX.md to clarify boundaries
